from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.fixtures.demo import demo_configuration
from app.models.schemas import GroupConfiguration, WeekendDaysOffPattern, ExternalDutyAssignment, WorkAssignment, ScheduleConfiguration
from app.services.scope import selected_configuration
from app.services.generation import generate_schedule
from app.validation.input_validation import validate_configuration


def incomplete_project():
    c = demo_configuration()
    c.groups += [GroupConfiguration(id=f"G{i}", display_order=i, code=str(i), name=f"Draft {i}") for i in range(2,9)]
    c.group_count = 8
    c.selected_group_ids = ["G1"]
    c.active_group_id = "G7"
    c.weekend_days_off_patterns.append(WeekendDaysOffPattern(id="DRAFT", educator_id="NOT_READY", days_off=[]))
    return c


def test_suspended_incomplete_groups_do_not_block_generation():
    c = incomplete_project()
    before = c.model_dump()
    report = validate_configuration(c)
    assert report.status == "VALID_INPUT", report.messages
    result = generate_schedule(c)
    assert result.validation_report.status == "VALID", result.messages
    assert {a.group_id for a in result.assignments} == {"G1"}
    assert {d.group_id for d in result.care} == {"G1"}
    assert c.model_dump() == before


def test_joined_incomplete_group_is_checked_not_silently_ignored():
    c = incomplete_project()
    c.selected_group_ids = ["G1", "G7"]
    report = validate_configuration(c)
    assert report.status == "INVALID_INPUT"
    assert any(m.group_id == "G7" for m in report.messages)


def test_explicit_empty_scope_never_becomes_all_groups():
    data = demo_configuration().model_dump(by_alias=True, mode="json")
    data["selectedGroupIds"] = []
    c = ScheduleConfiguration.model_validate(data)
    assert c.selected_group_ids == []
    assert validate_configuration(c).status == "INVALID_INPUT"
    result = generate_schedule(c)
    assert result.generation_status == "NOT_STARTED" and not result.assignments


def test_missing_weekend_templates_returns_actionable_report_not_server_error():
    c = demo_configuration()
    c.weekend_variants = []
    report = validate_configuration(c)
    assert report.status == "INVALID_INPUT"
    assert any("utwórz brakujące wzorce" in m.message and m.actual_value == "brak" for m in report.messages)


def test_shared_fixed_commitments_remain_but_other_people_are_suspended():
    c = incomplete_project()
    start = datetime.combine(c.cycle_start_date, datetime.min.time(), tzinfo=ZoneInfo(c.time_zone_id))
    c.external_duty_assignments = [
        ExternalDutyAssignment(id="SHARED", educator_id="A", duty_type="NIGHT", start_date_time=start+timedelta(hours=22),
                               end_date_time=start+timedelta(hours=30), budget_group_id="G7", counts_towards_hours=True),
        ExternalDutyAssignment(id="UNRELATED", educator_id="NOT_READY", start_date_time=start, end_date_time=start+timedelta(hours=8)),
    ]
    c.required_assignments = [WorkAssignment(group_id="G7", educator_id="A", date=c.cycle_start_date, start_minute=1080, end_minute=1200)]
    scoped = selected_configuration(c)
    assert [d.id for d in scoped.external_duty_assignments] == ["SHARED"]
    assert not scoped.external_duty_assignments[0].counts_towards_hours
    assert scoped.locked_assignments[0].group_id == "EXTERNAL"
    assert not scoped.required_assignments
    assert selected_configuration(scoped).model_dump() == scoped.model_dump()
    assert c.required_assignments[0].group_id == "G7"
