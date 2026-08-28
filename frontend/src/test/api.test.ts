import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  getApiBaseUrl,
  normalizeApiBaseUrl,
  saveApiBaseUrl,
} from "../api";
import { configurationFixture } from "./fixture";

describe("konfiguracja połączenia z API", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("akceptuje HTTPS i lokalny adres HTTP", () => {
    expect(normalizeApiBaseUrl("https://api.example.test/")).toBe(
      "https://api.example.test",
    );
    expect(normalizeApiBaseUrl("http://127.0.0.1:8000/")).toBe(
      "http://127.0.0.1:8000",
    );
    expect(() => normalizeApiBaseUrl("http://api.example.test")).toThrow(
      /musi używać HTTPS/i,
    );
  });

  it("zapisuje adres lokalnie i używa go w żądaniu", async () => {
    saveApiBaseUrl("https://api.example.test/");
    expect(getApiBaseUrl()).toBe("https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          service: "harmonogram-mow-api",
        }),
      }),
    );

    await api.health();

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/health",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("wysyła stałe nocki jako konkretne dyżury bez lokalnego pola pomocniczego", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "VALID", messages: [], care: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const configuration = {
      ...structuredClone(configurationFixture),
      recurringNightDuties: [
        {
          id: "NIGHT-A",
          educatorId: "A",
          startDayOfWeek: 1,
          description: "Stała nocka",
        },
      ],
    };

    await api.validate(configuration);

    const body = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(body).not.toHaveProperty("recurringNightDuties");
    expect(body.externalDutyAssignments).toHaveLength(1);
    expect(body.externalDutyAssignments[0]).toMatchObject({
      educatorId: "A",
      startDateTime: "2026-09-15T20:00:00.000Z",
      endDateTime: "2026-09-16T04:00:00.000Z",
    });
  });
});
