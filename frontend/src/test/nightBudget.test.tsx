import {render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {describe,it,expect,vi} from "vitest";
import {App} from "../App";
import {AppStateProvider,migrateConfiguration} from "../state/AppState";
import {configurationFixture} from "./fixture";
import {replaceRecurringNights,careHours,fixedNightHours,prepareConfigurationForApi} from "../nightDuties";
const key="harmonogram-mow-configuration-v3";
const night={id:"N",educatorId:"A",startDayOfWeek:2,budgetGroupId:"G1",description:"Stała nocka"};
function config(total=28.5) {
  const c=migrateConfiguration(structuredClone(configurationFixture));
  c.planningHorizonWeeks=6;
  c.groupMemberships[0].weeklyTargetHoursByWeek=Array(6).fill(total);
  return c;
}
function show(c:ReturnType<typeof config>) {
  localStorage.setItem(key,JSON.stringify(c));
  render(<MemoryRouter initialEntries={["/wychowawcy"]}><AppStateProvider><App/></AppStateProvider></MemoryRouter>);
}
describe("stała nocka wewnątrz wymiaru",()=>{
  it("28,5 pozostaje 28,5: sześć nocek środa–czwartek daje po 20,5 opieki",()=>{
    const c=config(), before=structuredClone(c), next=replaceRecurringNights(c,[night]);
    for(let w=0;w<6;w++) {
      expect(next.groupMemberships[0].weeklyTargetHoursByWeek[w]).toBe(28.5);
      expect(fixedNightHours(next,next.groupMemberships[0],w)).toBe(8);
      expect(careHours(next,next.groupMemberships[0],w)).toBe(20.5);
    }
    expect(prepareConfigurationForApi(next).externalDutyAssignments.filter(d=>d.regularNight)).toHaveLength(6);
    expect(c).toEqual(before);
    expect(migrateConfiguration(next)).toEqual(next);
    expect(replaceRecurringNights(next,[night])).toEqual(next);
  });
  it("usunięcie, zmiana dnia i przeniesienie nocki zachowują wszystkie wymiary",()=>{
    const c=replaceRecurringNights(config(),[night]);
    for(const nights of [[],[{...night,startDayOfWeek:4,budgetGroupId:"G2"}]]) {
      const next=replaceRecurringNights(c,nights);
      expect(next.groupMemberships).toEqual(c.groupMemberships);
      expect(careHours(next,next.groupMemberships[0],0)).toBe(28.5);
    }
  });
  it("formularz dodaje nockę bez podwyższania wpisanych godzin",async()=>{
    show(config()); const user=userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Wychowawca stałej nocki"),"A");
    await user.selectOptions(screen.getByLabelText("Dzień rozpoczęcia stałej nocki"),"2");
    await user.click(screen.getByRole("button",{name:"Dodaj stałą nockę"}));
    expect(JSON.parse(localStorage.getItem(key)!).groupMemberships[0].weeklyTargetHoursByWeek).toEqual(Array(6).fill(28.5));
    expect(screen.getAllByText("Opieka: 20,5 godz. + stałe nocki: 8 godz.")).toHaveLength(6);
  });
  it("korekta 36,5 wymaga zgody i kopii; nie zmienia nocki ani innych osób",async()=>{
    const c=replaceRecurringNights(config(36.5),[night]); show(c);
    const user=userEvent.setup(), confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
    await user.click(screen.getByText("Starsza wersja doliczyła nockę ponad wymiar?"));
    const button=screen.getByRole("button",{name:"Popraw wymiar zawyżony o nocki"});
    await user.click(button);
    expect(JSON.parse(localStorage.getItem(key)!).groupMemberships[0].weeklyTargetHoursByWeek).toEqual(Array(6).fill(36.5));
    confirm.mockReturnValue(true); await user.click(button);
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining("łącznie 28,5 godz., w tym nocki 8 godz.; opieka 20,5 godz."));
    const saved=JSON.parse(localStorage.getItem(key)!);
    expect(saved.groupMemberships[0].weeklyTargetHoursByWeek).toEqual(Array(6).fill(28.5));
    expect(saved.groupMemberships.slice(1)).toEqual(c.groupMemberships.slice(1));
    expect(saved.recurringNightDuties).toEqual(c.recurringNightDuties);
    expect(JSON.parse(localStorage.getItem("harmonogram-before-night-budget-repair-v1")!).configuration).toEqual(c);
  });
});
