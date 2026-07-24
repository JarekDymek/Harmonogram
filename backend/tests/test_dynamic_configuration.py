from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.fixtures.demo import demo_configuration
from app.models.schemas import (
    Educator,
    InputStatus,
    LegalStatus,
    OperationMode,
    ScheduleBoundaryMode,
)
from app.services.care_calculator import calculate_care
from app.services.generation import generate_schedule
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import validate_schedule


def four_person_configuration():
    configuration = demo_configuration()
    configuration.educator_count = 4
    for educator, assigned in zip(
        configuration.educators,
        (1320, 1320, 1140),
        strict=True,
    ):
        educator.base_weekly_assigned_minutes = assigned
    configuration.educators.append(
        Educator(
            id="D",
            group_id=configuration.group_id,
            display_name="Dorota Zielińska",
            short_code="DZ",
            base_weekly_assigned_minutes=1140,
            description="Czwarta osoba testowa.",
        )
    )
    return configuration


@pytest.mark.parametrize("weeks", range(1, 7))
def test_care_uses_selected_horizon(weeks):
    configuration = demo_configuration()
    configuration.planning_horizon_weeks = weeks
    assert len(calculate_care(configuration)) == weeks * 7


def test_four_person_schedule_is_generated_and_validated():
    configuration = four_person_configuration()
    input_report = validate_configuration(configuration)
    assert input_report.status == InputStatus.VALID_INPUT

    response = generate_schedule(configuration)

    assert response.generation_status == "CANDIDATE_FOUND"
    assert response.validation_report is not None
    assert response.validation_report.status == "VALID"
    assert {item.educator_id for item in response.assignments} == {
        "A",
        "B",
        "C",
        "D",
    }


@pytest.mark.parametrize("weeks", range(1, 6))
def test_cyclic_mode_is_rejected_below_six_weeks(weeks):
    configuration = demo_configuration()
    configuration.planning_horizon_weeks = weeks
    configuration.schedule_boundary_mode = ScheduleBoundaryMode.CYCLIC

    response = validate_configuration(configuration)

    assert response.status == InputStatus.INVALID_INPUT
    assert any(item.rule_id == "REQ-CROSS-WEEK-001" for item in response.messages)


def test_six_week_cycle_wraps_and_reports_next_position():
    configuration = demo_configuration()
    configuration.planning_horizon_weeks = 6
    configuration.schedule_boundary_mode = ScheduleBoundaryMode.CYCLIC

    response = generate_schedule(configuration)

    assert response.generation_status == "CANDIDATE_FOUND"
    assert response.next_weekend_variant == 1
    assert len(response.care) == 42

    assignments = [item.model_copy(deep=True) for item in response.assignments]
    first_date = configuration.cycle_start_date
    last_date = response.care[-1].date
    first = min(
        (item for item in assignments if item.date == first_date),
        key=lambda item: item.start_minute,
    )
    last = max(
        (item for item in assignments if item.date == last_date),
        key=lambda item: item.end_minute,
    )
    last.educator_id = first.educator_id
    report = validate_schedule(configuration, assignments)
    cross_boundary_errors = [
        item
        for item in report.messages
        if item.rule_id == "REQ-CROSS-WEEK-001" and item.severity == "ERROR"
    ]
    assert cross_boundary_errors


def test_complete_verified_profile_allows_production():
    configuration = demo_configuration()
    configuration.requested_operation_mode = OperationMode.PRODUCTION
    legal = configuration.legal_rules
    legal.verification_status = LegalStatus.VERIFIED
    legal.source_title = "Zweryfikowane źródło testowe"
    legal.source_identifier = "TEST-LEGAL-001"
    legal.source_section = "§ testowy"
    legal.verified_at = datetime(
        2026, 7, 24, 12, 0, tzinfo=ZoneInfo("Europe/Warsaw")
    )
    legal.effective_from = configuration.cycle_start_date
    legal.effective_to = None
    legal.approved_by = "TESTER PRAWNY"
    legal.version = "verified-test-1"

    response = validate_configuration(configuration)

    assert response.status == InputStatus.VALID_INPUT


def test_incomplete_verified_trace_is_rejected():
    configuration = demo_configuration()
    legal = configuration.legal_rules
    legal.verification_status = LegalStatus.VERIFIED
    legal.source_identifier = ""
    legal.source_section = ""
    legal.verified_at = None
    legal.effective_from = None
    legal.approved_by = None
    legal.version = ""

    response = validate_configuration(configuration)

    assert response.status == InputStatus.INVALID_INPUT
    assert any(item.rule_id == "REQ-LEGAL-001" for item in response.messages)
