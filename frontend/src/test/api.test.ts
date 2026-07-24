import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  getApiBaseUrl,
  normalizeApiBaseUrl,
  saveApiBaseUrl,
} from "../api";

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
});
