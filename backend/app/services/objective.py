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


def calculate_objective(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
    assignments: list[WorkAssignment],
) -> ObjectiveBreakdown:
    step = configuration.organizational_rules.time_step_minutes
    org = configuration.organizational_rules
    by_date: dict[object, list[WorkAssignment]] = defaultdict(list)
    for assignment in assignments:
        by_date[assignment.date].append(assignment)

    afternoon = 0
    preferred_minute = parse_hhmm(org.preferred_afternoon_handover_time)
    for day in care:
        if day.day_of_week >= 5:
            continue
        relevant = next(
            (
                interval
                for interval in day.intervals
                if interval.start_minute <= preferred_minute < interval.end_minute
            ),
            None,
        )
        if relevant is None:
            continue
        day_assignments = sorted(by_date[day.date], key=lambda item: (item.start_minute, item.educator_id))
        starts = {(item.start_minute, item.educator_id) for item in day_assignments}
        for item in day_assignments:
            boundary = item.end_minute
            if not relevant.start_minute < boundary < relevant.end_minute:
                continue
            if any(start == boundary and educator_id != item.educator_id for start, educator_id in starts):
                afternoon += abs(boundary - preferred_minute) // step

    weekend = 0
    for day in care:
        if day.day_of_week < 5:
            continue
        totals: dict[str, int] = defaultdict(int)
        for item in by_date[day.date]:
            totals[item.educator_id] += item.end_minute - item.start_minute
        weekend += sum(
            abs(minutes - org.preferred_weekend_split_minutes) // step
            for minutes in totals.values()
        )

    segments_per_day: dict[tuple[str, object], int] = defaultdict(int)
    long_segments = 0
    for item in assignments:
        segments_per_day[(item.educator_id, item.date)] += 1
        long_segments += max(
            0,
            item.end_minute
            - item.start_minute
            - org.preferred_maximum_segment_minutes,
        ) // step
    split_days = sum(max(0, count - 1) for count in segments_per_day.values())

    preferred_unavailable = 0
    for educator in configuration.educators:
        for day in care:
            week_number = day.week_number
            preferred_pairs: list[tuple[int, int]] = []
            hard_pairs: list[tuple[int, int]] = []
            for item in configuration.unavailability:
                if item.educator_id != educator.id or not _active_unavailability(
                    item,
                    target_date=day.date,
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
            for assignment in by_date[day.date]:
                if assignment.educator_id != educator.id:
                    continue
                for slot_start in range(assignment.start_minute, assignment.end_minute, step):
                    in_preferred = any(start <= slot_start < end for start, end in preferred)
                    in_hard = any(start <= slot_start < end for start, end in hard)
                    if in_preferred and not in_hard:
                        preferred_unavailable += 1

    score = (
        org.afternoon_handover_penalty_weight * afternoon
        + org.weekend_imbalance_penalty_weight * weekend
        + org.split_day_penalty_weight * split_days
        + org.long_segment_penalty_weight * long_segments
        + org.preferred_unavailability_penalty_weight * preferred_unavailable
    )
    educator_order = {item.id: index for index, item in enumerate(configuration.educators)}
    canonical = sum(
        (
            (assignment.date - configuration.cycle_start_date).days * 144
            + assignment.start_minute // step * 3
            + educator_order[assignment.educator_id]
            + 1
        )
        for assignment in sorted(
            assignments,
            key=lambda item: (
                item.date,
                item.start_minute,
                item.end_minute,
                item.educator_id,
            ),
        )
    )
    return ObjectiveBreakdown(
        afternoon_penalty=afternoon,
        weekend_penalty=weekend,
        split_days_penalty=split_days,
        long_segments_penalty=long_segments,
        preferred_unavailability_penalty=preferred_unavailable,
        objective_score=score,
        canonical_tie_breaker=canonical,
    )
