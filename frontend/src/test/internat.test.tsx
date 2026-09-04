import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { addBlankGroup } from "../groups";
import { AppStateProvider } from "../state/AppState";
import { configurationFixture } from "./fixture";

describe("projekt internatu", () => {

  it("widok całego internatu pokazuje wszystkie aktywne grupy", () => {
    const configuration = addBlankGroup(configurationFixture, "II");
    localStorage.setItem(
      "harmonogram-mow-configuration-v3",
      JSON.stringify(configuration),
    );
    localStorage.setItem(
      "harmonogram-mow-generation-v3",
      JSON.stringify({
        generationStatus: "CANDIDATE_FOUND",
        publicResult: "POPRAWNY_TRYB_DEMONSTRACYJNY",
        validationReport: { status: "VALID", validatorVersion: "3.1.0" },
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
