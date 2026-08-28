import { describe, expect, it } from "vitest";
import {
  createNightAssignment,
  formatNightDateTime,
  localDateTimeToIso,
  prepareConfigurationForApi,
  recurringNightLabel,
} from "../nightDuties";
import { configurationFixture } from "./fixture";

describe("stałe i dodatkowe nocki", () => {
  it("rozwija wtorkową stałą nockę 22:00–06:00 na każdy tydzień", () => {
    const configuration = {
      ...structuredClone(configurationFixture),
      planningHorizonWeeks: 2,
      recurringNightDuties: [
        {
          id: "NIGHT-A-TUE",
          educatorId: "A",
          startDayOfWeek: 1,
          description: "Stała nocka",
        },
      ],
    };

    const prepared = prepareConfigurationForApi(configuration);

    expect(prepared).not.toHaveProperty("recurringNightDuties");
    expect(prepared.externalDutyAssignments).toHaveLength(2);
    expect(prepared.externalDutyAssignments[0]).toMatchObject({
      educatorId: "A",
      startDateTime: "2026-09-15T20:00:00.000Z",
      endDateTime: "2026-09-16T04:00:00.000Z",
      dutyType: "NIGHT",
      locked: true,
    });
    expect(prepared.externalDutyAssignments[1].startDateTime).toBe(
      "2026-09-22T20:00:00.000Z",
    );
  });

  it("zachowuje lokalną godzinę w strefie Europe/Warsaw", () => {
    expect(
      localDateTimeToIso("2026-10-27", "22:00", "Europe/Warsaw"),
    ).toBe("2026-10-27T21:00:00.000Z");
  });

  it("tworzy dodatkową nockę z końcem następnego dnia", () => {
    const assignment = createNightAssignment({
      id: "EXTRA",
      educatorId: "B",
      startDate: "2026-09-18",
      startTime: "20:00",
      endTime: "06:00",
      timeZoneId: "Europe/Warsaw",
      description: "Nadgodziny",
    });
    expect(assignment.startDateTime).toBe("2026-09-18T18:00:00.000Z");
    expect(assignment.endDateTime).toBe("2026-09-19T04:00:00.000Z");
  });

  it("opisuje nockę dniem rozpoczęcia i następnym dniem", () => {
    expect(recurringNightLabel(6)).toBe(
      "niedziela 22:00 → poniedziałek 06:00",
    );
  });

  it("pokazuje dodatkową nockę w lokalnej godzinie planu", () => {
    expect(
      formatNightDateTime("2026-09-18T18:00:00.000Z", "Europe/Warsaw"),
    ).toMatch(/18\.09\.2026, 20:00/);
  });
});
