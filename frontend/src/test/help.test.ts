import { describe, expect, it } from "vitest";
import { getPageHelp, getRepairOptions, getRuleGuidance } from "../help";
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

  it("podaje dokładną różnicę sumy i prowadzi do właściwego tygodnia", () => {
    const balanceMessage = message(
      "REQ-HOURS-001",
      "W tygodniu 2 brakuje godzin.",
    );
    balanceMessage.groupId = "G1";
    balanceMessage.context = {
      weekNumber: 2,
      requiredMinutes: 6000,
      assignedMinutes: 5880,
      differenceMinutes: -120,
    };

    const guidance = getRuleGuidance(balanceMessage);

    expect(guidance.title).toBe("W tygodniu 2 brakuje 2 godz.");
    expect(guidance.explanation).toContain("Zwiększ łączną liczbę godzin");
    expect(guidance.actionTo).toBe(
      "/wychowawcy?grupa=G1#godziny-tydzien-2",
    );
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

  it("nie każe zmieniać godzin z powodu ograniczonej kontroli granic planu", () => {
    const guidance = getRuleGuidance(
      message(
        "REQ-CROSS-WEEK-001",
        "Tryb skończony nie ma pełnego kontekstu przydziałów przed i po horyzoncie; walidacja odpoczynku na tej granicy jest ograniczona.",
      ),
    );

    expect(guidance.title).toContain("nie dotyczy godzin");
    expect(guidance.explanation).toContain("nie wymaga zmiany godzin");
    expect(guidance.actionTo).toBe("/podsumowanie");
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

  it("prowadzi konflikt nocki do dokładnej pozycji weekendowej", () => {
    const nightMessage = message(
      "REQ-CROSS-GROUP-REST-001",
      "Nocka Jan Kowalski koliduje z pracą w pozycji weekendu 2.",
    );
    nightMessage.educatorId = "B";
    nightMessage.context = {
      conflictType: "NIGHT_WEEKEND_REST",
      position: 2,
      weekNumber: 2,
    };
    const configuration = {
      educators: [{ id: "B", displayName: "Jan Kowalski" }],
      weekendVariants: [],
    } as never;

    const guidance = getRuleGuidance(nightMessage, configuration);

    expect(guidance.title).toContain("Jan Kowalski");
    expect(guidance.explanation).toContain("pozycji weekendu 2");
    expect(guidance.actionTo).toBe("/weekendy#weekend-pozycja-2");
  });

  it("proponuje dwa bezpieczne sposoby naprawy konfliktu nocki", () => {
    const nightMessage = message("REQ-CROSS-GROUP-REST-001");
    nightMessage.context = {
      conflictType: "NIGHT_WEEKEND_REST",
      position: 2,
    };

    const options = getRepairOptions(nightMessage);

    expect(options).toHaveLength(2);
    expect(options[0].actionTo).toBe("/weekendy#weekend-pozycja-2");
    expect(options[1].actionTo).toBe("/wychowawcy#nocki");
    expect(options[1].description).toContain("wpisana omyłkowo");
  });

  it("prowadzi konflikt niedostępności do dokładnej pozycji weekendowej", () => {
    const unavailableMessage = message("REQ-UNAVAILABLE-HARD-001");
    unavailableMessage.context = {
      conflictType: "HARD_UNAVAILABILITY_WEEKEND",
      position: 5,
    };

    const guidance = getRuleGuidance(unavailableMessage);

    expect(guidance.actionTo).toBe("/weekendy#weekend-pozycja-5");
    expect(guidance.destination).toBe("Weekendy → pozycja 5");
  });

  it("pozwala poprawić weekend albo błędnie wpisaną niedostępność", () => {
    const unavailableMessage = message("REQ-UNAVAILABLE-HARD-001");
    unavailableMessage.context = {
      conflictType: "HARD_UNAVAILABILITY_WEEKEND",
      position: 5,
    };

    const options = getRepairOptions(unavailableMessage);

    expect(options.map((option) => option.actionTo)).toEqual([
      "/weekendy#weekend-pozycja-5",
      "/wychowawcy#dostepnosc",
    ]);
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
