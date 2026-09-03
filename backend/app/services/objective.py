from __future__ import annotations

from collections import defaultdict

from app.models.schemas import (
    CalculatedCareDay,
    EducatorUnavailability,
    ObjectiveBreakdown,
    ScheduleConfiguration,
    UnavailabilityType,
    WorkAssignment,
)
from app.services.time_utils import normalize_pairs, parse_hhmm
from app.validation.weekend_days_off import weekend_days_off_messages


def _active_unavailability(
    item: EducatorUnavailability,
    *,
    target_date,
    week_number: int,
) -> bool:
    if item.scope == "RECURRING_WEEKLY":
        return item.day_of_week == target_date.weekday()
    if item.scope == "CYCLE_WEEK":
        return item.week_number == week_number and item.day_of_week == target_date.weekday()
    return item.date == target_date


def canonicalize_assignments(
    assignments: list[WorkAssignment],
) -> list[WorkAssignment]:
    """Scala stykające się odcinki tej samej osoby, grupy i daty."""
    result: list[WorkAssignment] = []
    for item in sorted(
        assignments,
        key=lambda value: (
            value.group_id,
            value.date,
            value.educator_id,
            value.start_minute,
            value.end_minute,
        ),
    ):
        if (
            result
            and result[-1].group_id == item.group_id
            and result[-1].date == item.date
            and result[-1].educator_id == item.educator_id
            and result[-1].end_minute == item.start_minute
        ):
            result[-1] = result[-1].model_copy(
                update={"end_minute": item.end_minute}
            )
        else:
            result.append(item)
    return sorted(
        result,
        key=lambda value: (
            value.date,
            value.group_id,
            value.start_minute,
            value.end_minute,
            value.educator_id,
        ),
    )


def calculate_objective(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
    assignments: list[WorkAssignment],
) -> ObjectiveBreakdown:
    step = configuration.organizational_rules.time_step_minutes
    org = configuration.organizational_rules
    canonical_assignments = canonicalize_assignments(assignments)
    by_group_date: dict[tuple[str, object], list[WorkAssignment]] = defaultdict(list)
    by_educator_date: dict[tuple[str, object], list[WorkAssignment]] = defaultdict(list)
    for assignment in canonical_assignments:
        by_group_date[(assignment.group_id, assignment.date)].append(assignment)
        by_educator_date[(assignment.educator_id, assignment.date)].append(assignment)

    handovers = 0
    distinct_educators = 0
    afternoon = 0
    short_middle = 0
    preferred_minute = parse_hhmm(org.preferred_afternoon_handover_time)
    for day in care:
        day_assignments = by_group_date[(day.group_id, day.date)]
        for interval in day.intervals:
            segments = sorted(
                [
                    item
                    for item in day_assignments
                    if item.start_minute < interval.end_minute
                    and interval.start_minute < item.end_minute
                ],
                key=lambda item: (
                    item.start_minute,
                    item.end_minute,
                    item.educator_id,
                ),
            )
            distinct_educators += max(
                0,
                len({item.educator_id for item in segments}) - 1,
            )
            for first, second in zip(segments, segments[1:]):
                if (
                    first.end_minute == second.start_minute
                    and first.educator_id != second.educator_id
                ):
                    handovers += 1
                    if day.day_of_week < 5:
                        afternoon += (
                            abs(first.end_minute - preferred_minute) // step
                        )
            short_middle += sum(
                item.end_minute - item.start_minute
                <= org.short_middle_segment_minutes
                for item in segments[1:-1]
            )

    weekend = 0
    for day in care:
        if day.day_of_week < 5:
            continue
        totals: dict[str, int] = defaultdict(int)
        for item in by_group_date[(day.group_id, day.date)]:
            totals[item.educator_id] += item.end_minute - item.start_minute
        weekend += sum(
            abs(minutes - org.preferred_weekend_split_minutes) // step
            for minutes in totals.values()
        )

    split_days = sum(
        max(
            0,
            len(
                normalize_pairs(
                    [(item.start_minute, item.end_minute) for item in values]
                )
            )
            - 1,
        )
        for values in by_educator_date.values()
    )
    long_segments = sum(
        max(
            0,
            item.end_minute
            - item.start_minute
            - org.preferred_maximum_segment_minutes,
        )
        // step
        for item in canonical_assignments
    )

    preferred_unavailable = 0
    care_week = {
        (item.group_id, item.date): item.week_number for item in care
    }
    for assignment in canonical_assignments:
        week_number = care_week.get(
            (assignment.group_id, assignment.date),
            (assignment.date - configuration.cycle_start_date).days // 7 + 1,
        )
        preferred_pairs: list[tuple[int, int]] = []
        hard_pairs: list[tuple[int, int]] = []
        for item in configuration.unavailability:
            if item.educator_id != assignment.educator_id or not _active_unavailability(
                item,
                target_date=assignment.date,
                week_number=week_number,
            ):
                continue
            pair = (parse_hhmm(item.start_time), parse_hhmm(item.end_time))
            if item.type == UnavailabilityType.HARD:
                hard_pairs.append(pair)
            else:
                preferred_pairs.append(pair)
        preferred = normalize_pairs(preferred_pairs)
        hard = normalize_pairs(hard_pairs)
        for slot_start in range(
            assignment.start_minute,
            assignment.end_minute,
            step,
        ):
            in_preferred = any(
                start <= slot_start < end for start, end in preferred
            )
            in_hard = any(start <= slot_start < end for start, end in hard)
            if in_preferred and not in_hard:
                preferred_unavailable += 1

    score = (
        split_days
        + handovers
        + distinct_educators
        + len(canonical_assignments)
        + short_middle
        + org.afternoon_handover_penalty_weight * afternoon
        + org.weekend_imbalance_penalty_weight * weekend
        + org.long_segment_penalty_weight * long_segments
        + org.preferred_unavailability_penalty_weight * preferred_unavailable
    )
    educator_order = {
        item.id: index for index, item in enumerate(configuration.educators)
    }
    group_order = {
        item.id: index
        for index, item in enumerate(
            sorted(configuration.groups, key=lambda value: value.display_order)
        )
    }
    canonical = sum(
        (
            (assignment.date - configuration.cycle_start_date).days * 10000
            + group_order.get(assignment.group_id, 0) * 1000
            + assignment.start_minute // step * 10
            + educator_order[assignment.educator_id]
            + 1
        )
        for assignment in canonical_assignments
    )
    return ObjectiveBreakdown(
        consecutive_days_off_penalty=sum(
            message.rule_id == "PREF-CONSECUTIVE-DAYS-OFF"
            for message in weekend_days_off_messages(configuration, canonical_assignments)
        ),
        afternoon_penalty=afternoon,
        weekend_penalty=weekend,
        split_days_penalty=split_days,
        continuous_block_handovers=handovers,
        distinct_educators_per_block=distinct_educators,
        total_segments=len(canonical_assignments),
        short_middle_segments=short_middle,
        long_segments_penalty=long_segments,
        preferred_unavailability_penalty=preferred_unavailable,
        objective_score=score,
        canonical_tie_breaker=canonical,
    )


def objective_priority_key(value: ObjectiveBreakdown) -> tuple[int, ...]:
    """Publiczna kolejność porównania jakości, zgodna z celem CP-SAT."""
    return (
        value.consecutive_days_off_penalty,
        value.split_days_penalty,
        value.continuous_block_handovers,
        value.distinct_educators_per_block,
        value.total_segments,
        value.short_middle_segments,
        value.preferred_unavailability_penalty,
        value.long_segments_penalty,
        value.afternoon_penalty,
        value.weekend_penalty,
        value.canonical_tie_breaker,
    )
