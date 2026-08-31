from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.fixtures.demo import demo_configuration
from app.models.schemas import Educator, ExternalDutyAssignment, ScheduleBoundaryMode, WorkAssignment
from app.services.generation import generate_schedule
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import _cross_group_messages, validate_schedule


def with_registry_only_educator(mode="CYCLIC"):
    config = demo_configuration()
    config.planning_horizon_weeks = 6 if mode == "CYCLIC" else 1
    config.schedule_boundary_mode = ScheduleBoundaryMode(mode)
    config.educators.append(Educator(id="REMOVED", display_name="Osoba z rejestru", short_code="R"))
    # No membership or assignments: this is the state after removing someone
    # from a group, without erasing their global contact record.
    return config


@pytest.mark.parametrize("mode", ["CYCLIC", "FINITE"])
def test_registry_only_person_has_no_missing_rest(mode):
    config = with_registry_only_educator(mode)
    assert validate_configuration(config).status == "VALID_INPUT"
    messages = _cross_group_messages(config, [])
    assert not [m for m in messages if m.educator_id == "REMOVED"]


def test_generation_succeeds_with_removed_fourth_person():
    config = with_registry_only_educator()
    config.solver_time_limit_seconds = 30
    before = config.model_dump()
    result = generate_schedule(config)
    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert {a.educator_id for a in result.assignments} == {"A", "B", "C"}
    assert config.model_dump() == before


def test_idle_person_does_not_hide_missing_hours_of_actual_members():
    config = with_registry_only_educator()
    report = validate_schedule(config, [])
    assert report.status == "INVALID"
    assert any(m.rule_id == "REQ-HOURS-001" and m.educator_id == "A" for m in report.messages)
    assert not any(m.educator_id == "REMOVED" for m in report.messages)


@pytest.mark.parametrize("source", ["school", "night", "other_group"])
def test_registry_person_with_actual_duties_still_has_rest_checked(source):
    config = with_registry_only_educator()
    zone = ZoneInfo(config.time_zone_id)
    if source == "other_group":
        config.locked_assignments = [WorkAssignment(group_id="OTHER", educator_id="REMOVED",
            date=config.cycle_start_date + timedelta(days=day), start_minute=480, end_minute=1200)
            for day in range(42)]
    else:
        for day in range(42):
            start = datetime.combine(config.cycle_start_date + timedelta(days=day), datetime.min.time(), tzinfo=zone)
            start += timedelta(hours=22 if source == "night" else 8)
            config.external_duty_assignments.append(ExternalDutyAssignment(
                id=f"FIXED-{day}", educator_id="REMOVED", duty_type="NIGHT" if source == "night" else "SCHOOL",
                start_date_time=start, end_date_time=start + timedelta(hours=8 if source == "night" else 12)))
    messages = _cross_group_messages(config, [])
    assert any(m.educator_id == "REMOVED" and m.rule_id == "REQ-CROSS-GROUP-REST-001"
        and m.context.get("relatedRuleId") == "REQ-REST-WEEKLY-001" for m in messages)
