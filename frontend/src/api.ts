import type {
  GenerateResponse,
  InputReport,
  ScheduleConfiguration,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? `Błąd komunikacji z API (${response.status}).`);
  }
  return body;
}

export const api = {
  demo: () => request<ScheduleConfiguration>("/api/demo"),
  validate: (configuration: ScheduleConfiguration) =>
    request<InputReport>("/api/validate-input", {
      method: "POST",
      body: JSON.stringify(configuration),
    }),
  calculateCare: (configuration: ScheduleConfiguration) =>
    request<{ status: string; care: InputReport["care"]; messages: InputReport["messages"] }>(
      "/api/calculate-care",
      {
        method: "POST",
        body: JSON.stringify(configuration),
      },
    ),
  generate: (configuration: ScheduleConfiguration) =>
    request<GenerateResponse>("/api/generate", {
      method: "POST",
      body: JSON.stringify(configuration),
    }),
};
