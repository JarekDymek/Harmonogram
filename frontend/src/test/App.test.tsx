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
        name: /Sześć tygodni\. Trzy osoby\. Bez zgadywania\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Utwórz konfigurację" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Otwórz demonstrację" }),
    ).toBeEnabled();
    expect(screen.getByText("Wyłącznie tryb demonstracyjny")).toBeVisible();
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
      "harmonogram-mow-configuration-v1",
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
});
