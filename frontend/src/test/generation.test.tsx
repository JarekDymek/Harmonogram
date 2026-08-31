import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { isBetterPlan, isValidatedPlan } from "../generation";
import { SchedulePage } from "../pages/SchedulePage";
import { AppStateProvider } from "../state/AppState";
import type { GenerateResponse } from "../types";
import { configurationFixture } from "./fixture";

const plan: GenerateResponse = {
  generationStatus: "CANDIDATE_FOUND", publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
  assignments: [{groupId: "G1", educatorId: "A", date: "2026-09-14", startMinute: 360, endMinute: 480}],
  care: [], messages: [], optimizationProven: false,
  validationReport: {status: "VALID", publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY", validatorVersion: "2.0.0",
    legalProfileStatus: "UNVERIFIED", legalProfileVersion: "test", messages: []},
  objective: {splitDaysPenalty: 2, continuousBlockHandovers: 2, distinctEducatorsPerBlock: 2,
    totalSegments: 4, shortMiddleSegments: 0, preferredUnavailabilityPenalty: 0,
    longSegmentsPenalty: 0, afternoonPenalty: 0, weekendPenalty: 0, canonicalTieBreaker: 0, objectiveScore: 0},
};
const timeout: GenerateResponse = {
  generationStatus: "TIME_LIMIT", publicResult: "NIE_ZAKONCZONO_WYSZUKIWANIA", assignments: [], care: [], messages: [],
};

function show(result: GenerateResponse) {
  localStorage.setItem("harmonogram-mow-configuration-v3", JSON.stringify(configurationFixture));
  localStorage.setItem("harmonogram-mow-generation-v3", JSON.stringify(result));
  render(<MemoryRouter><AppStateProvider><SchedulePage /></AppStateProvider></MemoryRouter>);
}

describe("poprawny plan przed optymalizacją", () => {
  it("wymaga wyniku niezależnej kontroli, nie tylko niepustego planu", () => {
    expect(isValidatedPlan(plan)).toBe(true);
    expect(isValidatedPlan({...plan, validationReport: null})).toBe(false);
    expect(isValidatedPlan({...plan, publicResult: "BLAD_WEWNETRZNY"})).toBe(false);
    expect(isValidatedPlan({...plan, validationReport: {...plan.validationReport!, status: "INVALID"}})).toBe(false);
  });

  it("porównuje podział dni przed mniej ważnymi preferencjami", () => {
    expect(isBetterPlan({...plan, objective: {...plan.objective!, splitDaysPenalty: 1, totalSegments: 20}}, plan)).toBe(true);
    expect(isBetterPlan({...plan, objective: {...plan.objective!, splitDaysPenalty: 3, totalSegments: 1}}, plan)).toBe(false);
    expect(isBetterPlan(plan, plan)).toBe(false);
  });

  it.each([timeout, plan, {...plan, objective: {...plan.objective!, splitDaysPenalty: 3}}])(
    "zachowuje dobry plan po nieudanej albo gorszej próbie ulepszenia %#", async (response) => {
      const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => response});
      vi.stubGlobal("fetch", fetchMock);
      show(plan);
      await userEvent.click(screen.getByRole("button", {name: "Spróbuj ulepszyć podział"}));
      expect(await screen.findByRole("status")).toHaveTextContent("Zachowano dotychczasowy poprawny plan");
      expect(screen.getByRole("heading", {name: "Propozycja planu jest gotowa i sprawdzona"})).toBeVisible();
      expect(JSON.parse(localStorage.getItem("harmonogram-mow-generation-v3")!)).toEqual(plan);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/generate?optimize=true");
    },
  );

  it("po limicie pozwala szukać dłużej bez zmiany zapisanych godzin", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => plan});
    vi.stubGlobal("fetch", fetchMock);
    show(timeout);
    const before = localStorage.getItem("harmonogram-mow-configuration-v3");
    await userEvent.click(screen.getByRole("button", {name: "Szukaj dłużej"}));
    await screen.findByRole("heading", {name: "Propozycja planu jest gotowa i sprawdzona"});
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).solverTimeLimitSeconds).toBe(180);
    expect(localStorage.getItem("harmonogram-mow-configuration-v3")).toBe(before);
  });

  it("wydłuża tylko żądanie API, a nie konfigurację użytkownika", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => plan});
    vi.stubGlobal("fetch", fetchMock);
    const config = structuredClone(configurationFixture);
    const before = structuredClone(config);
    await api.generate(config);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/generate");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).solverTimeLimitSeconds).toBe(60);
    expect(config).toEqual(before);
  });

  it("nie pokazuje odrzuconych przypisań jako gotowego planu", () => {
    show({...plan, publicResult: "BLAD_WEWNETRZNY"});
    expect(screen.getByRole("heading", {name: "Wynik został odrzucony"})).toBeVisible();
    expect(screen.queryByRole("heading", {name: "Propozycja planu jest gotowa i sprawdzona"})).not.toBeInTheDocument();
  });

  it("nie traci dobrego planu, gdy przerwie się połączenie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    show(plan);
    await userEvent.click(screen.getByRole("button", {name: "Spróbuj ulepszyć podział"}));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Zachowano"));
    expect(JSON.parse(localStorage.getItem("harmonogram-mow-generation-v3")!)).toEqual(plan);
  });
});
