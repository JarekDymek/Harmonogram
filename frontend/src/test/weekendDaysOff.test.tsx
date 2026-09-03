import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { AppStateProvider, migrateConfiguration } from "../state/AppState";
import { configurationFixture } from "./fixture";
import { getRuleGuidance } from "../help";
import { prepareConfigurationForApi } from "../nightDuties";
import { createDeviceTransferPackage, parseDeviceTransferPackage, serializeDeviceTransferPackage } from "../transfer";

const key = "harmonogram-mow-configuration-v3";
const pattern = {id:"OFF-A",educatorId:"A",daysOff:[0,1],active:true};
function show() {
  return render(<MemoryRouter initialEntries={["/weekendy"]}><AppStateProvider><App /></AppStateProvider></MemoryRouter>);
}

describe("stałe wolne za weekend", () => {
  it("zapisuje elastyczną preferencję bez wybierania dni i zachowuje inne obowiązkowe wzorce", async () => {
    const original = migrateConfiguration({...configurationFixture, weekendDaysOffPatterns: [pattern]});
    localStorage.setItem(key, JSON.stringify(original));
    show();
    const name = original.educators[1].displayName;
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(`${name}: sposób planowania wolnego`), "PREFER_CONSECUTIVE");
    expect(screen.queryByLabelText(`${name}: pierwszy dzień wolny`)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "Zapisz wzorce"}));
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(saved.weekendDaysOffPatterns).toContainEqual(pattern);
    expect(saved.weekendDaysOffPatterns).toContainEqual(expect.objectContaining({
      educatorId: "B", mode: "PREFER_CONSECUTIVE", daysOff: [], active: true,
    }));
    expect(saved.groupMemberships).toEqual(original.groupMemberships);
    const imported = parseDeviceTransferPackage(serializeDeviceTransferPackage(createDeviceTransferPackage(saved, ""))).configuration;
    expect(prepareConfigurationForApi(imported).weekendDaysOffPatterns).toEqual(saved.weekendDaysOffPatterns);
  });

  it("nie zamienia automatycznie istniejącej obowiązkowej pary w preferencję", async () => {
    localStorage.setItem(key, JSON.stringify({...configurationFixture, weekendDaysOffPatterns: [pattern]}));
    show();
    const name = configurationFixture.educators[0].displayName;
    expect(screen.getByLabelText(`${name}: sposób planowania wolnego`)).toHaveValue("FIXED");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(`${name}: sposób planowania wolnego`), "PREFER_CONSECUTIVE");
    await user.selectOptions(screen.getByLabelText(`${name}: sposób planowania wolnego`), "FIXED");
    expect(screen.getByLabelText(`${name}: pierwszy dzień wolny`)).toHaveValue("0");
    expect(screen.getByLabelText(`${name}: drugi dzień wolny`)).toHaveValue("1");
  });

  it("pokazuje niespełnioną preferencję jako informację o gotowym planie, nie błąd", () => {
    const message = {ruleId:"PREF-CONSECUTIVE-DAYS-OFF",severity:"WARNING" as const,
      educatorId:"A",message:"Tydzień 2: wolne poniedziałek i piątek.",context:{patternId:"OFF-A"}};
    const guidance = getRuleGuidance(message, configurationFixture);
    expect(guidance.repairable).toBe(false);
    expect(guidance.explanation).toBe(message.message);
    expect(guidance.actionTo).toBe("/weekendy?grupa=G1#wolne-OFF-A");
  });
  it("pokazuje pierwszeństwo stałego dyżuru bez nadpisania zapisanych wzorców", () => {
    const config = migrateConfiguration(configurationFixture);
    config.recurringRequiredDuties = [{id: "R", groupId: "G1", educatorId: "C", dayOfWeek: 5,
      startTime: "20:00", endTime: "22:00", description: "Stały dyżur"}];
    localStorage.setItem(key, JSON.stringify(config));
    show();
    expect(screen.getByRole("heading", {name: "Obowiązkowe dyżury mają pierwszeństwo"})).toBeVisible();
    expect(screen.getByText(/2026-09-19, 20:00–22:00/)).toBeVisible();
    expect(JSON.parse(localStorage.getItem(key)!).weekendVariants).toEqual(config.weekendVariants);
  });
  it("zapisuje, przywraca i zmienia osobisty wzorzec bez zmiany godzin i weekendów", async () => {
    const original = migrateConfiguration(configurationFixture);
    localStorage.setItem(key, JSON.stringify(original));
    const view = show();
    const user = userEvent.setup();
    const name = original.educators[0].displayName;
    await user.selectOptions(screen.getByLabelText(`${name}: pierwszy dzień wolny`), "0");
    await user.selectOptions(screen.getByLabelText(`${name}: drugi dzień wolny`), "1");
    await user.click(screen.getByRole("button", {name:"Zapisz wzorce"}));
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(saved.weekendDaysOffPatterns).toEqual([expect.objectContaining({educatorId:"A",daysOff:[0,1],active:true})]);
    expect(saved.groupMemberships).toEqual(original.groupMemberships);
    expect(saved.weekendVariants).toEqual(original.weekendVariants);
    expect(saved.unavailability).toEqual(original.unavailability);
    view.unmount(); show();
    expect(screen.getByLabelText(`${name}: drugi dzień wolny`)).toHaveValue("1");
    await user.selectOptions(screen.getByLabelText(`${name}: drugi dzień wolny`), "4");
    await user.click(screen.getByRole("button", {name:"Zapisz wzorce"}));
    expect(JSON.parse(localStorage.getItem(key)!).weekendDaysOffPatterns[0].daysOff).toEqual([0,4]);
  });

  it("podkreśla jednakowe dni i nie zapisuje niekompletnego wzorca", async () => {
    localStorage.setItem(key, JSON.stringify(configurationFixture)); show();
    const before = localStorage.getItem(key);
    const user = userEvent.setup();
    const name = configurationFixture.educators[0].displayName;
    await user.selectOptions(screen.getByLabelText(`${name}: pierwszy dzień wolny`),"0");
    await user.selectOptions(screen.getByLabelText(`${name}: drugi dzień wolny`),"0");
    await user.click(screen.getByRole("button",{name:"Zapisz wzorce"}));
    expect(screen.getByLabelText(`${name}: drugi dzień wolny`)).toHaveAttribute("aria-invalid","true");
    expect(screen.getByText(/Wybierz dwa różne dni. Oba pola/)).toBeVisible();
    expect(localStorage.getItem(key)).toBe(before);
  });

  it("przenosi wzorzec na telefon i do API, a migracja nie zmienia godzin", () => {
    const config = migrateConfiguration({...configurationFixture,weekendDaysOffPatterns:[pattern]});
    const serialized = serializeDeviceTransferPackage(createDeviceTransferPackage(config, ""));
    const imported = parseDeviceTransferPackage(serialized).configuration;
    expect(prepareConfigurationForApi(imported).weekendDaysOffPatterns).toEqual([pattern]);
    expect(migrateConfiguration(config)).toEqual(config);
  });

  it("prowadzi do czerwonego wzorca właściwej osoby", () => {
    const message = {ruleId:"REQ-WEEKEND-DAYS-OFF-001",severity:"ERROR" as const,
      educatorId:"A",message:"Nocka koliduje z wolnym",context:{patternId:pattern.id}};
    const config = {...configurationFixture,weekendDaysOffPatterns:[pattern]};
    expect(getRuleGuidance(message, config).actionTo).toBe("/weekendy?grupa=G1#wolne-OFF-A");
    localStorage.setItem(key,JSON.stringify(config));
    localStorage.setItem("harmonogram-mow-input-report-v3",JSON.stringify({status:"INVALID_INPUT",messages:[message],care:[],weeklyBalance:[]}));
    show();
    expect(within(document.getElementById("wolne-OFF-A")!).getByRole("alert")).toHaveTextContent(message.message);
  });
});
