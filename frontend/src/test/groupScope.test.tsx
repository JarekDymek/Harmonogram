import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {describe,it,expect,vi} from "vitest";
import {App} from "../App";
import {AppStateProvider,migrateConfiguration} from "../state/AppState";
import {configurationFixture} from "./fixture";
import type {GenerateResponse} from "../types";
import {planInputs} from "../groupScope";
import { addBlankGroup, GROUP_CODES } from "../groups";

const key="harmonogram-mow-configuration-v3";
const resultKey="harmonogram-mow-generation-v3";
const plan:GenerateResponse={generationStatus:"CANDIDATE_FOUND",publicResult:"POPRAWNY_TRYB_DEMONSTRACYJNY",
  care:[], messages:[], assignments:[{groupId:"G1",educatorId:"A",date:"2026-09-14",startMinute:360,endMinute:480}],
  validationReport:{status:"VALID",publicResult:"POPRAWNY_TRYB_DEMONSTRACYJNY",validatorVersion:"3.1.0",
    legalProfileStatus:"UNVERIFIED",legalProfileVersion:"test",messages:[]}};
function config() {
  const c=migrateConfiguration(structuredClone(configurationFixture));
  c.groups.push({id:"G7",code:"VII",name:"Grupa VII",classLabel:"",active:true,displayOrder:7});
  c.groupCount=2; c.activeGroupId="G7"; c.groupId="G7"; c.groupName="Grupa VII";
  for (const [i,e] of [...c.educators].entries()) {
    c.educators.push({...e,id:`NEW-${e.id}`,displayName:`Osoba VII ${i+1}`});
    c.groupMemberships.push({...c.groupMemberships[i],id:`MEM-NEW-${i}`,groupId:"G7",educatorId:`NEW-${e.id}`});
  }
  return c;
}
function show(path="/harmonogram") {
  localStorage.setItem(key,JSON.stringify(config())); localStorage.setItem(resultKey,JSON.stringify(plan));
  render(<MemoryRouter initialEntries={[path]}><AppStateProvider><App/></AppStateProvider></MemoryRouter>);
}
describe("ręczny zakres grup",()=>{
  it("zapis konfiguracji i dodanie nowych grup nie dołączają ich samoczynnie",()=>{
    const c=config();
    expect(addBlankGroup(c,"II").selectedGroupIds).toEqual(["G1"]);
    const all = GROUP_CODES.filter(code => !c.groups.some(g => g.code === code)).reduce((next,code) => addBlankGroup(next,code), c);
    expect(all.selectedGroupIds).toEqual(["G1"]);
    c.selectedGroupIds=[];
    expect(addBlankGroup(c,"II").selectedGroupIds).toEqual([]);
  });
  it("odłączenie także w konfiguracji nie tworzy ukrytych blokad starego planu",async()=>{
    show("/konfiguracja");
    await userEvent.click(screen.getByRole("checkbox",{name:"I · Grupa testowa"}));
    const saved=JSON.parse(localStorage.getItem(key)!);
    expect(saved.selectedGroupIds).toEqual([]);
    expect(saved.lockedAssignments).toEqual([]);
    expect(JSON.parse(localStorage.getItem(resultKey)!)).toEqual(plan);
  });
  it("nie pokazuje poprawności VI jako planu VII; dołącza dokładnie wybraną grupę",async()=>{
    const failed:GenerateResponse={generationStatus:"NOT_STARTED",publicResult:"DANE_NIEPOPRAWNE",assignments:[],care:[],
      messages:[{severity:"ERROR",ruleId:"REQ-WEEKEND-001",message:"Uzupełnij weekendy VII.",groupId:"G7",context:{}}]};
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>failed}); vi.stubGlobal("fetch",fetch);
    show();
    expect(screen.getByRole("heading",{name:"Ta grupa nie ma jeszcze wygenerowanego planu"})).toBeVisible();
    expect(screen.queryByText("Propozycja planu jest gotowa i sprawdzona")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button",{name:"Dołącz tę grupę i wygeneruj"}));
    await waitFor(()=>expect(fetch).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0][1].body).selectedGroupIds).toEqual(["G1","G7"]);
    expect(await screen.findByText(/Ostatnia próba nie utworzyła/)).toBeVisible();
    expect(JSON.parse(localStorage.getItem(resultKey)!)).toEqual(plan);
  });
  it("odłącza wszystkie grupy bez kasowania ich danych i bez migracji do pełnego zakresu",async()=>{
    show();
    await userEvent.click(screen.getByRole("checkbox",{name:"Dołącz grupę I"}));
    const saved=JSON.parse(localStorage.getItem(key)!);
    expect(saved.selectedGroupIds).toEqual([]);
    expect(migrateConfiguration(saved).selectedGroupIds).toEqual([]);
    expect(saved.groups).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(resultKey)!)).toEqual(plan);
  });
  it("tworzy formularze weekendów tylko aktywnej grupy, wymaga osób i zachowuje gotowy inny plan",async()=>{
    show("/weekendy");
    const user=userEvent.setup();
    await user.click(screen.getByRole("button",{name:"Utwórz brakujące wzorce weekendów"}));
    expect(screen.getAllByRole("heading",{name:/^Pozycja /})).toHaveLength(6);
    await user.click(screen.getByRole("button",{name:"Zapisz wzorce"}));
    expect(screen.getByText(/Nie zapisano: w każdym odcinku/)).toBeVisible();
    const selects=screen.getAllByRole("combobox").filter(e=>e.getAttribute("aria-label")?.includes("wychowawca"));
    for (const [i,s] of selects.entries()) await user.selectOptions(s,i%2===0?"NEW-A":"NEW-B");
    await user.click(screen.getByRole("button",{name:"Zapisz wzorce"}));
    const saved=JSON.parse(localStorage.getItem(key)!);
    expect(saved.weekendVariants.filter((v:any)=>v.groupId==="G7")).toHaveLength(6);
    expect(saved.weekendVariants.every((v:any)=>v.groupId==="G7")).toBe(true);
    expect(JSON.parse(localStorage.getItem(resultKey)!)).toEqual(plan);
  },15000);
  it("edytowanie obcej grupy nie unieważnia planu, ale praca wspólnej osoby już tak",()=>{
    const c=config(), before=planInputs(c,["G1"]);
    c.groupMemberships.find(m=>m.groupId==="G7")!.weeklyTargetHoursByWeek=[99];
    expect(planInputs(c,["G1"])).toBe(before);
    c.recurringRequiredDuties=[{id:"SHARED",groupId:"G7",educatorId:"A",dayOfWeek:0,startTime:"10:00",endTime:"12:00",description:"Stały"}];
    expect(planInputs(c,["G1"])).not.toBe(before);
  });
});
