import type { ScheduleConfiguration } from "./types";

export const GROUP_CODES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** Adding a group is not cloning a group. Existing IDs, inputs and scope survive. */
export function addBlankGroup(configuration: ScheduleConfiguration, code: string): ScheduleConfiguration {
  code = code.trim().toUpperCase();
  if (!GROUP_CODES.includes(code)) throw new Error("Wybierz oznaczenie grupy od I do VIII.");
  if (configuration.groups.length >= 8) throw new Error("Projekt zawiera już osiem grup.");
  if (configuration.groups.some(g => g.code.trim().toUpperCase() === code)) {
    throw new Error("Ta grupa już istnieje. Wybierz ją na liście zamiast tworzyć ponownie.");
  }
  const next = structuredClone(configuration);
  const groupId = `G-${crypto.randomUUID()}`;
  next.groups.push({id: groupId, displayOrder: GROUP_CODES.indexOf(code) + 1,
    code, name: `Grupa ${code}`, classLabel: "", active: true});
  for (let index = 0; index < 3; index++) {
    const educatorId = `EDU-${crypto.randomUUID()}`;
    next.educators.push({id: educatorId, groupId: null, displayName: "", shortCode: "",
      baseWeeklyAssignedMinutes: 0, active: true, canWorkWeekends: true, description: ""});
    next.groupMemberships.push({id: crypto.randomUUID(), groupId, educatorId,
      role: "PRIMARY", active: true, weeklyTargetHoursByWeek: [0],
      hoursIncludeFixedNights: true, fixedPartialSchedule: false, description: ""});
  }
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    next.dayPlans.push({id: crypto.randomUUID(), configurationVersionId: next.configurationVersionId,
      groupId, scope: "BASE_WEEKLY", dayOfWeek, operatingIntervals: [], noCareIntervals: [],
      description: "", approved: false, approvedAt: null, approvedBy: ""});
  }
  next.groupCount = next.groups.filter(g => g.active).length;
  next.activeGroupId = next.groupId = groupId;
  next.groupName = `Grupa ${code}`;
  next.educatorCount = 3;
  // Do not join an unfinished group or replace any saved schedule.
  return next;
}
