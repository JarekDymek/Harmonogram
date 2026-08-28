import type {
  ExternalDutyAssignment,
  RecurringNightDuty,
  ScheduleConfiguration,
} from "./types";

export const NIGHT_START_TIME = "22:00";
export const NIGHT_END_TIME = "06:00";

export const WEEKDAY_NAMES = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
] as const;

const GENERATED_NIGHT_PREFIX = "RECURRING-NIGHT-";

function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Nieprawidłowa data początku cyklu.");
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function weekdayIndex(value: Date): number {
  return (value.getUTCDay() + 6) % 7;
}

function zonedParts(value: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

export function localDateTimeToIso(
  date: string,
  time: string,
  timeZone: string,
): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new Error("Podaj poprawną datę i godzinę dyżuru.");
  }

  const desiredUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  let instant = desiredUtc;
  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant = desiredUtc - (representedUtc - instant);
  }
  return new Date(instant).toISOString();
}

export function createNightAssignment({
  id,
  educatorId,
  startDate,
  startTime = NIGHT_START_TIME,
  endTime = NIGHT_END_TIME,
  timeZoneId,
  description,
}: {
  id: string;
  educatorId: string;
  startDate: string;
  startTime?: string;
  endTime?: string;
  timeZoneId: string;
  description: string;
}): ExternalDutyAssignment {
  const endDate = formatDate(addDays(parseDate(startDate), 1));
  return {
    id,
    educatorId,
    startDateTime: localDateTimeToIso(startDate, startTime, timeZoneId),
    endDateTime: localDateTimeToIso(endDate, endTime, timeZoneId),
    dutyType: "NIGHT",
    locked: true,
    countsTowardsHours: false,
    description,
  };
}

function expandRecurringNight(
  configuration: ScheduleConfiguration,
  duty: RecurringNightDuty,
): ExternalDutyAssignment[] {
  const firstDate = parseDate(configuration.cycleStartDate);
  const totalDays = configuration.planningHorizonWeeks * 7;
  const assignments: ExternalDutyAssignment[] = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const date = addDays(firstDate, dayIndex);
    if (weekdayIndex(date) !== duty.startDayOfWeek) continue;
    const startDate = formatDate(date);
    assignments.push(
      createNightAssignment({
        id: `${GENERATED_NIGHT_PREFIX}${duty.id}-${startDate}`,
        educatorId: duty.educatorId,
        startDate,
        timeZoneId: configuration.timeZoneId,
        description:
          duty.description ||
          `Stała nocka: ${WEEKDAY_NAMES[duty.startDayOfWeek]} 22:00–06:00.`,
      }),
    );
  }
  return assignments;
}

export function prepareConfigurationForApi(
  configuration: ScheduleConfiguration,
): Omit<ScheduleConfiguration, "recurringNightDuties"> {
  const { recurringNightDuties = [], ...backendConfiguration } = configuration;
  const manualAssignments = configuration.externalDutyAssignments.filter(
    (item) => !item.id.startsWith(GENERATED_NIGHT_PREFIX),
  );
  return {
    ...backendConfiguration,
    externalDutyAssignments: [
      ...manualAssignments,
      ...recurringNightDuties.flatMap((duty) =>
        expandRecurringNight(configuration, duty),
      ),
    ],
  };
}

export function recurringNightLabel(dayOfWeek: number): string {
  const start = WEEKDAY_NAMES[dayOfWeek] ?? "wybrany dzień";
  const end = WEEKDAY_NAMES[(dayOfWeek + 1) % 7] ?? "następny dzień";
  return `${start} 22:00 → ${end} 06:00`;
}

export function formatNightDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
