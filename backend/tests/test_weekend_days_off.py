from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.fixtures.demo import demo_configuration
from app.models.schemas import (
    EducatorUnavailability,
    ExternalDutyAssignment,
    UnavailabilityScope,
    UnavailabilityType,
    WeekendDaysOffPattern,
    WorkAssignment,
)
from app.services.care_calculator import calculate_care
from app.services.generation import generate_schedule
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import _cross_group_messages, validate_schedule
from app.validation.weekend_days_off import RULE, weekend_days_off_messages


def pattern(educator="A", days=(0, 1), active=True):
    return WeekendDaysOffPattern(id=f"OFF-{educator}", educator_id=educator, days_off=list(days), active=active)


def assignment(config, educator, day, group="G1"):
    return WorkAssignment(group_id=group, educator_id=educator,
                          date=config.cycle_start_date + timedelta(days=day), start_minute=840, end_minute=960)


@pytest.mark.parametrize("days", [[], [0], [0, 0], [0, 7], [-1, 3], [0, 1, 2]])
def test_invalid_pattern_is_actionable_not_schema_error(days):
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern(days=days)]
    report = validate_configuration(config)
    assert report.status == "INVALID_INPUT"
    assert any(m.rule_id == RULE and m.context["patternId"] == "OFF-A" for m in report.messages)


def test_duplicate_and_unknown_person_are_rejected():
    config = demo_configuration()
    for patterns in ([pattern(), pattern()], [pattern("MISSING")]):
        config.weekend_days_off_patterns = patterns
        assert weekend_days_off_messages(config)


@pytest.mark.parametrize("source", ["SCHOOL", "NIGHT", "REQUIRED", "LOCKED"])
def test_fixed_work_on_free_day_has_date_person_and_pattern(source):
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern()]
    if source in ("SCHOOL", "NIGHT"):
        start = datetime.combine(config.cycle_start_date, datetime.min.time(), tzinfo=ZoneInfo(config.time_zone_id))
        start += timedelta(hours=22 if source == "NIGHT" else 8)
        config.external_duty_assignments = [ExternalDutyAssignment(id="FIXED", educator_id="A", duty_type=source,
            start_date_time=start, end_date_time=start + timedelta(hours=8))]
    elif source == "REQUIRED":
        config.required_assignments = [assignment(config, "A", 0)]
    else:
        config.locked_assignments = [assignment(config, "A", 0, "OTHER")]
    errors = weekend_days_off_messages(config)
    assert errors and all(m.educator_id == "A" and m.context["patternId"] == "OFF-A" for m in errors)
    assert errors[0].date == config.cycle_start_date
    if source == "NIGHT":
        assert len(errors) == 2  # Monday start and Tuesday end are both work.


def test_night_alone_triggers_working_weekend():
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern("C", (0, 6))]  # C has no day care on this weekend.
    start = datetime.combine(config.cycle_start_date + timedelta(days=5), datetime.min.time(), tzinfo=ZoneInfo(config.time_zone_id)) + timedelta(hours=22)
    config.external_duty_assignments = [ExternalDutyAssignment(id="N", educator_id="C", duty_type="NIGHT",
        start_date_time=start, end_date_time=start + timedelta(hours=8))]
    errors = weekend_days_off_messages(config)
    assert len(errors) == 1 and errors[0].date.weekday() == 6
    assert errors[0].context["workSources"] == ["nocka"]


def test_nonworking_weekend_and_disabled_pattern_do_not_block_weekdays():
    config = demo_configuration()
    config.required_assignments = [assignment(config, "C", 0)]
    config.weekend_days_off_patterns = [pattern("C"), pattern("A", active=False)]
    assert not weekend_days_off_messages(config)


def test_impossible_hours_capacity_names_person_week_shortage_and_available_days():
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern("A", (0, 1))]
    config.unavailability.extend(
        EducatorUnavailability(
            id=f"BLOCK-A-{day}", educator_id="A",
            scope=UnavailabilityScope.RECURRING_WEEKLY,
            day_of_week=day, start_time="06:00", end_time="22:00",
            type=UnavailabilityType.HARD,
        )
        for day in (2, 3, 4)
    )
    errors = weekend_days_off_messages(config, care=calculate_care(config))
    capacity = next(m for m in errors if m.context.get("conflictType") == "WEEKEND_OFF_CAPACITY")
    assert capacity.educator_id == "A"
    assert capacity.context["weekNumber"] == 1
    assert capacity.required_value > capacity.actual_value
    assert "Brakuje" in capacity.message and "Dostępne:" in capacity.message


def test_hours_already_covered_by_required_duties_are_not_counted_twice():
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern("A", (0, 1))]
    care = calculate_care(config)
    assert not weekend_days_off_messages(config, care=care)
    config.required_assignments = [
        WorkAssignment(group_id=day.group_id, educator_id="B", date=day.date,
                       start_minute=interval.start_minute, end_minute=interval.end_minute)
        for day in care if day.date.weekday() in (2, 3)
        for interval in day.intervals
    ]
    messages = weekend_days_off_messages(config, care=care)
    shortage = next(m for m in messages if m.context.get("conflictType") == "WEEKEND_OFF_CAPACITY")
    assert shortage.actual_value < shortage.required_value
    assert "obowiązkowych dyżurów innych osób" in shortage.message


def preferred(educator="A"):
    return WeekendDaysOffPattern(id=f"PREF-{educator}", educator_id=educator,
                                 mode="PREFER_CONSECUTIVE")


def separated_days_configuration():
    config = demo_configuration()
    config.weekend_days_off_patterns = [preferred()]
    # Tuesday, Thursday, Saturday and Sunday are work. None of the remaining
    # Monday/Wednesday/Friday pairs is consecutive, regardless of the solver.
    config.required_assignments = [assignment(config, "A", day) for day in (1, 3)]
    config.solver_time_limit_seconds = 15
    return config


def test_preference_needs_no_selected_days_and_finds_a_pair_when_feasible():
    config = demo_configuration()
    config.weekend_days_off_patterns = [preferred()]
    config.solver_time_limit_seconds = 15
    assert validate_configuration(config).status == "VALID_INPUT"
    result = generate_schedule(config)
    assert result.validation_report.status == "VALID", result.messages
    assert not any(m.rule_id == "PREF-CONSECUTIVE-DAYS-OFF" for m in result.messages)
    assert result.objective.consecutive_days_off_penalty == 0


def test_impossible_preference_returns_valid_plan_and_specific_warning():
    config = separated_days_configuration()
    before = config.model_dump()
    result = generate_schedule(config)
    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert config.model_dump() == before
    message = next(m for m in result.messages if m.rule_id == "PREF-CONSECUTIVE-DAYS-OFF")
    assert message.severity == "WARNING" and message.educator_id == "A"
    assert message.context["weekNumber"] == 1 and message.context["patternId"] == "PREF-A"
    assert len(message.context["freeDays"]) == 2
    assert result.objective.consecutive_days_off_penalty == 1


def test_preference_timeout_does_not_discard_valid_baseline(monkeypatch):
    from ortools.sat.python import cp_model
    original_solve = cp_model.CpSolver.solve
    attempted = []

    def time_limited(self, model, *args, **kwargs):
        if model.has_objective():
            attempted.append(True)
            return cp_model.UNKNOWN
        return original_solve(self, model, *args, **kwargs)

    monkeypatch.setattr(cp_model.CpSolver, "solve", time_limited)
    result = generate_schedule(separated_days_configuration())
    assert attempted
    assert result.generation_status == "CANDIDATE_FOUND"
    assert result.validation_report.status == "VALID"
    assert any(m.rule_id == "PREF-CONSECUTIVE-DAYS-OFF" for m in result.messages)


def test_solver_conflict_set_identifies_fixed_patterns_and_weeks():
    from app.solver.internat_solver import solve_internat_schedule
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern("A", (0, 1)), pattern("B", (0, 1))]
    config.solver_time_limit_seconds = 15
    result = solve_internat_schedule(config, calculate_care(config))
    assert result.status == "NO_SOLUTION"
    assert result.conflict_messages
    assert {m.context["patternId"] for m in result.conflict_messages} <= {"OFF-A", "OFF-B"}
    assert all(m.context["weekNumber"] == 1 and m.educator_id for m in result.conflict_messages)


def test_preference_counts_both_dates_of_a_night_and_is_only_conditional_on_weekend():
    config = demo_configuration()
    config.weekend_days_off_patterns = [preferred("C")]
    assert not weekend_days_off_messages(config, [assignment(config, "C", 0)])
    start = datetime.combine(config.cycle_start_date + timedelta(days=1), datetime.min.time(),
                             tzinfo=ZoneInfo(config.time_zone_id)) + timedelta(hours=22)
    config.external_duty_assignments = [ExternalDutyAssignment(id="N", educator_id="C", duty_type="NIGHT",
        start_date_time=start, end_date_time=start + timedelta(hours=8))]
    messages = weekend_days_off_messages(config, [assignment(config, "C", d) for d in (0, 5, 6)])
    assert not messages  # Thu/Fri are free; Tue/Wed are work.
    messages = weekend_days_off_messages(config, [assignment(config, "C", d) for d in (3, 5, 6)])
    assert messages[0].context["freeDays"] == [0, 4]


def test_selected_substitute_not_unused_base_triggers_pattern():
    config = demo_configuration()
    base = next(v for v in config.weekend_variants if v.position_in_cycle == 1)
    substitute = base.model_copy(deep=True, update={"id":"SUB", "variant_kind":"SUBSTITUTE",
        "position_in_cycle":None, "replaces_weekend_rotation_variant_id":base.id, "applicable_week_number":1,
        "applicable_saturday_date": config.cycle_start_date + timedelta(days=5),
        "applicable_sunday_date": config.cycle_start_date + timedelta(days=6)})
    for template in (substitute.saturday_template, substitute.sunday_template):
        for a in template.assignments:
            if a.educator_id == "A": a.educator_id = "C"
    config.weekend_variants.append(substitute)
    config.required_assignments = [assignment(config, "C", 0)]
    config.weekend_days_off_patterns = [pattern("C")]
    assert weekend_days_off_messages(config)


def test_validator_uses_actual_work_in_any_group_not_weekend_template():
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern("C")]
    actual = [assignment(config, "C", d, "OTHER") for d in (0, 5)]
    errors = weekend_days_off_messages(config, actual)
    assert errors and errors[0].educator_id == "C"
    assert RULE in {m.rule_id for m in validate_schedule(config, actual).messages}


@pytest.mark.parametrize("count", [4, 6, 7])
def test_final_check_rejects_any_count_other_than_five(count):
    config = demo_configuration()
    actual = [assignment(config, "A", day) for day in range(count)]
    errors = [m for m in _cross_group_messages(config, actual, complete=True)
              if m.rule_id == "REQ-DAYS-001" and m.educator_id == "A"]
    assert len(errors) == 1 and errors[0].actual_value == count


def test_generator_enforces_five_days_and_two_saved_days_off():
    config = demo_configuration()
    config.weekend_days_off_patterns = [pattern("A", (0, 1)), pattern("B", (3, 4)), pattern("C", (0, 4))]
    config.solver_time_limit_seconds = 30
    before = config.model_dump()
    result = generate_schedule(config)
    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert result.validation_report.validator_version == "3.1.0"
    assert config.model_dump() == before
    for educator in ("A", "B", "C"):
        days = {a.date.weekday() for a in result.assignments if a.educator_id == educator}
        assert len(days) == 5
        if educator == "A": assert days == {2, 3, 4, 5, 6}
        if educator == "B": assert days == {0, 1, 2, 5, 6}
        if educator == "C": assert days == {0, 1, 2, 3, 4}
    tampered = [*result.assignments, assignment(config, "A", 0)]
    assert RULE in {m.rule_id for m in validate_schedule(config, tampered).messages}
