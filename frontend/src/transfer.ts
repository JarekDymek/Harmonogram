import { isValidatedPlan } from "./generation";
import type {
  GenerateResponse,
  InputReport,
  ScheduleConfiguration,
} from "./types";

export const TRANSFER_FORMAT = "harmonogram-mow-project";
export const LEGACY_TRANSFER_FORMAT = "harmonogram-mow-device-transfer";
export const TRANSFER_VERSION = 2;
export const MAX_TRANSFER_FILE_BYTES = 5 * 1024 * 1024;
export const BEFORE_IMPORT_STORAGE_KEY =
  "harmonogram-mow-project-before-import-v2";

export interface ProjectTransferPackage {
  format: typeof TRANSFER_FORMAT;
  version: typeof TRANSFER_VERSION;
  exportedAt: string;
  configuration: ScheduleConfiguration;
  inputReport: InputReport | null;
  generation: GenerateResponse | null;
}

// Kept as an exported alias so older imports in extensions do not break.
export type DeviceTransferPackage = ProjectTransferPackage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  source: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Pakiet nie zawiera pola „${label}”.`);
  }
  return value;
}

export function createProjectTransferPackage(
  configuration: ScheduleConfiguration,
  inputReport: InputReport | null,
  generation: GenerateResponse | null,
): ProjectTransferPackage {
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    configuration: structuredClone(configuration),
    inputReport: inputReport ? structuredClone(inputReport) : null,
    generation: isTransferredGenerationCompatible(configuration, generation)
      ? structuredClone(generation)
      : null,
  };
}

/** @deprecated Use createProjectTransferPackage. */
export function createDeviceTransferPackage(
  configuration: ScheduleConfiguration,
  _legacyApiBaseUrl = "",
  inputReport: InputReport | null = null,
  generation: GenerateResponse | null = null,
): ProjectTransferPackage {
  return createProjectTransferPackage(configuration, inputReport, generation);
}

export function serializeDeviceTransferPackage(
  transferPackage: ProjectTransferPackage,
): string {
  return JSON.stringify(transferPackage, null, 2);
}

function parseInputReport(value: unknown): InputReport | null {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    typeof value.status !== "string" ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.care) ||
    !Array.isArray(value.weeklyBalance)
  ) {
    throw new Error("Pakiet zawiera uszkodzony raport danych wejściowych.");
  }
  return value as unknown as InputReport;
}

function parseGeneration(value: unknown): GenerateResponse | null {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    typeof value.generationStatus !== "string" ||
    typeof value.publicResult !== "string" ||
    !Array.isArray(value.assignments) ||
    !Array.isArray(value.care) ||
    !Array.isArray(value.messages)
  ) {
    throw new Error("Pakiet zawiera uszkodzony wygenerowany plan.");
  }
  return value as unknown as GenerateResponse;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isTransferredGenerationCompatible(
  configuration: ScheduleConfiguration,
  generation: GenerateResponse | null,
): generation is GenerateResponse {
  if (!isValidatedPlan(generation)) return false;
  const groupIds = new Set(configuration.groups.map((item) => item.id));
  const educatorIds = new Set(configuration.educators.map((item) => item.id));
  const lastDate = addDays(
    configuration.cycleStartDate,
    configuration.planningHorizonWeeks * 7 - 1,
  );
  return generation.assignments.every(
    (item) =>
      groupIds.has(item.groupId) &&
      educatorIds.has(item.educatorId) &&
      item.date >= configuration.cycleStartDate &&
      item.date <= lastDate &&
      Number.isInteger(item.startMinute) &&
      Number.isInteger(item.endMinute) &&
      item.startMinute >= 0 &&
      item.endMinute <= 1440 &&
      item.startMinute < item.endMinute,
  );
}

export function parseDeviceTransferPackage(
  text: string,
): ProjectTransferPackage {
  if (new Blob([text]).size > MAX_TRANSFER_FILE_BYTES) {
    throw new Error("Pakiet jest zbyt duży. Maksymalny rozmiar to 5 MB.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Wybrany plik nie jest prawidłowym pakietem Harmonogramu.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Wybrany plik nie jest prawidłowym pakietem Harmonogramu.");
  }
  const isLegacy =
    parsed.format === LEGACY_TRANSFER_FORMAT && parsed.version === 1;
  const isCurrent =
    parsed.format === TRANSFER_FORMAT && parsed.version === TRANSFER_VERSION;
  if (!isLegacy && !isCurrent) {
    throw new Error("To nie jest obsługiwana wersja pakietu Harmonogramu.");
  }
  if (!isRecord(parsed.configuration)) {
    throw new Error("Pakiet nie zawiera konfiguracji.");
  }

  const configuration = parsed.configuration;
  requireString(configuration, "projectId", "identyfikator projektu");
  requireString(configuration, "projectName", "nazwa projektu");
  requireString(configuration, "cycleStartDate", "początek cyklu");
  if (!Array.isArray(configuration.groups) || !configuration.groups.length) {
    throw new Error("Pakiet nie zawiera żadnej grupy.");
  }
  if (!Array.isArray(configuration.educators) || !configuration.educators.length) {
    throw new Error("Pakiet nie zawiera żadnego wychowawcy.");
  }

  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt:
      typeof parsed.exportedAt === "string"
        ? parsed.exportedAt
        : new Date(0).toISOString(),
    configuration: configuration as unknown as ScheduleConfiguration,
    inputReport: isCurrent ? parseInputReport(parsed.inputReport) : null,
    generation: isCurrent ? parseGeneration(parsed.generation) : null,
  };
}

export function transferFileName(configuration: ScheduleConfiguration): string {
  const group = configuration.groups.find(
    (item) => item.id === configuration.activeGroupId,
  );
  const safeGroup = (group?.code || "plan")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `harmonogram-${safeGroup || "plan"}-${new Date()
    .toISOString()
    .slice(0, 10)}.harmonogram.json`;
}
