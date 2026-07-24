from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from math import ceil

from ortools.sat.python import cp_model

from app.domain import rules
from app.models.schemas import (
    CalculatedCareDay,
    GenerationStatus,
    ScheduleConfiguration,
    ScheduleBoundaryMode,
    UnavailabilityScope,
    UnavailabilityType,
    WeeklyRestWindowType,
    WorkAssignment,
)
from app.services.objective import calculate_objective
from app.services.time_utils import (
    TimeDomainError,
    aware_local_datetime,
    elapsed_minutes,
    interval_slots,
    normalize_pairs,
    parse_hhmm,
)
from app.services.weekend import selected_weekend_variant, template_tuples


@dataclass(slots=True)
class SolverResult:
    status: GenerationStatus
    assignments: list[WorkAssignment]
    objective_score: int | None = None
    solver_status_name: str = ""


@dataclass(slots=True)
class RestCandidate:
    variable: cp_model.IntVar
    start: int
    end: int
    window_number: int


def _active_unavailability(item, target_date, week_number: int) -> bool:
    if item.scope == UnavailabilityScope.RECURRING_WEEKLY:
        return item.day_of_week == target_date.weekday()
    if item.scope == UnavailabilityScope.CYCLE_WEEK:
        return (
            item.week_number == week_number
            and item.day_of_week == target_date.weekday()
        )
    return item.date == target_date


def _assigned_minutes(
    configuration: ScheduleConfiguration,
    educator_id: str,
    week_number: int,
) -> int:
    override = next(
        (
            item
            for item in configuration.assignment_overrides
            if item.educator_id == educator_id and item.week_number == week_number
        ),
        None,
    )
    if override is not None:
        return override.assigned_minutes
    return next(
        item.base_weekly_assigned_minutes
        for item in configuration.educators
        if item.id == educator_id
    )


def _boundary(index: int, configuration: ScheduleConfiguration):
    day_index, slot = divmod(index, rules.SLOTS_PER_DAY)
    target_date = configuration.cycle_start_date + timedelta(days=day_index)
    return target_date, slot * configuration.organizational_rules.time_step_minutes


def _actual_duration(
    start_index: int,
    end_index: int,
    configuration: ScheduleConfiguration,
) -> int | None:
    start_date, start_minute = _boundary(start_index, configuration)
    end_date, end_minute = _boundary(end_index, configuration)
    try:
        return elapsed_minutes(
            start_date,
            start_minute,
            end_date,
            end_minute,
            configuration.time_zone_id,
        )
    except TimeDomainError:
        return None


def _candidate_rest_variables(
    *,
    model: cp_model.CpModel,
    x: dict[tuple[int, int, int], cp_model.IntVar],
    educator_index: int,
    configuration: ScheduleConfiguration,
    window_start: int,
    window_end: int,
    minimum_minutes: int,
    label: str,
    window_number: int,
    total_days: int,
    cyclic: bool,
) -> list[RestCandidate]:
    """Zwraca wskaźniki możliwych, rzeczywistych okresów bez pracy."""
    step = configuration.organizational_rules.time_step_minutes
    minimum_slots = ceil(minimum_minutes / step)
    total_cycle_slots = total_days * rules.SLOTS_PER_DAY
    candidates: list[RestCandidate] = []
    for start in range(window_start, window_end + 1):
        end = start + minimum_slots
        while end <= window_end:
            duration = _actual_duration(start, end, configuration)
            if duration is not None and duration >= minimum_minutes:
                break
            end += 1
        if end > window_end:
            continue
        occupied = []
        for absolute_slot in range(start, end):
            if not cyclic and not 0 <= absolute_slot < total_cycle_slots:
                continue
            day_index, slot = divmod(
                absolute_slot % total_cycle_slots if cyclic else absolute_slot,
                rules.SLOTS_PER_DAY,
            )
            occupied.append(x[(educator_index, day_index, slot)])
        candidate = model.new_bool_var(f"rest_{label}_{educator_index}_{start}")
        if occupied:
            model.add(sum(occupied) <= len(occupied) * (1 - candidate))
        candidates.append(
            RestCandidate(
                variable=candidate,
                start=start,
                end=end,
                window_number=window_number,
            )
        )
    return candidates


def _add_weekly_rest(
    *,
    model: cp_model.CpModel,
    x: dict[tuple[int, int, int], cp_model.IntVar],
    configuration: ScheduleConfiguration,
    educator_count: int,
    total_days: int,
    cyclic: bool,
) -> list[cp_model.IntVar]:
    legal = configuration.legal_rules
    step = configuration.organizational_rules.time_step_minutes
    cycle_slots = total_days * rules.SLOTS_PER_DAY
    window_slots = legal.weekly_rest_window_length_minutes // step
    window_step_slots = legal.weekly_rest_window_step_minutes // step
    anchor_slot = parse_hhmm(legal.weekly_rest_anchor_time) // step
    anchor_day_offset = (
        legal.weekly_rest_anchor_day_of_week
        - configuration.cycle_start_date.weekday()
    ) % 7
    first_anchor = anchor_day_offset * rules.SLOTS_PER_DAY + anchor_slot
    if first_anchor > 0:
        first_anchor -= 7 * rules.SLOTS_PER_DAY
    if legal.weekly_rest_window_type == WeeklyRestWindowType.FIXED_LOCAL_WEEK:
        starts = []
        cursor = first_anchor
        while cursor < cycle_slots:
            starts.append(cursor)
            cursor += 7 * rules.SLOTS_PER_DAY
        ends = [start + window_slots for start in starts]
    else:
        starts = list(range(first_anchor, cycle_slots, window_step_slots))
        ends = [start + window_slots for start in starts]
    if not cyclic:
        finite_windows = [
            (start, end)
            for start, end in zip(starts, ends, strict=True)
            if start >= 0 and end <= cycle_slots
        ]
        starts = [start for start, _ in finite_windows]
        ends = [end for _, end in finite_windows]

    exception_used: list[cp_model.IntVar] = []
    for educator_index in range(educator_count):
        educator_exceptions: list[tuple[int, cp_model.IntVar]] = []
        selected_rest_candidates: list[RestCandidate] = []
        for window_number, (window_start, window_end) in enumerate(
            zip(starts, ends, strict=True),
            start=1,
        ):
            normal = _candidate_rest_variables(
                model=model,
                x=x,
                educator_index=educator_index,
                configuration=configuration,
                window_start=window_start,
                window_end=window_end,
                minimum_minutes=legal.minimum_weekly_rest_minutes,
                label=f"normal_{window_number}",
                window_number=window_number,
                total_days=total_days,
                cyclic=cyclic,
            )
            selected_rest_candidates.extend(normal)
            normal_variables = [item.variable for item in normal]
            if not legal.weekly_rest_exception_enabled:
                if normal_variables:
                    if legal.weekly_rest_reuse_across_windows_allowed:
                        model.add_bool_or(normal_variables)
                    else:
                        model.add_exactly_one(normal_variables)
                else:
                    model.add_bool_or([])
                continue

            used = model.new_bool_var(
                f"weekly_rest_exception_{educator_index}_{window_number}"
            )
            exception_used.append(used)
            educator_exceptions.append((window_start, used))
            if legal.weekly_rest_reuse_across_windows_allowed:
                model.add_bool_or([*normal_variables, used])
            else:
                model.add_exactly_one([*normal_variables, used])
            short = _candidate_rest_variables(
                model=model,
                x=x,
                educator_index=educator_index,
                configuration=configuration,
                window_start=window_start,
                window_end=window_end,
                minimum_minutes=legal.weekly_rest_exception_minimum_minutes or 0,
                label=f"exception_{window_number}",
                window_number=window_number,
                total_days=total_days,
                cyclic=cyclic,
            )
            selected_rest_candidates.extend(short)
            short_variables = [item.variable for item in short]
            if short_variables:
                model.add(sum(short_variables) == used)
            else:
                model.add(used == 0)

            if legal.weekly_rest_compensation_required:
                deadline_slots = ceil(
                    (legal.weekly_rest_compensation_deadline_minutes or 0) / step
                )
                compensation = _candidate_rest_variables(
                    model=model,
                    x=x,
                    educator_index=educator_index,
                    configuration=configuration,
                    window_start=window_end,
                    window_end=window_end + deadline_slots,
                    minimum_minutes=legal.weekly_rest_compensation_minutes or 0,
                    label=f"compensation_{window_number}",
                    window_number=window_number,
                    total_days=total_days,
                    cyclic=cyclic,
                )
                selected_rest_candidates.extend(compensation)
                compensation_variables = [
                    item.variable for item in compensation
                ]
                if compensation_variables:
                    model.add(sum(compensation_variables) >= used)
                    for value in compensation_variables:
                        model.add(value <= used)
                else:
                    model.add(used == 0)

        maximum = legal.weekly_rest_exception_maximum_occurrences_per_cycle or 0
        model.add(sum(value for _, value in educator_exceptions) <= maximum)
        minimum_gap = legal.weekly_rest_exception_minimum_gap_minutes or 0
        for first_index, (first_start, first_var) in enumerate(educator_exceptions):
            for second_start, second_var in educator_exceptions[first_index + 1 :]:
                first_date, first_minute = _boundary(first_start, configuration)
                second_date, second_minute = _boundary(second_start, configuration)
                try:
                    gap = elapsed_minutes(
                        first_date,
                        first_minute,
                        second_date,
                        second_minute,
                        configuration.time_zone_id,
                    )
                except TimeDomainError:
                    continue
                if gap < minimum_gap:
                    model.add(first_var + second_var <= 1)
        if not legal.weekly_rest_reuse_across_windows_allowed:
            ordered = sorted(
                selected_rest_candidates,
                key=lambda item: (item.start, item.end, item.window_number),
            )
            for first_index, first in enumerate(ordered):
                for second in ordered[first_index + 1 :]:
                    if second.start >= first.end:
                        break
                    if (
                        first.window_number != second.window_number
                        and first.start < second.end
                        and second.start < first.end
                    ):
                        model.add(first.variable + second.variable <= 1)
    return exception_used


def solve_schedule(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
) -> SolverResult:
    model = cp_model.CpModel()
    educators = [item for item in configuration.educators if item.active]
    total_days = configuration.planning_horizon_weeks * 7
    total_weeks = configuration.planning_horizon_weeks
    cyclic = (
        configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    )
    step = configuration.organizational_rules.time_step_minutes
    minimum_segment_slots = (
        configuration.organizational_rules.minimum_segment_minutes // step
    )
    x: dict[tuple[int, int, int], cp_model.IntVar] = {}
    starts: dict[tuple[int, int, int], cp_model.IntVar] = {}
    works_day: dict[tuple[int, int], cp_model.IntVar] = {}
    care_slots_by_day: dict[int, set[int]] = {}

    for day_index, day in enumerate(care):
        care_slots_by_day[day_index] = interval_slots(
            [(item.start_minute, item.end_minute) for item in day.intervals],
            step=step,
        )
        for educator_index in range(len(educators)):
            for slot in range(rules.SLOTS_PER_DAY):
                x[(educator_index, day_index, slot)] = model.new_bool_var(
                    f"x_{educator_index}_{day_index}_{slot}"
                )

    for day_index in range(total_days):
        for slot in range(rules.SLOTS_PER_DAY):
            variables = [
                x[(educator_index, day_index, slot)]
                for educator_index in range(len(educators))
            ]
            if slot in care_slots_by_day[day_index]:
                model.add(sum(variables) == 1)
            else:
                model.add(sum(variables) == 0)

    for educator_index in range(len(educators)):
        for day_index in range(total_days):
            day_variables = [
                x[(educator_index, day_index, slot)]
                for slot in range(rules.SLOTS_PER_DAY)
            ]
            works_day[(educator_index, day_index)] = model.new_bool_var(
                f"workday_{educator_index}_{day_index}"
            )
            model.add_max_equality(
                works_day[(educator_index, day_index)],
                day_variables,
            )
            for slot in range(rules.SLOTS_PER_DAY):
                current = x[(educator_index, day_index, slot)]
                previous = (
                    x[(educator_index, day_index, slot - 1)] if slot else 0
                )
                start = model.new_bool_var(
                    f"start_{educator_index}_{day_index}_{slot}"
                )
                starts[(educator_index, day_index, slot)] = start
                model.add(start >= current - previous)
                model.add(start <= current)
                if slot:
                    model.add(start <= 1 - previous)
                for offset in range(minimum_segment_slots):
                    if slot + offset >= rules.SLOTS_PER_DAY:
                        model.add(start == 0)
                        break
                    model.add(
                        x[(educator_index, day_index, slot + offset)] >= start
                    )

    for educator_index, educator in enumerate(educators):
        for week_index in range(total_weeks):
            day_indexes = range(week_index * 7, (week_index + 1) * 7)
            model.add(
                sum(works_day[(educator_index, day)] for day in day_indexes)
                == configuration.organizational_rules.required_work_days_per_week
            )
            required_minutes = _assigned_minutes(
                configuration,
                educator.id,
                week_index + 1,
            )
            model.add(
                sum(
                    x[(educator_index, day, slot)]
                    for day in day_indexes
                    for slot in range(rules.SLOTS_PER_DAY)
                )
                * step
                == required_minutes
            )

    for item in configuration.unavailability:
        if item.type != UnavailabilityType.HARD:
            continue
        educator_index = next(
            (
                index
                for index, educator in enumerate(educators)
                if educator.id == item.educator_id
            ),
            None,
        )
        if educator_index is None:
            continue
        unavailable_slots = interval_slots(
            normalize_pairs(
                [(parse_hhmm(item.start_time), parse_hhmm(item.end_time))]
            ),
            step=step,
        )
        for day_index, day in enumerate(care):
            if _active_unavailability(item, day.date, day.week_number):
                for slot in unavailable_slots:
                    model.add(x[(educator_index, day_index, slot)] == 0)

    educator_index_by_id = {
        educator.id: index for index, educator in enumerate(educators)
    }
    for week_number in range(1, total_weeks + 1):
        saturday_index = (week_number - 1) * 7 + 5
        saturday = care[saturday_index].date
        sunday = care[saturday_index + 1].date
        variant = selected_weekend_variant(
            configuration,
            week_number=week_number,
            saturday=saturday,
            sunday=sunday,
        )
        for day_index, template in (
            (saturday_index, variant.saturday_template),
            (saturday_index + 1, variant.sunday_template),
        ):
            owner_by_slot: dict[int, int] = {}
            for _, educator_id, start, end in template_tuples(template):
                for slot in range(start // step, end // step):
                    owner_by_slot[slot] = educator_index_by_id[educator_id]
            for slot in care_slots_by_day[day_index]:
                owner = owner_by_slot[slot]
                for educator_index in range(len(educators)):
                    model.add(
                        x[(educator_index, day_index, slot)]
                        == int(educator_index == owner)
                    )

    maximum_daily = configuration.legal_rules.maximum_absolute_daily_work_minutes
    maximum_segment = (
        configuration.legal_rules.maximum_absolute_segment_minutes
    )
    for educator_index in range(len(educators)):
        for day_index in range(total_days):
            if maximum_daily is not None:
                model.add(
                    sum(
                        x[(educator_index, day_index, slot)]
                        for slot in range(rules.SLOTS_PER_DAY)
                    )
                    * step
                    <= maximum_daily
                )
            if maximum_segment is not None:
                limit = maximum_segment // step
                for start_slot in range(rules.SLOTS_PER_DAY - limit):
                    model.add(
                        sum(
                            x[(educator_index, day_index, slot)]
                            for slot in range(start_slot, start_slot + limit + 1)
                        )
                        <= limit
                    )

    minimum_daily_rest = configuration.legal_rules.minimum_daily_rest_minutes
    for educator_index in range(len(educators)):
        transition_count = total_days if cyclic else total_days - 1
        for day_index in range(transition_count):
            next_day_index = (day_index + 1) % total_days
            current_date = care[day_index].date
            next_date = (
                care[next_day_index].date
                if next_day_index
                else configuration.cycle_start_date + timedelta(days=total_days)
            )
            for current_slot in care_slots_by_day[day_index]:
                end_minute = (current_slot + 1) * step
                for next_slot in care_slots_by_day[next_day_index]:
                    rest = elapsed_minutes(
                        current_date,
                        end_minute,
                        next_date,
                        next_slot * step,
                        configuration.time_zone_id,
                    )
                    if rest < minimum_daily_rest:
                        model.add(
                            x[(educator_index, day_index, current_slot)]
                            + x[(educator_index, next_day_index, next_slot)]
                            <= 1
                        )

    if not cyclic and configuration.boundary_context is not None:
        context_by_educator = {
            item.educator_id: item
            for item in configuration.boundary_context.educators
        }
        for educator_index, educator in enumerate(educators):
            context = context_by_educator.get(educator.id)
            if context is None:
                continue
            if context.last_assignment_before is not None:
                previous = context.last_assignment_before
                for slot in care_slots_by_day[0]:
                    rest = elapsed_minutes(
                        previous.date,
                        previous.end_minute,
                        care[0].date,
                        slot * step,
                        configuration.time_zone_id,
                    )
                    if rest < minimum_daily_rest:
                        model.add(x[(educator_index, 0, slot)] == 0)
            if context.first_assignment_after is not None:
                following = context.first_assignment_after
                last_day_index = total_days - 1
                for slot in care_slots_by_day[last_day_index]:
                    rest = elapsed_minutes(
                        care[last_day_index].date,
                        (slot + 1) * step,
                        following.date,
                        following.start_minute,
                        configuration.time_zone_id,
                    )
                    if rest < minimum_daily_rest:
                        model.add(
                            x[(educator_index, last_day_index, slot)] == 0
                        )

    exception_variables = _add_weekly_rest(
        model=model,
        x=x,
        configuration=configuration,
        educator_count=len(educators),
        total_days=total_days,
        cyclic=cyclic,
    )

    org = configuration.organizational_rules
    preferred_unavailable_terms = []
    for item in configuration.unavailability:
        if item.type != UnavailabilityType.PREFERRED:
            continue
        educator_index = educator_index_by_id.get(item.educator_id)
        if educator_index is None:
            continue
        unavailable = interval_slots(
            [(parse_hhmm(item.start_time), parse_hhmm(item.end_time))],
            step=step,
        )
        for day_index, day in enumerate(care):
            if _active_unavailability(item, day.date, day.week_number):
                preferred_unavailable_terms.extend(
                    x[(educator_index, day_index, slot)]
                    for slot in unavailable & care_slots_by_day[day_index]
                )

    split_terms = [
        sum(
            starts[(educator_index, day_index, slot)]
            for slot in range(rules.SLOTS_PER_DAY)
        )
        - works_day[(educator_index, day_index)]
        for educator_index in range(len(educators))
        for day_index in range(total_days)
    ]

    preferred_segment_slots = org.preferred_maximum_segment_minutes // step
    long_terms = []
    for educator_index in range(len(educators)):
        for day_index in range(total_days):
            for slot in range(preferred_segment_slots, rules.SLOTS_PER_DAY):
                window = [
                    x[(educator_index, day_index, position)]
                    for position in range(
                        slot - preferred_segment_slots,
                        slot + 1,
                    )
                ]
                over = model.new_bool_var(
                    f"long_{educator_index}_{day_index}_{slot}"
                )
                for value in window:
                    model.add(over <= value)
                model.add(over >= sum(window) - preferred_segment_slots)
                long_terms.append(over)

    afternoon_terms = []
    preferred_boundary = parse_hhmm(org.preferred_afternoon_handover_time)
    for day_index, day in enumerate(care):
        if day.day_of_week >= 5:
            continue
        containing = next(
            (
                interval
                for interval in day.intervals
                if interval.start_minute <= preferred_boundary < interval.end_minute
            ),
            None,
        )
        if containing is None:
            continue
        for boundary in range(
            containing.start_minute + step,
            containing.end_minute,
            step,
        ):
            slot = boundary // step
            distance = abs(boundary - preferred_boundary) // step
            for first in range(len(educators)):
                for second in range(len(educators)):
                    if first == second:
                        continue
                    handover = model.new_bool_var(
                        f"handover_{day_index}_{slot}_{first}_{second}"
                    )
                    before = x[(first, day_index, slot - 1)]
                    after = x[(second, day_index, slot)]
                    model.add(handover <= before)
                    model.add(handover <= after)
                    model.add(handover >= before + after - 1)
                    afternoon_terms.append(distance * handover)

    weekend_penalty = 0
    for day_index, day in enumerate(care):
        if day.day_of_week < 5:
            continue
        totals: dict[str, int] = {}
        week_number = day.week_number
        saturday_index = (week_number - 1) * 7 + 5
        variant = selected_weekend_variant(
            configuration,
            week_number=week_number,
            saturday=care[saturday_index].date,
            sunday=care[saturday_index + 1].date,
        )
        template = (
            variant.saturday_template
            if day.day_of_week == 5
            else variant.sunday_template
        )
        for _, educator_id, start, end in template_tuples(template):
            totals[educator_id] = totals.get(educator_id, 0) + end - start
        weekend_penalty += sum(
            abs(minutes - org.preferred_weekend_split_minutes) // step
            for minutes in totals.values()
        )

    soft_score = (
        org.afternoon_handover_penalty_weight * sum(afternoon_terms)
        + org.weekend_imbalance_penalty_weight * weekend_penalty
        + org.split_day_penalty_weight * sum(split_terms)
        + org.long_segment_penalty_weight * sum(long_terms)
        + org.preferred_unavailability_penalty_weight
        * sum(preferred_unavailable_terms)
    )
    # Wyjątek prawny jest zawsze mniej pożądany niż dowolna poprawa miękka.
    exception_priority = 1_000_000 * sum(exception_variables)
    model.minimize(exception_priority + soft_score)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = configuration.solver_time_limit_seconds
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = configuration.random_seed
    solver.parameters.cp_model_presolve = True
    solver.parameters.log_search_progress = False
    status = solver.solve(model)
    status_name = solver.status_name(status)
    if status == cp_model.INFEASIBLE:
        return SolverResult(
            status=GenerationStatus.NO_SOLUTION,
            assignments=[],
            solver_status_name=status_name,
        )
    if status != cp_model.OPTIMAL:
        return SolverResult(
            status=GenerationStatus.TIME_LIMIT,
            assignments=[],
            solver_status_name=status_name,
        )

    assignments: list[WorkAssignment] = []
    for educator_index, educator in enumerate(educators):
        for day_index, day in enumerate(care):
            segment_start: int | None = None
            for slot in range(rules.SLOTS_PER_DAY + 1):
                worked = (
                    slot < rules.SLOTS_PER_DAY
                    and solver.value(x[(educator_index, day_index, slot)]) == 1
                )
                if worked and segment_start is None:
                    segment_start = slot * step
                if not worked and segment_start is not None:
                    assignments.append(
                        WorkAssignment(
                            educator_id=educator.id,
                            date=day.date,
                            start_minute=segment_start,
                            end_minute=slot * step,
                        )
                    )
                    segment_start = None
    objective = calculate_objective(configuration, care, assignments)
    return SolverResult(
        status=GenerationStatus.CANDIDATE_FOUND,
        assignments=assignments,
        objective_score=objective.objective_score,
        solver_status_name=status_name,
    )
