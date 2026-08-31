import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AppStateProvider, migrateConfiguration } from "../state/AppState";
import { calendarDuties, careHours, fixedNightHours, prepareConfigurationForApi } from "../nightDuties";
import { configurationFixture } from "./fixture";
import { getRuleGuidance } from "../help";
import { createDeviceTransferPackage, parseDeviceTransferPackage, serializeDeviceTransferPackage } from "../transfer";

const key = "harmonogram-mow-configuration-v3";
const recurring = { id:"R", educatorId:"A", groupId:"G1", dayOfWeek:2, startTime:"06:00", endTime:"08:00", description:"Obowiązkowy" };

describe("wspólny kalendarz pracy", () => {
  it("dolicza noc raz, nie zmieniając opieki, nazwisk ani dostępności", () => {
    const old = { ...structuredClone(configurationFixture), workRulesVersion:1, planningHorizonWeeks:6,
      recurringNightDuties:[{id:"N", educatorId:"A", startDayOfWeek:1, description:"Noc"}] };
    const before = structuredClone(old);
    const next = migrateConfiguration(old);
    expect(old).toEqual(before);
    expect(next.groupMemberships[0].weeklyTargetHoursByWeek).toEqual(Array(6).fill(35.5));
    expect(careHours(next, next.groupMemberships[0], 0)).toBe(27.5);
    expect(fixedNightHours(next, next.groupMemberships[0], 0)).toBe(8);
    expect(next.educators.map(e => e.displayName)).toEqual(old.educators.map(e => e.displayName));
    expect(next.unavailability).toEqual(old.unavailability);
    expect(migrateConfiguration(next)).toEqual(next);
  });

  it("przenosi wszystkie nowe wpisy na telefon bez ponownego doliczania nocy", () => {
    const config = migrateConfiguration({...configurationFixture,
      recurringRequiredDuties:[recurring], recurringSchoolWork:[{...recurring,id:"S",startTime:"08:10",endTime:"13:45"}],
      recurringNightDuties:[{id:"N",educatorId:"A",startDayOfWeek:1,description:"N"}]});
    const loaded = parseDeviceTransferPackage(serializeDeviceTransferPackage(createDeviceTransferPackage(config,"https://example.test")));
    expect(migrateConfiguration(loaded.configuration)).toEqual(config);
  });

  it("rozwija obowiązkowy dyżur i szkołę bez doliczania szkoły do godzin grupy", () => {
    const config = migrateConfiguration({...configurationFixture,planningHorizonWeeks:2,
      recurringRequiredDuties:[recurring],recurringSchoolWork:[{...recurring,id:"S",startTime:"08:10",endTime:"13:45"}]});
    const api = prepareConfigurationForApi(config);
    expect(api.requiredAssignments).toHaveLength(2);
    expect(api.requiredAssignments?.[0]).toMatchObject({date:"2026-09-16",startMinute:360,endMinute:480,educatorId:"A"});
    expect(api.externalDutyAssignments[0]).toMatchObject({dutyType:"SCHOOL",countsTowardsHours:false,startDateTime:"2026-09-16T06:10:00.000Z"});
    expect(api).not.toHaveProperty("recurringSchoolWork");
    expect(api).not.toHaveProperty("recurringRequiredDuties");
    expect(api.groupMemberships[0].weeklyTargetHoursByWeek[0]).toBe(27.5);
  });

  it("noc niedzielna zajmuje poniedziałek i nie obciąża nowego tygodnia drugi raz", () => {
    const config = migrateConfiguration({...configurationFixture,recurringNightDuties:[{id:"SUN",educatorId:"A",startDayOfWeek:6,description:"N"}]});
    const duties = calendarDuties(config);
    expect(duties.map(d => d.date)).toEqual(["2026-09-14","2026-09-20"]);
    expect(duties[0]).toMatchObject({startMinute:0,endMinute:360});
    expect(fixedNightHours(config,config.groupMemberships[0],0)).toBe(8);
    const prepared = prepareConfigurationForApi(config);
    expect(prepareConfigurationForApi(prepared).externalDutyAssignments).toEqual(prepared.externalDutyAssignments);
  });

  it("zachowuje prywatną kopię oryginału przed pierwszym zapisem migracji", () => {
    const old = {...configurationFixture,workRulesVersion:2};
    const previousResult = {generationStatus:"CANDIDATE_FOUND",validationReport:{validatorVersion:"2.0.0"}};
    localStorage.setItem(key,JSON.stringify(old));
    localStorage.setItem("harmonogram-mow-generation-v3",JSON.stringify(previousResult));
    render(<MemoryRouter><AppStateProvider><App /></AppStateProvider></MemoryRouter>);
    const backup = JSON.parse(localStorage.getItem(`${key}-before-work-calendar-v3-TEST`)!);
    expect(backup.configuration).toEqual(old);
    expect(backup.generation).toEqual(previousResult);
    expect(JSON.parse(localStorage.getItem(key)!).workRulesVersion).toBe(3);
  });

  it("brak miejsca na kopię nie nadpisuje oryginalnych danych", () => {
    const old = {...configurationFixture,workRulesVersion:1};
    localStorage.setItem(key,JSON.stringify(old));
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(this: Storage,k,v) {
      if (k.includes("before-work-calendar")) throw new DOMException("Full","QuotaExceededError");
      return original.call(this,k,v);
    });
    try {
      render(<MemoryRouter><AppStateProvider><App /></AppStateProvider></MemoryRouter>);
      expect(screen.getByText(/Brak miejsca na bezpieczną kopię/)).toBeVisible();
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual(old);
    } finally { spy.mockRestore(); }
  });

  it("dodaje i poprawia obowiązkowy dyżur bez zmiany wymiaru", async () => {
    localStorage.setItem(key,JSON.stringify(configurationFixture));
    render(<MemoryRouter initialEntries={["/wychowawcy"]}><AppStateProvider><App /></AppStateProvider></MemoryRouter>);
    const user = userEvent.setup();
    const area = within(document.getElementById("stale-dyzury")!);
    await user.selectOptions(area.getByLabelText("Obowiązkowy dyżur w internacie: wychowawca"),"A");
    await user.type(area.getByLabelText("Obowiązkowy dyżur w internacie: od"),"06:00");
    await user.type(area.getByLabelText("Obowiązkowy dyżur w internacie: do"),"08:00");
    await user.click(area.getByRole("button",{name:"Dodaj na każdy tydzień"}));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!).recurringRequiredDuties).toHaveLength(1));
    expect(JSON.parse(localStorage.getItem(key)!).groupMemberships[0].weeklyTargetHoursByWeek[0]).toBe(27.5);
    await user.click(area.getByRole("button",{name:"Popraw godziny"}));
    await user.selectOptions(area.getByLabelText("Obowiązkowy dyżur w internacie: dzień"),"3");
    await user.click(area.getByRole("button",{name:"Zapisz poprawione godziny"}));
    expect(JSON.parse(localStorage.getItem(key)!).recurringRequiredDuties).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(key)!).recurringRequiredDuties[0].dayOfWeek).toBe(3);
  });

  it("prowadzi do obowiązkowego dyżuru zamiast do ogólnej pomocy", () => {
    expect(getRuleGuidance({ruleId:"REQ-REQUIRED-DUTY-001",severity:"ERROR",message:"Zmień godziny",context:{},groupId:"G1"}).actionTo).toBe("/wychowawcy?grupa=G1#stale-dyzury");
  });
});
