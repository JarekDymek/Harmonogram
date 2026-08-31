import type {
  GenerateResponse,
  InputReport,
  ScheduleConfiguration,
} from "./types";
import { prepareConfigurationForApi } from "./nightDuties";

const API_BASE_URL_KEY = "harmonogram-mow-api-base-url-v1";

export interface GenerationOptions {
  optimize?: boolean;
  timeLimitSeconds?: number;
}

export function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) return "";

  const parsed = new URL(normalized);
  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
    throw new Error(
      "Adres API musi używać HTTPS. HTTP jest dozwolone wyłącznie dla localhost.",
    );
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const saved = localStorage.getItem(API_BASE_URL_KEY);
  if (saved !== null) return saved;
  return normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "");
}

export function saveApiBaseUrl(value: string): string {
  const normalized = normalizeApiBaseUrl(value);
  localStorage.setItem(API_BASE_URL_KEY, normalized);
  return normalized;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const target = `${getApiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(target, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(
      "Nie można połączyć się z backendem. Sprawdź adres API i połączenie z siecią.",
    );
  }

  let body: T & { message?: string };
  try {
    body = (await response.json()) as T & { message?: string };
  } catch {
    throw new Error(
      `Backend zwrócił nieprawidłową odpowiedź (${response.status}). Sprawdź adres API.`,
    );
  }
  if (!response.ok) {
    throw new Error(body.message ?? `Błąd komunikacji z API (${response.status}).`);
  }
  return body;
}

export const api = {
  health: () =>
    request<{ status: string; service: string }>("/api/health"),
  demo: () => request<ScheduleConfiguration>("/api/demo"),
  validate: (configuration: ScheduleConfiguration) =>
    request<InputReport>("/api/validate-input", {
      method: "POST",
      body: JSON.stringify(prepareConfigurationForApi(configuration)),
    }),
  calculateCare: (configuration: ScheduleConfiguration) =>
    request<{ status: string; care: InputReport["care"]; messages: InputReport["messages"] }>(
      "/api/calculate-care",
      {
        method: "POST",
        body: JSON.stringify(prepareConfigurationForApi(configuration)),
      },
    ),
  generate: (configuration: ScheduleConfiguration, options: GenerationOptions = {}) =>
    request<GenerateResponse>(`/api/generate${options.optimize ? "?optimize=true" : ""}`, {
      method: "POST",
      body: JSON.stringify({
        ...prepareConfigurationForApi(configuration),
        // Budget belongs to this request only; never rewrite saved user data.
        solverTimeLimitSeconds: Math.min(300, Math.max(
          options.timeLimitSeconds ?? 60, configuration.solverTimeLimitSeconds,
        )),
      }),
    }),
};
