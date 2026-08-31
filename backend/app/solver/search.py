"""Bounded search for a usable plan; quality never gates feasibility."""
from time import monotonic

from ortools.sat.python import cp_model

from app.models.schemas import GenerationStatus, ScheduleConfiguration


def first_feasible(model: cp_model.CpModel, configuration: ScheduleConfiguration):
    # Reserve a smaller second attempt for a different search strategy. The
    # attempts share one budget and exactly the same hard constraints.
    deadline = monotonic() + configuration.solver_time_limit_seconds
    solver = cp_model.CpSolver()
    status = cp_model.UNKNOWN
    for attempt in range(2):
        remaining = deadline - monotonic()
        if remaining <= 0:
            break
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = remaining * (0.75 if attempt == 0 else 1)
        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = configuration.random_seed
        solver.parameters.stop_after_first_solution = True
        if not attempt and any(d.duty_type == "SCHOOL" and d.locked for d in configuration.external_duty_assignments):
            solver.parameters.search_branching = cp_model.FIXED_SEARCH
        if attempt:
            solver.parameters.search_branching = cp_model.FIXED_SEARCH
            solver.parameters.cp_model_presolve = False
        status = solver.solve(model)
        if status != cp_model.UNKNOWN:
            break
    return solver, status


def generation_status(status: int) -> GenerationStatus:
    if status in (cp_model.FEASIBLE, cp_model.OPTIMAL):
        return GenerationStatus.CANDIDATE_FOUND
    if status == cp_model.INFEASIBLE:
        return GenerationStatus.NO_SOLUTION
    if status == cp_model.MODEL_INVALID:
        return GenerationStatus.INTERNAL_ERROR
    return GenerationStatus.TIME_LIMIT
