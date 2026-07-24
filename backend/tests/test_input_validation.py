from __future__ import annotations

from datetime import timedelta

from app.models.schemas import (
    InputStatus,
    OperationMode,
    PlanScope,
)
from app.validation.input_validation import validate_configuration


def rule_ids(response):
    return {item.rule_id for item in response.messages}


def test_complete_demo_input_is_valid(demo_config):
    response = validate_configuration(demo_config)
    assert response.status == InputStatus.VALID_INPUT
    assert len(response.care) == 42
    assert [item["differenceMinutes"] for item in response.weekly_balance] == [0] * 6


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


def test_weekly_balance_must_be_exact(demo_config):
    demo_config.educators[0].base_weekly_assigned_minutes += 30
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
    response = validate_configuration(demo_config)
    special = next(item for item in response.care if item.week_number == 2 and item.day_of_week == 2)
    assert special.applied_day_plan_id == "PLAN-SPECIAL-2026-09-23"
    assert special.total_required_minutes == 540
