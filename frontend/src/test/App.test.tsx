import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AppStateProvider } from "../state/AppState";
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
      screen.getByRole("button", { name: "Otwórz demonstrację" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Wyłącznie tryb demonstracyjny"),
    ).not.toBeInTheDocument();
  });

  it("wczytuje demonstrację przez API i przechodzi do konfiguracji", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => configurationFixture,
      }),
    );
    const user = userEvent.setup();
    renderApp();
    await user.click(
      screen.getByRole("button", { name: "Otwórz demonstrację" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Konfiguracja podstawowa" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Grupa testowa")).toBeVisible();
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
      await screen.findByRole("heading", { name: "4 członkostwa" }),
    ).toBeVisible();
    expect(screen.getAllByDisplayValue("Nowy wychowawca uzupełniający")).toHaveLength(1);
  });

  it("tworzy drugą grupę i wymaga potwierdzenia przed jej usunięciem", async () => {
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configurationFixture),
    );
    const confirmation = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderApp("/konfiguracja");
    await user.selectOptions(
      screen.getByLabelText("Liczba grup w internacie"),
      "2",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz konfigurację" }));
    expect(screen.getByLabelText("Aktualnie edytowana grupa")).toHaveDisplayValue("I · Grupa testowa");
    expect(screen.getByLabelText("Aktualnie edytowana grupa").querySelectorAll("option")).toHaveLength(2);
    await user.selectOptions(
      screen.getByLabelText("Liczba grup w internacie"),
      "1",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz konfigurację" }));
    expect(confirmation).toHaveBeenCalled();
    expect(screen.getByLabelText("Liczba grup w internacie")).toHaveValue("2");
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
      screen.getAllByLabelText(/^Godziny tygodniowo/),
    ).toHaveLength(3);
    expect(screen.getAllByDisplayValue("27,5")).toHaveLength(2);
    expect(screen.queryByText("Minuty tygodniowo")).not.toBeInTheDocument();
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
    expect(screen.getByLabelText("Minimum wyjątku")).toBeDisabled();
    expect(screen.getByLabelText("Wymiar kompensacji")).toBeDisabled();
    expect(screen.getByLabelText("Termin kompensacji")).toBeDisabled();
  });
});
