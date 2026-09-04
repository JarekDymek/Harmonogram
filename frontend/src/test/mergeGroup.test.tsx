import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppStateProvider, migrateConfiguration } from "../state/AppState";
import { GroupImport } from "../components/GroupImport";
import { mergeGroupConfiguration } from "../mergeGroup";
import { configurationFixture } from "./fixture";
import { planInputs } from "../groupScope";
import { createProjectTransferPackage, serializeDeviceTransferPackage } from "../transfer";

function projects() {
  const current = migrateConfiguration(structuredClone(configurationFixture));
  current.groups[0].code = "VI";
  const source = structuredClone(current);
  source.groups[0].code = "VII";
  source.educators.forEach(e => {e.displayName = `Inna osoba ${e.id}`;});
  source.recurringNightDuties = [{id:"NIGHT", educatorId:"A", budgetGroupId:"G1",startDayOfWeek:2,description:"Noc"}];
  source.recurringRequiredDuties = [{id:"DUTY",groupId:"G1",educatorId:"B",dayOfWeek:0,startTime:"06:00",endTime:"08:00",description:"Stały"}];
  source.unavailability = [{id:"OFF",educatorId:"C",scope:"RECURRING_WEEKLY",dayOfWeek:0,startTime:"10:00",endTime:"12:00",type:"HARD",description:"Zajęcia"}];
  source.dayPlans = [{id:"PLAN",configurationVersionId:source.configurationVersionId,groupId:"G1",scope:"BASE_WEEKLY",dayOfWeek:0,operatingIntervals:[{id:"INTERVAL",startTime:"06:00",endTime:"22:00",description:""}],noCareIntervals:[],description:"",approved:true}];
  const assignments = [{id:"SA",educatorId:"A",startTime:"06:00",endTime:"22:00",sequenceNumber:1}];
  source.weekendVariants = [{id:"BASE",configurationVersionId:source.configurationVersionId,groupId:"G1",variantKind:"BASE",positionInCycle:1,approved:true,approvalReference:"Ref",approvedBy:"Test",approvedAt:"2026-09-04",saturdayTemplate:{id:"S",dayOfWeek:"SATURDAY",assignments},sundayTemplate:{id:"N",dayOfWeek:"SUNDAY",assignments:structuredClone(assignments)}}];
  source.weekendVariants.push({...structuredClone(source.weekendVariants[0]),id:"SUB",variantKind:"SUBSTITUTE",positionInCycle:null,replacesWeekendRotationVariantId:"BASE",applicableWeekNumber:1});
  return {current, source};
}

describe("bezpieczne dołączanie jednej grupy z pliku", () => {
  it("remapuje identyczne G1/A/B/C, powiązania i zastępstwa bez zmiany VI", () => {
    const {current,source} = projects(), before = structuredClone(current), originalSource = structuredClone(source);
    const merged = mergeGroupConfiguration(current,source), id = merged.activeGroupId;
    expect(current).toEqual(before); expect(source).toEqual(originalSource);
    expect(merged.groups.map(g => g.code)).toEqual(["VI","VII"]);
    expect(merged.selectedGroupIds).toEqual(["G1"]);
    expect(planInputs(merged,["G1"])).toBe(planInputs(current,["G1"]));
    const ids = merged.groupMemberships.filter(m => m.groupId === id).map(m => m.educatorId);
    expect(ids.every(e => !["A","B","C"].includes(e))).toBe(true);
    expect(merged.recurringNightDuties?.[0].budgetGroupId).toBe(id);
    expect(merged.recurringNightDuties?.[0].educatorId).toBe(ids[0]);
    expect(merged.recurringRequiredDuties?.[0].groupId).toBe(id);
    expect(merged.dayPlans[0].operatingIntervals[0].id).not.toBe("INTERVAL");
    const base = merged.weekendVariants.find(v => v.variantKind === "BASE")!;
    expect(merged.weekendVariants.find(v => v.variantKind === "SUBSTITUTE")!.replacesWeekendRotationVariantId).toBe(base.id);
    expect(base.saturdayTemplate.assignments[0].educatorId).toBe(ids[0]);
  });
  it("odmawia duplikatu grupy, wspólnej osoby i niezgodnych dat lub reguł", () => {
    const {current, source} = projects();
    expect(() => mergeGroupConfiguration(current,current)).toThrow("już istnieje");
    source.educators[0].displayName = current.educators[0].displayName;
    expect(() => mergeGroupConfiguration(current,source)).toThrow("W obu projektach");
    source.educators[0].displayName = "Inna osoba";
    source.cycleStartDate = "2026-09-07";
    expect(() => mergeGroupConfiguration(current,source)).toThrow("początek cyklu");
    source.cycleStartDate = current.cycleStartDate;
    source.organizationalRules.requiredWorkDaysPerWeek = 4;
    expect(() => mergeGroupConfiguration(current,source)).toThrow("Dni pracy — reguła placówki: projekt 5, plik 4");
  });
  it("podgląd niczego nie zapisuje, zatwierdzenie zachowuje kopię obu projektów", async () => {
    const {current,source} = projects();
    localStorage.setItem("harmonogram-mow-configuration-v3",JSON.stringify(current));
    render(<MemoryRouter><AppStateProvider><GroupImport hasUnsavedChanges={false}/></AppStateProvider></MemoryRouter>);
    const file = new File([serializeDeviceTransferPackage(createProjectTransferPackage(source,null,null))],"grupa.json",{type:"application/json"});
    await userEvent.upload(screen.getByLabelText("Plik grupy do dołączenia"),file);
    expect(JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!).groups).toHaveLength(1);
    await userEvent.click(await screen.findByRole("button",{name:"Dołącz dane grupy z pliku"}));
    expect(JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!).groups).toHaveLength(2);
    const backup = JSON.parse(localStorage.getItem("harmonogram-before-group-merge-v1")!);
    expect(backup.current.configuration.groups[0].code).toBe("VI");
    expect(backup.incoming.configuration.groups[0].code).toBe("VII");
  });
  it("nie dołącza, gdy zapis kopii bezpieczeństwa się nie udał", async () => {
    const {current,source} = projects();
    localStorage.setItem("harmonogram-mow-configuration-v3",JSON.stringify(current));
    render(<MemoryRouter><AppStateProvider><GroupImport hasUnsavedChanges={false}/></AppStateProvider></MemoryRouter>);
    await userEvent.upload(screen.getByLabelText("Plik grupy do dołączenia"),new File([serializeDeviceTransferPackage(createProjectTransferPackage(source,null,null))],"grupa.json",{type:"application/json"}));
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this:Storage,key,value) { if(key === "harmonogram-before-group-merge-v1") throw new Error("Brak miejsca na kopię"); original.call(this,key,value); });
    await userEvent.click(await screen.findByRole("button",{name:"Dołącz dane grupy z pliku"}));
    expect(screen.getByRole("status")).toHaveTextContent("Brak miejsca na kopię");
    expect(JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!).groups).toHaveLength(1);
    spy.mockRestore();
  });
});
