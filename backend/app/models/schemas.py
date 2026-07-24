from __future__ import annotations

from datetime import date as Date, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def _camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def _id() -> str:
    return str(uuid4())


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="forbid",
    )


class PlanScope(StrEnum):
    BASE_WEEKLY = "BASE_WEEKLY"
    CYCLE_WEEK = "CYCLE_WEEK"
    SPECIFIC_DATE = "SPECIFIC_DATE"


class UnavailabilityScope(StrEnum):
    RECURRING_WEEKLY = "RECURRING_WEEKLY"
    CYCLE_WEEK = "CYCLE_WEEK"
    SPECIFIC_DATE = "SPECIFIC_DATE"


class UnavailabilityType(StrEnum):
    HARD = "HARD"
    PREFERRED = "PREFERRED"


class LegalStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"


class OperationMode(StrEnum):
    PRODUCTION = "PRODUCTION"
    DEMONSTRATION = "DEMONSTRATION"


class ScheduleBoundaryMode(StrEnum):
    FINITE = "FINITE"
    CYCLIC = "CYCLIC"


class WeeklyRestWindowType(StrEnum):
    FIXED_LOCAL_WEEK = "FIXED_LOCAL_WEEK"
    ROLLING_DURATION = "ROLLING_DURATION"


class WeeklyRestAttributionMode(StrEnum):
    FULLY_CONTAINED = "FULLY_CONTAINED"
    INTERSECTION_WITH_WINDOW = "INTERSECTION_WITH_WINDOW"


class WeekendVariantKind(StrEnum):
    BASE = "BASE"
    SUBSTITUTE = "SUBSTITUTE"


class WeekendDay(StrEnum):
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"


class MessageSeverity(StrEnum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class InputStatus(StrEnum):
    NOT_VALIDATED = "NOT_VALIDATED"
    VALID_INPUT = "VALID_INPUT"
    INVALID_INPUT = "INVALID_INPUT"


class GenerationStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    RUNNING = "RUNNING"
    CANDIDATE_FOUND = "CANDIDATE_FOUND"
    NO_SOLUTION = "NO_SOLUTION"
    TIME_LIMIT = "TIME_LIMIT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ValidationStatus(StrEnum):
    NOT_VALIDATED = "NOT_VALIDATED"
    VALID = "VALID"
    INVALID = "INVALID"


class PublicResult(StrEnum):
    DANE_NIEPOPRAWNE = "DANE_NIEPOPRAWNE"
    BRAK_ROZWIAZANIA = "BRAK_ROZWIAZANIA"
    NIE_ZAKONCZONO_WYSZUKIWANIA = "NIE_ZAKONCZONO_WYSZUKIWANIA"
    BLAD_WEWNETRZNY = "BLAD_WEWNETRZNY"
    POPRAWNY = "POPRAWNY"
    POPRAWNY_TRYB_DEMONSTRACYJNY = "POPRAWNY_TRYB_DEMONSTRACYJNY"


class EventType(StrEnum):
    SCHOOL = "SCHOOL"
    INTERNSHIP = "INTERNSHIP"
    TRIP = "TRIP"
    CEREMONY = "CEREMONY"
    ACTIVITY_OUTSIDE = "ACTIVITY_OUTSIDE"
    OTHER_CARE = "OTHER_CARE"
    CUSTOM = "CUSTOM"


class TimeInterval(APIModel):
    id: str = Field(default_factory=_id)
    start_time: str
    end_time: str
    event_type: EventType | None = None
    custom_event_type: str | None = None
    description: str = ""


class Educator(APIModel):
    id: str
    group_id: str
    display_name: str
    short_code: str
    base_weekly_assigned_minutes: int = Field(ge=0)
    description: str = ""
    active: bool = True
    can_work_weekends: bool = True


class EducatorWeekAssignmentOverride(APIModel):
    id: str = Field(default_factory=_id)
    educator_id: str
    configuration_version_id: str
    week_number: int = Field(ge=1, le=6)
    assigned_minutes: int = Field(ge=0)
    reason: str
    approved_at: datetime
    approved_by: str


class EducatorUnavailability(APIModel):
    id: str = Field(default_factory=_id)
    educator_id: str
    scope: UnavailabilityScope
    date: Date | None = None
    week_number: int | None = Field(default=None, ge=1, le=6)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: str
    end_time: str
    type: UnavailabilityType
    description: str = ""


class DayCarePlan(APIModel):
    id: str = Field(default_factory=_id)
    configuration_version_id: str
    group_id: str
    scope: PlanScope
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    week_number: int | None = Field(default=None, ge=1, le=6)
    date: Date | None = None
    operating_intervals: list[TimeInterval]
    no_care_intervals: list[TimeInterval] = Field(default_factory=list)
    event_type: EventType | None = None
    custom_event_type: str | None = None
    description: str = ""
    approved: bool = True
    approved_at: datetime | None = None
    approved_by: str | None = None


class LegalRulesConfiguration(APIModel):
    id: str
    configuration_version_id: str
    jurisdiction: str
    source_title: str
    source_section: str
    source_identifier: str
    verified_at: datetime | None = None
    effective_from: Date | None = None
    effective_to: Date | None = None
    approved_by: str | None = None
    version: str
    verification_notes: str = ""
    verification_status: LegalStatus
    minimum_daily_rest_minutes: int = Field(ge=0)
    weekly_rest_window_type: WeeklyRestWindowType
    weekly_rest_window_length_minutes: int = Field(gt=0)
    weekly_rest_window_step_minutes: int = Field(gt=0)
    weekly_rest_anchor_day_of_week: int = Field(ge=0, le=6)
    weekly_rest_anchor_time: str
    minimum_weekly_rest_minutes: int = Field(ge=0)
    weekly_rest_attribution_mode: WeeklyRestAttributionMode
    weekly_rest_reuse_across_windows_allowed: bool
    weekly_rest_exception_enabled: bool = False
    weekly_rest_exception_minimum_minutes: int | None = Field(default=None, ge=0)
    weekly_rest_exception_maximum_occurrences_per_cycle: int | None = Field(default=None, ge=0)
    weekly_rest_exception_minimum_gap_minutes: int | None = Field(default=None, ge=0)
    weekly_rest_compensation_required: bool = False
    weekly_rest_compensation_minutes: int | None = Field(default=None, ge=0)
    weekly_rest_compensation_deadline_minutes: int | None = Field(default=None, ge=0)
    maximum_absolute_daily_work_minutes: int | None = Field(default=None, ge=0)
    maximum_absolute_segment_minutes: int | None = Field(default=None, ge=0)


class OrganizationalRulesConfiguration(APIModel):
    id: str
    configuration_version_id: str
    time_step_minutes: int = 30
    minimum_segment_minutes: int = 120
    required_work_days_per_week: int = 5
    weekend_rotation_enabled: bool = True
    preferred_maximum_segment_minutes: int = 480
    preferred_afternoon_handover_time: str = "17:00"
    preferred_weekend_split_minutes: int = 480
    split_day_penalty_weight: int = Field(default=1, ge=0)
    preferred_unavailability_penalty_weight: int = Field(default=1, ge=0)
    long_segment_penalty_weight: int = Field(default=1, ge=0)
    weekend_imbalance_penalty_weight: int = Field(default=1, ge=0)
    afternoon_handover_penalty_weight: int = Field(default=1, ge=0)


class WeekendAssignmentTemplate(APIModel):
    id: str = Field(default_factory=_id)
    educator_id: str
    start_time: str
    end_time: str
    sequence_number: int = Field(ge=1)


class WeekendDayTemplate(APIModel):
    id: str = Field(default_factory=_id)
    day_of_week: WeekendDay
    assignments: list[WeekendAssignmentTemplate]


class WeekendRotationVariant(APIModel):
    id: str
    configuration_version_id: str
    variant_kind: WeekendVariantKind
    position_in_cycle: int | None = Field(default=None, ge=1, le=6)
    replaces_weekend_rotation_variant_id: str | None = None
    applicable_week_number: int | None = Field(default=None, ge=1, le=6)
    applicable_saturday_date: Date | None = None
    applicable_sunday_date: Date | None = None
    off_educator_id: str | None = None
    approved: bool
    approval_reference: str
    approved_at: datetime
    approved_by: str
    saturday_template: WeekendDayTemplate
    sunday_template: WeekendDayTemplate


class BoundaryWorkSegment(APIModel):
    date: Date
    start_minute: int = Field(ge=0, lt=1440)
    end_minute: int = Field(gt=0, le=1440)


class EducatorBoundaryContext(APIModel):
    educator_id: str
    last_assignment_before: BoundaryWorkSegment | None = None
    first_assignment_after: BoundaryWorkSegment | None = None


class BoundaryContext(APIModel):
    educators: list[EducatorBoundaryContext] = Field(default_factory=list)


class ScheduleConfiguration(APIModel):
    schema_version: int = Field(default=2, ge=2)
    project_id: str
    project_name: str
    configuration_version_id: str
    version_number: int = Field(ge=1)
    group_id: str
    group_name: str
    cycle_start_date: Date
    week_start_day: str = "MONDAY"
    time_zone_id: str = "Europe/Warsaw"
    educator_count: int = Field(default=3, ge=3, le=4)
    planning_horizon_weeks: int = Field(default=1, ge=1, le=6)
    schedule_boundary_mode: ScheduleBoundaryMode = ScheduleBoundaryMode.FINITE
    # Pola starszego schematu są przyjmowane wyłącznie dla zgodności migracyjnej.
    cycle_length_weeks: int | None = Field(default=None, ge=1, le=6)
    cycle_is_repeating: bool | None = None
    starting_weekend_variant: int = Field(default=1, ge=1, le=6)
    requested_operation_mode: OperationMode
    educators: list[Educator]
    assignment_overrides: list[EducatorWeekAssignmentOverride] = Field(default_factory=list)
    day_plans: list[DayCarePlan]
    unavailability: list[EducatorUnavailability] = Field(default_factory=list)
    legal_rules: LegalRulesConfiguration
    organizational_rules: OrganizationalRulesConfiguration
    weekend_variants: list[WeekendRotationVariant]
    boundary_context: BoundaryContext | None = None
    solver_time_limit_seconds: float = Field(default=20.0, gt=0, le=300)
    random_seed: int = 20260724
    demonstration_notice: str | None = None


class CareInterval(APIModel):
    start_minute: int = Field(ge=0, lt=1440)
    end_minute: int = Field(gt=0, le=1440)
    required_staff_count: int = 1


class CalculatedCareDay(APIModel):
    date: Date
    week_number: int = Field(ge=1, le=6)
    day_of_week: int = Field(ge=0, le=6)
    applied_day_plan_id: str
    intervals: list[CareInterval]
    total_required_minutes: int


class DomainMessage(APIModel):
    rule_id: str
    severity: MessageSeverity
    message: str
    date: Date | None = None
    educator_id: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    required_value: str | int | float | None = None
    actual_value: str | int | float | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class InputValidationResponse(APIModel):
    status: InputStatus
    public_result: PublicResult | None = None
    messages: list[DomainMessage] = Field(default_factory=list)
    care: list[CalculatedCareDay] = Field(default_factory=list)
    weekly_balance: list[dict[str, Any]] = Field(default_factory=list)


class WorkAssignment(APIModel):
    educator_id: str
    date: Date
    start_minute: int
    end_minute: int


class ObjectiveBreakdown(APIModel):
    afternoon_penalty: int = 0
    weekend_penalty: int = 0
    split_days_penalty: int = 0
    long_segments_penalty: int = 0
    preferred_unavailability_penalty: int = 0
    objective_score: int = 0
    canonical_tie_breaker: int = 0


class ValidationReport(APIModel):
    status: ValidationStatus
    public_result: PublicResult
    validator_version: str = "1.0.0"
    messages: list[DomainMessage] = Field(default_factory=list)
    objective: ObjectiveBreakdown | None = None
    legal_profile_status: LegalStatus
    legal_profile_version: str
    legal_profile_relevant_date: Date | None = None
    demonstration_use_prohibited_notice: str | None = None


class ConflictReport(APIModel):
    summary: str
    conflict_analysis_quality: str = "APPROXIMATE"
    conflicting_rule_ids: list[str] = Field(default_factory=list)
    educator_ids: list[str] = Field(default_factory=list)
    dates: list[Date] = Field(default_factory=list)
    time_intervals: list[str] = Field(default_factory=list)
    required_values: list[str] = Field(default_factory=list)
    actual_values: list[str] = Field(default_factory=list)
    input_fields_to_review: list[str] = Field(default_factory=list)


class GenerateResponse(APIModel):
    generation_status: GenerationStatus
    public_result: PublicResult
    assignments: list[WorkAssignment] = Field(default_factory=list)
    care: list[CalculatedCareDay] = Field(default_factory=list)
    objective: ObjectiveBreakdown | None = None
    validation_report: ValidationReport | None = None
    conflict_report: ConflictReport | None = None
    messages: list[DomainMessage] = Field(default_factory=list)
    next_weekend_variant: int | None = Field(default=None, ge=1, le=6)


class ValidateScheduleRequest(APIModel):
    configuration: ScheduleConfiguration
    assignments: list[WorkAssignment]
    calculated_care: list[CalculatedCareDay] | None = None


class CalculateCareResponse(APIModel):
    status: str
    care: list[CalculatedCareDay] = Field(default_factory=list)
    messages: list[DomainMessage] = Field(default_factory=list)
