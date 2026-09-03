import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DemoNotice, EmptyState, PageHeader, StatusBadge } from "../components/UI";
import { useAppState } from "../state/AppState";
import { careHours } from "../nightDuties";
import type { ScheduleConfiguration, WeekendVariant } from "../types";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const schema = z
  .object({
    projectName: z.string().min(3, "Podaj nazwę projektu."),
    groupCount: z.number().int().min(1).max(8),
    groupName: z.string().min(2, "Podaj nazwę grupy."),
    groupCode: z.string().min(1, "Podaj oznaczenie grupy."),
    classLabel: z.string(),
    cycleStartDate: z.string().min(1, "Wybierz datę."),
    timeZoneId: z.string().min(3, "Podaj strefę IANA."),
    startingWeekendVariant: z.number().int().min(1).max(6),
    requestedOperationMode: z.enum(["PRODUCTION", "DEMONSTRATION"]),
    educatorCount: z.union([z.literal(3), z.literal(4)]),
    planningHorizonWeeks: z.number().int().min(1).max(6),
    scheduleBoundaryMode: z.enum(["FINITE", "CYCLIC"]),
  })
  .superRefine((value, context) => {
    if (value.scheduleBoundaryMode === "CYCLIC" && value.planningHorizonWeeks !== 6) {
      context.addIssue({
        code: "custom",
        path: ["scheduleBoundaryMode"],
        message: "Tryb cykliczny wymaga dokładnie sześciu tygodni.",
      });
    }
  });
type FormValues = z.infer<typeof schema>;

function cloneWeekendVariant(
  source: WeekendVariant,
  groupId: string,
  educatorMap: Map<string, string>,
): WeekendVariant {
  const variant = structuredClone(source);
  variant.id = crypto.randomUUID();
  variant.groupId = groupId;
  variant.replacesWeekendRotationVariantId = null;
  variant.saturdayTemplate.id = crypto.randomUUID();
  variant.sundayTemplate.id = crypto.randomUUID();
  if (variant.offEducatorId) {
    variant.offEducatorId = educatorMap.get(variant.offEducatorId) ?? null;
  }
  for (const template of [variant.saturdayTemplate, variant.sundayTemplate]) {
    for (const assignment of template.assignments) {
      assignment.id = crypto.randomUUID();
      assignment.educatorId =
        educatorMap.get(assignment.educatorId) ?? assignment.educatorId;
    }
  }
  return variant;
}

export function resizeInternatGroups(
  configuration: ScheduleConfiguration,
  targetCount: number,
): ScheduleConfiguration {
  const next = structuredClone(configuration);
  const active = next.groups
    .filter((item) => item.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  if (targetCount < active.length) {
    const removedIds = new Set(active.slice(targetCount).map((item) => item.id));
    next.groups = next.groups.filter((item) => !removedIds.has(item.id));
    next.dayPlans = next.dayPlans.filter((item) => !removedIds.has(item.groupId));
    next.weekendVariants = next.weekendVariants.filter(
      (item) => !item.groupId || !removedIds.has(item.groupId),
    );
    next.groupMemberships = next.groupMemberships.filter(
      (item) => !removedIds.has(item.groupId),
    );
    next.assignmentOverrides = next.assignmentOverrides.filter(
      (item) => !item.groupId || !removedIds.has(item.groupId),
    );
    next.commonAreaDuties = next.commonAreaDuties.filter(
      (item) => !removedIds.has(item.groupId),
    );
    next.lockedAssignments = next.lockedAssignments.filter(
      (item) => !removedIds.has(item.groupId),
    );
    next.requiredAssignments = (next.requiredAssignments ?? []).filter(item => !removedIds.has(item.groupId));
    next.recurringRequiredDuties = (next.recurringRequiredDuties ?? []).filter(item => !removedIds.has(item.groupId));
    const usedEducators = new Set(
      next.groupMemberships.map((item) => item.educatorId),
    );
    const removedEducators = new Set(
      next.educators
        .filter((item) => !usedEducators.has(item.id))
        .map((item) => item.id),
    );
    next.educators = next.educators.filter((item) => usedEducators.has(item.id));
    next.unavailability = next.unavailability.filter(
      (item) => !removedEducators.has(item.educatorId),
    );
    next.externalDutyAssignments = next.externalDutyAssignments.filter(
      (item) => !removedEducators.has(item.educatorId),
    );
    next.recurringNightDuties = (next.recurringNightDuties ?? []).filter(item => !removedEducators.has(item.educatorId));
    next.recurringSchoolWork = (next.recurringSchoolWork ?? []).filter(item => !removedEducators.has(item.educatorId));
    if (next.boundaryContext) {
      next.boundaryContext.educators = next.boundaryContext.educators.filter(
        (item) => !removedEducators.has(item.educatorId),
      );
    }
  } else if (targetCount > active.length) {
    const sourceGroup =
      next.groups.find((item) => item.id === next.activeGroupId) ?? active[0];
    const sourceMemberships = next.groupMemberships
      .filter((item) => item.groupId === sourceGroup.id && item.active)
      .slice(0, 3);
    for (let index = active.length; index < targetCount; index += 1) {
      const groupId = `G-${crypto.randomUUID()}`;
      next.groups.push({
        id: groupId,
        displayOrder: index + 1,
        code: ROMAN[index],
        name: `Grupa ${ROMAN[index]}`,
        classLabel: "",
        active: true,
      });
      const educatorMap = new Map<string, string>();
      for (const [memberIndex, sourceMembership] of sourceMemberships.entries()) {
        const sourceEducator = next.educators.find(
          (item) => item.id === sourceMembership.educatorId,
        );
        if (!sourceEducator) continue;
        const educatorId = `EDU-${crypto.randomUUID()}`;
        educatorMap.set(sourceEducator.id, educatorId);
        next.educators.push({
          ...sourceEducator,
          id: educatorId,
          groupId: null,
          displayName: `Nowy wychowawca ${ROMAN[index]}-${memberIndex + 1}`,
          shortCode: `${ROMAN[index]}${memberIndex + 1}`,
        });
        next.groupMemberships.push({
          ...sourceMembership,
          weeklyTargetHoursByWeek: Array.from({ length: next.planningHorizonWeeks }, (_, week) => careHours(configuration, sourceMembership, week)),
          id: crypto.randomUUID(),
          groupId,
          educatorId,
        });
      }
      next.dayPlans.push(
        ...next.dayPlans
          .filter((item) => item.groupId === sourceGroup.id)
          .map((item) => ({
            ...structuredClone(item),
            id: crypto.randomUUID(),
            groupId,
            operatingIntervals: item.operatingIntervals.map((interval) => ({
              ...interval,
              id: crypto.randomUUID(),
            })),
            noCareIntervals: item.noCareIntervals.map((interval) => ({
              ...interval,
              id: crypto.randomUUID(),
            })),
          })),
      );
      next.weekendVariants.push(
        ...next.weekendVariants
          .filter((item) => item.groupId === sourceGroup.id)
          .map((item) => cloneWeekendVariant(item, groupId, educatorMap)),
      );
    }
  }
  const remaining = next.groups
    .filter((item) => item.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  next.groupCount = remaining.length;
  next.selectedGroupIds = next.selectedGroupIds.filter(id => remaining.some(group => group.id === id));
  if (!remaining.some((item) => item.id === next.activeGroupId)) {
    next.activeGroupId = remaining[0].id;
  }
  const activeGroup = remaining.find((item) => item.id === next.activeGroupId)!;
  next.groupId = activeGroup.id;
  next.groupName = activeGroup.name;
  next.educatorCount = (next.groupMemberships.filter(
    (item) => item.active && item.groupId === activeGroup.id,
  ).length === 4
    ? 4
    : 3) as 3 | 4;
  return next;
}

export function BasicPage() {
  const { configuration, setConfiguration, setSelectedGroups, busy } = useAppState();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { register, reset, watch, handleSubmit, formState: { errors, isSubmitSuccessful } } = form;

  useEffect(() => {
    if (!configuration) return;
    const group = configuration.groups.find(
      (item) => item.id === configuration.activeGroupId,
    )!;
    reset({
      projectName: configuration.projectName,
      groupCount: configuration.groupCount,
      groupName: group.name,
      groupCode: group.code,
      classLabel: group.classLabel,
      cycleStartDate: configuration.cycleStartDate,
      timeZoneId: configuration.timeZoneId,
      startingWeekendVariant: configuration.startingWeekendVariant,
      requestedOperationMode: configuration.requestedOperationMode,
      educatorCount: configuration.educatorCount,
      planningHorizonWeeks: configuration.planningHorizonWeeks,
      scheduleBoundaryMode: configuration.scheduleBoundaryMode,
    });
  }, [configuration, reset]);

  if (!configuration) {
    return <EmptyState>Wróć na stronę startową i utwórz konfigurację albo wczytaj demonstrację.</EmptyState>;
  }

  const selectedHorizon = watch("planningHorizonWeeks", configuration.planningHorizonWeeks);

  const submit = (values: FormValues) => {
    if (
      values.groupCount < configuration.groupCount &&
      !window.confirm(
        "Zmniejszenie liczby grup usunie ich plany, członkostwa, weekendy i wyniki. Kontynuować?",
      )
    ) {
      reset({ ...values, groupCount: configuration.groupCount });
      return;
    }
    let next = resizeInternatGroups(configuration, values.groupCount);
    const group = next.groups.find((item) => item.id === next.activeGroupId)!;
    group.name = values.groupName;
    group.code = values.groupCode;
    group.classLabel = values.classLabel;
    const currentMembers = next.groupMemberships.filter(
      (item) => item.groupId === group.id && item.active,
    );
    if (values.educatorCount === 4 && currentMembers.length === 3) {
      const educatorId = `EDU-${crypto.randomUUID()}`;
      next.educators.push({
        id: educatorId,
        groupId: null,
        displayName: "Nowy wychowawca uzupełniający",
        shortCode: "W4",
        baseWeeklyAssignedMinutes: 0,
        description: "",
        active: true,
        canWorkWeekends: true,
      });
      next.groupMemberships.push({
        id: crypto.randomUUID(),
        groupId: group.id,
        educatorId,
        role: "SUPPORT",
        active: true,
        weeklyTargetHoursByWeek: [0],
        description: "",
      });
    }
    if (values.educatorCount === 3 && currentMembers.length === 4) {
      const removed = currentMembers[3];
      const hasDependencies =
        next.unavailability.some((item) => item.educatorId === removed.educatorId) ||
        next.weekendVariants.some(
          (variant) =>
            variant.groupId === group.id &&
            [...variant.saturdayTemplate.assignments, ...variant.sundayTemplate.assignments].some(
              (item) => item.educatorId === removed.educatorId,
            ),
        );
      if (hasDependencies && !window.confirm("Czwarty wychowawca ma powiązane dane. Usunąć członkostwo?")) return;
      next.groupMemberships = next.groupMemberships.filter(
        (item) => item.id !== removed.id,
      );
      const usedElsewhere = next.groupMemberships.some(
        (item) => item.educatorId === removed.educatorId,
      );
      if (!usedElsewhere) {
        next.educators = next.educators.filter((item) => item.id !== removed.educatorId);
        next.unavailability = next.unavailability.filter(
          (item) => item.educatorId !== removed.educatorId,
        );
      }
    }
    next = {
      ...next,
      ...values,
      schemaVersion: 3,
      groupId: group.id,
      groupName: group.name,
      scheduleBoundaryMode:
        values.planningHorizonWeeks === 6 ? values.scheduleBoundaryMode : "FINITE",
    };
    setConfiguration(next);
  };

  const toggleSelected = (groupId: string, checked: boolean) => {
    const selected = checked
      ? [...new Set([...configuration.selectedGroupIds, groupId])]
      : configuration.selectedGroupIds.filter((id) => id !== groupId);
    setSelectedGroups(selected);
  };

  const copyToNextGroup = () => {
    const groups = configuration.groups
      .filter((item) => item.active)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const sourceIndex = groups.findIndex(
      (item) => item.id === configuration.activeGroupId,
    );
    const target = groups[sourceIndex + 1];
    if (!target) return;
    if (
      !window.confirm(
        `Zastąpić plany, wymiary i weekendy grupy ${target.code} konfiguracją aktywnej grupy?`,
      )
    ) return;
    const sourceMembers = configuration.groupMemberships.filter(
      (item) => item.groupId === configuration.activeGroupId && item.active,
    );
    const targetMembers = configuration.groupMemberships.filter(
      (item) => item.groupId === target.id && item.active,
    );
    const educatorMap = new Map<string, string>();
    sourceMembers.forEach((item, index) => {
      if (targetMembers[index]) educatorMap.set(item.educatorId, targetMembers[index].educatorId);
    });
    const copiedMemberships = targetMembers.map((item, index) => ({
      ...item,
      role: sourceMembers[index]?.role ?? item.role,
      weeklyTargetHoursByWeek:
        sourceMembers[index]?.weeklyTargetHoursByWeek ?? item.weeklyTargetHoursByWeek,
      description: sourceMembers[index]?.description ?? item.description,
    }));
    const otherMemberships = configuration.groupMemberships.filter(
      (item) => item.groupId !== target.id,
    );
    const copiedPlans = configuration.dayPlans
      .filter((item) => item.groupId === configuration.activeGroupId)
      .map((item) => ({
        ...structuredClone(item),
        id: crypto.randomUUID(),
        groupId: target.id,
        operatingIntervals: item.operatingIntervals.map((interval) => ({
          ...interval,
          id: crypto.randomUUID(),
        })),
        noCareIntervals: item.noCareIntervals.map((interval) => ({
          ...interval,
          id: crypto.randomUUID(),
        })),
      }));
    const copiedWeekends = configuration.weekendVariants
      .filter((item) => item.groupId === configuration.activeGroupId)
      .map((item) => cloneWeekendVariant(item, target.id, educatorMap));
    setConfiguration({
      ...configuration,
      groupMemberships: [...otherMemberships, ...copiedMemberships],
      dayPlans: [
        ...configuration.dayPlans.filter((item) => item.groupId !== target.id),
        ...copiedPlans,
      ],
      weekendVariants: [
        ...configuration.weekendVariants.filter((item) => item.groupId !== target.id),
        ...copiedWeekends,
      ],
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="KROK 02 · PROJEKT INTERNATU"
        title="Konfiguracja podstawowa"
        description="Ustal 1–8 grup, zakres wspólnego generowania oraz parametry aktywnej grupy."
      />
      {configuration.requestedOperationMode === "DEMONSTRATION" && (
        <DemoNotice>{configuration.demonstrationNotice}</DemoNotice>
      )}
      <form className="form-card" onSubmit={handleSubmit(submit)} noValidate>
        <div className="form-grid form-grid--two">
          <label>Nazwa projektu<input {...register("projectName")} />{errors.projectName && <em>{errors.projectName.message}</em>}</label>
          <label>
            Liczba grup w internacie
            <select {...register("groupCount", { valueAsNumber: true })}>
              {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{value} {value === 1 ? "grupa" : value < 5 ? "grupy" : "grup"}</option>
              ))}
            </select>
          </label>
          <label>Nazwa grupy<input {...register("groupName")} />{errors.groupName && <em>{errors.groupName.message}</em>}</label>
          <label>Oznaczenie grupy<input {...register("groupCode")} /></label>
          <label>Klasa (opcjonalnie)<input {...register("classLabel")} placeholder="np. kl. 7" /></label>
          <label>
            Liczba wychowawców
            <select {...register("educatorCount", { valueAsNumber: true })}>
              <option value={3}>3 osoby</option><option value={4}>4 osoby</option>
            </select>
          </label>
          <label id="data-poczatku-cyklu">Początek cyklu (poniedziałek)<input type="date" {...register("cycleStartDate")} />{errors.cycleStartDate && <em>{errors.cycleStartDate.message}</em>}</label>
          <label>Strefa czasu IANA<input {...register("timeZoneId")} /></label>
          <label>
            Horyzont planowania
            <select {...register("planningHorizonWeeks", { valueAsNumber: true })}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} tyg.</option>)}
            </select>
          </label>
          <label>
            Granice harmonogramu
            <select {...register("scheduleBoundaryMode")}>
              <option value="FINITE">Skończony horyzont</option>
              <option value="CYCLIC" disabled={selectedHorizon !== 6}>Cykl powtarzalny (tylko 6 tygodni)</option>
            </select>
            {errors.scheduleBoundaryMode && <em>{errors.scheduleBoundaryMode.message}</em>}
          </label>
          <label>
            Początkowa pozycja weekendu
            <select {...register("startingWeekendVariant", { valueAsNumber: true })}>
              {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Pozycja {value}</option>)}
            </select>
          </label>
          <label>
            Tryb operacji
            <select {...register("requestedOperationMode")}>
              <option value="DEMONSTRATION">Tryb demonstracyjny</option>
              <option value="PRODUCTION">Tryb rzeczywisty</option>
            </select>
          </label>
        </div>
        <section className="group-selection" aria-label="Zakres generowania grup">
          <strong>Grupy generowane wspólnie</strong>
          {configuration.groups.filter((item) => item.active).map((group) => (
            <label key={group.id}>
              <input
                type="checkbox"
                checked={configuration.selectedGroupIds.includes(group.id)}
                disabled={busy}
                onChange={(event) => toggleSelected(group.id, event.target.checked)}
              />
              {group.code} · {group.name}
            </label>
          ))}
        </section>
        <div className="profile-summary">
          <div><small>Profil prawny</small><strong>{configuration.legalRules.sourceTitle}</strong></div>
          <StatusBadge value={configuration.legalRules.verificationStatus} />
        </div>
        <div className="form-footer">
          {isSubmitSuccessful && <span role="status">Zapisano lokalnie.</span>}
          {configuration.groups
            .filter((item) => item.active)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .findIndex((item) => item.id === configuration.activeGroupId) <
            configuration.groupCount - 1 && (
            <button className="button button--secondary" type="button" onClick={copyToNextGroup}>
              Skopiuj konfigurację do następnej grupy
            </button>
          )}
          <button className="button button--primary" type="submit">Zapisz konfigurację</button>
        </div>
      </form>
    </>
  );
}
