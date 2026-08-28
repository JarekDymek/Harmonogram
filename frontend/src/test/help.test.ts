import { describe, expect, it } from "vitest";
import { getPageHelp, getRuleGuidance } from "../help";
import type { DomainMessage } from "../types";

function message(
  ruleId: string,
  text = "Komunikat testowy",
): DomainMessage {
  return {
    ruleId,
    severity: "ERROR",
    message: text,
    context: {},
  };
}

describe("pomoc kontekstowa", () => {
  it("wyjaśnia brak wymiaru godzin i prowadzi do właściwego pola", () => {
    const guidance = getRuleGuidance(
      message(
        "REQ-HOURS-001",
        "Wymiar członkostwa musi zawierać jedną wartość bazową albo wartość każdego tygodnia.",
      ),
    );

    expect(guidance.title).toBe("Brakuje wymiaru godzin");
    expect(guidance.actionTo).toBe("/wychowawcy#godziny");
    expect(guidance.explanation).toContain("większą niż 0");
  });

  it("kieruje błędy planu dnia do planu pobytu", () => {
    expect(getRuleGuidance(message("REQ-COVERAGE-001")).actionTo).toBe(
      "/plany",
    );
  });

  it("ma instrukcję dla każdego głównego kroku", () => {
    for (const path of [
      "/",
      "/konfiguracja",
      "/wychowawcy",
      "/plany",
      "/weekendy",
      "/reguly",
      "/podsumowanie",
      "/harmonogram",
      "/internat",
      "/walidacja",
    ]) {
      const help = getPageHelp(path);
      expect(help.title.length).toBeGreaterThan(0);
      expect(help.steps).toHaveLength(3);
    }
  });

  it("bezpiecznie obsługuje nieznaną regułę", () => {
    const guidance = getRuleGuidance(message("REQ-NEW-999"));
    expect(guidance.actionTo).toBe("/podsumowanie");
  });
});
