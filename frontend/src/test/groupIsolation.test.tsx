import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { App } from "../App";
import { AppStateProvider, migrateConfiguration } from "../state/AppState";
import { addBlankGroup, GROUP_CODES } from "../groups";
import { deriveWeekendMetadata } from "../weekendMetadata";
import { prepareConfigurationForApi } from "../nightDuties";
import { planInputs } from "../groupScope";
import { setupSteps } from "../readiness";
import { configurationFixture } from "./fixture";

function source() {
  const c = migrateConfiguration(structuredClone(configurationFixture));
  c.groups[0].code = "VI";
  c.groups[0].name = c.groupName = "Grupa VI";
  return c;
}
describe("izolacja danych kolejnych grup", () => {
  it("dodaje do ośmiu grup bez zmiany starych danych ani zakresu", () => {
    const original = source(), before = structuredClone(original);
    let next = original;
    for (const code of GROUP_CODES.filter(code => code !== "VI")) {
      next = addBlankGroup(next, code);
      expect(planInputs(next, original.selectedGroupIds)).toBe(planInputs(original, original.selectedGroupIds));
      expect(next.selectedGroupIds).toEqual(original.selectedGroupIds);
      const id = next.activeGroupId;
      expect(next.dayPlans.filter(p => p.groupId === id)).toHaveLength(7);
      expect(next.dayPlans.filter(p => p.groupId === id).every(p => !p.approved && !p.operatingIntervals.length && !p.noCareIntervals.length)).toBe(true);
      expect(next.weekendVariants.some(v => v.groupId === id)).toBe(false);
      expect(next.groupMemberships.filter(m => m.groupId === id).every(m => m.weeklyTargetHoursByWeek[0] === 0 && !m.fixedPartialSchedule)).toBe(true);
      expect(setupSteps({...next, selectedGroupIds:[id]}).filter(s => s.key.startsWith("staff") || s.key.startsWith("stay") || s.key.startsWith("weekends")).every(s => !s.ready)).toBe(true);
    }
    expect(next.groups).toHaveLength(8);
    expect(original).toEqual(before);
    expect(new Set(next.educators.map(e => e.id)).size).toBe(next.educators.length);
    expect(() => addBlankGroup(next, "VI")).toThrow();
  });
  it("odrzuca duplikaty i nie zmienia tożsamości VI przy dodaniu VII", () => {
    const c = source();
    expect(() => addBlankGroup(c, " vi ")).toThrow();
    const next = addBlankGroup(c, "VII");
    expect(next.groups.map(g => g.code)).toEqual(["VI", "VII"]);
    expect(next.groups[0]).toEqual(c.groups[0]);
    expect(next.educators.filter(e => c.educators.some(old => old.id === e.id))).toEqual(c.educators);
  });
  it("formularz nie ma liczbowego usuwania grup ani kopiowania cudzej konfiguracji", async () => {
    const c = source();
    const result = {generationStatus:"CANDIDATE_FOUND", publicResult:"POPRAWNY_TRYB_DEMONSTRACYJNY",
      assignments:[{groupId:c.groupId, educatorId:"A", date:c.cycleStartDate, startMinute:360, endMinute:480}],
      care:[], messages:[], validationReport:{status:"VALID", validatorVersion:"3.1.0"}};
    localStorage.setItem("harmonogram-mow-configuration-v3", JSON.stringify(c));
    localStorage.setItem("harmonogram-mow-generation-v3", JSON.stringify(result));
    render(<MemoryRouter initialEntries={["/konfiguracja"]}><AppStateProvider><App/></AppStateProvider></MemoryRouter>);
    expect(screen.queryByLabelText("Liczba grup w internacie")).toBeNull();
    expect(screen.queryByText("Skopiuj konfigurację do następnej grupy")).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Oznaczenie nowej grupy"), "VII");
    await userEvent.click(screen.getByRole("button", {name:"Dodaj pustą grupę"}));
    const saved = JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!);
    expect(saved.groups.map((g: {code:string}) => g.code)).toEqual(["VI","VII"]);
    expect(saved.selectedGroupIds).toEqual(c.selectedGroupIds);
    expect(JSON.parse(localStorage.getItem("harmonogram-mow-generation-v3")!)).toEqual(result);
  });
  it("wolne wynika z obsady również po dodaniu czwartej osoby i dla zastępstwa", () => {
    const c = source();
    const assignments = ["A","B"].map((educatorId,i) => ({id:String(i), educatorId, sequenceNumber:i+1, startTime:i ? "14:00":"06:00",endTime:i ? "22:00":"14:00"}));
    c.weekendVariants = [{id:"BASE",configurationVersionId:c.configurationVersionId,groupId:c.groupId,
      variantKind:"BASE",positionInCycle:1,approved:true,approvalReference:"test",approvedBy:"test",approvedAt:"2026-09-04T10:00:00Z",
      saturdayTemplate:{id:"SAT",dayOfWeek:"SATURDAY",assignments},
      sundayTemplate:{id:"SUN",dayOfWeek:"SUNDAY",assignments:structuredClone(assignments)}}];
    const first = c.weekendVariants[0];
    const work = first.saturdayTemplate.assignments[0].educatorId;
    first.offEducatorId = work;
    const correct = deriveWeekendMetadata(c, first);
    expect(correct.offEducatorId).not.toBe(work);
    c.educators.push({...c.educators[0], id:"D"});
    c.groupMemberships.push({...c.groupMemberships[0],id:"MEM-D",educatorId:"D",role:"SUPPORT"});
    expect(deriveWeekendMetadata(c, first).offEducatorId).toBeNull();
    first.variantKind = "SUBSTITUTE";
    expect(prepareConfigurationForApi(c).weekendVariants[0].offEducatorId).toBeNull();
    expect(first.offEducatorId).toBe(work); // Original export is never edited by request preparation.
  });
});
