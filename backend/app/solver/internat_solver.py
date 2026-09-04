from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from math import ceil
from time import monotonic

from ortools.sat.python import cp_model

from app.domain import rules
from app.domain.work_calendar import (
    allowed_beside_night, care_target_minutes, fixed_on_date, same_night_block,
    night_windows, uses_fixed_partial_schedule,
)
from app.models.schemas import (
    CalculatedCareDay,
    GenerationStatus,
    ScheduleBoundaryMode,
    ScheduleConfiguration,
    UnavailabilityScope,
    UnavailabilityType,
    WorkAssignment,
    DomainMessage,
)
from app.services.reports import error
from app.services.mornings import morning_balance_cost
from app.services.time_utils import (
    TimeDomainError,
    elapsed_minutes,
    interval_slots,
    normalize_pairs,
    parse_hhmm,
    zone,
)
from app.services.weekend import selected_weekend_variant, template_tuples
from app.solver.schedule_solver import _add_weekly_rest
from app.solver.search import first_feasible, generation_status


@dataclass(slots=True)
class InternatSolverResult:
    status: GenerationStatus
    assignments: list[WorkAssignment]
    solver_status_name: str = ""
    stage_values: dict[str, int] | None = None
    optimization_proven: bool = False
    conflict_messages: list[DomainMessage] | None = None


def _active_unavailability(item, target_date, week_number: int) -> bool:
    if item.scope == UnavailabilityScope.RECURRING_WEEKLY:
        return item.day_of_week == target_date.weekday()
    if item.scope == UnavailabilityScope.CYCLE_WEEK:
        return (
            item.week_number == week_number
            and item.day_of_week == target_date.weekday()
        )
    return item.date == target_date


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
    external_slots=None,
) -> bool:
    step = configuration.organizational_rules.time_step_minutes
    slot_start = slot * step
    slot_end = slot_start + step
    for assignment in [*configuration.locked_assignments,
                       *(a for a in configuration.required_assignments if a.group_id not in configuration.selected_group_ids)]:
        if (
            assignment.educator_id == educator_id
            and assignment.date == target_date
            and assignment.start_minute < slot_end
            and slot_start < assignment.end_minute
        ):
            return True
    if external_slots is None:
        external_slots = _external_occupancy_slots(configuration)
    return slot in external_slots.get((educator_id, target_date), set())


def _external_occupancy_slots(configuration):
    """Project actual duty instants onto the local grid, including both DST folds."""
    occupied = defaultdict(set)
    tz = zone(configuration.time_zone_id)
    step = configuration.organizational_rules.time_step_minutes
    for duty in configuration.external_duty_assignments:
        if not duty.locked:
            continue
        cursor = duty.start_date_time.astimezone(UTC).replace(second=0, microsecond=0)
        end = duty.end_date_time.astimezone(UTC)
        while cursor < end:
            local = cursor.astimezone(tz)
            occupied[(duty.educator_id, local.date())].add(
                (local.hour * 60 + local.minute) // step
            )
            cursor += timedelta(minutes=1)
    return occupied


def _grid_rest_minutes(start_date, start_minute, end_date, end_minute, time_zone_id):
    """Use the shortest possible rest at an internal ambiguous grid boundary.

    User-entered boundaries still go through strict input validation. The model
    also contains unused night slots; those must not crash a daytime schedule.
    """
    try:
        return elapsed_minutes(start_date, start_minute, end_date, end_minute, time_zone_id)
    except TimeDomainError:
        tz = zone(time_zone_id)
        start = datetime.combine(start_date, time()) + timedelta(minutes=start_minute)
        end = datetime.combine(end_date, time()) + timedelta(minutes=end_minute)
        latest_start = max(start.replace(tzinfo=tz, fold=f).astimezone(UTC) for f in (0, 1))
        earliest_end = min(end.replace(tzinfo=tz, fold=f).astimezone(UTC) for f in (0, 1))
        return int((earliest_end - latest_start).total_seconds() // 60)


def _fixed_workday(
    configuration: ScheduleConfiguration,
    educator_id: str,
    target_date,
) -> bool:
    return fixed_on_date(configuration, educator_id, target_date)


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
    *,
    optimize: bool = False,
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

    # Twarde niedostępności są założeniami modelu, a nie usuwaniem zmiennych.
    # Dzięki temu solver nadal traktuje je bezwzględnie, ale przy braku planu
    # potrafi wskazać dokładny wpis należący do sprzecznego zestawu reguł.
    hard_unavailability_slots: dict[tuple[str, int], set[int]] = defaultdict(set)
    hard_unavailability_dates: dict[str, list] = defaultdict(list)
    hard_unavailability_items = {}
    for item in configuration.unavailability:
        if item.type != UnavailabilityType.HARD:
            continue
        if item.educator_id not in relevant_educator_ids:
            continue
        hard_unavailability_items[item.id] = item
        unavailable = interval_slots(
            normalize_pairs([(parse_hhmm(item.start_time), parse_hhmm(item.end_time))]),
            step=step,
        )
        for day_index, target_date in enumerate(dates):
            if _active_unavailability(item, target_date, day_index // 7 + 1):
                hard_unavailability_slots[(item.id, day_index)].update(unavailable)
                hard_unavailability_dates[item.id].append(target_date)

    x: dict[tuple[str, int, int, int], cp_model.IntVar] = {}
    # Ograniczenia wynikające z odpoczynku wokół stałej nocki pozostają
    # bezwarunkowe i nie są prezentowane jako wpis użytkownika do poprawy.
    night_hard_slots: dict[tuple[str, int], set[int]] = defaultdict(set)
    for educator in educators:
        for day_index, date in enumerate(dates):
            night_hard_slots[(educator.id, day_index)].update(
                slot for slot in range(rules.SLOTS_PER_DAY)
                if not allowed_beside_night(configuration, educator.id, date,
                                            slot * step, (slot + 1) * step)
            )
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
                    if slot in night_hard_slots[(educator_id, day_index)]:
                        continue
                    index = educator_index[educator_id]
                    variable = model.new_bool_var(
                        f"x_{group_id}_{index}_{day_index}_{slot}"
                    )
                    x[(group_id, index, day_index, slot)] = variable
                    by_educator_day_slot[(index, day_index, slot)].append(variable)
                    variables.append(variable)
                model.add(sum(variables) == 1)

    hard_unavailability_assumptions = {}
    for item_id, item in hard_unavailability_items.items():
        assumption = model.new_bool_var(f"hard_unavailable_{item_id}")
        model.add_assumption(assumption)
        hard_unavailability_assumptions[assumption.index] = item
        index = educator_index[item.educator_id]
        for day_index in range(total_days):
            for slot in hard_unavailability_slots[(item_id, day_index)]:
                for group_id in group_ids:
                    variable = x.get((group_id, index, day_index, slot))
                    if variable is not None:
                        model.add(variable == 0).only_enforce_if(assumption)

    # Required care is coverage, not an external occupancy block.
    for assignment in configuration.required_assignments:
        if assignment.group_id not in group_ids:
            continue
        index = educator_index.get(assignment.educator_id)
        day_index = (assignment.date - configuration.cycle_start_date).days
        for slot in range(assignment.start_minute // step, assignment.end_minute // step):
            variable = x.get((assignment.group_id, index, day_index, slot))
            if variable is None:
                model.add_bool_or([])
            else:
                model.add(variable == 1)

    global_x: dict[tuple[int, int, int], cp_model.IntVar] = {}
    occupied_x: dict[tuple[int, int, int], cp_model.IntVar] = {}
    fixed_slots: set[tuple[int, int, int]] = set()
    external_slots = _external_occupancy_slots(configuration)
    possible_slots = defaultdict(set)
    for index, educator in enumerate(educators):
        for day_index, target_date in enumerate(dates):
            for slot in range(rules.SLOTS_PER_DAY):
                assigned = by_educator_day_slot[(index, day_index, slot)]
                if assigned:
                    possible_slots[day_index].add(slot)
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
                    external_slots,
                ):
                    possible_slots[day_index].add(slot)
                    fixed_slots.add((index, day_index, slot))
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
                    maximum_segment = configuration.legal_rules.maximum_absolute_segment_minutes
                    if maximum_segment is not None:
                        # At most one contiguous segment per person in this block.
                        model.add(sum(values) * step <= maximum_segment)
                    used = model.new_bool_var(
                        f"used_{group_id}_{index}_{day_index}_{block_index}"
                    )
                    model.add_max_equality(used, values)
                    used_terms.append(used)
                distinct_terms.append(sum(used_terms) - 1)

                if not optimize:
                    continue

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
                == care_target_minutes(configuration, membership, week_index + 1)
            )

    works_day: dict[tuple[int, int], cp_model.IntVar] = {}
    global_starts: list[cp_model.IntVar] = []
    prefer_visits = any(e.prefer_single_daily_visit for e in educators)
    weighted_starts, weighted_care_days = [], []
    for index in range(len(educators)):
        for day_index in range(total_days):
            values = [
                global_x[(index, day_index, slot)]
                for slot in range(rules.SLOTS_PER_DAY)
            ]
            work_day = model.new_bool_var(f"work_day_{index}_{day_index}")
            works_day[(index, day_index)] = work_day
            if _fixed_workday(
                configuration,
                educators[index].id,
                dates[day_index],
            ):
                model.add(work_day == 1)
            else:
                model.add_max_equality(work_day, values)
            weight = 3 if educators[index].prefer_single_daily_visit else 1
            if optimize or prefer_visits:
                care_day = model.new_bool_var(f"care_day_{index}_{day_index}")
                model.add_max_equality(care_day, values)
                weighted_care_days.append(weight * care_day)
            for slot, current in enumerate(values if optimize or prefer_visits else []):
                previous = values[slot - 1] if slot else 0
                start = model.new_bool_var(f"global_start_{index}_{day_index}_{slot}")
                model.add(start >= current - previous)
                model.add(start <= current)
                model.add(start <= 1 - previous)
                global_starts.append(start)
                weighted_starts.append(weight * start)
        for week_index in range(total_weeks):
            weekly_workdays = sum(
                works_day[(index, day_index)]
                for day_index in range(week_index * 7, (week_index + 1) * 7)
            )
            if uses_fixed_partial_schedule(configuration, educators[index].id):
                model.add(
                    weekly_workdays
                    <= configuration.organizational_rules.required_work_days_per_week
                )
            else:
                model.add(
                    weekly_workdays
                    == configuration.organizational_rules.required_work_days_per_week
                )

    split_expression = sum(weighted_starts) - sum(weighted_care_days)
    # One personal pattern across all groups. A night touching Saturday/Sunday
    # triggers it too, since works_day includes the entire fixed-work calendar.
    off_assumptions = {}
    consecutive_penalties = []
    for pattern in configuration.weekend_days_off_patterns:
        if not pattern.active or pattern.educator_id not in educator_index:
            continue
        index = educator_index[pattern.educator_id]
        for week_index in range(total_weeks):
            offset = week_index * 7
            weekend_work = model.new_bool_var(f"weekend_work_{pattern.id}_{week_index}")
            model.add_max_equality(weekend_work, [works_day[(index, offset + d)] for d in (5, 6)])
            if pattern.mode != "FIXED":
                pairs = []
                for day in range(4):
                    pair = model.new_bool_var(f"free_pair_{pattern.id}_{week_index}_{day}")
                    first, second = works_day[index, offset + day], works_day[index, offset + day + 1]
                    model.add(pair <= 1 - first)
                    model.add(pair <= 1 - second)
                    model.add(pair >= 1 - first - second)
                    pairs.append(pair)
                has_pair = model.new_bool_var(f"free_pair_any_{pattern.id}_{week_index}")
                model.add_max_equality(has_pair, pairs)
                missed = model.new_bool_var(f"free_pair_missed_{pattern.id}_{week_index}")
                model.add(missed >= weekend_work - has_pair)
                model.add(missed <= weekend_work)
                model.add(missed <= 1 - has_pair)
                consecutive_penalties.append(missed)
                if pattern.mode == "PREFER_AFTER_FREE_WEEKEND" and (week_index > 0 or cyclic):
                    previous_work = model.new_bool_var(f"previous_weekend_work_{pattern.id}_{week_index}")
                    model.add_max_equality(previous_work, [works_day[index, (offset-d) % total_days] for d in (1,2)])
                    monday_missed = model.new_bool_var(f"monday_pair_missed_{pattern.id}_{week_index}")
                    model.add(monday_missed >= weekend_work - previous_work - pairs[0])
                    model.add(monday_missed <= weekend_work)
                    model.add(monday_missed <= 1-previous_work)
                    model.add(monday_missed <= 1-pairs[0])
                    consecutive_penalties.append(monday_missed)
            else:
                assumption = model.new_bool_var(f"required_off_{pattern.id}_{week_index}")
                model.add_assumption(assumption)
                off_assumptions[assumption.index] = (pattern, week_index)
                for day in pattern.days_off:
                    model.add(works_day[(index, offset + day)] == 0).only_enforce_if([weekend_work, assumption])

    def hard_conflicts(solver):
        from app.validation.weekend_days_off import DAY_NAMES, RULE
        core_indexes = set(solver.sufficient_assumptions_for_infeasibility())
        off_core = [off_assumptions[key] for key in core_indexes if key in off_assumptions]
        unavailable_core = [
            hard_unavailability_assumptions[key]
            for key in core_indexes
            if key in hard_unavailability_assumptions
        ]
        result = []
        conflict_set_size = len(off_core) + len(unavailable_core)
        for pattern, week_index in off_core:
            monday = dates[week_index * 7]
            name = educators[educator_index[pattern.educator_id]].display_name
            days = ", ".join(DAY_NAMES[day] for day in pattern.days_off)
            result.append(error(RULE,
                f"{name}, tydzień {week_index + 1} ({monday:%d.%m}–{monday + timedelta(days=6):%d.%m}): "
                f"obowiązkowe wolne: {days}. Solver potwierdził, że wskazane wzorce wolnego "
                "łącznie z pozostałymi wymaganiami nie pozwalają ułożyć planu. "
                "Lista jest zestawem kolidujących warunków, nie oznacza, że każdy wpis osobno jest błędny. "
                "Jeżeli ta para jest życzeniem, w kroku Weekendy wybierz „Preferuj dwa kolejne dni”. "
                "Jeżeli musi być obowiązkowa, trzeba zmienić powiązaną obsadę lub dostępność, nie sam bilans godzin.",
                educator_id=pattern.educator_id, date_value=monday,
                context={"patternId": pattern.id, "weekNumber": week_index + 1,
                         "daysOff": pattern.days_off, "conflictType": "WEEKEND_OFF_CONFLICT_SET",
                          "conflictSetSize": conflict_set_size}))
        recurring_day_phrases = [
            "w każdy poniedziałek", "w każdy wtorek", "w każdą środę",
            "w każdy czwartek", "w każdy piątek", "w każdą sobotę",
            "w każdą niedzielę",
        ]
        day_names = ["poniedziałek", "wtorek", "środę", "czwartek", "piątek", "sobotę", "niedzielę"]
        for item in unavailable_core:
            educator = educators[educator_index[item.educator_id]]
            affected = hard_unavailability_dates[item.id]
            if item.scope == UnavailabilityScope.RECURRING_WEEKLY:
                when = f"{recurring_day_phrases[item.day_of_week]} {item.start_time}–{item.end_time}"
            elif item.scope == UnavailabilityScope.CYCLE_WEEK:
                when = (
                    f"w tygodniu {item.week_number}, w {day_names[item.day_of_week]} "
                    f"{item.start_time}–{item.end_time}"
                )
            else:
                when = f"{item.date:%d.%m.%Y} {item.start_time}–{item.end_time}"
            dates_text = ", ".join(value.strftime("%d.%m") for value in affected)
            weekend_review = []
            member_group_ids = [
                membership.group_id for membership in memberships
                if membership.educator_id == item.educator_id
            ]
            for member_group_id in member_group_ids:
                member_group = next(group for group in groups if group.id == member_group_id)
                for week_number in range(1, total_weeks + 1):
                    saturday_index = (week_number - 1) * 7 + 5
                    variant = selected_weekend_variant(
                        configuration.configuration_for_group(member_group_id),
                        week_number=week_number,
                        saturday=dates[saturday_index],
                        sunday=dates[saturday_index + 1],
                    )
                    owners = {
                        educator_id
                        for template in (variant.saturday_template, variant.sunday_template)
                        for _, educator_id, _, _ in template_tuples(template)
                    }
                    if item.educator_id not in owners:
                        weekend_review.append({
                            "groupId": member_group_id,
                            "groupCode": member_group.code,
                            "weekNumber": week_number,
                            "positionInCycle": variant.position_in_cycle,
                            "saturday": dates[saturday_index].isoformat(),
                            "sunday": dates[saturday_index + 1].isoformat(),
                        })
            weekend_hint = ""
            if weekend_review:
                positions = ", ".join(
                    f"{value['groupCode']}:{value['positionInCycle'] or value['weekNumber']}"
                    for value in weekend_review
                )
                weekend_hint = (
                    f" Najpierw sprawdź obsadę weekendu w pozycjach {positions}: "
                    f"{educator.display_name} nie ma tam dyżuru, więc musi zmieścić cały wymiar "
                    "w dniach roboczych objętych tymi blokadami."
                )
            result.append(error(
                "REQ-UNAVAILABLE-HARD-001",
                f"{educator.display_name}: bezwzględna niedostępność {when} należy do zestawu "
                "warunków, których nie da się spełnić jednocześnie. Konflikt obejmuje także "
                "dokładny wymiar godzin, obsadę weekendów, 5 dni pracy, stałe nocki oraz odpoczynki. "
                "To nie znaczy, że niedostępność jest błędna — jeśli musi zostać, zmień obsadę "
                "weekendu lub rozkład godzin innej osoby."
                + weekend_hint
                + (f" Dotyczy dat: {dates_text}." if dates_text else ""),
                educator_id=item.educator_id,
                context={
                    "unavailabilityId": item.id,
                    "groupId": member_group_ids[0] if member_group_ids else None,
                    "scope": item.scope,
                    "dayOfWeek": item.day_of_week,
                    "weekNumber": item.week_number,
                    "date": item.date.isoformat() if item.date else None,
                    "startTime": item.start_time,
                    "endTime": item.end_time,
                    "affectedDates": [value.isoformat() for value in affected],
                    "weekendReview": weekend_review,
                    "conflictType": "HARD_UNAVAILABILITY_CONFLICT_SET",
                    "conflictSetSize": conflict_set_size,
                },
            ))
        return result

    morning_expression, morning_bound = morning_balance_cost(model, x, memberships, educator_index, total_weeks, step)

    def improve_days_off(solver, status, deadline):
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return solver, status
        remaining = min(8.0, deadline - monotonic())
        # Days off retain priority. The multiplier exceeds every possible
        # weighted split cost, including all selected groups together.
        bound = 3 * len(educators) * total_days * rules.SLOTS_PER_DAY + 1
        preference = ((sum(consecutive_penalties) * bound + (split_expression if prefer_visits else 0))
                      * (morning_bound + 1) + morning_expression)
        if remaining <= 0 or solver.value(preference) == 0:
            return solver, status
        model.minimize(preference)
        for variable in x.values():
            model.add_hint(variable, solver.value(variable))
        preferred_solver = cp_model.CpSolver()
        preferred_solver.parameters.max_time_in_seconds = remaining
        preferred_solver.parameters.num_search_workers = 1
        preferred_solver.parameters.random_seed = configuration.random_seed
        preferred_status = preferred_solver.solve(model)
        model.clear_hints()
        if preferred_status in (cp_model.OPTIMAL, cp_model.FEASIBLE) and (
            preferred_solver.value(preference) <= solver.value(preference)
        ):
            return preferred_solver, preferred_status
        return solver, status

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
    for day_index in range(transition_count):
        next_day_index = (day_index + 1) % total_days
        next_date = (
            dates[next_day_index]
            if next_day_index
            else configuration.cycle_start_date + timedelta(days=total_days)
        )
        night_bridge = {
            index for index, educator in enumerate(educators)
            if same_night_block(configuration, educator.id, dates[day_index],
                                1200, next_date, 480)
        }
        for current_slot in sorted(possible_slots[day_index]):
            for next_slot in sorted(possible_slots[next_day_index]):
                rest = _grid_rest_minutes(
                    dates[day_index],
                    (current_slot + 1) * step,
                    next_date,
                    next_slot * step,
                    configuration.time_zone_id,
                )
                if rest < minimum_daily_rest:
                    for index in range(len(educators)):
                        current_fixed = (index, day_index, current_slot) in fixed_slots
                        next_fixed = (index, next_day_index, next_slot) in fixed_slots
                        if current_fixed and next_fixed:
                            continue
                        if index in night_bridge and current_slot * step >= 1200 and (next_slot + 1) * step <= 480:
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

    maximum_segment = configuration.legal_rules.maximum_absolute_segment_minutes
    if maximum_segment is not None:
        maximum_slots = maximum_segment // step
        for index in range(len(educators)):
            timeline = [occupied_x[index, day, slot] for day in range(total_days) for slot in range(rules.SLOTS_PER_DAY)]
            if cyclic:
                timeline += timeline[:maximum_slots]
            for start_slot in range(len(timeline) - maximum_slots):
                model.add(sum(timeline[start_slot:start_slot + maximum_slots + 1]) <= maximum_slots)
        for index, educator in enumerate(educators):
            for night_start, night_end in night_windows(configuration, educator.id):
                start_index = (night_start.date() - configuration.cycle_start_date).days
                end_index = (night_end.date() - configuration.cycle_start_date).days
                if cyclic:
                    start_index %= total_days
                    end_index %= total_days
                if 0 <= start_index < total_days or 0 <= end_index < total_days:
                    before = (sum(occupied_x[index, start_index, s] for s in range(1200 // step, 1440 // step)) * step
                              if 0 <= start_index < total_days else 1440 - night_start.hour * 60 - night_start.minute)
                    after = (sum(occupied_x[index, end_index, s] for s in range(480 // step)) * step
                             if 0 <= end_index < total_days else night_end.hour * 60 + night_end.minute)
                    model.add(before + after <= maximum_segment)

    if not optimize:
        # Avoid creating extra travel/work dates; fixed school/night dates first.
        extra_days = [value for (index, day), value in works_day.items()
                      if not _fixed_workday(configuration, educators[index].id, dates[day])]
        model.add_decision_strategy(extra_days, cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE)
        model.add_decision_strategy(list(group_starts.values()), cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE)
        model.add_decision_strategy(list(x.values()), cp_model.CHOOSE_FIRST, cp_model.SELECT_MIN_VALUE)
        preference_deadline = monotonic() + configuration.solver_time_limit_seconds
        solver, status = first_feasible(model, configuration)
        solver, status = improve_days_off(solver, status, preference_deadline)
        result_status = generation_status(status)
        assignments = []
        if result_status == GenerationStatus.CANDIDATE_FOUND:
            for group_id in group_ids:
                for membership in group_members[group_id]:
                    index = educator_index[membership.educator_id]
                    for day_index, target_date in enumerate(dates):
                        segment_start = None
                        for slot in range(rules.SLOTS_PER_DAY + 1):
                            variable = x.get((group_id, index, day_index, slot))
                            worked = variable is not None and solver.value(variable) == 1
                            if worked and segment_start is None:
                                segment_start = slot * step
                            if not worked and segment_start is not None:
                                assignments.append(WorkAssignment(
                                    group_id=group_id,
                                    educator_id=membership.educator_id,
                                    date=target_date,
                                    start_minute=segment_start,
                                    end_minute=slot * step,
                                ))
                                segment_start = None
        return InternatSolverResult(
            status=result_status,
            assignments=_canonical_merge(assignments),
            solver_status_name=solver.status_name(status),
            optimization_proven=False,
            conflict_messages=hard_conflicts(solver) if status == cp_model.INFEASIBLE else None,
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
    preference_deadline = monotonic() + configuration.solver_time_limit_seconds
    feasibility_status = feasibility_solver.solve(model)
    if feasibility_status == cp_model.INFEASIBLE:
        return InternatSolverResult(
            status=GenerationStatus.NO_SOLUTION,
            assignments=[],
            solver_status_name=feasibility_solver.status_name(feasibility_status),
            stage_values={},
            conflict_messages=hard_conflicts(feasibility_solver),
        )
    if feasibility_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return InternatSolverResult(
            status=GenerationStatus.TIME_LIMIT,
            assignments=[],
            solver_status_name=feasibility_solver.status_name(feasibility_status),
            stage_values={},
        )
    feasibility_solver, feasibility_status = improve_days_off(feasibility_solver, feasibility_status, preference_deadline)
    if consecutive_penalties:
        model.add(sum(consecutive_penalties) <= feasibility_solver.value(sum(consecutive_penalties)))
    for variable in x.values():
        model.add_hint(variable, feasibility_solver.value(variable))
    # A later optional quality pass must not undo the morning balance already found.
    model.add(morning_expression <= feasibility_solver.value(morning_expression))
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
