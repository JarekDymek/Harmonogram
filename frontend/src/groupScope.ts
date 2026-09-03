import type { GenerateResponse, ScheduleConfiguration } from "./types";
import { prepareConfigurationForApi } from "./nightDuties";

export function generatedGroups(result: GenerateResponse | null): string[] {
  return [...new Set([...(result?.care ?? []).map(a => a.groupId),
    ...(result?.assignments ?? []).map(a => a.groupId)])].sort();
}

// Ignore navigation and edits to unrelated suspended groups, not known fixed
// work of shared people. Such commitments still affect collisions and rest.
export function planInputs(configuration: ScheduleConfiguration, ids: string[]): string {
  const selected = new Set(ids);
  const members = configuration.groupMemberships.filter(m => selected.has(m.groupId));
  const people = new Set(members.filter(m => m.active).map(m => m.educatorId));
  const c = prepareConfigurationForApi(configuration);
  return JSON.stringify({
    project: c.projectId, start: c.cycleStartDate, weeks: c.planningHorizonWeeks,
    boundary: c.scheduleBoundaryMode, timezone: c.timeZoneId, mode: c.requestedOperationMode,
    rotation: c.startingWeekendVariant, legal: c.legalRules, rules: c.organizationalRules,
    groups: c.groups.filter(g => selected.has(g.id)).map(({displayOrder, ...g}) => g),
    members, educators: c.educators.filter(e => people.has(e.id)),
    plans: c.dayPlans.filter(p => selected.has(p.groupId)),
    variants: c.weekendVariants.filter(v => selected.has(v.groupId ?? "")),
    overrides: c.assignmentOverrides.filter(o => selected.has(o.groupId ?? "")),
    common: c.commonAreaDuties.filter(d => selected.has(d.groupId)),
    unavailability: c.unavailability.filter(u => people.has(u.educatorId)),
    duties: c.externalDutyAssignments.filter(d => people.has(d.educatorId)),
    required: c.requiredAssignments?.filter(a => selected.has(a.groupId) || people.has(a.educatorId)),
    locked: c.lockedAssignments.filter(a => people.has(a.educatorId)),
    off: c.weekendDaysOffPatterns?.filter(p => people.has(p.educatorId)),
    context: c.boundaryContext?.educators.filter(e => people.has(e.educatorId)),
  });
}
