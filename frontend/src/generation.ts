import type { GenerateResponse, ValidationReport } from "./types";

type ValidatedPlan = GenerateResponse & {
  validationReport: ValidationReport & { status: "VALID" };
  publicResult: "POPRAWNY" | "POPRAWNY_TRYB_DEMONSTRACYJNY";
};

export function isValidatedPlan(result: GenerateResponse | null): result is ValidatedPlan {
  return Boolean(
    result?.assignments.length &&
    result.validationReport?.status === "VALID" &&
    result.validationReport.validatorVersion === "2.0.0" &&
    ["POPRAWNY", "POPRAWNY_TRYB_DEMONSTRACYJNY"].includes(result.publicResult),
  );
}

// Public quality order supplied by the backend, not a second rule validator.
export function isBetterPlan(next: GenerateResponse, previous: GenerateResponse): boolean {
  if (!next.objective || !previous.objective) return false;
  const keys = [
    "splitDaysPenalty", "continuousBlockHandovers", "distinctEducatorsPerBlock",
    "totalSegments", "shortMiddleSegments", "preferredUnavailabilityPenalty",
    "longSegmentsPenalty", "afternoonPenalty", "weekendPenalty", "canonicalTieBreaker",
  ] as const;
  for (const key of keys) {
    const difference = next.objective[key] - previous.objective[key];
    if (!Number.isFinite(difference)) return false;
    if (difference !== 0) return difference < 0;
  }
  return false;
}
