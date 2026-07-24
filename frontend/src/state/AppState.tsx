import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api";
import type {
  GenerateResponse,
  InputReport,
  ScheduleConfiguration,
} from "../types";

const STORAGE_KEY = "harmonogram-mow-configuration-v1";
const INPUT_REPORT_KEY = "harmonogram-mow-input-report-v1";
const GENERATION_KEY = "harmonogram-mow-generation-v1";

interface AppStateValue {
  configuration: ScheduleConfiguration | null;
  inputReport: InputReport | null;
  generation: GenerateResponse | null;
  busy: boolean;
  error: string | null;
  setConfiguration: (value: ScheduleConfiguration) => void;
  clearError: () => void;
  loadDemo: () => Promise<ScheduleConfiguration>;
  startNew: () => Promise<ScheduleConfiguration>;
  validateInput: () => Promise<InputReport | null>;
  generate: () => Promise<GenerateResponse | null>;
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [configuration, setConfigurationState] =
    useState<ScheduleConfiguration | null>(() =>
      restore<ScheduleConfiguration>(STORAGE_KEY),
    );
  const [inputReport, setInputReport] = useState<InputReport | null>(() =>
    restore<InputReport>(INPUT_REPORT_KEY),
  );
  const [generation, setGeneration] = useState<GenerateResponse | null>(() =>
    restore<GenerateResponse>(GENERATION_KEY),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configuration) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configuration));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [configuration]);

  useEffect(() => {
    if (inputReport) {
      localStorage.setItem(INPUT_REPORT_KEY, JSON.stringify(inputReport));
    } else {
      localStorage.removeItem(INPUT_REPORT_KEY);
    }
  }, [inputReport]);

  useEffect(() => {
    if (generation) {
      localStorage.setItem(GENERATION_KEY, JSON.stringify(generation));
    } else {
      localStorage.removeItem(GENERATION_KEY);
    }
  }, [generation]);

  const setConfiguration = useCallback((value: ScheduleConfiguration) => {
    setConfigurationState(value);
    setInputReport(null);
    setGeneration(null);
    setError(null);
  }, []);

  const run = useCallback(async <T,>(operation: () => Promise<T>) => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Nieznany błąd komunikacji z backendem.";
      setError(message);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const loadDemo = useCallback(async () => {
    const result = await run(api.demo);
    if (!result) {
      throw new Error("Nie udało się pobrać danych demonstracyjnych.");
    }
    setConfiguration(result);
    return result;
  }, [run, setConfiguration]);

  const startNew = useCallback(async () => {
    const template = await run(api.demo);
    if (!template) {
      throw new Error("Nie udało się utworzyć konfiguracji startowej.");
    }
    const suffix = Date.now().toString();
    const result: ScheduleConfiguration = {
      ...template,
      projectId: `PROJECT-${suffix}`,
      projectName: "Nowy harmonogram MOW",
      configurationVersionId: `CV-${suffix}`,
      groupName: "Nowa grupa",
      requestedOperationMode: "DEMONSTRATION",
      demonstrationNotice:
        "Konfiguracja robocza. Przed użyciem rzeczywistym wymaga zweryfikowanego profilu prawnego i zatwierdzonych wzorców placówki.",
    };
    const versionId = result.configurationVersionId;
    result.legalRules.configurationVersionId = versionId;
    result.organizationalRules.configurationVersionId = versionId;
    result.dayPlans.forEach((item) => {
      item.configurationVersionId = versionId;
    });
    result.weekendVariants.forEach((item) => {
      item.configurationVersionId = versionId;
    });
    result.assignmentOverrides.forEach((item) => {
      item.configurationVersionId = versionId;
    });
    setConfiguration(result);
    return result;
  }, [run, setConfiguration]);

  const validateInput = useCallback(async () => {
    if (!configuration) {
      setError("Najpierw utwórz albo wczytaj konfigurację.");
      return null;
    }
    const result = await run(() => api.validate(configuration));
    if (result) {
      setInputReport(result);
    }
    return result;
  }, [configuration, run]);

  const generate = useCallback(async () => {
    if (!configuration) {
      setError("Najpierw utwórz albo wczytaj konfigurację.");
      return null;
    }
    const result = await run(() => api.generate(configuration));
    if (result) {
      setGeneration(result);
    }
    return result;
  }, [configuration, run]);

  const value = useMemo<AppStateValue>(
    () => ({
      configuration,
      inputReport,
      generation,
      busy,
      error,
      setConfiguration,
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
      busy,
      error,
      setConfiguration,
      loadDemo,
      startNew,
      validateInput,
      generate,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState wymaga AppStateProvider.");
  }
  return value;
}
