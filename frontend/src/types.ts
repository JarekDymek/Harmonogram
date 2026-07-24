export type Severity = "ERROR" | "WARNING" | "INFO";
export type ResultStatus =
  | "DANE_NIEPOPRAWNE"
  | "BRAK_ROZWIAZANIA"
  | "NIE_ZAKONCZONO_WYSZUKIWANIA"
  | "BLAD_WEWNETRZNY"
  | "POPRAWNY"
  | "POPRAWNY_TRYB_DEMONSTRACYJNY";

export interface TimeInterval {
  id: string;
  startTime: string;
  endTime: string;
  eventType?: string | null;
  customEventType?: string | null;
  description: string;
}

export interface Educator {
  id: string;
  groupId: string;
  displayName: string;
  shortCode: string;
  baseWeeklyAssignedMinutes: number;
  description: string;
  active: boolean;
  canWorkWeekends: boolean;
}

export interface AssignmentOverride {
  id: string;
  educatorId: string;
  configurationVersionId: string;
  weekNumber: number;
  assignedMinutes: number;
  reason: string;
  approvedAt: string;
  approvedBy: string;
}

export interface Unavailability {
  id: string;
  educatorId: string;
  scope: "RECURRING_WEEKLY" | "CYCLE_WEEK" | "SPECIFIC_DATE";
  date?: string | null;
  weekNumber?: number | null;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  type: "HARD" | "PREFERRED";
  description: string;
}

export interface DayPlan {
  id: string;
  configurationVersionId: string;
  groupId: string;
  scope: "BASE_WEEKLY" | "CYCLE_WEEK" | "SPECIFIC_DATE";
  dayOfWeek?: number | null;
  weekNumber?: number | null;
  date?: string | null;
  operatingIntervals: TimeInterval[];
  noCareIntervals: TimeInterval[];
  eventType?: string | null;
  customEventType?: string | null;
  description: string;
  approved: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
}

export interface WeekendAssignment {
  id: string;
  educatorId: string;
  startTime: string;
  endTime: string;
  sequenceNumber: number;
}

export interface WeekendDayTemplate {
  id: string;
  dayOfWeek: "SATURDAY" | "SUNDAY";
  assignments: WeekendAssignment[];
}

export interface WeekendVariant {
  id: string;
  configurationVersionId: string;
  variantKind: "BASE" | "SUBSTITUTE";
  positionInCycle?: number | null;
  replacesWeekendRotationVariantId?: string | null;
  applicableWeekNumber?: number | null;
  applicableSaturdayDate?: string | null;
  applicableSundayDate?: string | null;
  offEducatorId: string;
  approved: boolean;
  approvalReference: string;
  approvedAt: string;
  approvedBy: string;
  saturdayTemplate: WeekendDayTemplate;
  sundayTemplate: WeekendDayTemplate;
}

export interface LegalRules {
  id: string;
  configurationVersionId: string;
  jurisdiction: string;
  sourceTitle: string;
  sourceSection: string;
  sourceIdentifier: string;
  verifiedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  approvedBy?: string | null;
  version: string;
  verificationNotes: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "EXPIRED";
  minimumDailyRestMinutes: number;
  weeklyRestWindowType: "FIXED_LOCAL_WEEK" | "ROLLING_DURATION";
  weeklyRestWindowLengthMinutes: number;
  weeklyRestWindowStepMinutes: number;
  weeklyRestAnchorDayOfWeek: number;
  weeklyRestAnchorTime: string;
  minimumWeeklyRestMinutes: number;
  weeklyRestAttributionMode: "FULLY_CONTAINED" | "INTERSECTION_WITH_WINDOW";
  weeklyRestReuseAcrossWindowsAllowed: boolean;
  weeklyRestExceptionEnabled: boolean;
  weeklyRestExceptionMinimumMinutes?: number | null;
  weeklyRestExceptionMaximumOccurrencesPerCycle?: number | null;
  weeklyRestExceptionMinimumGapMinutes?: number | null;
  weeklyRestCompensationRequired: boolean;
  weeklyRestCompensationMinutes?: number | null;
  weeklyRestCompensationDeadlineMinutes?: number | null;
  maximumAbsoluteDailyWorkMinutes?: number | null;
  maximumAbsoluteSegmentMinutes?: number | null;
}

export interface OrganizationalRules {
  id: string;
  configurationVersionId: string;
  timeStepMinutes: number;
  minimumSegmentMinutes: number;
  requiredWorkDaysPerWeek: number;
  weekendRotationEnabled: boolean;
  preferredMaximumSegmentMinutes: number;
  preferredAfternoonHandoverTime: string;
  preferredWeekendSplitMinutes: number;
  splitDayPenaltyWeight: number;
  preferredUnavailabilityPenaltyWeight: number;
  longSegmentPenaltyWeight: number;
  weekendImbalancePenaltyWeight: number;
  afternoonHandoverPenaltyWeight: number;
}

export interface ScheduleConfiguration {
  projectId: string;
  projectName: string;
  configurationVersionId: string;
  versionNumber: number;
  groupId: string;
  groupName: string;
  cycleStartDate: string;
  weekStartDay: string;
  timeZoneId: string;
  cycleLengthWeeks: number;
  cycleIsRepeating: boolean;
  startingWeekendVariant: number;
  requestedOperationMode: "PRODUCTION" | "DEMONSTRATION";
  educators: Educator[];
  assignmentOverrides: AssignmentOverride[];
  dayPlans: DayPlan[];
  unavailability: Unavailability[];
  legalRules: LegalRules;
  organizationalRules: OrganizationalRules;
  weekendVariants: WeekendVariant[];
  solverTimeLimitSeconds: number;
  randomSeed: number;
  demonstrationNotice?: string | null;
}

export interface DomainMessage {
  ruleId: string;
  severity: Severity;
  message: string;
  date?: string | null;
  educatorId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  requiredValue?: string | number | null;
  actualValue?: string | number | null;
  context: Record<string, unknown>;
}

export interface CareInterval {
  startMinute: number;
  endMinute: number;
  requiredStaffCount: number;
}

export interface CareDay {
  date: string;
  weekNumber: number;
  dayOfWeek: number;
  appliedDayPlanId: string;
  intervals: CareInterval[];
  totalRequiredMinutes: number;
}

export interface InputReport {
  status: "NOT_VALIDATED" | "VALID_INPUT" | "INVALID_INPUT";
  publicResult?: ResultStatus | null;
  messages: DomainMessage[];
  care: CareDay[];
  weeklyBalance: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    requiredMinutes: number;
    assignedMinutes: number;
    differenceMinutes: number;
    educatorMinutes: Record<string, number>;
  }>;
}

export interface WorkAssignment {
  educatorId: string;
  date: string;
  startMinute: number;
  endMinute: number;
}

export interface Objective {
  afternoonPenalty: number;
  weekendPenalty: number;
  splitDaysPenalty: number;
  longSegmentsPenalty: number;
  preferredUnavailabilityPenalty: number;
  objectiveScore: number;
  canonicalTieBreaker: number;
}

export interface ValidationReport {
  status: "NOT_VALIDATED" | "VALID" | "INVALID";
  publicResult: ResultStatus;
  validatorVersion: string;
  messages: DomainMessage[];
  objective?: Objective | null;
  legalProfileStatus: string;
  legalProfileVersion: string;
  legalProfileRelevantDate?: string | null;
  demonstrationUseProhibitedNotice?: string | null;
}

export interface ConflictReport {
  summary: string;
  conflictAnalysisQuality: string;
  conflictingRuleIds: string[];
  educatorIds: string[];
  dates: string[];
  timeIntervals: string[];
  requiredValues: string[];
  actualValues: string[];
  inputFieldsToReview: string[];
}

export interface GenerateResponse {
  generationStatus: string;
  publicResult: ResultStatus;
  assignments: WorkAssignment[];
  care: CareDay[];
  objective?: Objective | null;
  validationReport?: ValidationReport | null;
  conflictReport?: ConflictReport | null;
  messages: DomainMessage[];
}
