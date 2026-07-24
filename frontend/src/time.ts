const HALF_HOUR = 0.5;

export function parsePolishHours(value: string | number): number {
  const normalized =
    typeof value === "number"
      ? value
      : Number(value.trim().replace(",", "."));
  if (
    !Number.isFinite(normalized) ||
    normalized < 0 ||
    !Number.isInteger(normalized / HALF_HOUR)
  ) {
    throw new Error("Podaj liczbę godzin w krokach co 0,5 godziny.");
  }
  return normalized;
}

export function hoursToMinutes(hours: number): number {
  const parsed = parsePolishHours(hours);
  return Math.round(parsed * 60);
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function formatPolishHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  const rounded = Math.round(hours * 2) / 2;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}

export function formatHoursFromMinutes(minutes: number): string {
  return formatPolishHours(minutesToHours(minutes));
}
