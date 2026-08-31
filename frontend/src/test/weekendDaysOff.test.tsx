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
