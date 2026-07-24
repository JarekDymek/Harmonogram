import { describe, expect, it } from "vitest";
import {
  formatPolishHours,
  hoursToMinutes,
  minutesToHours,
  parsePolishHours,
} from "../time";

describe("godziny w polskim interfejsie", () => {
  it("akceptuje przecinek i kropkę bez utraty pół godziny", () => {
    expect(parsePolishHours("27,5")).toBe(27.5);
    expect(parsePolishHours("27.5")).toBe(27.5);
    expect(hoursToMinutes(parsePolishHours("27,5"))).toBe(1650);
  });

  it("konwertuje w obie strony i formatuje polski przecinek", () => {
    expect(minutesToHours(1620)).toBe(27);
    expect(formatPolishHours(minutesToHours(1650))).toBe("27,5");
    expect(() => parsePolishHours("27,25")).toThrow(/0,5/);
  });
});
