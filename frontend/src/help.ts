import type {
  DomainMessage,
  ScheduleConfiguration,
} from "./types";

export interface PageHelp {
  title: string;
  intro: string;
  steps: string[];
  note?: string;
}

export interface RuleGuidance {
  title: string;
  explanation: string;
  destination: string;
  actionLabel: string;
  actionTo: string;
}

const pageHelp: Record<string, PageHelp> = {
  "/": {
    title: "Jak zacząć",
    intro: "Dane są zapisywane automatycznie na tym urządzeniu.",
    steps: [
      "Utwórz nową konfigurację albo wróć do zapisanej.",
      "Przejdź kolejno przez kroki 02–06.",
      "W kroku 07 sprawdź dane i popraw tylko wskazane pozycje.",
    ],
    note: "Nie używaj opcji tworzenia nowej konfiguracji, jeśli chcesz zachować obecny plan.",
  },
  "/konfiguracja": {
    title: "Konfiguracja grupy",
    intro: "Tutaj wybierasz grupę, klasę, datę początku i liczbę tygodni.",
    steps: [
      "Sprawdź oznaczenie i nazwę aktywnej grupy.",
      "Ustaw poniedziałek rozpoczynający plan.",
      "Wybierz liczbę tygodni i zapisz formularz.",
    ],
  },
  "/wychowawcy": {
    title: "Wychowawcy i godziny",
    intro: "Najważniejsze jest wpisanie wymiaru godzin dla każdej osoby w każdym tygodniu.",
    steps: [
      "Sprawdź nazwisko i skrót każdej osoby.",
      "Wpisz więcej niż 0 godzin w każdym polu „Godziny tygodniowo”.",
      "Dodaj niedostępności i dyżury nocne tylko wtedy, gdy rzeczywiście występują.",
    ],
    note: "Możesz używać przecinka, np. 30,5. Dane zapisują się po opuszczeniu pola.",
  },
  "/plany": {
    title: "Plan pobytu wychowanków",
    intro: "Plan pobytu określa godziny, w których grupa wymaga opieki.",
    steps: [
      "Dla każdego dnia sprawdź początek i koniec działania grupy.",
      "Dodaj przerwy bez opieki, np. czas pobytu klasy w szkole.",
      "Upewnij się, że każdy dzień tygodnia ma jeden zatwierdzony plan.",
    ],
  },
  "/weekendy": {
    title: "Weekendy",
    intro: "Aplikacja potrzebuje pełnej rotacji weekendowej dla sześciu pozycji.",
    steps: [
      "Sprawdź osobę wolną w każdej pozycji rotacji.",
      "Uzupełnij sobotę i niedzielę.",
      "Zatwierdź wszystkie warianty używane w planie.",
    ],
  },
  "/reguly": {
    title: "Reguły organizacyjne",
    intro: "Te ustawienia opisują odpoczynek, minimalny odcinek pracy i preferencje.",
    steps: [
      "Nie zmieniaj profilu prawnego bez uzgodnienia zasad placówki.",
      "Sprawdź krok czasu i minimalną długość odcinka.",
      "W trybie rzeczywistym upewnij się, że profil prawny jest zweryfikowany.",
    ],
  },
  "/podsumowanie": {
    title: "Sprawdzenie i generowanie",
    intro: "Najpierw kliknij „Sprawdź dane”. Generator uruchomi się dopiero po usunięciu błędów.",
    steps: [
      "Przeczytaj pierwszą czerwoną kartę.",
      "Kliknij „Napraw teraz”, aby przejść do właściwego formularza.",
      "Wróć tutaj, ponownie sprawdź dane i dopiero potem wygeneruj harmonogram.",
    ],
    note: "Ostrzeżenia wymagają uwagi, ale tylko błędy blokują generowanie.",
  },
  "/harmonogram": {
    title: "Gotowy harmonogram",
    intro: "Tutaj sprawdzasz przydziały wygenerowane dla wybranej grupy.",
    steps: [
      "Sprawdź pokrycie każdego dnia.",
      "Porównaj liczbę godzin każdej osoby z zadanym wymiarem.",
      "Przejdź do walidacji przed użyciem planu.",
    ],
  },
  "/internat": {
    title: "Widok całego internatu",
    intro: "Ten ekran łączy wyniki wielu grup. Nie jest potrzebny do pracy tylko z Grupą VI.",
    steps: [
      "Najpierw zakończ plan aktywnej grupy.",
      "Użyj tego widoku dopiero po przygotowaniu pozostałych grup.",
      "Sprawdź konflikty osób pracujących w więcej niż jednej grupie.",
    ],
  },
  "/walidacja": {
    title: "Końcowa kontrola",
    intro: "Walidacja sprawdza gotowy wynik niezależnie od generatora.",
    steps: [
      "Usuń wszystkie błędy oznaczone na czerwono.",
      "Przejrzyj ostrzeżenia i zdecyduj, czy są dopuszczalne.",
      "Zachowaj plan dopiero po pomyślnej kontroli.",
    ],
  },
  "/brak-rozwiazania": {
    title: "Brak rozwiązania",
    intro: "Dane mogą być poprawne, ale ograniczenia razem nie pozwalają ułożyć planu.",
    steps: [
      "Sprawdź, czy niedostępności nie blokują całych dni.",
      "Porównaj zapotrzebowanie z sumą godzin wychowawców.",
      "Poluzuj jedną preferencję i spróbuj ponownie.",
    ],
  },
};

export function getPageHelp(pathname: string): PageHelp {
  return pageHelp[pathname] ?? pageHelp["/"];
}

function contextString(message: DomainMessage, key: string) {
  const value = message.context[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function contextNumber(message: DomainMessage, key: string) {
  const value = message.context[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function anchor(value: string) {
  return encodeURIComponent(value);
}

function weekendTarget(
  message: DomainMessage,
  configuration?: ScheduleConfiguration,
) {
  const explicitPosition = contextNumber(message, "position");
  const variantId =
    contextString(message, "variantId") ??
    contextString(message, "baseVariantId");
  const variant = variantId
    ? configuration?.weekendVariants.find((item) => item.id === variantId)
    : undefined;
  const position = explicitPosition ?? variant?.positionInCycle ?? null;

  if (position !== null) {
    return {
      destination: `Weekendy → pozycja ${position}`,
      actionTo: `/weekendy#weekend-pozycja-${position}`,
    };
  }
  if (variant?.variantKind === "SUBSTITUTE" && variantId) {
    return {
      destination: "Weekendy → wskazany wariant zastępczy",
      actionTo: `/weekendy#weekend-zastepczy-${anchor(variantId)}`,
    };
  }
  return {
    destination: "Weekendy → wzorce soboty i niedzieli",
    actionTo: "/weekendy#wzorce-weekendowe",
  };
}

function planTarget(
  message: DomainMessage,
  configuration?: ScheduleConfiguration,
) {
  const planId = contextString(message, "planId");
  const plan = planId
    ? configuration?.dayPlans.find((item) => item.id === planId)
    : undefined;
  const dayOfWeek =
    contextNumber(message, "dayOfWeek") ?? plan?.dayOfWeek ?? null;

  if (plan?.scope !== "BASE_WEEKLY" && planId) {
    return {
      destination: "Plan pobytu → wskazany plan szczególny",
      actionTo: `/plany#plan-szczegolny-${anchor(planId)}`,
    };
  }
  if (dayOfWeek !== null) {
    const dayNames = [
      "poniedziałek",
      "wtorek",
      "środę",
      "czwartek",
      "piątek",
      "sobotę",
      "niedzielę",
    ];
    return {
      destination: `Plan pobytu → ${dayNames[dayOfWeek] ?? `dzień ${dayOfWeek}`}`,
      actionTo: `/plany#plan-dzien-${dayOfWeek}`,
    };
  }
  return {
    destination: "Plan pobytu → godziny wskazanego dnia",
    actionTo: "/plany#plany-tygodniowe",
  };
}

export function getRuleGuidance(
  message: DomainMessage,
  configuration?: ScheduleConfiguration,
): RuleGuidance {
  const ruleId = message.ruleId;

  if (
    ruleId === "REQ-CROSS-WEEK-001" &&
    (contextString(message, "field") === "cycleStartDate" ||
      /rozpoczynać się w poniedziałek|weekStartDay/i.test(message.message))
  ) {
    return {
      title: "Ustaw początek planu na poniedziałek",
      explanation:
        "Godziny tygodniowe mogą być prawidłowe. Ten błąd dotyczy tylko daty początku cyklu: wybierz poniedziałek i zapisz konfigurację.",
      destination: "Konfiguracja → Początek cyklu (poniedziałek)",
      actionLabel: "Przejdź do daty początku",
      actionTo: "/konfiguracja#data-poczatku-cyklu",
    };
  }

  if (ruleId === "REQ-HOURS-001") {
    const educatorAnchor = message.educatorId
      ? `#godziny-${anchor(message.educatorId)}`
      : "#godziny";
    return {
      title: message.message.includes("Wymiar członkostwa")
        ? "Brakuje wymiaru godzin"
        : "Sprawdź wymiar godzin",
      explanation:
        "Każda osoba musi mieć wpisaną liczbę godzin większą niż 0 dla każdego tygodnia planu. Wartość 0 oznacza brak danych.",
      destination: "Wychowawcy → tygodniowy wymiar wskazanej osoby",
      actionLabel: "Uzupełnij godziny",
      actionTo: `/wychowawcy${educatorAnchor}`,
    };
  }

  if (
    ruleId === "REQ-SPECIAL-DAY-001" &&
    (/weekend|SUBSTITUTE/i.test(message.message) ||
      contextString(message, "baseVariantId") !== null)
  ) {
    return {
      title: "Dostosuj weekend do planu pobytu",
      explanation:
        "Bilans godzin nie jest tu problemem. W podanej dacie godziny opieki różnią się od zwykłego wzorca weekendu. Dodaj albo popraw wariant zastępczy dla wskazanego tygodnia.",
      destination: "Weekendy → Dzień specjalny w weekend",
      actionLabel: "Przejdź do wariantu zastępczego",
      actionTo: "/weekendy#dzien-specjalny-weekend",
    };
  }

  if (
    ["REQ-SPECIAL-DAY-001", "REQ-COVERAGE-001", "REQ-STAFFING-001", "REQ-NO-OUTSIDE-001"].includes(
      ruleId,
    )
  ) {
    const target = planTarget(message, configuration);
    return {
      title: "Sprawdź plan pobytu",
      explanation:
        "Godziny opieki albo plan dnia są niepełne. Otwórz plan pobytu i sprawdź wskazany dzień.",
      destination: target.destination,
      actionLabel: "Przejdź do wskazanego dnia",
      actionTo: target.actionTo,
    };
  }

  if (["REQ-WEEKEND-001", "REQ-ROTATION-001"].includes(ruleId)) {
    const target = weekendTarget(message, configuration);
    return {
      title: "Popraw wskazany weekend",
      explanation:
        "Tygodniowy bilans może być prawidłowy, ale wzorzec soboty lub niedzieli jest niepełny albo zawiera sprzeczny przydział.",
      destination: target.destination,
      actionLabel: "Przejdź do tego weekendu",
      actionTo: target.actionTo,
    };
  }

  if (
    [
      "REQ-UNAVAILABLE-HARD-001",
      "REQ-DAYS-001",
      "REQ-CROSS-GROUP-NO-OVERLAP-001",
      "REQ-CROSS-GROUP-REST-001",
    ].includes(ruleId)
  ) {
    return {
      title: "Sprawdź dostępność wychowawców",
      explanation:
        "Przydział koliduje z dostępnością, liczbą dni albo pracą tej osoby w innej grupie.",
      destination: "Wychowawcy → dostępność wskazanej osoby",
      actionLabel: "Otwórz wychowawców",
      actionTo: "/wychowawcy",
    };
  }

  if (
    [
      "REQ-LEGAL-001",
      "REQ-REST-DAILY-001",
      "REQ-REST-WEEKLY-001",
      "REQ-TIME-STEP-001",
      "REQ-SEGMENT-MIN-001",
      "REQ-CROSS-WEEK-001",
    ].includes(ruleId)
  ) {
    return {
      title: "Sprawdź reguły i odpoczynek",
      explanation:
        "Jedna z reguł organizacyjnych albo zasad odpoczynku nie jest spełniona.",
      destination: "Reguły → zasady organizacyjne i odpoczynki",
      actionLabel: "Otwórz reguły",
      actionTo: "/reguly#reguly-organizacyjne",
    };
  }

  return {
    title: "Sprawdź wskazane dane",
    explanation:
      "Aplikacja wykryła pozycję wymagającą uwagi. Otwórz szczegóły techniczne, a następnie popraw wskazany formularz.",
    destination: "Podsumowanie → szczegóły komunikatu",
    actionLabel: "Wróć do podsumowania",
    actionTo: "/podsumowanie",
  };
}
