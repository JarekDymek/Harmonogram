from __future__ import annotations

import re
from collections import defaultdict

from app.domain import rules
from app.models.schemas import (
    ConflictReport,
    DomainMessage,
    GenerateResponse,
    GenerationStatus,
    InputStatus,
    PublicResult,
    ScheduleConfiguration,
    ValidationStatus,
)
from app.services.objective import calculate_objective
from app.services.quality import build_quality_report
from app.services.reports import error, info
from app.services.time_utils import zone
from app.solver.internat_solver import solve_internat_schedule
from app.solver.schedule_solver import solve_schedule
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import validate_schedule
from app.services.weekend import expected_weekend_position


def _solve_once(configuration: ScheduleConfiguration, care, *, optimize: bool = False):
    use_internat_solver = (
        len(configuration.active_groups()) > 1
        or bool(configuration.external_duty_assignments)
        or bool(configuration.locked_assignments)
        or bool(configuration.required_assignments)
        or bool(configuration.weekend_days_off_patterns)
    )
    if use_internat_solver:
        return solve_internat_schedule(configuration, care, optimize=optimize)
    group = configuration.active_groups()[0]
    group_configuration = configuration.configuration_for_group(group.id)
    return solve_schedule(
        group_configuration,
        [item for item in care if item.group_id == group.id],
        optimize=optimize,
    )


def _recurring_duty_key(duty_id: str) -> str:
    match = re.match(r"^(RECURRING-NIGHT-.*)-\d{4}-\d{2}-\d{2}$", duty_id)
    return match.group(1) if match else duty_id


def _diagnose_no_solution(
    configuration: ScheduleConfiguration,
    care,
) -> list[DomainMessage]:
    """Wskazuje konkretny wpis, którego usunięcie odblokowuje solver.

    Próby są wykonywane wyłącznie na głębokich kopiach w pamięci. Konfiguracja
    użytkownika nie jest zmieniana, a żaden harmonogram z poluzowaną regułą nie
    jest publikowany.
    """
    educator_by_id = {item.id: item for item in configuration.educators}

    def attempt(candidate: ScheduleConfiguration) -> bool:
        candidate.solver_time_limit_seconds = min(
            3.0,
            configuration.solver_time_limit_seconds,
        )
        return _solve_once(candidate, care).status == GenerationStatus.CANDIDATE_FOUND

    for pattern in configuration.weekend_days_off_patterns:
        if not pattern.active:
            continue
        candidate = configuration.model_copy(deep=True)
        candidate.weekend_days_off_patterns = [p for p in candidate.weekend_days_off_patterns if p.id != pattern.id]
        if attempt(candidate):
            educator = educator_by_id.get(pattern.educator_id)
            name = educator.display_name if educator else pattern.educator_id
            return [error("REQ-WEEKEND-DAYS-OFF-001",
                          f"{name}: plan spełniający pięć dni pracy staje się możliwy po zmianie wzorca wolnego za weekend. "
                          "W kroku Weekendy wybierz inną parę dni albo zmień obsadę weekendu. Zapisane dane nie zostały zmienione.",
                          educator_id=pattern.educator_id, context={"patternId": pattern.id})]

    locked_duties = [
        item for item in configuration.external_duty_assignments if item.locked
    ]
    if locked_duties:
        without_all = configuration.model_copy(deep=True)
        without_all.external_duty_assignments = [
            item
            for item in without_all.external_duty_assignments
            if not item.locked
        ]
        if attempt(without_all):
            grouped: dict[str, list] = defaultdict(list)
            for duty in locked_duties:
                grouped[_recurring_duty_key(duty.id)].append(duty)
            for duty_group in grouped.values():
                removed_ids = {item.id for item in duty_group}
                candidate = configuration.model_copy(deep=True)
                candidate.external_duty_assignments = [
                    item
                    for item in candidate.external_duty_assignments
                    if item.id not in removed_ids
                ]
                if not attempt(candidate):
                    continue
                project_zone = zone(configuration.time_zone_id)
                first = min(item.start_date_time for item in duty_group).astimezone(
                    project_zone
                )
                last = max(item.end_date_time for item in duty_group).astimezone(
                    project_zone
                )
                educator_id = duty_group[0].educator_id
                educator = educator_by_id.get(educator_id)
                name = educator.display_name if educator else educator_id
                return [
                    error(
                        rules.RULE_CROSS_GROUP_REST,
                        (
                            f"Plan staje się możliwy po wyłączeniu nocki: "
                            f"{name}, {first:%Y-%m-%d %H:%M}–"
                            f"{last:%Y-%m-%d %H:%M}. Ta konkretna nocka "
                            "koliduje z innym dyżurem, weekendem, dostępnością "
                            "albo wymaganym odpoczynkiem. Sprawdź ją jako "
                            "pierwszą; aplikacja nie zmieniła zapisanych danych."
                        ),
                        educator_id=educator_id,
                        date_value=first.date(),
                        context={
                            "conflictType": "FIXED_DUTY_TRIGGER",
                            "dutyIds": sorted(removed_ids),
                        },
                    )
                ]
            names = sorted(
                {
                    educator_by_id.get(item.educator_id).display_name
                    if educator_by_id.get(item.educator_id)
                    else item.educator_id
                    for item in locked_duties
                }
            )
            return [
                error(
                    rules.RULE_CROSS_GROUP_REST,
                    (
                        "Plan staje się możliwy po wyłączeniu zablokowanych "
                        f"dyżurów osób: {', '.join(names)}. Co najmniej dwie "
                        "nocki lub inne stałe dyżury kolidują ze sobą albo z "
                        "weekendem. Sprawdź tylko te osoby; godziny tygodniowe "
                        "nie są przyczyną."
                    ),
                    context={"conflictType": "FIXED_DUTIES_TRIGGER"},
                )
            ]

    hard_items = [
        item for item in configuration.unavailability if item.type == "HARD"
    ]
    if hard_items:
        candidate = configuration.model_copy(deep=True)
        candidate.unavailability = [
            item for item in candidate.unavailability if item.type != "HARD"
        ]
        if attempt(candidate):
            for blocked in hard_items:
                without_one = configuration.model_copy(deep=True)
                without_one.unavailability = [
                    item
                    for item in without_one.unavailability
                    if item.id != blocked.id
                ]
                if not attempt(without_one):
                    continue
                educator = educator_by_id.get(blocked.educator_id)
                name = (
                    educator.display_name if educator else blocked.educator_id
                )
                when = (
                    str(blocked.date)
                    if blocked.date is not None
                    else (
                        f"tydzień {blocked.week_number}, dzień "
                        f"{blocked.day_of_week}"
                        if blocked.week_number is not None
                        else f"co tydzień, dzień {blocked.day_of_week}"
                    )
                )
                return [
                    error(
                        rules.RULE_HARD_UNAVAILABLE,
                        (
                            f"Plan staje się możliwy po pominięciu jednego "
                            f"wpisu: {name}, {when}, "
                            f"{blocked.start_time}–{blocked.end_time}. "
                            "Ta konkretna bezwzględna niedostępność koliduje "
                            "z wymaganym dyżurem. Sprawdź ją jako pierwszą; "
                            "aplikacja nie usunęła wpisu."
                        ),
                        educator_id=blocked.educator_id,
                        date_value=blocked.date,
                        start_time=blocked.start_time,
                        end_time=blocked.end_time,
                        context={
                            "conflictType": "HARD_UNAVAILABILITY_TRIGGER",
                            "unavailabilityId": blocked.id,
                            "weekNumber": blocked.week_number,
                            "dayOfWeek": blocked.day_of_week,
                        },
                    )
                ]
            names = sorted(
                {
                    educator_by_id.get(item.educator_id).display_name
                    if educator_by_id.get(item.educator_id)
                    else item.educator_id
                    for item in hard_items
                }
            )
            return [
                error(
                    rules.RULE_HARD_UNAVAILABLE,
                    (
                        "Plan staje się możliwy po pominięciu bezwzględnej "
                        f"niedostępności osób: {', '.join(names)}. Sprawdź "
                        "czerwone okresy niedostępności tych osób; aplikacja "
                        "nie usunęła żadnego wpisu."
                    ),
                    context={"conflictType": "HARD_UNAVAILABILITY_TRIGGER"},
                )
            ]

    no_daily_rest = configuration.model_copy(deep=True)
    no_daily_rest.legal_rules.minimum_daily_rest_minutes = 0
    if attempt(no_daily_rest):
        required = configuration.legal_rules.minimum_daily_rest_minutes
        return [
            error(
                rules.RULE_REST_DAILY,
                (
                    f"Plan blokuje wymagany odpoczynek dobowy {required / 60:g} "
                    "godz. Godziny tygodniowe są zbilansowane, ale co najmniej "
                    "dwa dyżury tej samej osoby leżą zbyt blisko siebie. "
                    "Sprawdź najpierw nocki i weekendy."
                ),
                required=required,
                context={"conflictType": "DAILY_REST_TRIGGER"},
            )
        ]

    for work_days in (4, 6):
        candidate = configuration.model_copy(deep=True)
        candidate.organizational_rules.required_work_days_per_week = work_days
        if attempt(candidate):
            return [
                error(
                    rules.RULE_DAYS,
                    (
                        "Suma godzin jest poprawna, ale nie da się jej rozłożyć "
                        "na dokładnie pięć dni pracy każdej osoby przy obecnych "
                        "nockach, weekendach i niedostępności. Sprawdź osobę z "
                        "największą liczbą zablokowanych dni."
                    ),
                    required=configuration.organizational_rules.required_work_days_per_week,
                    actual=work_days,
                    context={"conflictType": "WORKDAY_COUNT_TRIGGER"},
                )
            ]
    return []


def generate_schedule(
    configuration: ScheduleConfiguration,
    *,
    optimize: bool = False,
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

    solver_result = _solve_once(configuration, input_report.care, optimize=optimize)
    if solver_result.status == GenerationStatus.NO_SOLUTION:
        diagnostic_messages = _diagnose_no_solution(
            configuration,
            input_report.care,
        )
        if not diagnostic_messages:
            diagnostic_messages = [
                error(
                    rules.RULE_NO_GUESSING,
                    (
                        "Godziny tygodniowe są zbilansowane, ale obecnych "
                        "niedostępności, weekendów, nocy, pięciu dni pracy i "
                        "odpoczynków nie da się spełnić jednocześnie. Aplikacja "
                        "nie zmieni żadnej z tych danych samodzielnie."
                    ),
                    context={
                        "solverStatus": solver_result.solver_status_name,
                        "conflictType": "COMBINED_HARD_RULES",
                    },
                )
            ]
        conflict_ids = sorted({item.rule_id for item in diagnostic_messages})
        educator_ids = sorted(
            {
                item.educator_id
                for item in diagnostic_messages
                if item.educator_id is not None
            }
        )
        dates = sorted(
            {
                item.date
                for item in diagnostic_messages
                if item.date is not None
            }
        )
        return GenerateResponse(
            generation_status=GenerationStatus.NO_SOLUTION,
            public_result=PublicResult.BRAK_ROZWIAZANIA,
            care=input_report.care,
            conflict_report=ConflictReport(
                summary=(
                    "Nie zmieniaj wszystkich danych. Zacznij od pierwszej "
                    "konkretnej pozycji wskazanej poniżej, a potem ponownie "
                    "uruchom generowanie."
                ),
                conflict_analysis_quality="APPROXIMATE",
                conflicting_rule_ids=conflict_ids,
                educator_ids=educator_ids,
                dates=dates,
                required_values=[
                    str(item.required_value)
                    for item in diagnostic_messages
                    if item.required_value is not None
                ],
                actual_values=[
                    str(item.actual_value)
                    for item in diagnostic_messages
                    if item.actual_value is not None
                ],
                input_fields_to_review=[
                    "Stałe i dodatkowe nocki",
                    "Dzienna obsada weekendu",
                    "Bezwzględna niedostępność wskazanych osób",
                    "Odpoczynek pomiędzy sąsiednimi dyżurami",
                ],
            ),
            messages=diagnostic_messages,
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
                    "Nie znaleziono jeszcze planu spełniającego wszystkie wymagane warunki. "
                    "To limit obliczeń, nie błąd wpisanych godzin ani dowód sprzeczności danych. "
                    "Wybierz „Szukaj dłużej”, bez ponownego wpisywania danych.",
                    context={"solverStatus": solver_result.solver_status_name, "conflictType": "SEARCH_LIMIT"},
                )
            ],
            next_weekend_variant=next_weekend_variant,
        )

    if solver_result.status != GenerationStatus.CANDIDATE_FOUND:
        return GenerateResponse(
            generation_status=GenerationStatus.INTERNAL_ERROR,
            public_result=PublicResult.BLAD_WEWNETRZNY,
            care=input_report.care,
            messages=[error(
                rules.RULE_NO_GUESSING,
                "Generator nie mógł uruchomić modelu obliczeń. To błąd programu, nie danych użytkownika.",
                context={"solverStatus": solver_result.solver_status_name},
            )],
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
        messages=[
            *input_report.messages,
            *validation.messages,
            *(
                []
                if solver_result.optimization_proven
                else [
                    info(
                        rules.RULE_NO_GUESSING,
                        "Propozycja planu przeszła pełną kontrolę wymaganych warunków. "
                        "Można opcjonalnie ulepszyć jej układ, np. zmniejszyć liczbę podzielonych dni. "
                        "Brak najlepszego możliwego podziału nie unieważnia tego planu.",
                        context={
                            "solverStatus": solver_result.solver_status_name,
                            "hardValidation": "VALID",
                            "conflictType": "QUALITY_OPTIONAL",
                        },
                    )
                ]
            ),
        ],
        next_weekend_variant=next_weekend_variant,
        optimization_proven=solver_result.optimization_proven,
        quality_report=build_quality_report(
            configuration,
            input_report.care,
            solver_result.assignments,
        ),
    )
