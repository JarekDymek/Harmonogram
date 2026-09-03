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


def test_regular_wednesday_night_is_inside_28_5_hour_total_each_week():
    config = demo_configuration()
    config.planning_horizon_weeks = 6
    member = config.group_memberships[0]
    member.weekly_target_hours_by_week = [28.5] * 6
    member.hours_include_fixed_nights = True
    config.external_duty_assignments = [night(config, member.educator_id, 2 + week * 7).model_copy(update={
        "id": f"WED-{week}", "regular_night": True, "locked": True, "counts_towards_hours": True,
        "budget_group_id": member.group_id, "credited_minutes": 480,
    }) for week in range(6)]
    assert [care_target_minutes(config, member, week) for week in range(1, 7)] == [1230] * 6
    assert member.weekly_target_hours_by_week == [28.5] * 6


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


def fixed_support_plan():
    config = demo_configuration()
    config.educator_count = 4
    config.educators.append(Educator(id="D", display_name="Wychowawca pomocniczy", short_code="D"))
    hours = {"A": 23.5, "B": 23.5, "C": 23, "D": 12}
    config.group_memberships = [
        GroupEducatorMembership(
            id=f"M-{educator_id}",
            group_id="G1",
            educator_id=educator_id,
            role="SUPPORT" if educator_id == "D" else "PRIMARY",
            weekly_target_hours_by_week=[hours[educator_id]],
            fixed_partial_schedule=educator_id == "D",
        )
        for educator_id in hours
    ]
    config.required_assignments = [
        WorkAssignment(
            group_id="G1",
            educator_id="D",
            date=config.cycle_start_date + timedelta(days=day),
            start_minute=840,
            end_minute=1200,
        )
        for day in (1, 3)
    ]
    config.solver_time_limit_seconds = 30
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


@pytest.mark.parametrize("weeks", [1, 6])
def test_fixed_support_plan_keeps_manual_hours_and_does_not_require_five_local_days(weeks):
    config = fixed_support_plan()
    config.planning_horizon_weeks = weeks
    duties = list(config.required_assignments)
    config.required_assignments = [
        duty.model_copy(update={"date": duty.date + timedelta(weeks=week)})
        for week in range(weeks) for duty in duties
    ]
    before = config.model_dump()

    result = generate_schedule(config)

    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert result.validation_report.validator_version == "3.1.0"
    assert config.model_dump() == before
    for week in range(weeks):
        assignments = [item for item in result.assignments
                       if (item.date - config.cycle_start_date).days // 7 == week]
        helper = [item for item in assignments if item.educator_id == "D"]
        assert sum(item.end_minute - item.start_minute for item in helper) == 12 * 60
        assert {item.date.weekday() for item in helper} == {1, 3}
        assert all(item.start_minute == 840 and item.end_minute == 1200 for item in helper)
        for educator_id in ("A", "B", "C"):
            assert len({item.date for item in assignments if item.educator_id == educator_id}) == 5


def test_external_occupancy_handles_both_folds_and_empty_dst_slots():
    from app.solver.internat_solver import _fixed_occupancy
    config = fixed_support_plan()
    target = datetime(2026, 10, 25).date()
    assert not _fixed_occupancy(config, "D", target, 4)
    config.external_duty_assignments = [ExternalDutyAssignment(
        id="DST", educator_id="D", duty_type="OTHER",
        start_date_time=datetime.fromisoformat("2026-10-25T02:45:00+02:00"),
        end_date_time=datetime.fromisoformat("2026-10-25T02:15:00+01:00"),
    )]
    assert _fixed_occupancy(config, "D", target, 4)
    assert _fixed_occupancy(config, "D", target, 5)
    assert not _fixed_occupancy(config, "D", target, 6)


def test_internal_grid_rest_uses_shorter_dst_interpretation():
    from app.solver.internat_solver import _grid_rest_minutes
    assert _grid_rest_minutes(datetime(2026, 10, 24).date(), 22 * 60,
                              datetime(2026, 10, 25).date(), 150, "Europe/Warsaw") == 270


def test_fixed_support_plan_requires_all_hours_to_be_entered_manually():
    config = fixed_support_plan()
    config.required_assignments.pop()

    report = validate_configuration(config)

    message = next(
        item
        for item in report.messages
        if item.context.get("conflictType") == "FIXED_PARTIAL_SCHEDULE_HOURS"
    )
    assert report.status == "INVALID_INPUT"
    assert message.educator_id == "D"
    assert message.required_value == 12 * 60
    assert message.actual_value == 6 * 60
    assert "obowiązkowe dyżury" in message.message


def test_fixed_support_weekend_takes_priority_without_changing_saved_rotation():
    config = fixed_support_plan()
    config.required_assignments[1].end_minute = 1080
    config.required_assignments.append(WorkAssignment(
        group_id="G1", educator_id="D", date=config.cycle_start_date + timedelta(days=5),
        start_minute=1200, end_minute=1320,
    ))
    before = config.model_dump()
    result = generate_schedule(config)
    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert config.model_dump() == before
    saturday = [a for a in result.assignments if a.date.weekday() == 5]
    assert [(a.educator_id, a.start_minute, a.end_minute) for a in saturday] == [
        ("A", 360, 840), ("B", 840, 1200), ("D", 1200, 1320)]
    assert sum(a.end_minute - a.start_minute for a in result.assignments if a.educator_id == "D") == 720
    assert validate_schedule(config, result.assignments).status == "VALID"


def test_priority_applies_to_primary_required_duty_and_substitute_too():
    from app.models.schemas import WeekendVariantKind
    from app.services.weekend import selected_weekend_variant, template_tuples
    config = fixed_support_plan()
    saturday = config.cycle_start_date + timedelta(days=5)
    source = config.weekend_variants[0]
    substitute = source.model_copy(deep=True, update={
        "id": "SUB", "variant_kind": WeekendVariantKind.SUBSTITUTE, "position_in_cycle": None,
        "replaces_weekend_rotation_variant_id": source.id, "applicable_week_number": 1,
        "applicable_saturday_date": saturday, "applicable_sunday_date": saturday + timedelta(days=1),
    })
    config.weekend_variants.append(substitute)
    config.required_assignments = [WorkAssignment(group_id="G1", educator_id="C", date=saturday,
                                                  start_minute=1200, end_minute=1320)]
    before = config.model_dump()
    resolved = selected_weekend_variant(config, week_number=1, saturday=saturday, sunday=saturday + timedelta(days=1))
    assert resolved.id == "SUB"
    assert template_tuples(resolved.saturday_template)[-1] == (3, "C", 1200, 1320)
    assert resolved.sunday_template == source.sunday_template
    assert config.model_dump() == before


def test_priority_never_resolves_two_conflicting_required_duties_silently():
    config = fixed_support_plan()
    config.required_assignments.append(config.required_assignments[0].model_copy(update={"educator_id": "A"}))
    report = validate_configuration(config)
    assert report.status == "INVALID_INPUT"
    assert any("Dwa obowiązkowe dyżury" in m.message for m in report.messages)
