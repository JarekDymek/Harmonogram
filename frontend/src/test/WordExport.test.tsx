import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WordExport } from "../components/WordExport";
import { createScheduleDocxFile } from "../scheduleDocx";
import type { GenerateResponse } from "../types";
import { configurationFixture } from "./fixture";

vi.mock("../scheduleDocx", () => ({ createScheduleDocxFile: vi.fn() }));
const createFile = vi.mocked(createScheduleDocxFile);
const plan = { assignments: [] } as unknown as GenerateResponse;
const configuration = { ...configurationFixture, planningHorizonWeeks: 6 };
const file = new File(["test-docx"], "harmonogram-i-6-tygodni.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
const BrowserURL = URL;

beforeEach(() => {
  createFile.mockReset().mockResolvedValue(file);
  vi.stubGlobal("URL", class extends BrowserURL {
    static createObjectURL = vi.fn(() => "blob:word-test");
    static revokeObjectURL = vi.fn();
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pobieranie gotowego Worda", () => {
  it("nie tworzy pliku dwukrotnie przy kontrolnym montowaniu React", async () => {
    render(<StrictMode><WordExport configuration={configuration} generation={plan} /></StrictMode>);
    await screen.findByRole("link", { name: "Pobierz Word (.docx)" });
    expect(createFile).toHaveBeenCalledTimes(1);
  });

  it("przygotowuje plik przed kliknięciem i pozostawia bezpośredni link do ponownego pobrania", async () => {
    render(<WordExport configuration={configuration} generation={plan} />);
    expect(screen.getByRole("button", { name: "Przygotowuję Word…" })).toBeDisabled();
    const link = await screen.findByRole("link", { name: "Pobierz Word (.docx)" });
    expect(link).toHaveAttribute("href", "blob:word-test");
    expect(link).toHaveAttribute("download", file.name);
    expect(document.body.contains(link)).toBe(true);
    // Keep jsdom from navigating; the real browser download is tested separately.
    link.addEventListener("click", event => event.preventDefault());
    fireEvent.click(link);
    fireEvent.click(link);
    expect(createFile).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(screen.getByText(/Przekazano plik do pobrania/)).toBeVisible();
    expect(screen.queryByText(/Pobrano edytowalny dokument/)).not.toBeInTheDocument();
  });

  it("zachowuje odnośnik przez minutę po opuszczeniu ekranu, aby nie przerwać pobierania", async () => {
    const { unmount } = render(<WordExport configuration={configuration} generation={plan} />);
    await screen.findByRole("link", { name: "Pobierz Word (.docx)" });
    vi.useFakeTimers();
    unmount();
    vi.advanceTimersByTime(59_999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:word-test");
  });

  it("nie pokazuje starego dokumentu po zmianie konfiguracji", async () => {
    const { rerender } = render(<WordExport configuration={configuration} generation={plan} />);
    await screen.findByRole("link", { name: "Pobierz Word (.docx)" });
    createFile.mockReturnValue(new Promise(() => {}));
    rerender(<WordExport configuration={{ ...configuration, groupName: "Inna grupa" }} generation={plan} />);
    expect(screen.queryByRole("link", { name: "Pobierz Word (.docx)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Przygotowuję Word…" })).toBeDisabled();
  });

  it("ignoruje zakończenie starego eksportu po opuszczeniu ekranu", async () => {
    let finish!: (value: File) => void;
    createFile.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { unmount } = render(<WordExport configuration={configuration} generation={plan} />);
    await waitFor(() => expect(createFile).toHaveBeenCalled());
    unmount();
    finish(file);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("pokazuje rzeczywisty błąd i ponawia tylko eksport, nie generowanie planu", async () => {
    createFile.mockRejectedValueOnce(new Error("Błąd pobrania modułu Word"));
    render(<WordExport configuration={configuration} generation={plan} />);
    const retry = await screen.findByRole("button", { name: "Ponów przygotowanie Worda" });
    expect(screen.getByText("Błąd pobrania modułu Word")).toBeInTheDocument();
    fireEvent.click(retry);
    await screen.findByRole("link", { name: "Pobierz Word (.docx)" });
    expect(createFile).toHaveBeenCalledTimes(2);
    expect(createFile).toHaveBeenLastCalledWith(configuration, plan);
  });

  it("po anulowaniu udostępniania na telefonie pozostawia działający link", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    try {
      render(<WordExport configuration={configuration} generation={plan} />);
      fireEvent.click(await screen.findByRole("button", { name: "Udostępnij plik" }));
      await screen.findByText(/Udostępnianie anulowano/);
      expect(share).toHaveBeenCalledWith({ files: [file], title: "Harmonogram pracy" });
      expect(screen.getByRole("link", { name: "Pobierz Word (.docx)" })).toHaveAttribute("href", "blob:word-test");
    } finally {
      Reflect.deleteProperty(navigator, "share");
      Reflect.deleteProperty(navigator, "canShare");
    }
  });
});
