import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { resizeInternatGroups } from "../pages/BasicPage";
import { AppStateProvider } from "../state/AppState";
import { configurationFixture } from "./fixture";

describe("projekt internatu", () => {
  it("usuwa wszystkie zależności grupy podczas bezpiecznego zmniejszenia", () => {
    const two = resizeInternatGroups(configurationFixture, 2);
    const removedId = two.groups[1].id;
    const reduced = resizeInternatGroups(two, 1);
    expect(reduced.groupCount).toBe(1);
    expect(reduced.groups.some((item) => item.id === removedId)).toBe(false);
    expect(reduced.dayPlans.some((item) => item.groupId === removedId)).toBe(false);
    expect(reduced.groupMemberships.some((item) => item.groupId === removedId)).toBe(false);
    expect(reduced.weekendVariants.some((item) => item.groupId === removedId)).toBe(false);
  });

  it("widok całego internatu pokazuje wszystkie aktywne grupy", () => {
    const configuration = resizeInternatGroups(configurationFixture, 2);
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configuration),
    );
    localStorage.setItem(
      "harmonogram-mow-generation-v3",
      JSON.stringify({
        generationStatus: "CANDIDATE_FOUND",
        publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
        validationReport: { status: "VALID", validatorVersion: "2.0.0" },
        assignments: [
          { groupId: "G1", educatorId: "A", date: "2026-09-14", startMinute: 360, endMinute: 480 },
        ],
        care: [],
        messages: [],
      }),
    );
    render(
      <MemoryRouter initialEntries={["/internat"]}>
        <AppStateProvider><App /></AppStateProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Cały internat" })).toBeVisible();
    expect(screen.getByRole("table")).toHaveTextContent("Grupa testowa");
    expect(screen.getByRole("table")).toHaveTextContent("Grupa II");
    expect(screen.getByRole("table")).toHaveTextContent("06:00–08:00");
  });
});
