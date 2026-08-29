from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.models.schemas import (
    EducatorUnavailability,
    ExternalDutyAssignment,
    InputStatus,
    OperationMode,
    PlanScope,
    UnavailabilityScope,
    UnavailabilityType,
)
from app.validation.input_validation import validate_configuration


def rule_ids(response):
    return {item.rule_id for item in response.messages}


def test_complete_demo_input_is_valid(demo_config):
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.VALID_INPUT
    assert len(response.care) == 7
    assert [item["differenceMinutes"] for item in response.weekly_balance] == [0]


def test_duplicate_approved_plan_is_rejected(demo_config):
    duplicate = demo_config.day_plans[0].model_copy(
        deep=True,
        update={"id": "DUPLICATE-PLAN"},
    )
    demo_config.day_plans.append(duplicate)
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.INVALID_INPUT
    assert "REQ-SPECIAL-DAY-001" in rule_ids(response)


def test_missing_base_plan_is_rejected(demo_config):
    demo_config.day_plans = [
        item
        for item in demo_config.day_plans
        if not (item.scope == PlanScope.BASE_WEEKLY and item.day_of_week == 6)
    ]
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.INVALID_INPUT
    assert "REQ-SPECIAL-DAY-001" in rule_ids(response)


def test_cycle_must_start_on_monday(demo_config):
    demo_config.cycle_start_date += timedelta(days=1)
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.INVALID_INPUT
    assert "REQ-CROSS-WEEK-001" in rule_ids(response)
    monday_error = next(
        item for item in response.messages if item.rule_id == "REQ-CROSS-WEEK-001"
    )
    assert monday_error.context["field"] == "cycleStartDate"


def test_weekly_balance_must_be_exact(demo_config):
    demo_config.group_memberships[0].weekly_target_hours_by_week[0] += 0.5
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.INVALID_INPUT
    hour_error = next(
        item for item in response.messages if item.rule_id == "REQ-HOURS-001"
    )
    assert hour_error.required_value == 4920
    assert hour_error.actual_value == 4950


def test_unverified_profile_blocks_production(demo_config):
    demo_config.requested_operation_mode = OperationMode.PRODUCTION
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.INVALID_INPUT
    assert "REQ-LEGAL-001" in rule_ids(response)


def test_specific_date_overrides_base_plan(demo_config):
    special_date = demo_config.cycle_start_date + timedelta(days=2)
    base = next(
        item
        for item in demo_config.day_plans
        if item.scope == PlanScope.BASE_WEEKLY and item.day_of_week == 2
    )
    special = base.model_copy(
        deep=True,
        update={
            "id": "PLAN-SPECIAL-FIRST-WEEK",
            "scope": PlanScope.SPECIFIC_DATE,
            "day_of_week": None,
            "date": special_date,
        },
    )
    special.no_care_intervals[0].end_time = "15:00"
    demo_config.day_plans.append(special)
    demo_config.educators[2].base_weekly_assigned_minutes -= 60
    response = validate_configuration(demo_config)
    calculated = next(
        item for item in response.care if item.date == special_date
    )
    assert calculated.applied_day_plan_id == "PLAN-SPECIAL-FIRST-WEEK"
    assert calculated.total_required_minutes == 540


def test_saturday_night_reports_exact_weekend_rest_conflict(demo_config):
    saturday = demo_config.cycle_start_date + timedelta(days=5)
    project_zone = ZoneInfo(demo_config.time_zone_id)
    utc = ZoneInfo("UTC")
    start = datetime.combine(
        saturday,
        datetime.min.time(),
        tzinfo=project_zone,
    ) + timedelta(hours=22)
    demo_config.external_duty_assignments.append(
        ExternalDutyAssignment(
            id="RECURRING-NIGHT-B-1",
            educator_id="B",
            start_date_time=start.astimezone(utc),
            end_date_time=(start + timedelta(hours=8)).astimezone(utc),
            duty_type="NIGHT",
        )
    )

    response = validate_configuration(demo_config)

    assert response.status == InputStatus.INVALID_INPUT
    conflict = next(
        item
        for item in response.messages
        if item.context.get("conflictType") == "NIGHT_WEEKEND_REST"
    )
    assert conflict.educator_id == "B"
    assert conflict.context["position"] == 1
    assert conflict.required_value == 660
    educator_name = next(item.display_name for item in demo_config.educators if item.id == "B")
    assert educator_name in conflict.message
    assert "22:00" in conflict.message


def test_tuesday_night_does_not_create_false_weekend_conflict(demo_config):
    tuesday = demo_config.cycle_start_date + timedelta(days=1)
    project_zone = ZoneInfo(demo_config.time_zone_id)
    start = datetime.combine(
        tuesday,
        datetime.min.time(),
        tzinfo=project_zone,
    ) + timedelta(hours=22)
    demo_config.external_duty_assignments.append(
        ExternalDutyAssignment(
            id="RECURRING-NIGHT-A-1",
            educator_id="A",
            start_date_time=start,
            end_date_time=start + timedelta(hours=8),
            duty_type="NIGHT",
        )
    )

    response = validate_configuration(demo_config)

    assert not any(
        item.context.get("conflictType") == "NIGHT_WEEKEND_REST"
        for item in response.messages
    )


def test_hard_unavailability_reports_exact_weekend_position(demo_config):
    saturday = demo_config.cycle_start_date + timedelta(days=5)
    demo_config.unavailability.append(
        EducatorUnavailability(
            id="HARD-A-SATURDAY",
            educator_id="A",
            scope=UnavailabilityScope.SPECIFIC_DATE,
            date=saturday,
            start_time="06:00",
            end_time="14:00",
            type=UnavailabilityType.HARD,
        )
    )

    response = validate_configuration(demo_config)

    assert response.status == InputStatus.INVALID_INPUT
    conflict = next(
        item
        for item in response.messages
        if item.context.get("conflictType") == "HARD_UNAVAILABILITY_WEEKEND"
    )
    assert conflict.educator_id == "A"
    assert conflict.context["position"] == 1
    assert conflict.date == saturday
    educator_name = next(item.display_name for item in demo_config.educators if item.id == "A")
    assert educator_name in conflict.message
