import {render,screen,fireEvent} from "@testing-library/react";
import {describe,it,expect} from "vitest";
import {MemoryRouter} from "react-router-dom";
import {configurationFixture} from "./fixture";
import {productionProfile,verificationLocalInput} from "../productionProfile";
import userEvent from "@testing-library/user-event";
import {RulesPage} from "../pages/RulesPage";
import {AppStateProvider} from "../state/AppState";
import {generationMissing,setupSteps} from "../readiness";
import {RuleFields} from "../components/RuleFields";
import {SectionTiles} from "../components/SectionTiles";
import {HashFocus} from "../components/HashFocus";
import {ruleRisk} from "../ruleHelp";

describe("guided planning",()=>{
 it("keeps the local verification time stable on a save round trip",()=>{
  const input=verificationLocalInput("2026-09-04T10:15:00Z");
  expect(new Date(input).toISOString()).toBe("2026-09-04T10:15:00.000Z");
 });
 it("preserves draft fields while filling approval and explains each rule",async()=>{
  localStorage.setItem("harmonogram-mow-configuration-v3",JSON.stringify(configurationFixture));
  const user=userEvent.setup();
  const {container}=render(<MemoryRouter><AppStateProvider><RulesPage/></AppStateProvider></MemoryRouter>);
  const rest=screen.getByLabelText("Odpoczynek dobowy");
  await user.clear(rest);await user.type(rest,"12");
  await user.type(screen.getByLabelText("Minimum wyjątku"),"24");
  await user.click(screen.getByRole("button",{name:/Ustaw zatwierdzenie/}));
  expect(rest).toHaveValue("12");
  expect(screen.getByLabelText("Minimum wyjątku")).toHaveValue("24");
  for(const input of container.querySelectorAll('input[name],select[name],textarea[name]')) {
    if(input.getAttribute('name')==='requestedOperationMode') continue;
    expect(input.closest('.rule-field')?.querySelector('.rule-hint')).toBeTruthy();
  }
  await user.click(screen.getByRole("button",{name:"Zapisz reguły"}));
  const saved=JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!);
  expect(saved.legalRules.minimumDailyRestMinutes).toBe(720);
  expect(saved.legalRules.weeklyRestExceptionMinimumMinutes).toBe(1440);
  expect(saved.legalRules.weeklyRestExceptionEnabled).toBe(false);
 });
 it("creates a dated user approval without modifying people, hours or source project",()=>{
  const source=structuredClone(configurationFixture),before=JSON.stringify(source);
  const result=productionProfile(source,new Date("2026-09-04T10:00:00Z"));
  expect(result.requestedOperationMode).toBe("PRODUCTION");
  expect(result.legalRules).toMatchObject({approvedBy:"Jarosław Dymek",effectiveFrom:"2026-09-04",effectiveTo:"2027-09-04"});
  expect(result.educators).toEqual(source.educators);
  expect(result.groupMemberships).toEqual(source.groupMemberships);
  expect(JSON.stringify(source)).toBe(before);
 });
 it("only checks included groups and does not mistake completeness for feasibility",()=>{
  const c=productionProfile(structuredClone(configurationFixture));
  c.groups.push({...c.groups[0],id:"G2",code:"II"});
  expect(setupSteps(c).some(s=>s.key.includes("G2"))).toBe(false);
  expect(generationMissing(c).map(s=>s.key)).toContain("stay-G1");
  c.selectedGroupIds=[];
  expect(generationMissing(c).map(s=>s.key)).toContain("scope");
  c.selectedGroupIds=["G1"];c.initialTemplateNeedsReview=true;
  expect(generationMissing(c).map(s=>s.key)).toContain("template");
 });
 it("marks risky rest red while keeping the field editable and help separate from label",()=>{
  render(<RuleFields values={{minimumDailyRestHours:"8"}}><label>Odpoczynek dobowy<input name="minimumDailyRestHours" defaultValue="8"/></label></RuleFields>);
  const input=screen.getByLabelText("Odpoczynek dobowy");
  expect(input).toBeEnabled();expect(input.closest('.rule-field')).toHaveClass('rule-field--risk');
  fireEvent.change(input,{target:{value:"11"}});expect(input).toHaveValue("11");
  fireEvent.click(screen.getByText("Co zmienia ta reguła?"));
  expect(ruleRisk("minimumDailyRestHours","11")).toBeNull();
 });
 it("collapsing does not remove entered values",()=>{
  render(<SectionTiles><section><h2>Godziny</h2><label>Wymiar<input defaultValue="28,5"/></label></section></SectionTiles>);
  fireEvent.click(screen.getByRole("heading",{name:"Godziny"}).closest("summary")!);
  expect(screen.getByLabelText("Wymiar")).toHaveValue("28,5");
 });
 it("a repair link reveals all folded ancestors before focusing",()=>{
  render(<MemoryRouter initialEntries={["/#target"]}><details><summary>Sekcja</summary><details id="target"><summary>Osoba</summary><input aria-label="Godziny"/></details></details><HashFocus/></MemoryRouter>);
  const input=screen.getByLabelText("Godziny");
  expect(input.closest('details')).toHaveAttribute('open');
  expect(input.closest('details')?.parentElement).toHaveAttribute('open');
  expect(input).toHaveFocus();
 });
});
