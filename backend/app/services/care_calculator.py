from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.models.schemas import (
    CalculatedCareDay,
    CareInterval,
    DayCarePlan,
    PlanScope,
    ScheduleConfiguration,
)
from app.services.time_utils import (
    is_subset,
    normalize_intervals,
    subtract_pairs,
)


class CareCalculationError(ValueError):
    def __init__(self, message: str, *, plan_id: str | None = None) -> None:
        super().__init__(message)
        self.plan_id = plan_id


def _plan_key(plan: DayCarePlan) -> tuple[object, ...]:
    if plan.scope == PlanScope.BASE_WEEKLY:
        return (plan.configuration_version_id, plan.group_id, plan.scope, plan.day_of_week)
    if plan.scope == PlanScope.CYCLE_WEEK:
        return (
            plan.configuration_version_id,
            plan.group_id,
            plan.scope,
            plan.week_number,
            plan.day_of_week,
        )
    return (plan.configuration_version_id, plan.group_id, plan.scope, plan.date)


def plan_duplicates(plans: list[DayCarePlan]) -> list[tuple[object, ...]]:
    grouped: dict[tuple[object, ...], int] = defaultdict(int)
    for plan in plans:
        if plan.approved:
            grouped[_plan_key(plan)] += 1
    return [key for key, count in grouped.items() if count > 1]


def select_effective_plan(
    configuration: ScheduleConfiguration,
    target_date: date,
    week_number: int,
) -> DayCarePlan:
    approved = [plan for plan in configuration.day_plans if plan.approved]
    exact = [
        plan
        for plan in approved
        if plan.scope == PlanScope.SPECIFIC_DATE and plan.date == target_date
    ]
    cycle = [
        plan
        for plan in approved
        if plan.scope == PlanScope.CYCLE_WEEK
        and plan.week_number == week_number
        and plan.day_of_week == target_date.weekday()
    ]
    base = [
        plan
        for plan in approved
        if plan.scope == PlanScope.BASE_WEEKLY
        and plan.day_of_week == target_date.weekday()
    ]
    selected = exact or cycle or base
    if len(selected) != 1:
        raise CareCalculationError(
            f"Dla daty {target_date.isoformat()} oczekiwano dokładnie jednego "
            f"skutecznego planu, znaleziono {len(selected)}."
        )
    return selected[0]


def calculate_plan_pairs(
    plan: DayCarePlan,
    *,
    time_step_minutes: int,
) -> list[tuple[int, int]]:
    operating = normalize_intervals(
        plan.operating_intervals,
        time_step_minutes=time_step_minutes,
    )
    no_care = normalize_intervals(
        plan.no_care_intervals,
        time_step_minutes=time_step_minutes,
    )
    if not is_subset(no_care, operating):
        raise CareCalculationError(
            "Przedział bez wymaganej opieki wychodzi poza godziny funkcjonowania.",
            plan_id=plan.id,
        )
    return subtract_pairs(operating, no_care)


def calculate_care(
    configuration: ScheduleConfiguration,
) -> list[CalculatedCareDay]:
    active_groups = configuration.active_groups()
    if len(configuration.groups) > 1:
        result: list[CalculatedCareDay] = []
        for group in active_groups:
            result.extend(calculate_care(configuration.configuration_for_group(group.id)))
        return sorted(result, key=lambda item: (item.date, item.group_id))

    step = configuration.organizational_rules.time_step_minutes
    result: list[CalculatedCareDay] = []
    group_id = configuration.group_id or active_groups[0].id
    for day_index in range(configuration.planning_horizon_weeks * 7):
        current = configuration.cycle_start_date.fromordinal(
            configuration.cycle_start_date.toordinal() + day_index
        )
        week_number = day_index // 7 + 1
        plan = select_effective_plan(configuration, current, week_number)
        pairs = calculate_plan_pairs(plan, time_step_minutes=step)
        intervals = [
            CareInterval(
                start_minute=start,
                end_minute=end,
                required_staff_count=1,
            )
            for start, end in pairs
        ]
        result.append(
            CalculatedCareDay(
                group_id=group_id,
                date=current,
                week_number=week_number,
                day_of_week=current.weekday(),
                applied_day_plan_id=plan.id,
                intervals=intervals,
                total_required_minutes=sum(end - start for start, end in pairs),
            )
        )
    return result
