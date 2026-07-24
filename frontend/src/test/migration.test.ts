import { describe, expect, it } from "vitest";
import { migrateConfiguration } from "../state/AppState";
import { configurationFixture } from "./fixture";

describe("migracja konfiguracji localStorage", () => {
  it("zachowuje wewnętrzne minuty i mapuje stary cykl", () => {
    const legacy = {
      ...configurationFixture,
      schemaVersion: undefined,
      educatorCount: undefined,
      planningHorizonWeeks: undefined,
      scheduleBoundaryMode: undefined,
      cycleLengthWeeks: 6,
      cycleIsRepeating: true,
    };
    const migrated = migrateConfiguration(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.planningHorizonWeeks).toBe(6);
    expect(migrated.scheduleBoundaryMode).toBe("CYCLIC");
    expect(migrated.educators[0].baseWeeklyAssignedMinutes).toBe(1650);
  });

  it("nie przelicza ponownie konfiguracji schematu 2", () => {
    const migrated = migrateConfiguration(configurationFixture);
    expect(migrated.educators[0].baseWeeklyAssignedMinutes).toBe(1650);
    expect(migrated.planningHorizonWeeks).toBe(1);
  });
});
