import type { ScheduleConfiguration } from "./types";
import { RULE_HELP } from "./ruleHelp";

const normalizedName = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("pl").replace(/\s+/g, " ");

/** Append one independently saved group, never overwrite by colliding G1/A/B IDs. */
export function mergeGroupConfiguration(current: ScheduleConfiguration, source: ScheduleConfiguration): ScheduleConfiguration {
  if (source.groups.length !== 1 || !source.groups[0].active) throw new Error("Dołączanie obsługuje plik jednej aktywnej grupy. Pełny projekt wielu grup wczytaj przez Eksport i import.");
  const group = source.groups[0];
  if (current.groups.length >= 8) throw new Error("Projekt ma już osiem grup.");
  if (current.groups.some(g => g.code.trim().toUpperCase() === group.code.trim().toUpperCase())) throw new Error(`Grupa ${group.code} już istnieje. Nie zastąpiono jej danymi z pliku.`);
  for (const [key, label] of [
    ["cycleStartDate", "początek cyklu"], ["planningHorizonWeeks", "liczba tygodni"],
    ["scheduleBoundaryMode", "granice harmonogramu"], ["timeZoneId", "strefa czasu"],
    ["startingWeekendVariant", "początkowa pozycja weekendu"],
  ] as const) {
    if (current[key] !== source[key]) throw new Error(`Różni się ${label}: projekt ${current[key]}, plik ${source[key]}. Uzgodnij to pole w Konfiguracji przed dołączeniem. Nie zmieniono danych.`);
  }
  const orgKeys = Object.keys(current.organizationalRules).filter(k => !["id", "configurationVersionId"].includes(k));
  const legalKeys = Object.keys(current.legalRules).filter(k => /^(minimum|maximum|weekly|jurisdiction)/.test(k));
  for (const [before, incoming, keys] of [[current.organizationalRules, source.organizationalRules, orgKeys], [current.legalRules, source.legalRules, legalKeys]] as const) {
    const differences = keys.filter(k => JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify((incoming as unknown as Record<string, unknown>)[k]));
    if (differences.length) {
      const labels: Record<string,string> = {timeStepMinutes:"Dokładność siatki czasu",minimumSegmentMinutes:"Minimum długości dyżuru",weekendRotationEnabled:"Rotacja weekendów",shortMiddleSegmentMinutes:"Krótki środkowy dyżur"};
      const details = differences.map(k => {
        const label = RULE_HELP[k]?.[0] ?? RULE_HELP[k.replace(/Minutes$/, "Hours")]?.[0] ?? labels[k] ?? k;
        const unit = k.endsWith("Minutes") ? " min" : "";
        const a = (before as unknown as Record<string, unknown>)[k], b = (incoming as unknown as Record<string, unknown>)[k];
        return `${label}: projekt ${String(a)}${unit}, plik ${String(b)}${unit}`;
      });
      throw new Error(`Pliki mają różne parametry w Regułach: ${details.join("; ")}. Nie zastąpiono reguł ani danych. Uzgodnij te parametry przed dołączeniem.`);
    }
  }
  const members = source.groupMemberships.filter(m => m.groupId === group.id);
  const people = new Set(members.map(m => m.educatorId));
  const educators = source.educators.filter(e => people.has(e.id));
  if (educators.length !== people.size || new Set(educators.map(e => e.id)).size !== people.size) throw new Error("Plik ma niejednoznaczne powiązania wychowawców z grupą. Nie dołączono danych.");
  // Never infer that two names are different people and silently double-book them.
  const shared = educators.filter(e => normalizedName(e.displayName) && current.educators.some(old => normalizedName(old.displayName) === normalizedName(e.displayName)));
  if (shared.length) throw new Error(`W obu projektach występują: ${shared.map(e => e.displayName).join(", ")}. Automatyczne dołączenie zatrzymano, aby nie utworzyć dwóch kopii tej samej osoby. Wspólne osoby wymagają uzgodnienia członkostw i dyżurów; istniejące dane pozostały bez zmian.`);
  const groupId = `G-${crypto.randomUUID()}`;
  const personIds = new Map(educators.map(e => [e.id, `EDU-${crypto.randomUUID()}`]));
  const variants = source.weekendVariants.filter(v => (v.groupId ?? source.groupId) === group.id);
  const variantIds = new Map(variants.map(v => [v.id, crypto.randomUUID()]));
  const remap = <T,>(value: T): T => {
    if (Array.isArray(value)) return value.map(remap) as T;
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (key === "id") return [key, crypto.randomUUID()];
      if (key === "configurationVersionId") return [key, current.configurationVersionId];
      if (key === "educatorId") {
        if (!personIds.has(item)) throw new Error("Wpis odwołuje się do wychowawcy spoza importowanej grupy. Nie dołączono danych.");
        return [key, personIds.get(item)];
      }
      if (key === "offEducatorId") return [key, personIds.get(item) ?? null];
      if (key === "groupId" || key === "budgetGroupId") {
        if (item && item !== group.id && item !== "EXTERNAL") throw new Error("Plik odwołuje się do innej, niezapisanej grupy. Nie dołączono danych.");
        return [key, item === group.id ? groupId : item];
      }
      if (key === "replacesWeekendRotationVariantId" && item) {
        if (!variantIds.has(item)) throw new Error("Zastępstwo nie ma wzorca bazowego w tym pliku. Nie dołączono danych.");
        return [key, variantIds.get(item)];
      }
      return [key, remap(item)];
    })) as T;
  };
  const next = structuredClone(current);
  next.groups.push({...group, id: groupId, displayOrder: current.groups.length + 1});
  next.educators.push(...educators.map(e => ({...remap(e), id: personIds.get(e.id)!, groupId: null})));
  next.groupMemberships.push(...members.map(remap));
  next.dayPlans.push(...source.dayPlans.filter(p => p.groupId === group.id).map(remap));
  next.weekendVariants.push(...variants.map(v => ({...remap(v), id: variantIds.get(v.id)!, groupId})));
  next.assignmentOverrides.push(...source.assignmentOverrides.filter(o => (o.groupId ?? source.groupId) === group.id).map(o => ({...remap(o), groupId})));
  next.commonAreaDuties.push(...source.commonAreaDuties.filter(d => d.groupId === group.id).map(remap));
  next.unavailability.push(...source.unavailability.filter(d => people.has(d.educatorId)).map(remap));
  next.externalDutyAssignments.push(...source.externalDutyAssignments.filter(d => people.has(d.educatorId)).map(remap));
  next.lockedAssignments.push(...source.lockedAssignments.filter(d => people.has(d.educatorId)).map(remap));
  next.requiredAssignments = [...(next.requiredAssignments ?? []), ...(source.requiredAssignments ?? []).filter(d => d.groupId === group.id).map(remap)];
  next.recurringRequiredDuties = [...(next.recurringRequiredDuties ?? []), ...(source.recurringRequiredDuties ?? []).filter(d => d.groupId === group.id).map(remap)];
  next.recurringNightDuties = [...(next.recurringNightDuties ?? []), ...(source.recurringNightDuties ?? []).filter(d => people.has(d.educatorId)).map(remap)];
  next.recurringSchoolWork = [...(next.recurringSchoolWork ?? []), ...(source.recurringSchoolWork ?? []).filter(d => people.has(d.educatorId)).map(remap)];
  next.weekendDaysOffPatterns = [...(next.weekendDaysOffPatterns ?? []), ...(source.weekendDaysOffPatterns ?? []).filter(d => people.has(d.educatorId)).map(remap)];
  if (source.boundaryContext) next.boundaryContext = {educators: [...(next.boundaryContext?.educators ?? []), ...source.boundaryContext.educators.filter(e => people.has(e.educatorId)).map(remap)]};
  next.groupCount = next.groups.filter(g => g.active).length;
  next.activeGroupId = next.groupId = groupId;
  next.groupName = group.name;
  next.educatorCount = members.filter(m => m.active).length === 4 ? 4 : 3;
  // Imported group starts suspended. Joint validation/generation is explicit.
  return next;
}
