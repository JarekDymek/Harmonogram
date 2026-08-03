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
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.planningHorizonWeeks).toBe(6);
    expect(migrated.scheduleBoundaryMode).toBe("CYCLIC");
    expect(migrated.educators[0].baseWeeklyAssignedMinutes).toBe(1650);
    expect(migrated.groupCount).toBe(1);
    expect(migrated.groupMemberships[0].weeklyTargetHoursByWeek).toEqual([27.5]);
  });

  it("nie traci danych konfiguracji schematu 3", () => {
    const migrated = migrateConfiguration(configurationFixture);
    expect(migrated.educators[0].baseWeeklyAssignedMinutes).toBe(1650);
    expect(migrated.planningHorizonWeeks).toBe(1);
  });

  it("tworzy projekt, grupę i członkostwa ze starego zapisu jednej grupy", () => {
    const legacy = structuredClone(configurationFixture) as Partial<
      typeof configurationFixture
    >;
    legacy.schemaVersion = 2;
    delete legacy.groups;
    delete legacy.groupCount;
    delete legacy.activeGroupId;
    delete legacy.selectedGroupIds;
    delete legacy.groupMemberships;
    const migrated = migrateConfiguration(legacy);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.groups).toHaveLength(1);
    expect(migrated.groupMemberships).toHaveLength(3);
    expect(migrated.groupMemberships.map((item) => item.weeklyTargetHoursByWeek[0])).toEqual([27.5, 27.5, 27]);
    expect(migrated.educators.map((item) => item.displayName)).toEqual(
      configurationFixture.educators.map((item) => item.displayName),
    );
  });
});
