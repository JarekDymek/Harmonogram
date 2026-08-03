from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from math import ceil
from time import monotonic

from ortools.sat.python import cp_model

from app.domain import rules
from app.models.schemas import (
    CalculatedCareDay,
    GenerationStatus,
    ScheduleBoundaryMode,
    ScheduleConfiguration,
    UnavailabilityScope,
    UnavailabilityType,
    WorkAssignment,
)
from app.services.time_utils import (
    aware_local_datetime,
    elapsed_minutes,
    interval_slots,
    normalize_pairs,
    parse_hhmm,
)
from app.services.weekend import selected_weekend_variant, template_tuples
from app.solver.schedule_solver import _add_weekly_rest


@dataclass(slots=True)
class InternatSolverResult:
    status: GenerationStatus
    assignments: list[WorkAssignment]
    solver_status_name: str = ""
    stage_values: dict[str, int] | None = None
    optimization_proven: bool = False


def _active_unavailability(item, target_date, week_number: int) -> bool:
    if item.scope == UnavailabilityScope.RECURRING_WEEKLY:
        return item.day_of_week == target_date.weekday()
    if item.scope == UnavailabilityScope.CYCLE_WEEK:
        return (
            item.week_number == week_number
            and item.day_of_week == target_date.weekday()
        )
    return item.date == target_date


def _membership_minutes(membership, week_number: int) -> int:
    values = membership.weekly_target_hours_by_week
    value = values[week_number - 1] if week_number <= len(values) else values[-1]
    return int(round(value * 60))


def _care_blocks(day: CalculatedCareDay, step: int) -> list[list[int]]:
    return [
        list(range(item.start_minute // step, item.end_minute // step))
        for item in day.intervals
    ]


def _fixed_occupancy(
    configuration: ScheduleConfiguration,
    educator_id: str,
    target_date,
    slot: int,
) -> bool:
    step = configuration.organizational_rules.time_step_minutes
    slot_start = slot * step
    slot_end = slot_start + step
    for assignment in configuration.locked_assignments:
        if (
            assignment.educator_id == educator_id
            and assignment.date == target_date
            and assignment.start_minute < slot_end
            and slot_start < assignment.end_minute
        ):
            return True
    slot_start_dt = aware_local_datetime(
        target_date,
        slot_start,
        configuration.time_zone_id,
    )
    slot_end_dt = aware_local_datetime(
        target_date,
        slot_end,
        configuration.time_zone_id,
    )
    for duty in configuration.external_duty_assignments:
        if duty.educator_id != educator_id or not duty.locked:
            continue
        if duty.start_date_time < slot_end_dt and slot_start_dt < duty.end_date_time:
            return True
    return False


def _canonical_merge(assignments: list[WorkAssignment]) -> list[WorkAssignment]:
    merged: list[WorkAssignment] = []
    for item in sorted(
        assignments,
        key=lambda value: (
            value.group_id,
            value.educator_id,
            value.date,
            value.start_minute,
            value.end_minute,
        ),
    ):
        if (
            merged
            and merged[-1].group_id == item.group_id
            and merged[-1].educator_id == item.educator_id
            and merged[-1].date == item.date
            and merged[-1].end_minute == item.start_minute
        ):
            merged[-1] = merged[-1].model_copy(
                update={"end_minute": item.end_minute}
            )
        else:
            merged.append(item)
    return sorted(
        merged,
        key=lambda value: (
            value.date,
            value.group_id,
            value.start_minute,
            value.educator_id,
        ),
    )


def solve_internat_schedule(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
) -> InternatSolverResult:
    """Wspólny model CP-SAT dla wszystkich wybranych grup internatu."""
    model = cp_model.CpModel()
    groups = configuration.active_groups()
    group_ids = [item.id for item in groups]
    memberships = [
        item
        for item in configuration.group_memberships
        if item.active and item.group_id in group_ids
    ]
    relevant_educator_ids = {item.educator_id for item in memberships}
    educators = [
        item
        for item in configuration.educators
        if item.active and item.id in relevant_educator_ids
    ]
    educator_index = {item.id: index for index, item in enumerate(educators)}
    group_members = {
        group_id: [
            item
            for item in memberships
            if item.group_id == group_id
        ]
        for group_id in group_ids
    }
    step = configuration.organizational_rules.time_step_minutes
    total_days = configuration.planning_horizon_weeks * 7
    total_weeks = configuration.planning_horizon_weeks
    cyclic = configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    dates = [
        configuration.cycle_start_date + timedelta(days=index)
        for index in range(total_days)
    ]
    care_by_group_day = {
        (
            item.group_id,
            (item.date - configuration.cycle_start_date).days,
        ): item
        for item in care
    }

    hard_slots: dict[tuple[str, int], set[int]] = defaultdict(set)
    for item in configuration.unavailability:
        if item.type != UnavailabilityType.HARD:
            continue
        unavailable = interval_slots(
            normalize_pairs([(parse_hhmm(item.start_time), parse_hhmm(item.end_time))]),
            step=step,
        )
        for day_index, target_date in enumerate(dates):
            if _active_unavailability(item, target_date, day_index // 7 + 1):
                hard_slots[(item.educator_id, day_index)].update(unavailable)

    x: dict[tuple[str, int, int, int], cp_model.IntVar] = {}
    by_educator_day_slot: dict[
        tuple[int, int, int], list[cp_model.IntVar]
    ] = defaultdict(list)
    group_starts: dict[tuple[str, int, int, int], cp_model.IntVar] = {}
    care_slots: dict[tuple[str, int], set[int]] = {}
    block_slots: dict[tuple[str, int, int], list[int]] = {}
    for group_id in group_ids:
        member_ids = [item.educator_id for item in group_members[group_id]]
        for day_index in range(total_days):
            day = care_by_group_day[(group_id, day_index)]
            blocks = _care_blocks(day, step)
            care_slots[(group_id, day_index)] = {
                slot for block in blocks for slot in block
            }
            for block_index, slots in enumerate(blocks):
                block_slots[(group_id, day_index, block_index)] = slots
            for slot in care_slots[(group_id, day_index)]:
                variables: list[cp_model.IntVar] = []
                for educator_id in member_ids:
                    if slot in hard_slots[(educator_id, day_index)]:
                        continue
                    index = educator_index[educator_id]
                    variable = model.new_bool_var(
                        f"x_{group_id}_{index}_{day_index}_{slot}"
                    )
                    x[(group_id, index, day_index, slot)] = variable
                    by_educator_day_slot[(index, day_index, slot)].append(variable)
                    variables.append(variable)
                model.add(sum(variables) == 1)

    global_x: dict[tuple[int, int, int], cp_model.IntVar] = {}
    occupied_x: dict[tuple[int, int, int], cp_model.IntVar] = {}
    for index, educator in enumerate(educators):
        for day_index, target_date in enumerate(dates):
            for slot in range(rules.SLOTS_PER_DAY):
                assigned = by_educator_day_slot[(index, day_index, slot)]
                global_value = model.new_bool_var(
                    f"global_{index}_{day_index}_{slot}"
                )
                global_x[(index, day_index, slot)] = global_value
                model.add(global_value == sum(assigned))
                occupied = model.new_bool_var(
                    f"occupied_{index}_{day_index}_{slot}"
                )
                occupied_x[(index, day_index, slot)] = occupied
                if _fixed_occupancy(
                    configuration,
                    educator.id,
                    target_date,
                    slot,
                ):
                    model.add(global_value == 0)
                    model.add(occupied == 1)
                else:
                    model.add(occupied == global_value)

    # Odcinek w grupie, minimum 2 godziny i krytyczny zakaz A–B–A.
    minimum_slots = configuration.organizational_rules.minimum_segment_minutes // step
    total_group_segment_terms: list[cp_model.IntVar] = []
    distinct_terms: list[cp_model.LinearExpr] = []
    handover_terms: list[cp_model.IntVar] = []
    afternoon_terms: list[cp_model.LinearExpr] = []
    short_middle_terms: list[cp_model.IntVar] = []
    preferred_boundary = parse_hhmm(
        configuration.organizational_rules.preferred_afternoon_handover_time
    )
    for group_id in group_ids:
        member_ids = [item.educator_id for item in group_members[group_id]]
        member_indexes = [educator_index[item] for item in member_ids]
        for day_index in range(total_days):
            day = care_by_group_day[(group_id, day_index)]
            for block_index, slots in enumerate(
                _care_blocks(day, step)
            ):
                used_terms: list[cp_model.IntVar] = []
                for index in member_indexes:
                    starts_in_block: list[cp_model.IntVar] = []
                    values = [
                        x.get((group_id, index, day_index, slot), 0)
                        for slot in slots
                    ]
                    for position, slot in enumerate(slots):
                        current = values[position]
                        previous = values[position - 1] if position else 0
                        start = model.new_bool_var(
                            f"start_{group_id}_{index}_{day_index}_{slot}"
                        )
                        group_starts[(group_id, index, day_index, slot)] = start
                        model.add(start >= current - previous)
                        model.add(start <= current)
                        model.add(start <= 1 - previous)
                        starts_in_block.append(start)
                        total_group_segment_terms.append(start)
                        for offset in range(minimum_slots):
                            if position + offset >= len(values):
                                model.add(start == 0)
                                break
                            model.add(values[position + offset] >= start)
                    # Najwyżej jeden początek osoby w maksymalnym bloku popytu.
                    model.add(sum(starts_in_block) <= 1)
                    used = model.new_bool_var(
                        f"used_{group_id}_{index}_{day_index}_{block_index}"
                    )
                    model.add_max_equality(used, values)
                    used_terms.append(used)
                distinct_terms.append(sum(used_terms) - 1)

                for position in range(1, len(slots)):
                    boundary_slot = slots[position]
                    same_terms: list[cp_model.IntVar] = []
                    for index in member_indexes:
                        before = x.get(
                            (group_id, index, day_index, slots[position - 1]),
                            0,
                        )
                        after = x.get(
                            (group_id, index, day_index, boundary_slot),
                            0,
                        )
                        same = model.new_bool_var(
                            f"same_{group_id}_{index}_{day_index}_{boundary_slot}"
                        )
                        model.add(same <= before)
                        model.add(same <= after)
                        model.add(same >= before + after - 1)
                        same_terms.append(same)
                    handover = model.new_bool_var(
                        f"handover_{group_id}_{day_index}_{boundary_slot}"
                    )
                    model.add(handover + sum(same_terms) == 1)
                    handover_terms.append(handover)
                    if day.day_of_week < 5:
                        boundary = boundary_slot * step
                        afternoon_terms.append(
                            abs(boundary - preferred_boundary) // step * handover
                        )

                # Krótki odcinek środkowy: 2–3 godziny, otoczony innymi osobami.
                for index in member_indexes:
                    for start_position in range(1, len(slots) - minimum_slots):
                        for length in range(minimum_slots, minimum_slots + 3):
                            end_position = start_position + length
                            if end_position >= len(slots):
                                continue
                            segment = [
                                x.get(
                                    (
                                        group_id,
                                        index,
                                        day_index,
                                        slots[position],
                                    ),
                                    0,
                                )
                                for position in range(start_position, end_position)
                            ]
                            before = x.get(
                                (
                                    group_id,
                                    index,
                                    day_index,
                                    slots[start_position - 1],
                                ),
                                0,
                            )
                            after = x.get(
                                (
                                    group_id,
                                    index,
                                    day_index,
                                    slots[end_position],
                                ),
                                0,
                            )
                            short = model.new_bool_var(
                                f"short_middle_{group_id}_{index}_{day_index}_{start_position}_{length}"
                            )
                            for value in segment:
                                model.add(short <= value)
                            model.add(short <= 1 - before)
                            model.add(short <= 1 - after)
                            model.add(
                                short
                                >= sum(segment)
                                - before
                                - after
                                - len(segment)
                                + 1
                            )
                            short_middle_terms.append(short)

    # Dokładne wymiary członkostw w każdej grupie i tygodniu.
    for membership in memberships:
        index = educator_index[membership.educator_id]
        for week_index in range(total_weeks):
            slots = [
                x.get((membership.group_id, index, day_index, slot), 0)
                for day_index in range(week_index * 7, (week_index + 1) * 7)
                for slot in care_slots[(membership.group_id, day_index)]
            ]
            model.add(
                sum(slots) * step
                == _membership_minutes(membership, week_index + 1)
            )

    works_day: dict[tuple[int, int], cp_model.IntVar] = {}
    global_starts: list[cp_model.IntVar] = []
    for index in range(len(educators)):
        for day_index in range(total_days):
            values = [
                occupied_x[(index, day_index, slot)]
                for slot in range(rules.SLOTS_PER_DAY)
            ]
            work_day = model.new_bool_var(f"work_day_{index}_{day_index}")
            works_day[(index, day_index)] = work_day
            model.add_max_equality(work_day, values)
            for slot, current in enumerate(values):
                previous = values[slot - 1] if slot else 0
                start = model.new_bool_var(f"global_start_{index}_{day_index}_{slot}")
                model.add(start >= current - previous)
                model.add(start <= current)
                model.add(start <= 1 - previous)
                global_starts.append(start)
        for week_index in range(total_weeks):
            model.add(
                sum(
                    works_day[(index, day_index)]
                    for day_index in range(week_index * 7, (week_index + 1) * 7)
                )
                == configuration.organizational_rules.required_work_days_per_week
            )

    # Ustalone, grupowe wzorce weekendowe.
    for group_id in group_ids:
        group_configuration = configuration.configuration_for_group(group_id)
        for week_number in range(1, total_weeks + 1):
            saturday_index = (week_number - 1) * 7 + 5
            variant = selected_weekend_variant(
                group_configuration,
                week_number=week_number,
                saturday=dates[saturday_index],
                sunday=dates[saturday_index + 1],
            )
            for day_index, template in (
                (saturday_index, variant.saturday_template),
                (saturday_index + 1, variant.sunday_template),
            ):
                owner_by_slot: dict[int, str] = {}
                for _, educator_id, start, end in template_tuples(template):
                    for slot in range(start // step, end // step):
                        owner_by_slot[slot] = educator_id
                for slot in care_slots[(group_id, day_index)]:
                    owner_id = owner_by_slot[slot]
                    owner_index = educator_index[owner_id]
                    owner = x.get((group_id, owner_index, day_index, slot))
                    if owner is None:
                        model.add_bool_or([])
                    else:
                        model.add(owner == 1)

    # Odpoczynki liczone globalnie, razem z dyżurami i blokadami.
    minimum_daily_rest = configuration.legal_rules.minimum_daily_rest_minutes
    transition_count = total_days if cyclic else total_days - 1
    for index in range(len(educators)):
        for day_index in range(transition_count):
            next_day_index = (day_index + 1) % total_days
            next_date = (
                dates[next_day_index]
                if next_day_index
                else configuration.cycle_start_date + timedelta(days=total_days)
            )
            for current_slot in range(rules.SLOTS_PER_DAY):
                for next_slot in range(rules.SLOTS_PER_DAY):
                    rest = elapsed_minutes(
                        dates[day_index],
                        (current_slot + 1) * step,
                        next_date,
                        next_slot * step,
                        configuration.time_zone_id,
                    )
                    if rest < minimum_daily_rest:
                        current_fixed = _fixed_occupancy(
                            configuration,
                            educators[index].id,
                            dates[day_index],
                            current_slot,
                        )
                        next_fixed = _fixed_occupancy(
                            configuration,
                            educators[index].id,
                            dates[next_day_index],
                            next_slot,
                        )
                        if current_fixed and next_fixed:
                            continue
                        model.add(
                            occupied_x[(index, day_index, current_slot)]
                            + occupied_x[(index, next_day_index, next_slot)]
                            <= 1
                        )
    exception_terms = _add_weekly_rest(
        model=model,
        x=occupied_x,
        configuration=configuration,
        educator_count=len(educators),
        total_days=total_days,
        cyclic=cyclic,
    )

    maximum_daily = configuration.legal_rules.maximum_absolute_daily_work_minutes
    if maximum_daily is not None:
        for index in range(len(educators)):
            for day_index in range(total_days):
                model.add(
                    sum(
                        occupied_x[(index, day_index, slot)]
                        for slot in range(rules.SLOTS_PER_DAY)
                    )
                    * step
                    <= maximum_daily
                )

    preferred_terms: list[cp_model.IntVar] = []
    for item in configuration.unavailability:
        if item.type != UnavailabilityType.PREFERRED:
            continue
        index = educator_index.get(item.educator_id)
        if index is None:
            continue
        unavailable = interval_slots(
            [(parse_hhmm(item.start_time), parse_hhmm(item.end_time))],
            step=step,
        )
        for day_index, target_date in enumerate(dates):
            if _active_unavailability(item, target_date, day_index // 7 + 1):
                preferred_terms.extend(
                    global_x[(index, day_index, slot)]
                    for slot in unavailable
                )

    preferred_segment_slots = (
        configuration.organizational_rules.preferred_maximum_segment_minutes // step
    )
    long_terms: list[cp_model.IntVar] = []
    for index in range(len(educators)):
        for day_index in range(total_days):
            for slot in range(preferred_segment_slots, rules.SLOTS_PER_DAY):
                window = [
                    occupied_x[(index, day_index, position)]
                    for position in range(slot - preferred_segment_slots, slot + 1)
                ]
                over = model.new_bool_var(f"long_{index}_{day_index}_{slot}")
                for value in window:
                    model.add(over <= value)
                model.add(over >= sum(window) - preferred_segment_slots)
                long_terms.append(over)

    # Dodatkowe odcinki w dniu: liczba globalnych startów minus dzień pracy.
    split_expression = sum(global_starts) - sum(works_day.values())
    canonical_terms: list[cp_model.LinearExpr] = []
    for (group_id, index, day_index, slot), variable in x.items():
        group_order = group_ids.index(group_id)
        coefficient = (
            day_index * len(group_ids) * rules.SLOTS_PER_DAY * len(educators)
            + group_order * rules.SLOTS_PER_DAY * len(educators)
            + slot * len(educators)
            + index
            + 1
        )
        canonical_terms.append(coefficient * variable)

    # Mnożniki wynikają ze ścisłych górnych granic modelu, więc niższy poziom
    # nigdy nie może przeważyć poprawy wyższego poziomu.
    block_count = len(block_slots)
    member_count = max((len(value) for value in group_members.values()), default=4)
    segment_bound = max(1, block_count * member_count)
    distinct_bound = max(1, block_count * max(1, member_count - 1))
    handover_bound = max(
        1,
        sum(max(0, len(value) - 1) for value in block_slots.values()),
    )
    short_bound = max(1, segment_bound)
    quality_expression = (
        (
            (
                (
                    split_expression * (handover_bound + 1)
                    + sum(handover_terms)
                )
                * (distinct_bound + 1)
                + sum(distinct_terms)
            )
            * (segment_bound + 1)
            + sum(total_group_segment_terms)
        )
        * (short_bound + 1)
        + sum(short_middle_terms)
    )
    preferred_bound = max(1, len(educators) * total_days * rules.SLOTS_PER_DAY)
    long_bound = preferred_bound
    afternoon_bound = max(1, handover_bound * rules.SLOTS_PER_DAY)
    soft_expression = (
        (
            sum(preferred_terms) * (long_bound + 1)
            + sum(long_terms)
        )
        * (afternoon_bound + 1)
        + sum(afternoon_terms)
    )
    soft_bound = (
        (preferred_bound * (long_bound + 1) + long_bound)
        * (afternoon_bound + 1)
        + afternoon_bound
    )
    exception_bound = max(1, len(exception_terms))
    secondary_expression = (
        soft_expression * (exception_bound + 1) + sum(exception_terms)
    )
    secondary_bound = (
        soft_bound * (exception_bound + 1) + exception_bound
    )
    # Równoważny cel leksykograficzny. Kryteria jakości nie osłabiają żadnego
    # ograniczenia twardego, w tym zakazu powrotu A–B–A.
    lexicographic_expression = (
        quality_expression * (secondary_bound + 1) + secondary_expression
    )
    def configured_solver() -> cp_model.CpSolver:
        value = cp_model.CpSolver()
        value.parameters.num_search_workers = 1
        value.parameters.random_seed = configuration.random_seed
        value.parameters.cp_model_presolve = True
        value.parameters.log_search_progress = False
        value.parameters.max_time_in_seconds = configuration.solver_time_limit_seconds
        return value

    model.add_decision_strategy(
        global_starts,
        cp_model.CHOOSE_FIRST,
        cp_model.SELECT_MIN_VALUE,
    )
    model.add_decision_strategy(
        handover_terms,
        cp_model.CHOOSE_FIRST,
        cp_model.SELECT_MIN_VALUE,
    )
    model.add_decision_strategy(
        total_group_segment_terms,
        cp_model.CHOOSE_FIRST,
        cp_model.SELECT_MIN_VALUE,
    )
    model.add_decision_strategy(
        list(x.values()),
        cp_model.CHOOSE_FIRST,
        cp_model.SELECT_MIN_VALUE,
    )
    model.minimize(0)
    feasibility_solver = configured_solver()
    feasibility_status = feasibility_solver.solve(model)
    if feasibility_status == cp_model.INFEASIBLE:
        return InternatSolverResult(
            status=GenerationStatus.NO_SOLUTION,
            assignments=[],
            solver_status_name=feasibility_solver.status_name(feasibility_status),
            stage_values={},
        )
    if feasibility_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return InternatSolverResult(
            status=GenerationStatus.TIME_LIMIT,
            assignments=[],
            solver_status_name=feasibility_solver.status_name(feasibility_status),
            stage_values={},
        )
    for variable in x.values():
        model.add_hint(variable, feasibility_solver.value(variable))
    model.minimize(lexicographic_expression)
    optimizer = configured_solver()
    optimization_status = optimizer.solve(model)
    if optimization_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        solver = optimizer
        status_name = optimizer.status_name(optimization_status)
    else:
        solver = feasibility_solver
        status_name = "FEASIBLE_HARD_RULES_ONLY"
    stage_values: dict[str, int] = {
        "legalExceptions": int(solver.value(sum(exception_terms))),
        "splitWorkDays": int(solver.value(split_expression)),
        "continuousBlockHandovers": int(solver.value(sum(handover_terms))),
        "distinctEducatorsPerBlock": int(solver.value(sum(distinct_terms))),
        "totalSegments": int(solver.value(sum(total_group_segment_terms))),
        "shortMiddleSegments": int(solver.value(sum(short_middle_terms))),
        "preferredUnavailability": int(solver.value(sum(preferred_terms))),
        "longSegments": int(solver.value(sum(long_terms))),
        "preferredHandoverTime": int(solver.value(sum(afternoon_terms))),
        "canonicalTieBreaker": int(solver.value(sum(canonical_terms))),
        "optimizationProven": int(optimization_status == cp_model.OPTIMAL),
    }

    raw_assignments: list[WorkAssignment] = []
    for group_id in group_ids:
        for membership in group_members[group_id]:
            index = educator_index[membership.educator_id]
            for day_index, target_date in enumerate(dates):
                segment_start: int | None = None
                for slot in range(rules.SLOTS_PER_DAY + 1):
                    variable = x.get((group_id, index, day_index, slot))
                    worked = variable is not None and solver.value(variable) == 1
                    if worked and segment_start is None:
                        segment_start = slot * step
                    if not worked and segment_start is not None:
                        raw_assignments.append(
                            WorkAssignment(
                                group_id=group_id,
                                educator_id=membership.educator_id,
                                date=target_date,
                                start_minute=segment_start,
                                end_minute=slot * step,
                            )
                        )
                        segment_start = None
    return InternatSolverResult(
        status=GenerationStatus.CANDIDATE_FOUND,
        assignments=_canonical_merge(raw_assignments),
        solver_status_name=status_name,
        stage_values=stage_values,
        optimization_proven=optimization_status == cp_model.OPTIMAL,
    )
