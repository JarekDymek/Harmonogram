from __future__ import annotations

from datetime import timedelta

from app.models.schemas import (
    EducatorUnavailability,
    UnavailabilityScope,
    UnavailabilityType,
    WorkAssignment,
)
from app.validation.schedule_validator import validate_schedule


def ids(report):
    return {item.rule_id for item in report.messages}


def cloned_assignments(response):
    return [item.model_copy(deep=True) for item in response.assignments]


def test_complete_generated_cycle_is_valid(generated_demo):
    configuration, response = generated_demo
    report = validate_schedule(
        configuration,
        response.assignments,
        response.care,
    )
    assert report.status == "VALID"
    assert report.public_result == "POPRAWNY_TRYB_DEMONSTRACYJNY"


def test_gap_is_detected(generated_demo):
    configuration, response = generated_demo
    assignments = cloned_assignments(response)
    saturday = configuration.cycle_start_date + timedelta(days=5)
    first = next(item for item in assignments if item.date == saturday)
    first.end_minute -= 30
    report = validate_schedule(configuration, assignments)
    assert report.status == "INVALID"
    assert "REQ-COVERAGE-001" in ids(report)
    assert "REQ-WEEKEND-001" in ids(report)


def test_overlap_is_detected(generated_demo):
    configuration, response = generated_demo
    assignments = cloned_assignments(response)
    assignments.append(assignments[0].model_copy(deep=True))
    report = validate_schedule(configuration, assignments)
    assert "REQ-STAFFING-001" in ids(report)


def test_work_outside_demand_is_detected(generated_demo):
    configuration, response = generated_demo
    assignments = cloned_assignments(response)
    assignments.append(
        WorkAssignment(
            educator_id="A",
            date=configuration.cycle_start_date,
            start_minute=8 * 60,
            end_minute=10 * 60,
        )
    )
    report = validate_schedule(configuration, assignments)
    assert "REQ-NO-OUTSIDE-001" in ids(report)


def test_minimum_segment_is_detected(generated_demo):
    configuration, response = generated_demo
    assignments = cloned_assignments(response)
    assignments[0].end_minute = assignments[0].start_minute + 30
    report = validate_schedule(configuration, assignments)
    assert "REQ-SEGMENT-MIN-001" in ids(report)


def test_hard_unavailability_is_critical(generated_demo):
    configuration, response = generated_demo
    configuration = configuration.model_copy(deep=True)
    assignment = response.assignments[0]
    configuration.unavailability.append(
        EducatorUnavailability(
            id="TEST-HARD",
            educator_id=assignment.educator_id,
            scope=UnavailabilityScope.SPECIFIC_DATE,
            date=assignment.date,
            start_time=f"{assignment.start_minute // 60:02d}:{assignment.start_minute % 60:02d}",
            end_time=f"{assignment.end_minute // 60:02d}:{assignment.end_minute % 60:02d}",
            type=UnavailabilityType.HARD,
        )
    )
    report = validate_schedule(configuration, response.assignments)
    assert "REQ-UNAVAILABLE-HARD-001" in ids(report)


def test_preferred_unavailability_is_only_a_warning(generated_demo):
    configuration, response = generated_demo
    configuration = configuration.model_copy(deep=True)
    assignment = response.assignments[0]
    configuration.unavailability.append(
        EducatorUnavailability(
            id="TEST-PREFERRED",
            educator_id=assignment.educator_id,
            scope=UnavailabilityScope.SPECIFIC_DATE,
            date=assignment.date,
            start_time=f"{assignment.start_minute // 60:02d}:{assignment.start_minute % 60:02d}",
            end_time=f"{assignment.end_minute // 60:02d}:{assignment.end_minute % 60:02d}",
            type=UnavailabilityType.PREFERRED,
        )
    )
    report = validate_schedule(configuration, response.assignments)
    preferred = [
        item
        for item in report.messages
        if item.rule_id == "REQ-PREF-UNAVAILABLE-001"
    ]
    assert preferred
    assert all(item.severity == "WARNING" for item in preferred)


def test_daily_rest_violation_is_detected(generated_demo):
    configuration, response = generated_demo
    assignments = cloned_assignments(response)
    monday_week_two = configuration.cycle_start_date + timedelta(days=7)
    morning = next(
        item
        for item in assignments
        if item.date == monday_week_two and item.start_minute == 6 * 60
    )
    morning.educator_id = "B"
    report = validate_schedule(configuration, assignments)
    assert "REQ-REST-DAILY-001" in ids(report)


def test_weekly_rest_violation_is_detected(generated_demo):
    configuration, response = generated_demo
    configuration = configuration.model_copy(deep=True)
    configuration.legal_rules.minimum_weekly_rest_minutes = 10000
    report = validate_schedule(configuration, response.assignments)
    assert "REQ-REST-WEEKLY-001" in ids(report)


def test_weekend_must_match_exact_template(generated_demo):
    configuration, response = generated_demo
    assignments = cloned_assignments(response)
    saturday = configuration.cycle_start_date + timedelta(days=5)
    first = next(item for item in assignments if item.date == saturday)
    first.educator_id = "C"
    report = validate_schedule(configuration, assignments)
    assert "REQ-WEEKEND-001" in ids(report)


def test_invalid_derived_staff_count_is_internal_error(generated_demo):
    configuration, response = generated_demo
    supplied_care = [item.model_copy(deep=True) for item in response.care]
    supplied_care[0].intervals[0].required_staff_count = 2
    report = validate_schedule(
        configuration,
        response.assignments,
        supplied_care,
    )
    assert report.public_result == "BLAD_WEWNETRZNY"
    assert "REQ-VALIDATOR-INDEP-001" in ids(report)
