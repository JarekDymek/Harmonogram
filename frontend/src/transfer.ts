import type { ScheduleConfiguration } from "./types";

export const TRANSFER_FORMAT = "harmonogram-mow-device-transfer";
export const TRANSFER_VERSION = 1;
export const MAX_TRANSFER_FILE_BYTES = 5 * 1024 * 1024;
export const BEFORE_IMPORT_STORAGE_KEY =
  "harmonogram-mow-configuration-before-import-v1";

export interface DeviceTransferPackage {
  format: typeof TRANSFER_FORMAT;
  version: typeof TRANSFER_VERSION;
  exportedAt: string;
  apiBaseUrl: string;
  configuration: ScheduleConfiguration;
}

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

export function createDeviceTransferPackage(
  configuration: ScheduleConfiguration,
  apiBaseUrl: string,
): DeviceTransferPackage {
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    apiBaseUrl,
    configuration: structuredClone(configuration),
  };
}

export function serializeDeviceTransferPackage(
  transferPackage: DeviceTransferPackage,
): string {
  return JSON.stringify(transferPackage, null, 2);
}

export function parseDeviceTransferPackage(
  text: string,
): DeviceTransferPackage {
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
  if (parsed.format !== TRANSFER_FORMAT || parsed.version !== TRANSFER_VERSION) {
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
    apiBaseUrl: typeof parsed.apiBaseUrl === "string" ? parsed.apiBaseUrl : "",
    configuration: configuration as unknown as ScheduleConfiguration,
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
