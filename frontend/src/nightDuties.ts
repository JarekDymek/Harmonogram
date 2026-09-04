import type {
  ExternalDutyAssignment,
  RecurringNightDuty,
  ScheduleConfiguration,
  GroupEducatorMembership,
  WorkAssignment,
} from "./types";
import { WORK_RULES_VERSION } from "./workRules";
import { deriveWeekendMetadata } from "./weekendMetadata";

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

  // Sunday before the cycle contributes Monday's work/rest, not this week's hours.
  for (let dayIndex = -1; dayIndex < totalDays; dayIndex += 1) {
    const date = addDays(firstDate, dayIndex);
    if (weekdayIndex(date) !== duty.startDayOfWeek) continue;
    const startDate = formatDate(date);
    assignments.push(
      { ...createNightAssignment({
        id: `${GENERATED_NIGHT_PREFIX}${duty.id}-${startDate}`,
        educatorId: duty.educatorId,
        startDate,
        timeZoneId: configuration.timeZoneId,
        description:
          duty.description ||
          `Stała nocka: ${WEEKDAY_NAMES[duty.startDayOfWeek]} 22:00–06:00.`,
      }), regularNight: true, countsTowardsHours: true, creditedMinutes: 480,
        budgetGroupId: duty.budgetGroupId ?? nightBudgetGroup(configuration, duty.educatorId) },
    );
  }
  return assignments;
}

export function prepareConfigurationForApi(
  configuration: ScheduleConfiguration,
): Omit<ScheduleConfiguration, "recurringNightDuties" | "recurringSchoolWork" | "recurringRequiredDuties"> {
  const { recurringNightDuties = [], recurringSchoolWork = [], recurringRequiredDuties = [], ...backendConfiguration } = configuration;
  const manualAssignments = configuration.externalDutyAssignments.filter(
    (item) => !recurringNightDuties.some(d => item.id.startsWith(`${GENERATED_NIGHT_PREFIX}${d.id}-`))
      && !recurringSchoolWork.some(d => item.id.startsWith(`RECURRING-SCHOOL-${d.id}-`)),
  );
  const school: ExternalDutyAssignment[] = [];
  const required: WorkAssignment[] = [...(configuration.requiredAssignments ?? [])];
  const minute = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
  for (let day = 0; day < configuration.planningHorizonWeeks * 7; day++) {
    const date = addDays(parseDate(configuration.cycleStartDate), day);
    for (const item of recurringRequiredDuties.filter(i => i.dayOfWeek === weekdayIndex(date))) {
      required.push({ groupId: item.groupId, educatorId: item.educatorId, date: formatDate(date),
                      startMinute: minute(item.startTime), endMinute: minute(item.endTime) });
    }
    for (const item of recurringSchoolWork.filter(i => i.dayOfWeek === weekdayIndex(date))) {
      school.push({ id: `RECURRING-SCHOOL-${item.id}-${formatDate(date)}`, educatorId: item.educatorId,
                    startDateTime: localDateTimeToIso(formatDate(date), item.startTime, configuration.timeZoneId),
                    endDateTime: localDateTimeToIso(formatDate(date), item.endTime, configuration.timeZoneId),
                    dutyType: "SCHOOL", locked: true, countsTowardsHours: false, description: item.description || "Praca w szkole" });
    }
  }
  return {
    ...backendConfiguration,
    weekendVariants: configuration.weekendVariants.map(v => deriveWeekendMetadata(configuration, v)),
    requiredAssignments: required,
    externalDutyAssignments: [
      ...manualAssignments,
      ...school,
      ...recurringNightDuties.flatMap((duty) =>
        expandRecurringNight(configuration, duty),
      ),
    ],
  };
}

export function nightBudgetGroup(configuration: ScheduleConfiguration, educatorId: string): string | undefined {
  const memberships = configuration.groupMemberships.filter(m => m.active && m.educatorId === educatorId);
  return memberships.length === 1 ? memberships[0].groupId : undefined;
}

const expandedCache = new WeakMap<ScheduleConfiguration, ExternalDutyAssignment[]>();

export function fixedNightHours(configuration: ScheduleConfiguration, membership: GroupEducatorMembership, weekIndex: number): number {
  const first = addDays(parseDate(configuration.cycleStartDate), weekIndex * 7);
  const end = formatDate(addDays(first, 7));
  const start = formatDate(first);
  let duties = expandedCache.get(configuration);
  if (!duties) {
    duties = prepareConfigurationForApi(configuration).externalDutyAssignments;
    expandedCache.set(configuration, duties);
  }
  return duties.reduce((sum, d) => {
    const p = zonedParts(new Date(d.startDateTime), configuration.timeZoneId);
    const date = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    return sum + (d.regularNight && d.locked && d.countsTowardsHours && d.educatorId === membership.educatorId
      && d.budgetGroupId === membership.groupId && start <= date && date < end ? (d.creditedMinutes ?? 480) / 60 : 0);
  }, 0);
}

export function careHours(configuration: ScheduleConfiguration, membership: GroupEducatorMembership, weekIndex: number): number {
  return (membership.weeklyTargetHoursByWeek[weekIndex] ?? membership.weeklyTargetHoursByWeek.at(-1) ?? 0)
    - (membership.hoursIncludeFixedNights ? fixedNightHours(configuration, membership, weekIndex) : 0);
}

// The entered weekly total already includes regular nights. Editing the night
// calendar must never increase or decrease that employment allocation.
export function replaceRecurringNights(configuration: ScheduleConfiguration, nights: RecurringNightDuty[]): ScheduleConfiguration {
  return {...configuration, recurringNightDuties: nights,
    groupMemberships: configuration.groupMemberships.map(m => ({...m, hoursIncludeFixedNights: true}))};
}

export function calendarDuties(configuration: ScheduleConfiguration) {
  const duties = prepareConfigurationForApi(configuration).externalDutyAssignments.filter(d => d.locked);
  const first = parseDate(configuration.cycleStartDate);
  return Array.from({ length: configuration.planningHorizonWeeks * 7 }, (_, index) => {
    const date = formatDate(addDays(first, index));
    const start = new Date(localDateTimeToIso(date, "00:00", configuration.timeZoneId)).getTime();
    const end = new Date(localDateTimeToIso(formatDate(addDays(first, index + 1)), "00:00", configuration.timeZoneId)).getTime();
    return duties.filter(d => new Date(d.startDateTime).getTime() < end && start < new Date(d.endDateTime).getTime()).map(d => {
      const begin = zonedParts(new Date(d.startDateTime), configuration.timeZoneId);
      const finish = zonedParts(new Date(d.endDateTime), configuration.timeZoneId);
      return { ...d, date, startMinute: new Date(d.startDateTime).getTime() <= start ? 0 : begin.hour * 60 + begin.minute,
        endMinute: new Date(d.endDateTime).getTime() >= end ? 1440 : finish.hour * 60 + finish.minute };
    });
  }).flat();
}

// Add the nights once. The old day-care allocation and every original input survive.
export function migrateWorkCalendar(configuration: ScheduleConfiguration): ScheduleConfiguration {
  const next = { ...configuration, workRulesVersion: WORK_RULES_VERSION,
    weekendDaysOffPatterns: configuration.weekendDaysOffPatterns ?? [],
    recurringRequiredDuties: configuration.recurringRequiredDuties ?? [],
    recurringSchoolWork: configuration.recurringSchoolWork ?? [],
    requiredAssignments: configuration.requiredAssignments ?? [],
    recurringNightDuties: (configuration.recurringNightDuties ?? []).map(d => ({ ...d,
      budgetGroupId: d.budgetGroupId ?? nightBudgetGroup(configuration, d.educatorId) })),
  };
  next.groupMemberships = configuration.groupMemberships.map(m => {
    const migrated = {
      ...m,
      fixedPartialSchedule: m.fixedPartialSchedule ?? false,
    };
    return m.hoursIncludeFixedNights ? migrated : ({
      ...migrated,
      hoursIncludeFixedNights: true,
      weeklyTargetHoursByWeek: Array.from({ length: configuration.planningHorizonWeeks }, (_, w) =>
        (m.weeklyTargetHoursByWeek[w] ?? m.weeklyTargetHoursByWeek.at(-1) ?? 0) + fixedNightHours(next, m, w)),
    });
  });
  return next;
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
