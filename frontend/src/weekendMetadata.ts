import type { ScheduleConfiguration, WeekendVariant } from "./types";

/** offEducatorId is derived display metadata, never a second source of truth. */
export function deriveWeekendMetadata(configuration: ScheduleConfiguration, variant: WeekendVariant): WeekendVariant {
  const working = new Set([...variant.saturdayTemplate.assignments, ...variant.sundayTemplate.assignments].map(a => a.educatorId));
  const free = configuration.groupMemberships.filter(m => m.active && m.groupId === (variant.groupId ?? configuration.groupId)
    && configuration.educators.some(e => e.active && e.id === m.educatorId) && !working.has(m.educatorId));
  return {...variant, offEducatorId: free.length === 1 ? free[0].educatorId : null};
}
