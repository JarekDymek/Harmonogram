import { describe, expect, it } from "vitest";
import {
  createDeviceTransferPackage,
  parseDeviceTransferPackage,
  serializeDeviceTransferPackage,
  transferFileName,
} from "../transfer";
import { configurationFixture } from "./fixture";

describe("przenoszenie konfiguracji między urządzeniami", () => {
  it("zachowuje pełną konfigurację i adres API", () => {
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
        createDeviceTransferPackage(
          configuration,
          "https://api.example.test",
        ),
      ),
    );

    expect(parsed.apiBaseUrl).toBe("https://api.example.test");
    expect(parsed.configuration.educators.map((item) => item.displayName)).toEqual(
      configuration.educators.map((item) => item.displayName),
    );
    expect(parsed.configuration.recurringNightDuties).toEqual(
      configuration.recurringNightDuties,
    );
    expect(parsed.configuration.unavailability).toEqual(
      configuration.unavailability,
    );
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
