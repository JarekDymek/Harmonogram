import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type GenerationOptions } from "../api";
import { migrateWorkCalendar } from "../nightDuties";
import { WORK_RULES_VERSION } from "../workRules";
import { isBetterPlan, isValidatedPlan } from "../generation";
import type {
  GenerateResponse,
  GroupConfiguration,
  GroupEducatorMembership,
  InputReport,
  ScheduleConfiguration,
} from "../types";

const STORAGE_KEY = "harmonogram-mow-configuration-v3";
const INPUT_REPORT_KEY = "harmonogram-mow-input-report-v3";
const GENERATION_KEY = "harmonogram-mow-generation-v3";
const V2_STORAGE_KEY = "harmonogram-mow-configuration-v2";
const LEGACY_STORAGE_KEY = "harmonogram-mow-configuration-v1";

interface AppStateValue {
  configuration: ScheduleConfiguration | null;
  inputReport: InputReport | null;
  generation: GenerateResponse | null;
  generationNotice: string | null;
  busy: boolean;
  error: string | null;
  migrationPending: boolean;
  setConfiguration: (value: ScheduleConfiguration) => void;
  importProject: (
    value: ScheduleConfiguration,
    report: InputReport | null,
    result: GenerateResponse | null,
  ) => void;
  setActiveGroup: (groupId: string) => void;
  clearError: () => void;
  loadDemo: () => Promise<ScheduleConfiguration>;
  startNew: () => Promise<ScheduleConfiguration>;
  validateInput: () => Promise<InputReport | null>;
  generate: (options?: GenerationOptions) => Promise<GenerateResponse | null>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function restore<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function migrateConfiguration(
  source: Partial<ScheduleConfiguration>,
): ScheduleConfiguration {
  const copy = structuredClone(source) as Partial<ScheduleConfiguration> & {
    classLabel?: unknown;
    groupCode?: unknown;
  };
  // These legacy single-group fields now live in groups[]. The backend forbids
  // unknown root properties, so keeping them would make migrated data fail
  // request validation even though the schedule itself is complete.
  delete copy.classLabel;
  delete copy.groupCode;
  const legacyWeeks =
    typeof copy.planningHorizonWeeks === "number"
      ? copy.planningHorizonWeeks
      : typeof copy.cycleLengthWeeks === "number"
        ? copy.cycleLengthWeeks
        : 6;
  const planningHorizonWeeks = Math.min(6, Math.max(1, legacyWeeks));
  const legacyGroupId = copy.groupId || "G1";
  const legacyGroupName = copy.groupName || "Grupa I";
  const groups: GroupConfiguration[] = copy.groups?.length
    ? copy.groups
    : [
        {
          id: legacyGroupId,
          displayOrder: 1,
          code: "I",
          name: legacyGroupName,
          classLabel: "",
          active: true,
        },
      ];
  const activeGroups = groups
    .filter((item) => item.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const activeGroupId = activeGroups.some(
    (item) => item.id === copy.activeGroupId,
  )
    ? (copy.activeGroupId as string)
    : activeGroups[0]?.id ?? groups[0].id;
  const activeGroup = groups.find((item) => item.id === activeGroupId) ?? groups[0];
  const educators = (copy.educators ?? []).map((item) => ({
    ...item,
    groupId: null,
    baseWeeklyAssignedMinutes: item.baseWeeklyAssignedMinutes ?? 0,
  }));
  const memberships: GroupEducatorMembership[] = copy.groupMemberships?.length
    ? copy.groupMemberships
    : educators.map((educator, index) => ({
        id: `MEM-${legacyGroupId}-${educator.id}`,
        groupId: legacyGroupId,
        educatorId: educator.id,
        role: index < 3 ? "PRIMARY" : "SUPPORT",
        active: educator.active,
        weeklyTargetHoursByWeek: [
          (educator.baseWeeklyAssignedMinutes ?? 0) / 60,
        ],
        description: educator.description,
      }));
  const memberCount = memberships.filter(
    (item) => item.active && item.groupId === activeGroupId,
  ).length;
  const educatorCount = (memberCount === 4 ? 4 : 3) as 3 | 4;

  return migrateWorkCalendar({
    ...(copy as ScheduleConfiguration),
    schemaVersion: 3,
    groupCount: activeGroups.length,
    groups,
    activeGroupId,
    selectedGroupIds:
      copy.selectedGroupIds?.filter((id) =>
        activeGroups.some((group) => group.id === id),
      ).length
        ? copy.selectedGroupIds.filter((id) =>
            activeGroups.some((group) => group.id === id),
          )
        : activeGroups.map((item) => item.id),
    groupId: activeGroup.id,
    groupName: activeGroup.name,
    educatorCount,
    planningHorizonWeeks,
    scheduleBoundaryMode:
      copy.scheduleBoundaryMode === "CYCLIC" && planningHorizonWeeks === 6
        ? "CYCLIC"
        : copy.cycleIsRepeating === true && planningHorizonWeeks === 6
          ? "CYCLIC"
          : "FINITE",
    educators,
    groupMemberships: memberships,
    assignmentOverrides: (copy.assignmentOverrides ?? []).map((item) => ({
      ...item,
      groupId: item.groupId ?? legacyGroupId,
    })),
    dayPlans: (copy.dayPlans ?? []).map((item) => ({
      ...item,
      groupId: item.groupId || legacyGroupId,
    })),
    weekendVariants: (copy.weekendVariants ?? []).map((item) => ({
      ...item,
      groupId: item.groupId ?? legacyGroupId,
    })),
    recurringNightDuties: copy.recurringNightDuties ?? [],
    organizationalRules: {
      ...copy.organizationalRules!,
      shortMiddleSegmentMinutes:
        copy.organizationalRules?.shortMiddleSegmentMinutes ?? 180,
    },
    unavailability: copy.unavailability ?? [],
    externalDutyAssignments: copy.externalDutyAssignments ?? [],
    commonAreaDuties: copy.commonAreaDuties ?? [],
    lockedAssignments: (copy.lockedAssignments ?? []).map((item) => ({
      ...item,
      groupId: item.groupId || legacyGroupId,
    })),
  });
}

function restoreInitialConfiguration(): {
  configuration: ScheduleConfiguration | null;
  migrationPending: boolean;
  storageError?: string;
  workRulesUpdated?: boolean;
} {
  for (const key of [STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    const stored = restore<Partial<ScheduleConfiguration>>(key);
    if (stored) {
      if (stored.workRulesVersion !== WORK_RULES_VERSION) {
        // A migration never overwrites the only copy of local user data.
        const backupKey = `${STORAGE_KEY}-before-work-calendar-v${WORK_RULES_VERSION}-${stored.projectId ?? "legacy"}`;
        try {
          if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, JSON.stringify({
            configuration: stored, generation: restore(GENERATION_KEY), savedAt: new Date().toISOString(),
          }));
        } catch {
          return { configuration: migrateConfiguration(stored), migrationPending: true,
            storageError: "Brak miejsca na bezpieczną kopię. Oryginalnych danych nie zmieniono. Pobierz pakiet w Przenieś dane; zwolnij miejsce na urządzeniu i uruchom aplikację ponownie." };
        }
      }
      const pending =
        (stored.schemaVersion ?? 0) < 3 ||
        !stored.groups?.length ||
        !stored.groupMemberships?.length;
      return {
        configuration: migrateConfiguration(stored),
        migrationPending: pending,
        workRulesUpdated: stored.workRulesVersion !== WORK_RULES_VERSION,
      };
    }
  }
  return { configuration: null, migrationPending: false };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(restoreInitialConfiguration);
  const [configuration, setConfigurationState] =
    useState<ScheduleConfiguration | null>(initial.configuration);
  const [migrationPending, setMigrationPending] = useState(initial.migrationPending);
  const [inputReport, setInputReport] = useState<InputReport | null>(() =>
    initial.migrationPending || initial.workRulesUpdated ? null : restore<InputReport>(INPUT_REPORT_KEY),
  );
  const [generation, setGeneration] = useState<GenerateResponse | null>(() =>
    initial.migrationPending ? null : restore<GenerateResponse>(GENERATION_KEY),
  );
  const [busy, setBusy] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const configurationRef = useRef(configuration);
  configurationRef.current = configuration;
  const [error, setError] = useState<string | null>(initial.storageError ?? null);

  useEffect(() => {
    if (migrationPending) return;
    if (configuration) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configuration));
      localStorage.removeItem(V2_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [configuration, migrationPending]);

  useEffect(() => {
    if (initial.storageError) return;
    if (inputReport) localStorage.setItem(INPUT_REPORT_KEY, JSON.stringify(inputReport));
    else localStorage.removeItem(INPUT_REPORT_KEY);
  }, [inputReport]);

  useEffect(() => {
    if (initial.storageError) return;
    if (generation) localStorage.setItem(GENERATION_KEY, JSON.stringify(generation));
    else localStorage.removeItem(GENERATION_KEY);
  }, [generation]);

  const invalidateResults = useCallback(() => {
    setInputReport(null);
    setGeneration(null);
    setGenerationNotice(null);
    setError(null);
  }, []);

  const setConfiguration = useCallback(
    (value: ScheduleConfiguration) => {
      if (initial.storageError) { setError(initial.storageError); return; }
      setConfigurationState(migrateConfiguration(value));
      setMigrationPending(false);
      invalidateResults();
    },
    [invalidateResults],
  );

  const importProject = useCallback(
    (
      value: ScheduleConfiguration,
      report: InputReport | null,
      result: GenerateResponse | null,
    ) => {
      if (initial.storageError) {
        setError(initial.storageError);
        return;
      }
      setConfigurationState(migrateConfiguration(value));
      setMigrationPending(false);
      setInputReport(report);
      setGeneration(result);
      setGenerationNotice(
        result
          ? "Wczytano gotowy, sprawdzony plan z pliku projektu."
          : null,
      );
      setError(null);
    },
    [],
  );

  const setActiveGroup = useCallback(
    (groupId: string) => {
      setConfigurationState((current) => {
        if (!current) return current;
        const group = current.groups.find(
          (item) => item.id === groupId && item.active,
        );
        if (!group) return current;
        const count = current.groupMemberships.filter(
          (item) => item.active && item.groupId === groupId,
        ).length;
        return {
          ...current,
          activeGroupId: groupId,
          groupId,
          groupName: group.name,
          educatorCount: (count === 4 ? 4 : 3) as 3 | 4,
        };
      });
    },
    [],
  );

  const run = useCallback(async <T,>(operation: () => Promise<T>) => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nieznany błąd komunikacji z backendem.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const loadDemo = useCallback(async () => {
    const result = await run(api.demo);
    if (!result) throw new Error("Nie udało się pobrać danych demonstracyjnych.");
    const migrated = migrateConfiguration(result);
    setConfiguration(migrated);
    return migrated;
  }, [run, setConfiguration]);

  const startNew = useCallback(async () => {
    const template = await run(api.demo);
    if (!template) throw new Error("Nie udało się utworzyć konfiguracji startowej.");
    const suffix = Date.now().toString();
    const result = migrateConfiguration({
      ...template,
      projectId: `PROJECT-${suffix}`,
      projectName: "Nowy harmonogram MOW",
      configurationVersionId: `CV-${suffix}`,
      requestedOperationMode: "DEMONSTRATION",
      demonstrationNotice:
        "Konfiguracja robocza. Przed użyciem rzeczywistym wymaga zweryfikowanego profilu prawnego i zatwierdzonych wzorców placówki.",
    });
    result.groups[0].name = "Nowa grupa";
    result.groupName = "Nowa grupa";
    const versionId = result.configurationVersionId;
    result.legalRules.configurationVersionId = versionId;
    result.organizationalRules.configurationVersionId = versionId;
    result.dayPlans.forEach((item) => (item.configurationVersionId = versionId));
    result.weekendVariants.forEach((item) => (item.configurationVersionId = versionId));
    result.assignmentOverrides.forEach((item) => (item.configurationVersionId = versionId));
    setConfiguration(result);
    return result;
  }, [run, setConfiguration]);

  const validateInput = useCallback(async () => {
    if (!configuration) {
      setError("Najpierw utwórz albo wczytaj konfigurację.");
      return null;
    }
    const result = await run(() => api.validate(configuration));
    if (result) setInputReport(result);
    return result;
  }, [configuration, run]);

  const generate = useCallback(async (options: GenerationOptions = {}) => {
    if (!configuration) {
      setError("Najpierw utwórz albo wczytaj konfigurację.");
      return null;
    }
    setGenerationNotice(null);
    const result = await run(() => api.generate(configuration, options));
    // Never attach a late response to a configuration edited during the request.
    if (configurationRef.current !== configuration) return null;
    if (isValidatedPlan(generation) && (
      !isValidatedPlan(result) || (options.optimize && !isBetterPlan(result, generation))
    )) {
      setGenerationNotice("Zachowano dotychczasowy poprawny plan. Ta próba nie znalazła lepszego układu.");
      return generation;
    }
    if (result) {
      setGeneration(result);
      if (options.optimize && isValidatedPlan(result)) {
        setGenerationNotice("Znaleziono lepszy układ. Nowy plan również przeszedł pełną kontrolę.");
      }
    }
    return result;
  }, [configuration, generation, run]);

  const value = useMemo<AppStateValue>(
    () => ({
      configuration,
      inputReport,
      generation,
      generationNotice,
      busy,
      error,
      migrationPending,
      setConfiguration,
      importProject,
      setActiveGroup,
      clearError: () => setError(null),
      loadDemo,
      startNew,
      validateInput,
      generate,
    }),
    [
      configuration,
      inputReport,
      generation,
      generationNotice,
      busy,
      error,
      migrationPending,
      setConfiguration,
      importProject,
      setActiveGroup,
      loadDemo,
      startNew,
      validateInput,
      generate,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState wymaga AppStateProvider.");
  return value;
}
