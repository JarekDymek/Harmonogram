from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.models.schemas import (
    DayCarePlan,
    Educator,
    EducatorUnavailability,
    EventType,
    LegalRulesConfiguration,
    LegalStatus,
    OperationMode,
    OrganizationalRulesConfiguration,
    PlanScope,
    ScheduleConfiguration,
    ScheduleBoundaryMode,
    TimeInterval,
    UnavailabilityScope,
    UnavailabilityType,
    WeeklyRestAttributionMode,
    WeeklyRestWindowType,
    WeekendAssignmentTemplate,
    WeekendDay,
    WeekendDayTemplate,
    WeekendRotationVariant,
    WeekendVariantKind,
)


DEMO_VERSION = "DEMO-CV-001"
DEMO_GROUP = "G1"
DEMO_NOTICE = (
    "WYŁĄCZNIE DEMONSTRACJA. Profil prawny ma status UNVERIFIED; "
    "harmonogramu nie wolno używać do rzeczywistego planowania pracy."
)


def _interval(
    interval_id: str,
    start: str,
    end: str,
    *,
    event_type: EventType | None = None,
    description: str = "",
) -> TimeInterval:
    return TimeInterval(
        id=interval_id,
        start_time=start,
        end_time=end,
        event_type=event_type,
        description=description,
    )


def _base_plan(day_of_week: int) -> DayCarePlan:
    weekday = day_of_week < 5
    return DayCarePlan(
        id=f"PLAN-BASE-{day_of_week}",
        configuration_version_id=DEMO_VERSION,
        group_id=DEMO_GROUP,
        scope=PlanScope.BASE_WEEKLY,
        day_of_week=day_of_week,
        operating_intervals=[
            _interval(
                f"OPERATING-{day_of_week}",
                "06:00",
                "22:00",
                description="Jawne godziny działania internatu.",
            )
        ],
        no_care_intervals=(
            [
                _interval(
                    f"SCHOOL-{day_of_week}",
                    "08:00",
                    "14:00",
                    event_type=EventType.SCHOOL,
                    description="Pobyt wychowanków w szkole.",
                )
            ]
            if weekday
            else []
        ),
        description=(
            "Bazowy dzień roboczy."
            if weekday
            else "Bazowy rzeczywisty przedział opieki weekendowej."
        ),
        approved=True,
        approved_at=datetime(2026, 7, 24, 9, 0, tzinfo=ZoneInfo("Europe/Warsaw")),
        approved_by="DEMO_ADMIN",
    )


def _weekend_template(
    variant_id: str,
    day: WeekendDay,
    first: str,
    second: str,
) -> WeekendDayTemplate:
    suffix = "SAT" if day == WeekendDay.SATURDAY else "SUN"
    return WeekendDayTemplate(
        id=f"{variant_id}-{suffix}",
        day_of_week=day,
        assignments=[
            WeekendAssignmentTemplate(
                id=f"{variant_id}-{suffix}-1",
                educator_id=first,
                start_time="06:00",
                end_time="14:00",
                sequence_number=1,
            ),
            WeekendAssignmentTemplate(
                id=f"{variant_id}-{suffix}-2",
                educator_id=second,
                start_time="14:00",
                end_time="22:00",
                sequence_number=2,
            ),
        ],
    )


def _variant(position: int, first: str, second: str, off: str) -> WeekendRotationVariant:
    variant_id = f"WEEKEND-BASE-{position}"
    return WeekendRotationVariant(
        id=variant_id,
        configuration_version_id=DEMO_VERSION,
        variant_kind=WeekendVariantKind.BASE,
        position_in_cycle=position,
        off_educator_id=off,
        approved=True,
        approval_reference="DEMO-APPROVAL-WEEKEND",
        approved_at=datetime(2026, 7, 24, 9, 30, tzinfo=ZoneInfo("Europe/Warsaw")),
        approved_by="DEMO_ADMIN",
        saturday_template=_weekend_template(
            variant_id,
            WeekendDay.SATURDAY,
            first,
            second,
        ),
        sunday_template=_weekend_template(
            variant_id,
            WeekendDay.SUNDAY,
            first,
            second,
        ),
    )


def demo_configuration() -> ScheduleConfiguration:
    cycle_start = datetime(2026, 9, 14).date()
    plans = [_base_plan(day) for day in range(7)]
    educators = [
        Educator(
            id="A",
            group_id=DEMO_GROUP,
            display_name="Anna Kowalska",
            short_code="AK",
            base_weekly_assigned_minutes=1650,
            description="Dane demonstracyjne.",
        ),
        Educator(
            id="B",
            group_id=DEMO_GROUP,
            display_name="Bartosz Nowak",
            short_code="BN",
            base_weekly_assigned_minutes=1650,
            description="Dane demonstracyjne.",
        ),
        Educator(
            id="C",
            group_id=DEMO_GROUP,
            display_name="Celina Wiśniewska",
            short_code="CW",
            base_weekly_assigned_minutes=1620,
            description="Dane demonstracyjne.",
        ),
    ]
    return ScheduleConfiguration(
        schema_version=2,
        project_id="HARMONOGRAM-MOW-DEMO",
        project_name="Harmonogram MOW — demonstracja",
        configuration_version_id=DEMO_VERSION,
        version_number=1,
        group_id=DEMO_GROUP,
        group_name="Grupa demonstracyjna",
        cycle_start_date=cycle_start,
        week_start_day="MONDAY",
        time_zone_id="Europe/Warsaw",
        educator_count=3,
        planning_horizon_weeks=1,
        schedule_boundary_mode=ScheduleBoundaryMode.FINITE,
        starting_weekend_variant=1,
        requested_operation_mode=OperationMode.DEMONSTRATION,
        educators=educators,
        assignment_overrides=[],
        day_plans=plans,
        unavailability=[
            EducatorUnavailability(
                id="HARD-C-MONDAY-MORNING",
                educator_id="C",
                scope=UnavailabilityScope.CYCLE_WEEK,
                week_number=1,
                day_of_week=0,
                start_time="06:00",
                end_time="08:00",
                type=UnavailabilityType.HARD,
                description="Przykład twardej niedostępności.",
            ),
            EducatorUnavailability(
                id="PREFERRED-A-WEDNESDAY",
                educator_id="A",
                scope=UnavailabilityScope.RECURRING_WEEKLY,
                day_of_week=2,
                start_time="14:00",
                end_time="18:00",
                type=UnavailabilityType.PREFERRED,
                description="Przykład preferencji, a nie zakazu.",
            ),
        ],
        legal_rules=LegalRulesConfiguration(
            id="LEGAL-DEMO-001",
            configuration_version_id=DEMO_VERSION,
            jurisdiction="PL",
            source_title="NIEZWERYFIKOWANY PROFIL DEMONSTRACYJNY",
            source_section="Wartości testowe — bez oceny prawnej",
            source_identifier="DEMO-ONLY",
            version="demo-1.0",
            verification_notes=DEMO_NOTICE,
            verification_status=LegalStatus.UNVERIFIED,
            minimum_daily_rest_minutes=660,
            weekly_rest_window_type=WeeklyRestWindowType.FIXED_LOCAL_WEEK,
            weekly_rest_window_length_minutes=10080,
            weekly_rest_window_step_minutes=10080,
            weekly_rest_anchor_day_of_week=0,
            weekly_rest_anchor_time="00:00",
            minimum_weekly_rest_minutes=2100,
            weekly_rest_attribution_mode=WeeklyRestAttributionMode.INTERSECTION_WITH_WINDOW,
            weekly_rest_reuse_across_windows_allowed=True,
            weekly_rest_exception_enabled=False,
            weekly_rest_exception_minimum_minutes=None,
            weekly_rest_exception_maximum_occurrences_per_cycle=None,
            weekly_rest_exception_minimum_gap_minutes=None,
            weekly_rest_compensation_required=False,
            weekly_rest_compensation_minutes=None,
            weekly_rest_compensation_deadline_minutes=None,
            maximum_absolute_daily_work_minutes=600,
            maximum_absolute_segment_minutes=480,
        ),
        organizational_rules=OrganizationalRulesConfiguration(
            id="ORG-DEMO-001",
            configuration_version_id=DEMO_VERSION,
            time_step_minutes=30,
            minimum_segment_minutes=120,
            required_work_days_per_week=5,
            weekend_rotation_enabled=True,
            preferred_maximum_segment_minutes=480,
            preferred_afternoon_handover_time="17:00",
            preferred_weekend_split_minutes=480,
            # Wagi fixture są jawnie testowe. Zerowy wektor pozwala użyć tego
            # zestawu jako szybkiego testu wykonalności wszystkich reguł twardych;
            # działanie składników celu jest testowane osobno.
            split_day_penalty_weight=0,
            preferred_unavailability_penalty_weight=0,
            long_segment_penalty_weight=0,
            weekend_imbalance_penalty_weight=0,
            afternoon_handover_penalty_weight=0,
        ),
        weekend_variants=[
            _variant(1, "A", "B", "C"),
            _variant(2, "A", "C", "B"),
            _variant(3, "B", "C", "A"),
            _variant(4, "B", "A", "C"),
            _variant(5, "C", "A", "B"),
            _variant(6, "C", "B", "A"),
        ],
        solver_time_limit_seconds=45,
        random_seed=20260724,
        demonstration_notice=DEMO_NOTICE,
    )
