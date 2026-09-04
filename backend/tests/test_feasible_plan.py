from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from ortools.sat.python import cp_model

from app.fixtures.demo import demo_configuration
from app.models.schemas import Educator, ExternalDutyAssignment, GroupEducatorMembership
from app.services import generation
from app.services.care_calculator import calculate_care
from app.solver.schedule_solver import solve_schedule, SolverResult
from app.solver.internat_solver import solve_internat_schedule
from app.solver.search import generation_status
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import validate_schedule


def three_week_night_configuration():
    """Synthetic data only: four people, three weeks, recurring 22:00–06:00 duties."""
    config = demo_configuration()
    config.planning_horizon_weeks = 3
    config.educator_count = 4
    config.solver_time_limit_seconds = 60
    config.educators.append(Educator(id="D", display_name="Test D", short_code="D"))
    targets = {"A": 22, "B": 22, "C": 16, "D": 22}
    config.group_memberships = [
        GroupEducatorMembership(id=f"MEM-G1-{key}", group_id="G1", educator_id=key,
                                weekly_target_hours_by_week=[hours])
        for key, hours in targets.items()
    ]
    first = config.weekend_variants[0]
    first.off_educator_id = "B"
    for template in (first.saturday_template, first.sunday_template):
        for assignment in template.assignments:
            if assignment.educator_id == "B":
                assignment.educator_id = "D"
    config.weekend_variants = [
        first.model_copy(deep=True, update={"id": f"WEEKEND-{index}", "position_in_cycle": index})
        for index in range(1, 7)
    ]
    for week in range(3):
        for educator_id, day in (("B", 5), ("C", 1)):
            start = datetime.combine(config.cycle_start_date + timedelta(days=week * 7 + day),
                                     datetime.min.time(), tzinfo=ZoneInfo(config.time_zone_id)) + timedelta(hours=22)
            config.external_duty_assignments.append(ExternalDutyAssignment(
                id=f"TEST-NIGHT-{educator_id}-{week}", educator_id=educator_id,
                start_date_time=start, end_date_time=start + timedelta(hours=8), duty_type="NIGHT",
            ))
    return config


def test_three_weeks_four_people_with_tuesday_and_saturday_nights():
    config = three_week_night_configuration()
    original = config.model_dump()
    report = validate_configuration(config)
    assert report.status == "VALID_INPUT", report.messages
    result = generation.generate_schedule(config)
    assert result.generation_status == "CANDIDATE_FOUND", result.messages
    assert result.validation_report.status == "VALID"
    assert validate_schedule(config, result.assignments).status == "VALID"
    assert not result.optimization_proven
    assert config.model_dump() == original
    for week in range(3):
        for membership in config.group_memberships:
            minutes = sum(a.end_minute - a.start_minute for a in result.assignments
                          if a.educator_id == membership.educator_id
                          and week * 7 <= (a.date - config.cycle_start_date).days < (week + 1) * 7)
            assert minutes == membership.weekly_target_hours_by_week[0] * 60


@pytest.mark.parametrize("solve", [solve_schedule, solve_internat_schedule])
def test_default_generation_does_not_build_quality_model(solve, monkeypatch):
    config = demo_configuration()
    original_solve = cp_model.CpSolver.solve
    calls = []

    def check_model(self, model, *args, **kwargs):
        proto = model.proto
        if not calls:
            assert not proto.has_objective()
        assert not any("handover" in v.name or "short_middle" in v.name for v in proto.variables)
        calls.append(True)
        return original_solve(self, model, *args, **kwargs)

    monkeypatch.setattr(cp_model.CpSolver, "solve", check_model)
    result = solve(config, calculate_care(config))
    assert result.status == "CANDIDATE_FOUND"
    assert not result.optimization_proven
    assert 1 <= len(calls) <= (2 if solve is solve_internat_schedule else 1)
    assert validate_schedule(config, result.assignments).status == "VALID"


@pytest.mark.parametrize("solve", [solve_schedule, solve_internat_schedule])
def test_optimization_timeout_keeps_valid_first_plan(solve, monkeypatch):
    config = demo_configuration()
    original_solve = cp_model.CpSolver.solve
    calls = []

    def timeout_only_optimization(self, model, *args, **kwargs):
        calls.append(True)
        if len(calls) > 1:
            return cp_model.UNKNOWN
        return original_solve(self, model, *args, **kwargs)

    monkeypatch.setattr(cp_model.CpSolver, "solve", timeout_only_optimization)
    result = solve(config, calculate_care(config), optimize=True)
    assert len(calls) >= 2
    assert result.status == "CANDIDATE_FOUND"
    assert not result.optimization_proven
    assert validate_schedule(config, result.assignments).status == "VALID"


def test_model_invalid_is_not_reported_as_timeout():
    assert generation_status(cp_model.MODEL_INVALID) == "INTERNAL_ERROR"
    assert generation_status(cp_model.UNKNOWN) == "TIME_LIMIT"


def test_candidate_rejected_by_independent_validator_is_not_published(monkeypatch):
    config = demo_configuration()
    monkeypatch.setattr(generation, "_solve_once", lambda *args, **kwargs: SolverResult(
        status="CANDIDATE_FOUND", assignments=[], solver_status_name="FEASIBLE", optimization_proven=False,
    ))
    result = generation.generate_schedule(config)
    assert result.public_result == "BLAD_WEWNETRZNY"
    assert result.validation_report.status == "INVALID"
    assert result.assignments == []
