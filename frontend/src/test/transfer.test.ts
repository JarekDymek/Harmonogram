import { describe, expect, it } from "vitest";
import {
  LEGACY_TRANSFER_FORMAT,
  createProjectTransferPackage,
  isTransferredGenerationCompatible,
  parseDeviceTransferPackage,
  serializeDeviceTransferPackage,
  transferFileName,
} from "../transfer";
import type { GenerateResponse } from "../types";
import { configurationFixture } from "./fixture";

const validatedPlan: GenerateResponse = {
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

describe("przenoszenie projektu między urządzeniami", () => {
  it("zachowuje pełną konfigurację i gotowy, sprawdzony plan", () => {
    const configuration = structuredClone(configurationFixture);
    configuration.recurringNightDuties = [
      {
        id: "NIGHT-A",
        educatorId: "A",
        startDayOfWeek: 1,
        description: "Stała nocka",
      },
    ];
    configuration.unavailability.push({
      id: "UNAVAILABLE-A",
      educatorId: "A",
      scope: "RECURRING_WEEKLY",
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "12:00",
      type: "HARD",
      description: "Test",
    });

    const parsed = parseDeviceTransferPackage(
      serializeDeviceTransferPackage(
        createProjectTransferPackage(configuration, null, validatedPlan),
      ),
    );

    expect(parsed.configuration.educators.map((item) => item.displayName)).toEqual(
      configuration.educators.map((item) => item.displayName),
    );
    expect(parsed.configuration.recurringNightDuties).toEqual(
      configuration.recurringNightDuties,
    );
    expect(parsed.configuration.unavailability).toEqual(
      configuration.unavailability,
    );
    expect(parsed.generation?.assignments).toEqual(validatedPlan.assignments);
  });

  it("wczytuje starszy pakiet danych bez przenoszenia adresu API", () => {
    const parsed = parseDeviceTransferPackage(
      JSON.stringify({
        format: LEGACY_TRANSFER_FORMAT,
        version: 1,
        exportedAt: "2026-08-18T10:00:00.000Z",
        apiBaseUrl: "http://localhost:8000",
        configuration: configurationFixture,
      }),
    );
    expect(parsed.configuration.projectId).toBe("TEST");
    expect(parsed.generation).toBeNull();
    expect(parsed).not.toHaveProperty("apiBaseUrl");
  });

  it("nie dołącza wyniku niezgodnego z aktualną konfiguracją", () => {
    const wrong = {
      ...validatedPlan,
      assignments: [
        { ...validatedPlan.assignments[0], educatorId: "USUNIETY" },
      ],
    };
    expect(isTransferredGenerationCompatible(configurationFixture, wrong)).toBe(false);
    expect(
      createProjectTransferPackage(configurationFixture, null, wrong).generation,
    ).toBeNull();
  });

  it("odrzuca zwykły plik JSON i nie nadpisuje danych", () => {
    expect(() => parseDeviceTransferPackage('{"hello":"world"}')).toThrow(
      /nie jest obsługiwana wersja/i,
    );
  });

  it("tworzy rozpoznawalną nazwę prywatnego pakietu", () => {
    expect(transferFileName(configurationFixture)).toMatch(
      /^harmonogram-i-\d{4}-\d{2}-\d{2}\.harmonogram\.json$/,
    );
  });
});
