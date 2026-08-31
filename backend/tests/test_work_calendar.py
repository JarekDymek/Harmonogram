from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.domain.work_calendar import allowed_beside_night, care_target_minutes, duty_dates
from app.fixtures.demo import demo_configuration
from app.models.schemas import Educator, ExternalDutyAssignment, GroupEducatorMembership, WorkAssignment
from app.services.generation import generate_schedule
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import _cross_group_messages, validate_schedule
from app.validation.work_calendar import commitment_messages


def night(config, educator="B", day=1):
    start = datetime.combine(config.cycle_start_date + timedelta(days=day), datetime.min.time(), tzinfo=ZoneInfo(config.time_zone_id)) + timedelta(hours=22)
    return ExternalDutyAssignment(id="TEST-NIGHT", educator_id=educator, start_date_time=start, end_date_time=start + timedelta(hours=8), duty_type="NIGHT")


def four_people():
    config = demo_configuration()
    config.educator_count = 4
    config.educators.append(Educator(id="D", display_name="Wychowawca D", short_code="D"))
    config.group_memberships = [GroupEducatorMembership(id=f"M-{e}", group_id="G1", educator_id=e,
        role="SUPPORT" if e == "D" else "PRIMARY", weekly_target_hours_by_week=[h]) for e, h in {"A":22,"B":22,"C":16,"D":22}.items()]
    weekend = next(v for v in config.weekend_variants if v.position_in_cycle == 1)
    weekend.off_educator_id = "B"
    for template in [weekend.saturday_template, weekend.sunday_template]:
        for a in template.assignments:
            if a.educator_id == "B": a.educator_id = "D"
    config.solver_time_limit_seconds = 20
    return config


@pytest.mark.parametrize("day", range(7))
def test_night_protects_both_dates_on_every_weekday(day):
    config = demo_configuration()
    duty = night(config, day=day)
    config.external_duty_assignments = [duty]
    first, second = duty.start_date_time.date(), duty.end_date_time.date()
    assert duty_dates(config, duty) == {first, second}
    assert allowed_beside_night(config, "B", first, 1200, 1320)
    assert allowed_beside_night(config, "B", second, 360, 480)
    assert not allowed_beside_night(config, "B", first, 1140, 1260)
    assert not allowed_beside_night(config, "B", second, 420, 540)
    assert allowed_beside_night(config, "A", first, 360, 480)


def test_both_night_dates_make_six_days_not_five():
    config = demo_configuration()
    config.external_duty_assignments = [night(config)]
    assignments = [WorkAssignment(group_id="G1", educator_id="B", date=config.cycle_start_date + timedelta(days=d), start_minute=840, end_minute=960) for d in [0,3,4,5]]
    days = [m for m in _cross_group_messages(config, assignments) if m.rule_id == "REQ-DAYS-001"]
    assert len(days) == 1
    assert days[0].actual_value == 6


def test_night_budget_debits_only_its_group_once():
    config = four_people()
    member = next(m for m in config.group_memberships if m.educator_id == "B")
    member.weekly_target_hours_by_week = [30]
    member.hours_include_fixed_nights = True
    duty = night(config).model_copy(update={"regular_night":True,"counts_towards_hours":True,"budget_group_id":"G1","credited_minutes":480})
    config.external_duty_assignments = [duty]
    assert care_target_minutes(config, member, 1) == 22 * 60
    assert care_target_minutes(config, member.model_copy(update={"group_id":"G2"}), 1) == 30 * 60
    view = config.configuration_for_group("G1")
    assert next(e for e in view.educators if e.id == "B").base_weekly_assigned_minutes == 22 * 60


def test_required_duty_and_school_count_together_and_are_preserved():
    config = four_people()
    # This synthetic profile explicitly allows night + two hours of care.
    config.legal_rules.maximum_absolute_segment_minutes = 600
    config.external_duty_assignments = [night(config)]
    required = WorkAssignment(group_id="G1", educator_id="B", date=config.cycle_start_date + timedelta(days=2), start_minute=360, end_minute=480)
    config.required_assignments = [required]
    for day in [1, 2, 3]:
        start = datetime.combine(config.cycle_start_date + timedelta(days=day), datetime.min.time(), tzinfo=ZoneInfo(config.time_zone_id)) + timedelta(hours=8)
        config.external_duty_assignments.append(ExternalDutyAssignment(id=f"SCHOOL-{day}", educator_id="A", duty_type="SCHOOL", start_date_time=start, end_date_time=start + timedelta(hours=4)))
    before = config.model_dump()
    result = generate_schedule(config)
    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert config.model_dump() == before
    assert not commitment_messages(config, result.care, result.assignments)
    for educator in config.educators:
        dates = {a.date for a in result.assignments if a.educator_id == educator.id}
        for d in config.external_duty_assignments:
            if d.educator_id == educator.id: dates |= duty_dates(config, d)
        assert len(dates) <= 5
    removed = [a for a in result.assignments if not (a.educator_id == "B" and a.date == required.date and a.start_minute <= 360)]
    assert "REQ-REQUIRED-DUTY-001" in {m.rule_id for m in validate_schedule(config, removed).messages}


def test_required_outside_demand_is_actionable():
    config = four_people()
    config.required_assignments = [WorkAssignment(group_id="G1", educator_id="B", date=config.cycle_start_date, start_minute=600, end_minute=720)]
    report = validate_configuration(config)
    assert report.status == "INVALID_INPUT"
    assert any(m.rule_id == "REQ-REQUIRED-DUTY-001" and "plan pobytu" in m.message for m in report.messages)


def test_school_after_night_outside_window_is_rejected():
    config = four_people()
    duty = night(config)
    config.external_duty_assignments = [duty, ExternalDutyAssignment(id="SCHOOL", educator_id="B", duty_type="SCHOOL",
        start_date_time=duty.end_date_time + timedelta(hours=2), end_date_time=duty.end_date_time + timedelta(hours=6))]
    report = validate_configuration(config)
    assert report.status == "INVALID_INPUT"
    assert "REQ-NIGHT-WINDOW-001" in {m.rule_id for m in report.messages}


def test_six_fixed_dates_are_reported_before_search():
    config = four_people()
    for day in range(6):
        start = datetime.combine(config.cycle_start_date + timedelta(days=day), datetime.min.time(), tzinfo=ZoneInfo(config.time_zone_id)) + timedelta(hours=8)
        config.external_duty_assignments.append(ExternalDutyAssignment(id=f"S-{day}", educator_id="B", duty_type="SCHOOL", start_date_time=start, end_date_time=start + timedelta(hours=2)))
    assert "REQ-WORK-CALENDAR-001" in {m.rule_id for m in validate_configuration(config).messages}


def test_legacy_group_ids_do_not_bypass_mandatory_validation():
    config = four_people()
    for educator in config.educators: educator.group_id = "G1"
    config.required_assignments = [WorkAssignment(group_id="G1", educator_id="B", date=config.cycle_start_date, start_minute=360, end_minute=480)]
    assert "REQ-REQUIRED-DUTY-001" in {m.rule_id for m in validate_schedule(config, []).messages}
