from __future__ import annotations

from app.domain import rules
from app.models.schemas import (
    ConflictReport,
    GenerateResponse,
    GenerationStatus,
    InputStatus,
    PublicResult,
    ScheduleConfiguration,
    ValidationStatus,
)
from app.services.objective import calculate_objective
from app.services.reports import error, info
from app.solver.schedule_solver import solve_schedule
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import validate_schedule
from app.services.weekend import expected_weekend_position


def generate_schedule(
    configuration: ScheduleConfiguration,
) -> GenerateResponse:
    next_weekend_variant = expected_weekend_position(
        configuration.starting_weekend_variant,
        configuration.planning_horizon_weeks + 1,
    )
    input_report = validate_configuration(configuration)
    if input_report.status != InputStatus.VALID_INPUT:
        return GenerateResponse(
            generation_status=GenerationStatus.NOT_STARTED,
            public_result=PublicResult.DANE_NIEPOPRAWNE,
            care=input_report.care,
            messages=input_report.messages,
            next_weekend_variant=next_weekend_variant,
        )

    solver_result = solve_schedule(configuration, input_report.care)
    if solver_result.status == GenerationStatus.NO_SOLUTION:
        conflict_ids = [
            rules.RULE_HOURS,
            rules.RULE_DAYS,
            rules.RULE_HARD_UNAVAILABLE,
            rules.RULE_REST_DAILY,
            rules.RULE_REST_WEEKLY,
            rules.RULE_WEEKEND,
        ]
        return GenerateResponse(
            generation_status=GenerationStatus.NO_SOLUTION,
            public_result=PublicResult.BRAK_ROZWIAZANIA,
            care=input_report.care,
            conflict_report=ConflictReport(
                summary=(
                    "Solver udowodnił, że pełny zbiór ograniczeń jest sprzeczny. "
                    "Raport wskazuje grupy reguł obecne w modelu; nie twierdzi, "
                    "że wyznacza minimalny rdzeń konfliktu."
                ),
                conflict_analysis_quality="APPROXIMATE",
                conflicting_rule_ids=conflict_ids,
                educator_ids=[item.id for item in configuration.educators],
                dates=[item.date for item in input_report.care],
                input_fields_to_review=[
                    "assignmentOverrides",
                    "unavailability",
                    "legalRules",
                    "weekendVariants",
                    "dayPlans",
                ],
            ),
            messages=[
                error(
                    rules.RULE_NO_GUESSING,
                    "Nie istnieje harmonogram spełniający wszystkie twarde reguły; aplikacja nie publikuje przybliżenia.",
                    context={"solverStatus": solver_result.solver_status_name},
                )
            ],
            next_weekend_variant=next_weekend_variant,
        )
    if solver_result.status == GenerationStatus.TIME_LIMIT:
        return GenerateResponse(
            generation_status=GenerationStatus.TIME_LIMIT,
            public_result=PublicResult.NIE_ZAKONCZONO_WYSZUKIWANIA,
            care=input_report.care,
            messages=[
                info(
                    rules.RULE_NO_GUESSING,
                    "Nie udowodniono optymalności w limicie czasu; żaden wynik nie został opublikowany.",
                    context={"solverStatus": solver_result.solver_status_name},
                )
            ],
            next_weekend_variant=next_weekend_variant,
        )

    validation = validate_schedule(
        configuration,
        solver_result.assignments,
        input_report.care,
    )
    if validation.status != ValidationStatus.VALID:
        return GenerateResponse(
            generation_status=GenerationStatus.INTERNAL_ERROR,
            public_result=PublicResult.BLAD_WEWNETRZNY,
            assignments=solver_result.assignments,
            care=input_report.care,
            validation_report=validation,
            messages=validation.messages,
            next_weekend_variant=next_weekend_variant,
        )
    objective = calculate_objective(
        configuration,
        input_report.care,
        solver_result.assignments,
    )
    return GenerateResponse(
        generation_status=GenerationStatus.CANDIDATE_FOUND,
        public_result=validation.public_result,
        assignments=solver_result.assignments,
        care=input_report.care,
        objective=objective,
        validation_report=validation,
        messages=[*input_report.messages, *validation.messages],
        next_weekend_variant=next_weekend_variant,
    )
