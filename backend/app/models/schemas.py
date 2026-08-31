from __future__ import annotations

from datetime import date as Date, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class GroupEducatorRole(StrEnum):
    PRIMARY = "PRIMARY"
    SUPPORT = "SUPPORT"


class DutyType(StrEnum):
    NIGHT = "NIGHT"
    SCHOOL = "SCHOOL"
    DINING_ROOM = "DINING_ROOM"
    OTHER = "OTHER"


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
    # `groupId` i tygodniowy wymiar pozostają przyjmowane wyłącznie po to,
    # aby bezstratnie migrować zapis schematu v1/v2.
    group_id: str | None = None
    display_name: str
    short_code: str
    base_weekly_assigned_minutes: int = Field(default=0, ge=0)
    description: str = ""
    active: bool = True
    can_work_weekends: bool = True


class EducatorWeekAssignmentOverride(APIModel):
    id: str = Field(default_factory=_id)
    educator_id: str
    configuration_version_id: str
    group_id: str | None = None
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


class GroupConfiguration(APIModel):
    id: str
    display_order: int = Field(ge=1, le=8)
    code: str
    name: str
    class_label: str = ""
    active: bool = True


class GroupEducatorMembership(APIModel):
    id: str = Field(default_factory=_id)
    group_id: str
    educator_id: str
    role: GroupEducatorRole = GroupEducatorRole.PRIMARY
    active: bool = True
    weekly_target_hours_by_week: list[float] = Field(min_length=1, max_length=6)
    hours_include_fixed_nights: bool = False
    description: str = ""


class ExternalDutyAssignment(APIModel):
    id: str = Field(default_factory=_id)
    educator_id: str
    start_date_time: datetime
    end_date_time: datetime
    duty_type: DutyType = DutyType.OTHER
    locked: bool = True
    counts_towards_hours: bool = False
    regular_night: bool = False
    budget_group_id: str | None = None
    credited_minutes: int | None = Field(default=None, ge=0)
    description: str = ""

    @model_validator(mode="after")
    def validate_interval(self) -> "ExternalDutyAssignment":
        if (
            self.start_date_time.utcoffset() is None
            or self.end_date_time.utcoffset() is None
        ):
            raise ValueError(
                "Dyżur zewnętrzny wymaga dat i godzin ze strefą czasową."
            )
        if self.end_date_time <= self.start_date_time:
            raise ValueError(
                "Koniec dyżuru zewnętrznego musi przypadać po początku."
            )
        return self


class CommonAreaDuty(APIModel):
    id: str = Field(default_factory=_id)
    date: Date
    group_id: str
    duty_type: DutyType = DutyType.DINING_ROOM
    description: str = ""


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
    short_middle_segment_minutes: int = 180
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
    group_id: str | None = None
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
    work_rules_version: int = 2
    schema_version: int = Field(default=3, ge=2)
    project_id: str
    project_name: str
    configuration_version_id: str
    version_number: int = Field(ge=1)
    group_count: int = Field(default=1, ge=1, le=8)
    groups: list[GroupConfiguration] = Field(default_factory=list)
    active_group_id: str | None = None
    selected_group_ids: list[str] = Field(default_factory=list)
    # Aliasy widoku aktywnej grupy zachowują zgodność z formularzami v2.
    group_id: str | None = None
    group_name: str | None = None
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
    group_memberships: list[GroupEducatorMembership] = Field(default_factory=list)
    assignment_overrides: list[EducatorWeekAssignmentOverride] = Field(default_factory=list)
    day_plans: list[DayCarePlan]
    unavailability: list[EducatorUnavailability] = Field(default_factory=list)
    legal_rules: LegalRulesConfiguration
    organizational_rules: OrganizationalRulesConfiguration
    weekend_variants: list[WeekendRotationVariant]
    external_duty_assignments: list[ExternalDutyAssignment] = Field(default_factory=list)
    common_area_duties: list[CommonAreaDuty] = Field(default_factory=list)
    locked_assignments: list["WorkAssignment"] = Field(default_factory=list)
    required_assignments: list["WorkAssignment"] = Field(default_factory=list)
    boundary_context: BoundaryContext | None = None
    solver_time_limit_seconds: float = Field(default=20.0, gt=0, le=300)
    random_seed: int = 20260724
    demonstration_notice: str | None = None

    @model_validator(mode="after")
    def migrate_legacy_group(self) -> "ScheduleConfiguration":
        """Normalizuje dawną konfigurację jednej grupy do projektu internatu."""
        self.schema_version = 3
        if not self.groups:
            legacy_group_id = self.group_id or "G1"
            self.groups = [
                GroupConfiguration(
                    id=legacy_group_id,
                    display_order=1,
                    code="I",
                    name=self.group_name or "Grupa I",
                    active=True,
                )
            ]
            self.group_count = 1
        active_ids = [item.id for item in self.groups if item.active]
        if self.active_group_id not in active_ids:
            self.active_group_id = active_ids[0] if active_ids else self.groups[0].id
        active_group = next(
            item for item in self.groups if item.id == self.active_group_id
        )
        self.group_id = active_group.id
        self.group_name = active_group.name
        if not self.selected_group_ids:
            self.selected_group_ids = active_ids
        if not self.group_memberships:
            for index, educator in enumerate(self.educators):
                group_id = educator.group_id or active_group.id
                educator.group_id = None
                self.group_memberships.append(
                    GroupEducatorMembership(
                        id=f"MEM-{group_id}-{educator.id}",
                        group_id=group_id,
                        educator_id=educator.id,
                        role=(
                            GroupEducatorRole.PRIMARY
                            if index < 3
                            else GroupEducatorRole.SUPPORT
                        ),
                        weekly_target_hours_by_week=[
                            educator.base_weekly_assigned_minutes / 60
                        ]
                        * self.planning_horizon_weeks,
                        description=educator.description,
                    )
                )
        for variant in self.weekend_variants:
            if variant.group_id is None:
                variant.group_id = active_group.id
        for override in self.assignment_overrides:
            if override.group_id is None:
                membership = next(
                    (
                        item
                        for item in self.group_memberships
                        if item.educator_id == override.educator_id
                    ),
                    None,
                )
                override.group_id = (
                    membership.group_id if membership is not None else active_group.id
                )
        return self

    def active_groups(self) -> list[GroupConfiguration]:
        selected = set(self.selected_group_ids)
        return [
            item
            for item in sorted(self.groups, key=lambda value: value.display_order)
            if item.active and item.id in selected
        ]

    def memberships_for_group(self, group_id: str) -> list[GroupEducatorMembership]:
        return [
            item
            for item in self.group_memberships
            if item.active and item.group_id == group_id
        ]

    def configuration_for_group(self, group_id: str) -> "ScheduleConfiguration":
        """Buduje zgodny widok pojedynczej grupy dla kalkulatorów i walidacji."""
        from app.domain.work_calendar import care_target_minutes
        group = next(item for item in self.groups if item.id == group_id)
        memberships = self.memberships_for_group(group_id)
        educator_by_id = {item.id: item for item in self.educators}
        educators: list[Educator] = []
        overrides: list[EducatorWeekAssignmentOverride] = []
        for membership in memberships:
            source = educator_by_id[membership.educator_id]
            minutes = [
                care_target_minutes(self, membership, week)
                for week in range(1, self.planning_horizon_weeks + 1)
            ]
            educators.append(
                source.model_copy(
                    update={
                        "group_id": group_id,
                        "base_weekly_assigned_minutes": minutes[0],
                    }
                )
            )
            for week_number, assigned in enumerate(minutes[1:], start=2):
                if assigned == minutes[0]:
                    continue
                overrides.append(
                    EducatorWeekAssignmentOverride(
                        id=f"MEMBER-TARGET-{membership.id}-{week_number}",
                        educator_id=membership.educator_id,
                        configuration_version_id=self.configuration_version_id,
                        group_id=group_id,
                        week_number=week_number,
                        assigned_minutes=assigned,
                        reason="Wymiar zapisany w członkostwie grupowym.",
                        approved_at=datetime(1970, 1, 1),
                        approved_by="MIGRATION",
                    )
                )
        explicit = [
            item
            for item in self.assignment_overrides
            if item.group_id == group_id
        ]
        explicit_keys = {(item.educator_id, item.week_number) for item in explicit}
        overrides = [
            item
            for item in overrides
            if (item.educator_id, item.week_number) not in explicit_keys
        ] + explicit
        selected_educator_ids = {item.id for item in educators}
        return self.model_copy(
            update={
                "group_count": 1,
                "groups": [group],
                "active_group_id": group_id,
                "selected_group_ids": [group_id],
                "group_id": group_id,
                "group_name": group.name,
                "educator_count": len(educators),
                "educators": educators,
                "group_memberships": memberships,
                "assignment_overrides": overrides,
                "day_plans": [
                    item for item in self.day_plans if item.group_id == group_id
                ],
                "unavailability": [
                    item
                    for item in self.unavailability
                    if item.educator_id in selected_educator_ids
                ],
                "weekend_variants": [
                    item
                    for item in self.weekend_variants
                    if item.group_id == group_id
                ],
                "common_area_duties": [
                    item
                    for item in self.common_area_duties
                    if item.group_id == group_id
                ],
                "boundary_context": (
                    BoundaryContext(
                        educators=[
                            item
                            for item in self.boundary_context.educators
                            if item.educator_id in selected_educator_ids
                        ]
                    )
                    if self.boundary_context is not None
                    else None
                ),
            }
        )


class CareInterval(APIModel):
    start_minute: int = Field(ge=0, lt=1440)
    end_minute: int = Field(gt=0, le=1440)
    required_staff_count: int = 1


class CalculatedCareDay(APIModel):
    group_id: str = ""
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
    group_id: str | None = None
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
    group_id: str = ""
    educator_id: str
    date: Date
    start_minute: int
    end_minute: int


class ObjectiveBreakdown(APIModel):
    afternoon_penalty: int = 0
    weekend_penalty: int = 0
    split_days_penalty: int = 0
    continuous_block_handovers: int = 0
    distinct_educators_per_block: int = 0
    total_segments: int = 0
    short_middle_segments: int = 0
    long_segments_penalty: int = 0
    preferred_unavailability_penalty: int = 0
    objective_score: int = 0
    canonical_tie_breaker: int = 0


class QualityBlockDetail(APIModel):
    group_id: str
    date: Date
    start_minute: int
    end_minute: int
    educator_ids: list[str]
    handovers: int
    explanation: str | None = None


class WeeklyQualitySummary(APIModel):
    week_number: int
    split_work_days: int
    handovers: int
    blocks_with_one_educator: int
    blocks_with_two_educators: int
    blocks_with_three_educators: int
    blocks_with_more_educators: int
    multi_educator_blocks: list[QualityBlockDetail] = Field(default_factory=list)


class ScheduleQualityReport(APIModel):
    weeks: list[WeeklyQualitySummary] = Field(default_factory=list)


class ValidationReport(APIModel):
    status: ValidationStatus
    public_result: PublicResult
    validator_version: str = "2.0.0"
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
    quality_report: ScheduleQualityReport | None = None
    optimization_proven: bool | None = None


class ValidateScheduleRequest(APIModel):
    configuration: ScheduleConfiguration
    assignments: list[WorkAssignment]
    calculated_care: list[CalculatedCareDay] | None = None


class CalculateCareResponse(APIModel):
    status: str
    care: list[CalculatedCareDay] = Field(default_factory=list)
    messages: list[DomainMessage] = Field(default_factory=list)
