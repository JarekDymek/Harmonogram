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
      "/plany#plany-tygodniowe",
    );
  });

  it("wyjaśnia, że błąd poniedziałku nie dotyczy bilansu godzin", () => {
    const guidance = getRuleGuidance(
      message(
        "REQ-CROSS-WEEK-001",
        "Cykl musi rozpoczynać się w poniedziałek, a weekStartDay musi wynosić MONDAY.",
      ),
    );

    expect(guidance.actionTo).toBe("/konfiguracja#data-poczatku-cyklu");
    expect(guidance.destination).toContain("Początek cyklu");
    expect(guidance.explanation).toContain("Godziny tygodniowe mogą być prawidłowe");
  });

  it("prowadzi błąd pozycji weekendowej do dokładnej karty", () => {
    const weekendMessage = message("REQ-WEEKEND-001");
    weekendMessage.context = { position: 4 };

    const guidance = getRuleGuidance(weekendMessage);

    expect(guidance.actionTo).toBe("/weekendy#weekend-pozycja-4");
    expect(guidance.destination).toBe("Weekendy → pozycja 4");
  });

  it("prowadzi konflikt planu weekendu do wariantu zastępczego", () => {
    const weekendMessage = message(
      "REQ-SPECIAL-DAY-001",
      "Weekendowy popyt różni się od wzorca bazowego i brakuje zgodnego SUBSTITUTE.",
    );
    weekendMessage.date = "2026-09-05";
    weekendMessage.context = { weekNumber: 1, baseVariantId: "WEEKEND-1" };

    const guidance = getRuleGuidance(weekendMessage);

    expect(guidance.actionTo).toBe("/weekendy#dzien-specjalny-weekend");
    expect(guidance.explanation).toContain("Bilans godzin nie jest tu problemem");
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
