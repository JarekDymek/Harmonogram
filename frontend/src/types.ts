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

export interface GroupConfiguration {
  id: string;
  displayOrder: number;
  code: string;
  name: string;
  classLabel: string;
  active: boolean;
}

export interface Educator {
  id: string;
  groupId?: string | null;
  displayName: string;
  shortCode: string;
  baseWeeklyAssignedMinutes: number;
  description: string;
  active: boolean;
  canWorkWeekends: boolean;
}

export interface GroupEducatorMembership {
  id: string;
  groupId: string;
  educatorId: string;
  role: "PRIMARY" | "SUPPORT";
  active: boolean;
  weeklyTargetHoursByWeek: number[];
  hoursIncludeFixedNights?: boolean;
  fixedPartialSchedule?: boolean;
  description: string;
}

export interface AssignmentOverride {
  id: string;
  educatorId: string;
  configurationVersionId: string;
  groupId?: string | null;
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
  groupId?: string | null;
  variantKind: "BASE" | "SUBSTITUTE";
  positionInCycle?: number | null;
  replacesWeekendRotationVariantId?: string | null;
  applicableWeekNumber?: number | null;
  applicableSaturdayDate?: string | null;
  applicableSundayDate?: string | null;
  offEducatorId?: string | null;
  approved: boolean;
  approvalReference: string;
  approvedAt: string;
  approvedBy: string;
  saturdayTemplate: WeekendDayTemplate;
  sundayTemplate: WeekendDayTemplate;
}

export interface ExternalDutyAssignment {
  id: string;
  educatorId: string;
  startDateTime: string;
  endDateTime: string;
  dutyType: "NIGHT" | "SCHOOL" | "DINING_ROOM" | "OTHER";
  locked: boolean;
  countsTowardsHours: boolean;
  regularNight?: boolean;
  budgetGroupId?: string | null;
  creditedMinutes?: number | null;
  description: string;
}

export interface RecurringNightDuty {
  id: string;
  educatorId: string;
  startDayOfWeek: number;
  budgetGroupId?: string;
  description: string;
}

export interface RecurringWork {
  id: string;
  educatorId: string;
  groupId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  description: string;
}

export interface CommonAreaDuty {
  id: string;
  date: string;
  groupId: string;
  dutyType: "NIGHT" | "DINING_ROOM" | "OTHER";
  description: string;
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
  shortMiddleSegmentMinutes: number;
  splitDayPenaltyWeight: number;
  preferredUnavailabilityPenaltyWeight: number;
  longSegmentPenaltyWeight: number;
  weekendImbalancePenaltyWeight: number;
  afternoonHandoverPenaltyWeight: number;
}

export interface WorkAssignment {
  groupId: string;
  educatorId: string;
  date: string;
  startMinute: number;
  endMinute: number;
}

export interface ScheduleConfiguration {
  schemaVersion: number;
  projectId: string;
  projectName: string;
  configurationVersionId: string;
  versionNumber: number;
  groupCount: number;
  groups: GroupConfiguration[];
  activeGroupId: string;
  selectedGroupIds: string[];
  groupId: string;
  groupName: string;
  cycleStartDate: string;
  weekStartDay: string;
  timeZoneId: string;
  educatorCount: 3 | 4;
  planningHorizonWeeks: number;
  scheduleBoundaryMode: "FINITE" | "CYCLIC";
  cycleLengthWeeks?: number | null;
  cycleIsRepeating?: boolean | null;
  startingWeekendVariant: number;
  requestedOperationMode: "PRODUCTION" | "DEMONSTRATION";
  educators: Educator[];
  groupMemberships: GroupEducatorMembership[];
  assignmentOverrides: AssignmentOverride[];
  dayPlans: DayPlan[];
  unavailability: Unavailability[];
  legalRules: LegalRules;
  organizationalRules: OrganizationalRules;
  weekendVariants: WeekendVariant[];
  weekendDaysOffPatterns?: WeekendDaysOffPattern[];
  recurringNightDuties?: RecurringNightDuty[];
  recurringRequiredDuties?: RecurringWork[];
  recurringSchoolWork?: RecurringWork[];
  requiredAssignments?: WorkAssignment[];
  workRulesVersion?: number;
  externalDutyAssignments: ExternalDutyAssignment[];
  commonAreaDuties: CommonAreaDuty[];
  lockedAssignments: WorkAssignment[];
  boundaryContext?: {
    educators: Array<{
      educatorId: string;
      lastAssignmentBefore?: { date: string; startMinute: number; endMinute: number } | null;
      firstAssignmentAfter?: { date: string; startMinute: number; endMinute: number } | null;
    }>;
  } | null;
  solverTimeLimitSeconds: number;
  randomSeed: number;
  demonstrationNotice?: string | null;
}

export interface WeekendDaysOffPattern {
  id: string;
  educatorId: string;
  daysOff: number[];
  active: boolean;
  mode?: "FIXED" | "PREFER_CONSECUTIVE";
}

export interface DomainMessage {
  ruleId: string;
  severity: Severity;
  message: string;
  date?: string | null;
  educatorId?: string | null;
  groupId?: string | null;
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
  groupId: string;
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
    groupId?: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
    requiredMinutes: number;
    assignedMinutes: number;
    differenceMinutes: number;
    educatorMinutes: Record<string, number>;
  }>;
}

export interface Objective {
  consecutiveDaysOffPenalty?: number;
  afternoonPenalty: number;
  weekendPenalty: number;
  splitDaysPenalty: number;
  continuousBlockHandovers: number;
  distinctEducatorsPerBlock: number;
  totalSegments: number;
  shortMiddleSegments: number;
  longSegmentsPenalty: number;
  preferredUnavailabilityPenalty: number;
  objectiveScore: number;
  canonicalTieBreaker: number;
}

export interface QualityBlockDetail {
  groupId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  educatorIds: string[];
  handovers: number;
  explanation?: string | null;
}

export interface WeeklyQualitySummary {
  weekNumber: number;
  splitWorkDays: number;
  handovers: number;
  blocksWithOneEducator: number;
  blocksWithTwoEducators: number;
  blocksWithThreeEducators: number;
  blocksWithMoreEducators: number;
  multiEducatorBlocks: QualityBlockDetail[];
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
  nextWeekendVariant?: number | null;
  qualityReport?: { weeks: WeeklyQualitySummary[] } | null;
  optimizationProven?: boolean | null;
}
