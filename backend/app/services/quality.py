from __future__ import annotations

from collections import defaultdict

from app.models.schemas import (
    CalculatedCareDay,
    QualityBlockDetail,
    ScheduleConfiguration,
    ScheduleQualityReport,
    WeeklyQualitySummary,
    WorkAssignment,
)
from app.services.objective import canonicalize_assignments
from app.services.time_utils import normalize_pairs


def build_quality_report(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
    assignments: list[WorkAssignment],
) -> ScheduleQualityReport:
    canonical = canonicalize_assignments(assignments)
    by_group_date: dict[tuple[str, object], list[WorkAssignment]] = defaultdict(list)
    by_educator_week_date: dict[
        tuple[str, int, object], list[WorkAssignment]
    ] = defaultdict(list)
    for item in canonical:
        by_group_date[(item.group_id, item.date)].append(item)
        week_number = (
            (item.date - configuration.cycle_start_date).days // 7 + 1
        )
        by_educator_week_date[(item.educator_id, week_number, item.date)].append(
            item
        )

    summaries: list[WeeklyQualitySummary] = []
    for week_number in range(1, configuration.planning_horizon_weeks + 1):
        split_work_days = sum(
            max(
                0,
                len(
                    normalize_pairs(
                        [(item.start_minute, item.end_minute) for item in values]
                    )
                )
                - 1,
            )
            for (_, current_week, _), values in by_educator_week_date.items()
            if current_week == week_number
        )
        counts: dict[int, int] = defaultdict(int)
        handovers = 0
        details: list[QualityBlockDetail] = []
        for day in care:
            if day.week_number != week_number:
                continue
            for interval in day.intervals:
                segments = sorted(
                    [
                        item
                        for item in by_group_date[(day.group_id, day.date)]
                        if item.start_minute < interval.end_minute
                        and interval.start_minute < item.end_minute
                    ],
                    key=lambda item: (item.start_minute, item.educator_id),
                )
                educator_ids = [item.educator_id for item in segments]
                block_handovers = sum(
                    first.end_minute == second.start_minute
                    and first.educator_id != second.educator_id
                    for first, second in zip(segments, segments[1:])
                )
                handovers += block_handovers
                number = len(set(educator_ids))
                counts[number] += 1
                if number > 1:
                    details.append(
                        QualityBlockDetail(
                            group_id=day.group_id,
                            date=day.date,
                            start_minute=interval.start_minute,
                            end_minute=interval.end_minute,
                            educator_ids=educator_ids,
                            handovers=block_handovers,
                            explanation=(
                                "Podział pozostał po uwzględnieniu wymiarów "
                                "godzin, niedostępności, odpoczynków i "
                                "ustalonych wzorców weekendowych."
                            ),
                        )
                    )
        summaries.append(
            WeeklyQualitySummary(
                week_number=week_number,
                split_work_days=split_work_days,
                handovers=handovers,
                blocks_with_one_educator=counts[1],
                blocks_with_two_educators=counts[2],
                blocks_with_three_educators=counts[3],
                blocks_with_more_educators=sum(
                    value for key, value in counts.items() if key > 3
                ),
                multi_educator_blocks=details,
            )
        )
    return ScheduleQualityReport(weeks=summaries)
