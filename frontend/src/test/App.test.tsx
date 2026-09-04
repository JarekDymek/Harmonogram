import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AppStateProvider } from "../state/AppState";
import {
  BEFORE_IMPORT_STORAGE_KEY,
  createProjectTransferPackage,
  serializeDeviceTransferPackage,
} from "../transfer";
import type { GenerateResponse } from "../types";
import { configurationFixture } from "./fixture";

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>,
  );
}

describe("główny przepływ interfejsu", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("pokazuje dwa bezpieczne sposoby rozpoczęcia pracy", () => {
    renderApp();
    expect(
      screen.getByRole("heading", {
        name: /Od jednej do ośmiu grup\. Jeden wspólny harmonogram internatu\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Utwórz konfigurację" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Zobacz reguły i podpowiedzi" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Wyłącznie tryb demonstracyjny"),
    ).not.toBeInTheDocument();
  });

  it("wczytuje demonstrację wyłącznie z narzędzi testowych w Regułach", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => configurationFixture,
      }),
    );
    const user = userEvent.setup();
    renderApp("/reguly");
    await user.click(screen.getByText("Narzędzia testowe — demonstracja"));
    await user.click(
      screen.getByRole("button", { name: "Otwórz demonstrację" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Reguły/ }),
      ).toBeInTheDocument(),
    );
    expect(JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!).requestedOperationMode).toBe("DEMONSTRATION");
    expect(fetch).toHaveBeenCalledWith(
      "/api/demo",
      expect.objectContaining({
        headers: {},
      }),
    );
  });

  it("waliduje formularz podstawowy przez Zod i React Hook Form", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v2",
      JSON.stringify(configurationFixture),
    );
    const user = userEvent.setup();
    renderApp("/konfiguracja");
    const input = screen.getByLabelText("Nazwa grupy");
    await user.clear(input);
    await user.click(
      screen.getByRole("button", { name: "Zapisz konfigurację" }),
    );
    expect(await screen.findByText("Podaj nazwę grupy.")).toBeVisible();
  });

  it("pozwala jawnie przełączyć zespół z trzech na cztery osoby", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v2",
      JSON.stringify(configurationFixture),
    );
    const user = userEvent.setup();
    renderApp("/konfiguracja");
    await user.selectOptions(screen.getByLabelText("Liczba wychowawców"), "4");
    await user.click(
      screen.getByRole("button", { name: "Zapisz konfigurację" }),
    );
    await user.click(screen.getByRole("link", { name: /Wychowawcy/ }));
    expect(
      await screen.findByRole("heading", { name: "Godziny opieki · 4 osoby" }),
    ).toBeVisible();
    expect(screen.getAllByDisplayValue("Nowy wychowawca uzupełniający")).toHaveLength(1);
  });

  it("dodaje konkretną pustą grupę bez zmiany zakresu istniejącej", async () => {
    localStorage.setItem("harmonogram-mow-configuration-v3", JSON.stringify(configurationFixture));
    const user = userEvent.setup();
    renderApp("/konfiguracja");
    await user.selectOptions(screen.getByLabelText("Oznaczenie nowej grupy"), "VII");
    await user.click(screen.getByRole("button", {name:"Dodaj pustą grupę"}));
    expect(screen.getByLabelText("Aktualnie edytowana grupa")).toHaveDisplayValue("VII · Grupa VII");
    expect(screen.getByLabelText("Aktualnie edytowana grupa").querySelectorAll("option")).toHaveLength(2);
    const saved = JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!);
    expect(saved.selectedGroupIds).toEqual(["G1"]);
    expect(screen.queryByLabelText("Liczba grup w internacie")).toBeNull();
  });

  it("udostępnia cykl tylko dla horyzontu sześciotygodniowego", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v2",
      JSON.stringify(configurationFixture),
    );
    const user = userEvent.setup();
    renderApp("/konfiguracja");
    const boundary = screen.getByLabelText("Granice harmonogramu");
    expect(
      screen.getByRole("option", {
        name: "Cykl powtarzalny (tylko 6 tygodni)",
      }),
    ).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Horyzont planowania"), "6");
    expect(
      screen.getByRole("option", {
        name: "Cykl powtarzalny (tylko 6 tygodni)",
      }),
    ).toBeEnabled();
    await user.selectOptions(boundary, "CYCLIC");
    await user.click(
      screen.getByRole("button", { name: "Zapisz konfigurację" }),
    );
    expect(boundary).toHaveValue("CYCLIC");
  });

  it("pokazuje przydziały wyłącznie jako godziny", () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v2",
      JSON.stringify(configurationFixture),
    );
    renderApp("/wychowawcy");
    expect(
      screen.getAllByLabelText(/^Łącznie: opieka/),
    ).toHaveLength(3);
    expect(screen.getAllByDisplayValue("27,5")).toHaveLength(2);
    expect(screen.queryByText("Minuty tygodniowo")).not.toBeInTheDocument();
  });

  it("usuwa czwarte członkostwo, zachowuje rejestr i unieważnia poprzedni wynik", async () => {
    const config = structuredClone(configurationFixture);
    config.educatorCount = 4;
    config.educators.push({...config.educators[0], id: "D", displayName: "Czwarta osoba", shortCode: "D"});
    config.groupMemberships.push({...config.groupMemberships[0], id: "MEM-D", educatorId: "D", role: "SUPPORT"});
    localStorage.setItem("harmonogram-mow-configuration-v3", JSON.stringify(config));
    localStorage.setItem("harmonogram-mow-generation-v3", JSON.stringify({generationStatus: "TIME_LIMIT", publicResult: "NIE_ZAKONCZONO_WYSZUKIWANIA", assignments: [], care: [], messages: []}));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderApp("/wychowawcy");
    await user.click(screen.getAllByText("Więcej ustawień osoby")[3]);
    await user.click(screen.getAllByRole("button", {name: "Usuń z tej grupy"})[3]);
    expect(screen.getByRole("heading", {name: "Godziny opieki · 3 osoby"})).toBeVisible();
    const saved = JSON.parse(localStorage.getItem("harmonogram-mow-configuration-v3")!);
    expect(saved.educatorCount).toBe(3);
    expect(saved.groupMemberships.map((m: {educatorId: string}) => m.educatorId)).toEqual(["A", "B", "C"]);
    expect(saved.educators).toHaveLength(4);
    expect(saved.educators.find((e: {id: string}) => e.id === "D").displayName).toBe("Czwarta osoba");
    expect(localStorage.getItem("harmonogram-mow-generation-v3")).toBeNull();
    expect(screen.getByText(/Osoba pozostająca tylko w rejestrze/)).toBeVisible();
  });

  it("zaznacza dokładny tydzień i mówi, o ile zmienić sumę godzin", () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configurationFixture),
    );
    localStorage.setItem(
      "harmonogram-mow-input-report-v3",
      JSON.stringify({
        status: "INVALID_INPUT",
        messages: [
          {
            ruleId: "REQ-HOURS-001",
            severity: "ERROR",
            message: "W tygodniu 1 brakuje 2 godz.",
            groupId: "G1",
            context: {
              weekNumber: 1,
              requiredMinutes: 5040,
              assignedMinutes: 4920,
              differenceMinutes: -120,
            },
          },
        ],
        care: [],
        weeklyBalance: [
          {
            groupId: "G1",
            weekNumber: 1,
            startDate: "2026-09-14",
            endDate: "2026-09-20",
            requiredMinutes: 5040,
            assignedMinutes: 4920,
            differenceMinutes: -120,
            educatorMinutes: { A: 1650, B: 1650, C: 1620 },
          },
        ],
      }),
    );

    renderApp("/wychowawcy?grupa=G1#godziny-tydzien-1");

    const balanceCard = screen.getByText("brakuje 2 godz.").closest("article");
    expect(balanceCard).toBeVisible();
    expect(balanceCard).toHaveTextContent("zwiększ sumę pól tego tygodnia o 2 godz.");
    for (const input of screen.getAllByLabelText(/^Łącznie: opieka/)) {
      expect(input).toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.queryByText("Globalne podsumowanie godzin")).not.toBeInTheDocument();
  });

  it("wymaga pełnego śladu przed zapisaniem statusu VERIFIED", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v2",
      JSON.stringify(configurationFixture),
    );
    const user = userEvent.setup();
    renderApp("/reguly");
    await user.selectOptions(
      screen.getByLabelText("Status weryfikacji"),
      "VERIFIED",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz reguły" }));
    expect(
      await screen.findByText("Podaj datę i czas weryfikacji."),
    ).toBeVisible();
    expect(
      screen.getByText("Podaj datę początku obowiązywania."),
    ).toBeVisible();
    expect(screen.getByText("Podaj osobę zatwierdzającą.")).toBeVisible();
  });

  it("nie wymaga parametrów wyłączonego wyjątku i kompensacji", () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v2",
      JSON.stringify(configurationFixture),
    );
    renderApp("/reguly");
    expect(screen.getByLabelText("Minimum wyjątku")).toBeEnabled();
    expect(screen.getByLabelText("Wymiar kompensacji")).toBeEnabled();
    expect(screen.getByLabelText("Termin kompensacji")).toBeEnabled();
  });

  it("dodaje stałą nockę przez wybór osoby i dnia bez wpisywania dat", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configurationFixture),
    );
    const user = userEvent.setup();
    const view = renderApp("/wychowawcy");

    await user.selectOptions(
      screen.getByLabelText("Wychowawca stałej nocki"),
      "A",
    );
    await user.selectOptions(
      screen.getByLabelText("Dzień rozpoczęcia stałej nocki"),
      "1",
    );
    await user.click(screen.getByRole("button", { name: "Dodaj stałą nockę" }));

    expect(
      await screen.findByText(/Wychowawca A · wtorek 22:00 → środa 06:00 · dwa dni pracy · co tydzień/i),
    ).toBeVisible();
    expect(view.container.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it("jednym przyciskiem sprawdza dane i nie uruchamia generatora po konkretnym błędzie", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configurationFixture),
    );
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "INVALID_INPUT",
        publicResult: "DANE_NIEPOPRAWNE",
        care: [],
        weeklyBalance: [],
        messages: [
          {
            ruleId: "REQ-CROSS-GROUP-REST-001",
            severity: "ERROR",
            message:
              "Stała nocka Wychowawca B koliduje z pracą w pozycji weekendu 1.",
            educatorId: "B",
            context: {
              conflictType: "NIGHT_WEEKEND_REST",
              position: 1,
              weekNumber: 1,
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", request);
    const user = userEvent.setup();
    renderApp("/podsumowanie");

    await user.click(
      screen.getByRole("button", {
        name: "Sprawdź i wygeneruj harmonogram",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /Nocka Wychowawca B koliduje z pracą w weekend/i,
      }),
    ).toBeVisible();
    expect(screen.getByText("Krok 1 z 1")).toBeVisible();
    expect(screen.getByLabelText("Proponowane sposoby naprawy")).toHaveTextContent(
      "Opcja 2",
    );
    expect(
      screen.getAllByRole("link", { name: "Zmień dzienny dyżur weekendowy" })[0],
    ).toHaveAttribute("href", "/weekendy#weekend-pozycja-1");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("/api/validate-input");
  });

  it("jednym przyciskiem po poprawnej kontroli uruchamia generator", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configurationFixture),
    );
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "VALID_INPUT",
          care: [],
          weeklyBalance: [],
          messages: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generationStatus: "CANDIDATE_FOUND",
          publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
          assignments: [
            {
              groupId: "G1",
              educatorId: "A",
              date: "2026-09-14",
              startMinute: 360,
              endMinute: 480,
            },
          ],
          care: [],
          messages: [],
        }),
      });
    vi.stubGlobal("fetch", request);
    const user = userEvent.setup();
    renderApp("/podsumowanie");

    await user.click(
      screen.getByRole("button", {
        name: "Sprawdź i wygeneruj harmonogram",
      }),
    );

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls.map((item) => item[0])).toEqual([
      "/api/validate-input",
      "/api/generate",
    ]);
  });

  it("udostępnia import projektu na każdym urządzeniu bez konfiguracji", () => {
    renderApp("/urzadzenia");
    expect(
      screen.getByRole("heading", { name: "Eksport i import projektu" }),
    ).toBeVisible();
    expect(screen.getByText(/Na tym urządzeniu nie ma projektu/i)).toBeVisible();
    expect(screen.getByText("Wybierz plik projektu")).toBeVisible();
  });

  it("wczytuje gotowy plan z pliku i zachowuje pełną kopię poprzedniego projektu", async () => {
    const previous = {
      ...structuredClone(configurationFixture),
      projectName: "Projekt przed importem",
    };
    const previousGeneration: GenerateResponse = {
      generationStatus: "TIME_LIMIT",
      publicResult: "NIE_ZAKONCZONO_WYSZUKIWANIA",
      assignments: [],
      care: [],
      messages: [],
    };
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(previous),
    );
    localStorage.setItem(
      "harmonogram-mow-generation-v3",
      JSON.stringify(previousGeneration),
    );
    const imported = {
      ...structuredClone(configurationFixture),
      projectName: "Projekt po imporcie",
    };
    const importedGeneration: GenerateResponse = {
      generationStatus: "CANDIDATE_FOUND",
      publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
      assignments: [
        {
          groupId: "G1",
          educatorId: "A",
          date: "2026-09-14",
          startMinute: 360,
          endMinute: 480,
        },
      ],
      care: [],
      messages: [],
      validationReport: {
        status: "VALID",
        publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
        validatorVersion: "3.1.0",
        messages: [],
        legalProfileStatus: "UNVERIFIED",
        legalProfileVersion: "test",
      },
    };
    const file = new File(
      [
        serializeDeviceTransferPackage(
          createProjectTransferPackage(imported, null, importedGeneration),
        ),
      ],
      "projekt.harmonogram.json",
      { type: "application/json" },
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderApp("/urzadzenia");

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input!, file);
    expect(await screen.findByText("Tak — zostanie wczytany")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Wczytaj projekt na tym urządzeniu" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Propozycja planu jest gotowa i sprawdzona",
      }),
    ).toBeVisible();
    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem("harmonogram-mow-generation-v3") || "null",
      );
      expect(saved.assignments).toEqual(importedGeneration.assignments);
    });
    const backup = JSON.parse(localStorage.getItem(BEFORE_IMPORT_STORAGE_KEY)!);
    expect(backup.configuration.projectName).toBe("Projekt przed importem");
    expect(backup.generation.generationStatus).toBe("TIME_LIMIT");
  });
});
