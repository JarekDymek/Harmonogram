from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from app.domain import rules
from app.validation.work_calendar import commitment_messages, night_assignment_messages, combined_limit_messages
from app.validation.weekend_days_off import weekend_days_off_messages
from app.models.schemas import (
    CalculatedCareDay,
    CareInterval,
    DomainMessage,
    LegalStatus,
    OperationMode,
    PlanScope,
    PublicResult,
    ScheduleConfiguration,
    ScheduleBoundaryMode,
    UnavailabilityScope,
    UnavailabilityType,
    ValidationReport,
    ValidationStatus,
    WeeklyRestAttributionMode,
    WeeklyRestWindowType,
    WorkAssignment,
)
from app.services.objective import calculate_objective, canonicalize_assignments
from app.services.reports import error, warning
from app.services.time_utils import (
    TimeDomainError,
    aware_local_datetime,
    format_hhmm,
    is_subset,
    normalize_pairs,
    parse_hhmm,
    subtract_pairs,
    zone,
)
from app.services.weekend import selected_weekend_variant, template_tuples


def _select_plan_independently(
    configuration: ScheduleConfiguration,
    target_date: date,
    week_number: int,
):
    exact = [
        item
        for item in configuration.day_plans
        if item.approved
        and item.scope == PlanScope.SPECIFIC_DATE
        and item.date == target_date
    ]
    cycle = [
        item
        for item in configuration.day_plans
        if item.approved
        and item.scope == PlanScope.CYCLE_WEEK
        and item.week_number == week_number
        and item.day_of_week == target_date.weekday()
    ]
    base = [
        item
        for item in configuration.day_plans
        if item.approved
        and item.scope == PlanScope.BASE_WEEKLY
        and item.day_of_week == target_date.weekday()
    ]
    selected = exact or cycle or base
    if len(selected) != 1:
        raise ValueError(
            f"Niezależny walidator znalazł {len(selected)} skutecznych planów "
            f"dla daty {target_date}."
        )
    return selected[0]


def calculate_care_independently(
    configuration: ScheduleConfiguration,
) -> list[CalculatedCareDay]:
    """Celowo nie korzysta z kalkulatora używanego przed solverem."""
    step = configuration.organizational_rules.time_step_minutes
    result: list[CalculatedCareDay] = []
    for day_index in range(configuration.planning_horizon_weeks * 7):
        target_date = configuration.cycle_start_date + timedelta(days=day_index)
        week_number = day_index // 7 + 1
        plan = _select_plan_independently(
            configuration,
            target_date,
            week_number,
        )
        operating = normalize_pairs(
            [
                (parse_hhmm(item.start_time), parse_hhmm(item.end_time))
                for item in plan.operating_intervals
            ]
        )
        no_care = normalize_pairs(
            [
                (parse_hhmm(item.start_time), parse_hhmm(item.end_time))
                for item in plan.no_care_intervals
            ]
        )
        if not is_subset(no_care, operating):
            raise ValueError(
                f"Plan {plan.id} ma przedział bez opieki poza godzinami działania."
            )
        pairs = subtract_pairs(operating, no_care)
        result.append(
            CalculatedCareDay(
                group_id=configuration.group_id or "",
                date=target_date,
                week_number=week_number,
                day_of_week=target_date.weekday(),
                applied_day_plan_id=plan.id,
                intervals=[
                    CareInterval(
                        start_minute=start,
                        end_minute=end,
                        required_staff_count=1,
                    )
                    for start, end in pairs
                ],
                total_required_minutes=sum(end - start for start, end in pairs),
            )
        )
    return result


def _active_unavailability(item, target_date: date, week_number: int) -> bool:
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


def _assignment_shape_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    step = configuration.organizational_rules.time_step_minutes
    minimum = configuration.organizational_rules.minimum_segment_minutes
    educator_ids = {item.id for item in configuration.educators if item.active}
    horizon_days = configuration.planning_horizon_weeks * 7
    cycle_end = configuration.cycle_start_date + timedelta(days=horizon_days)
    for item in assignments:
        if item.educator_id not in educator_ids:
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Przydział wskazuje nieznanego wychowawcę.",
                    educator_id=item.educator_id,
                    date_value=item.date,
                )
            )
        if not configuration.cycle_start_date <= item.date < cycle_end:
            messages.append(
                error(
                    rules.RULE_CROSS_WEEK,
                    "Przydział znajduje się poza wybranym horyzontem planowania.",
                    educator_id=item.educator_id,
                    date_value=item.date,
                )
            )
        if (
            item.start_minute < 0
            or item.end_minute > 1440
            or item.end_minute <= item.start_minute
        ):
            messages.append(
                error(
                    rules.RULE_SAME_DAY,
                    "Odcinek ma niepoprawne granice albo przechodzi przez północ.",
                    educator_id=item.educator_id,
                    date_value=item.date,
                    actual=f"{item.start_minute}–{item.end_minute}",
                )
            )
            continue
        if item.start_minute % step or item.end_minute % step:
            messages.append(
                error(
                    rules.RULE_TIME_STEP,
                    "Granice przydziału nie są zgodne z krokiem 30 minut.",
                    educator_id=item.educator_id,
                    date_value=item.date,
                    start_time=format_hhmm(item.start_minute),
                    end_time=format_hhmm(item.end_minute),
                )
            )
        if item.end_minute - item.start_minute < minimum:
            messages.append(
                error(
                    rules.RULE_SEGMENT_MIN,
                    "Odcinek jest krótszy niż wymagane minimum.",
                    educator_id=item.educator_id,
                    date_value=item.date,
                    required=minimum,
                    actual=item.end_minute - item.start_minute,
                )
            )
        try:
            aware_local_datetime(
                item.date,
                item.start_minute,
                configuration.time_zone_id,
            )
            aware_local_datetime(
                item.date,
                item.end_minute,
                configuration.time_zone_id,
            )
        except TimeDomainError as exc:
            messages.append(
                error(
                    rules.RULE_SAME_DAY,
                    str(exc),
                    educator_id=item.educator_id,
                    date_value=item.date,
                )
            )
    return messages


def _coverage_messages(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    step = configuration.organizational_rules.time_step_minutes
    by_date: dict[date, list[WorkAssignment]] = defaultdict(list)
    for item in assignments:
        by_date[item.date].append(item)
    for day in care:
        required_slots = {
            slot
            for interval in day.intervals
            for slot in range(
                interval.start_minute // step,
                interval.end_minute // step,
            )
        }
        for slot in range(1440 // step):
            minute = slot * step
            count = sum(
                item.start_minute <= minute < item.end_minute
                for item in by_date[day.date]
            )
            if slot in required_slots and count == 0:
                messages.append(
                    error(
                        rules.RULE_COVERAGE,
                        "Brak wychowawcy w wymaganym slocie.",
                        date_value=day.date,
                        start_time=format_hhmm(minute),
                        end_time=format_hhmm(minute + step),
                        required=1,
                        actual=0,
                    )
                )
            elif slot in required_slots and count > 1:
                messages.append(
                    error(
                        rules.RULE_STAFFING,
                        "W wymaganym slocie przypisano więcej niż jedną osobę.",
                        date_value=day.date,
                        start_time=format_hhmm(minute),
                        end_time=format_hhmm(minute + step),
                        required=1,
                        actual=count,
                    )
                )
            elif slot not in required_slots and count:
                messages.append(
                    error(
                        rules.RULE_NO_OUTSIDE,
                        "Przydział znajduje się poza zapotrzebowaniem.",
                        date_value=day.date,
                        start_time=format_hhmm(minute),
                        end_time=format_hhmm(minute + step),
                        required=0,
                        actual=count,
                    )
                )
    return messages


def _hours_and_days_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    for educator in configuration.educators:
        if not educator.active:
            continue
        for week_number in range(
            1, configuration.planning_horizon_weeks + 1
        ):
            start = configuration.cycle_start_date + timedelta(
                days=(week_number - 1) * 7
            )
            end = start + timedelta(days=7)
            relevant = [
                item
                for item in assignments
                if item.educator_id == educator.id and start <= item.date < end
            ]
            actual_minutes = sum(
                item.end_minute - item.start_minute for item in relevant
            )
            required_minutes = _assigned_minutes(
                configuration,
                educator.id,
                week_number,
            )
            if actual_minutes != required_minutes:
                messages.append(
                    error(
                        rules.RULE_HOURS,
                        "Tygodniowy przydział godzin nie jest dokładny.",
                        educator_id=educator.id,
                        date_value=start,
                        required=required_minutes,
                        actual=actual_minutes,
                        context={"weekNumber": week_number},
                    )
                )
            actual_days = len({item.date for item in relevant})
            required_days = (
                configuration.organizational_rules.required_work_days_per_week
            )
            if actual_days != required_days:
                messages.append(
                    error(
                        rules.RULE_DAYS,
                        f"Plan zawiera {actual_days} dni pracy zamiast pięciu. Wygeneruj plan ponownie; nie zmieniaj sumy godzin tylko po to, by ukryć ten błąd.",
                        educator_id=educator.id,
                        date_value=start,
                        required=required_days,
                        actual=actual_days,
                        context={"weekNumber": week_number},
                    )
                )
    return messages


def _unavailability_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    for unavailable in configuration.unavailability:
        if unavailable.type != UnavailabilityType.HARD:
            continue
        start = parse_hhmm(unavailable.start_time)
        end = parse_hhmm(unavailable.end_time)
        for assignment in assignments:
            if (
                assignment.educator_id == unavailable.educator_id
                and _active_unavailability(
                    unavailable,
                    assignment.date,
                    (assignment.date - configuration.cycle_start_date).days // 7
                    + 1,
                )
                and max(start, assignment.start_minute)
                < min(end, assignment.end_minute)
            ):
                messages.append(
                    error(
                        rules.RULE_HARD_UNAVAILABLE,
                        "Przydział przecina twardą niedostępność.",
                        educator_id=assignment.educator_id,
                        date_value=assignment.date,
                        start_time=format_hhmm(max(start, assignment.start_minute)),
                        end_time=format_hhmm(min(end, assignment.end_minute)),
                    )
                )
    return messages


def _utc_interval(
    configuration: ScheduleConfiguration,
    item: WorkAssignment,
    *,
    date_shift: int = 0,
) -> tuple[datetime, datetime]:
    shifted = item.date + timedelta(days=date_shift)
    return (
        aware_local_datetime(
            shifted,
            item.start_minute,
            configuration.time_zone_id,
        ).astimezone(UTC),
        aware_local_datetime(
            shifted,
            item.end_minute,
            configuration.time_zone_id,
        ).astimezone(UTC),
    )


def _daily_rest_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    minimum = configuration.legal_rules.minimum_daily_rest_minutes
    horizon_days = configuration.planning_horizon_weeks * 7
    cyclic = (
        configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    )
    boundary_by_educator = {
        item.educator_id: item
        for item in (
            configuration.boundary_context.educators
            if configuration.boundary_context is not None
            else []
        )
    }

    def append_if_short(
        educator_id: str,
        previous_date: date,
        previous_end: int,
        next_date: date,
        next_start: int,
        *,
        boundary: bool,
    ) -> None:
        last_end = aware_local_datetime(
            previous_date,
            previous_end,
            configuration.time_zone_id,
        ).astimezone(UTC)
        first_start = aware_local_datetime(
            next_date,
            next_start,
            configuration.time_zone_id,
        ).astimezone(UTC)
        actual = int((first_start - last_end).total_seconds() // 60)
        if previous_end == 1440 and next_start == 0 and next_date == previous_date + timedelta(days=1):
            return
        if actual < minimum:
            messages.append(
                error(
                    rules.RULE_CROSS_WEEK if boundary else rules.RULE_REST_DAILY,
                    "Rzeczywisty odpoczynek dobowy jest za krótki.",
                    educator_id=educator_id,
                    date_value=previous_date,
                    required=minimum,
                    actual=actual,
                    context={"nextWorkDate": next_date.isoformat()},
                )
            )

    for educator in configuration.educators:
        if not educator.active:
            continue
        by_date: dict[date, list[WorkAssignment]] = defaultdict(list)
        for item in assignments:
            if item.educator_id == educator.id:
                by_date[item.date].append(item)
        work_dates = sorted(by_date)
        for previous_date, next_date in zip(work_dates, work_dates[1:]):
            previous_end = max(
                item.end_minute for item in by_date[previous_date]
            )
            next_start = min(
                item.start_minute for item in by_date[next_date]
            )
            # Jedna służba przechodząca przez północ jest ciągłą pracą, a nie
            # dwiema zmianami, między którymi należałoby zapewnić odpoczynek.
            if (
                next_date == previous_date + timedelta(days=1)
                and previous_end == 1440
                and next_start == 0
            ):
                continue
            append_if_short(
                educator.id,
                previous_date,
                previous_end,
                next_date,
                next_start,
                boundary=False,
            )
        if cyclic and work_dates:
            append_if_short(
                educator.id,
                work_dates[-1],
                max(item.end_minute for item in by_date[work_dates[-1]]),
                work_dates[0] + timedelta(days=horizon_days),
                min(item.start_minute for item in by_date[work_dates[0]]),
                boundary=True,
            )
        if not cyclic:
            boundary = boundary_by_educator.get(educator.id)
            if (
                boundary is not None
                and boundary.last_assignment_before is not None
                and work_dates
            ):
                previous = boundary.last_assignment_before
                append_if_short(
                    educator.id,
                    previous.date,
                    previous.end_minute,
                    work_dates[0],
                    min(item.start_minute for item in by_date[work_dates[0]]),
                    boundary=True,
                )
            if (
                boundary is not None
                and boundary.first_assignment_after is not None
                and work_dates
            ):
                following = boundary.first_assignment_after
                append_if_short(
                    educator.id,
                    work_dates[-1],
                    max(item.end_minute for item in by_date[work_dates[-1]]),
                    following.date,
                    following.start_minute,
                    boundary=True,
                )
    return messages


def _merged_utc_work(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
    educator_id: str,
) -> list[tuple[datetime, datetime]]:
    raw = []
    horizon_days = configuration.planning_horizon_weeks * 7
    cyclic = (
        configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    )
    for item in assignments:
        if item.educator_id != educator_id:
            continue
        if cyclic:
            raw.append(
                _utc_interval(
                    configuration,
                    item,
                    date_shift=-horizon_days,
                )
            )
        raw.append(_utc_interval(configuration, item))
        if cyclic:
            raw.append(
                _utc_interval(
                    configuration,
                    item,
                    date_shift=horizon_days,
                )
            )
    raw.sort()
    merged: list[list[datetime]] = []
    for start, end in raw:
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return [(start, end) for start, end in merged]


def _maximum_free_minutes(
    work: list[tuple[datetime, datetime]],
    start: datetime,
    end: datetime,
) -> int:
    cursor = start
    maximum = 0
    for work_start, work_end in work:
        if work_end <= start:
            continue
        if work_start >= end:
            break
        clipped_start = max(start, work_start)
        clipped_end = min(end, work_end)
        if clipped_start > cursor:
            maximum = max(
                maximum,
                int((clipped_start - cursor).total_seconds() // 60),
            )
        cursor = max(cursor, clipped_end)
    maximum = max(maximum, int((end - cursor).total_seconds() // 60))
    return maximum


def _global_free_periods(
    work: list[tuple[datetime, datetime]],
    *,
    boundary_start: datetime | None = None,
    boundary_end: datetime | None = None,
) -> list[tuple[datetime, datetime]]:
    result = [
        (current_end, next_start)
        for (_, current_end), (next_start, _) in zip(work, work[1:])
        if next_start > current_end
    ]
    if boundary_start is not None and boundary_end is not None:
        relevant = [
            (start, end)
            for start, end in work
            if end > boundary_start and start < boundary_end
        ]
        if not relevant:
            return [(boundary_start, boundary_end)]
        if relevant[0][0] > boundary_start:
            result.append((boundary_start, min(relevant[0][0], boundary_end)))
        if relevant[-1][1] < boundary_end:
            result.append((max(relevant[-1][1], boundary_start), boundary_end))
        result.sort()
    return result


def _rest_options(
    free_periods: list[tuple[datetime, datetime]],
    window_start: datetime,
    window_end: datetime,
    minimum_minutes: int,
    attribution_mode: WeeklyRestAttributionMode,
) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    for period_index, (rest_start, rest_end) in enumerate(free_periods):
        if attribution_mode == WeeklyRestAttributionMode.FULLY_CONTAINED:
            if rest_start < window_start or rest_end > window_end:
                continue
            attributed = int((rest_end - rest_start).total_seconds() // 60)
        else:
            overlap_start = max(window_start, rest_start)
            overlap_end = min(window_end, rest_end)
            attributed = max(
                0,
                int((overlap_end - overlap_start).total_seconds() // 60),
            )
        if attributed >= minimum_minutes:
            result.append((period_index, attributed))
    return result


def _has_distinct_rest_assignment(
    options_by_window: list[list[int]],
) -> bool:
    """Dopasowanie okien do różnych maksymalnych okresów odpoczynku."""
    owner_by_period: dict[int, int] = {}

    def assign(window_index: int, visited: set[int]) -> bool:
        for period_index in options_by_window[window_index]:
            if period_index in visited:
                continue
            visited.add(period_index)
            current_owner = owner_by_period.get(period_index)
            if current_owner is None or assign(current_owner, visited):
                owner_by_period[period_index] = window_index
                return True
        return False

    return all(assign(index, set()) for index in range(len(options_by_window)))


def _weekly_windows(
    configuration: ScheduleConfiguration,
) -> list[tuple[datetime, datetime]]:
    legal = configuration.legal_rules
    horizon_days = configuration.planning_horizon_weeks * 7
    cyclic = (
        configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    )
    step = configuration.organizational_rules.time_step_minutes
    anchor_minute = parse_hhmm(legal.weekly_rest_anchor_time)
    anchor_slot = anchor_minute // step
    anchor_day_offset = (
        legal.weekly_rest_anchor_day_of_week
        - configuration.cycle_start_date.weekday()
    ) % 7
    first_anchor_index = (
        anchor_day_offset * rules.SLOTS_PER_DAY + anchor_slot
    )
    if first_anchor_index > 0:
        first_anchor_index -= 7 * rules.SLOTS_PER_DAY

    def local_boundary_utc(index: int) -> datetime:
        day_index, slot = divmod(index, rules.SLOTS_PER_DAY)
        return aware_local_datetime(
            configuration.cycle_start_date + timedelta(days=day_index),
            slot * step,
            configuration.time_zone_id,
        ).astimezone(UTC)

    cycle_end = aware_local_datetime(
        configuration.cycle_start_date + timedelta(days=horizon_days),
        0,
        configuration.time_zone_id,
    ).astimezone(UTC)
    if legal.weekly_rest_window_type == WeeklyRestWindowType.FIXED_LOCAL_WEEK:
        result = []
        window_slots = legal.weekly_rest_window_length_minutes // step
        cursor = first_anchor_index
        horizon_slots = horizon_days * rules.SLOTS_PER_DAY
        while cursor < horizon_slots:
            if cyclic or (
                cursor >= 0 and cursor + window_slots <= horizon_slots
            ):
                result.append(
                    (
                        local_boundary_utc(cursor),
                        local_boundary_utc(cursor + window_slots),
                    )
                )
            cursor += 7 * rules.SLOTS_PER_DAY
        return result
    result = []
    start = local_boundary_utc(first_anchor_index)
    horizon_start = aware_local_datetime(
        configuration.cycle_start_date,
        0,
        configuration.time_zone_id,
    ).astimezone(UTC)
    while start < cycle_end:
        end = start + timedelta(
            minutes=legal.weekly_rest_window_length_minutes
        )
        if cyclic or (start >= horizon_start and end <= cycle_end):
            result.append((start, end))
        start += timedelta(minutes=legal.weekly_rest_window_step_minutes)
    return result


def _weekly_rest_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    legal = configuration.legal_rules
    windows = _weekly_windows(configuration)
    cyclic = (
        configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    )
    horizon_start = aware_local_datetime(
        configuration.cycle_start_date,
        0,
        configuration.time_zone_id,
    ).astimezone(UTC)
    horizon_end = aware_local_datetime(
        configuration.cycle_start_date
        + timedelta(days=configuration.planning_horizon_weeks * 7),
        0,
        configuration.time_zone_id,
    ).astimezone(UTC)
    for educator in configuration.educators:
        if not educator.active:
            continue
        work = _merged_utc_work(configuration, assignments, educator.id)
        # A registry entry without any work has no rest deficit. In a cyclic
        # horizon there are no neighbouring shifts from which to construct
        # free periods; treating that empty list as zero rest rejects valid
        # plans after removing a membership. Required hours/coverage are
        # checked separately, and any real school/night/other-group duty is
        # already included in `assignments` by the global validator.
        if not work:
            continue
        free_periods = _global_free_periods(
            work,
            boundary_start=None if cyclic else horizon_start,
            boundary_end=None if cyclic else horizon_end,
        )
        exceptions: list[datetime] = []
        reusable_options: list[list[int]] = []
        for window_index, (window_start, window_end) in enumerate(windows, start=1):
            normal_options = _rest_options(
                free_periods,
                window_start,
                window_end,
                legal.minimum_weekly_rest_minutes,
                legal.weekly_rest_attribution_mode,
            )
            maximum = max(
                (
                    attributed
                    for _, attributed in _rest_options(
                        free_periods,
                        window_start,
                        window_end,
                        0,
                        legal.weekly_rest_attribution_mode,
                    )
                ),
                default=0,
            )
            if normal_options:
                reusable_options.append(
                    [period_index for period_index, _ in normal_options]
                )
                continue
            exception_minimum = legal.weekly_rest_exception_minimum_minutes or 0
            exception_options = _rest_options(
                free_periods,
                window_start,
                window_end,
                exception_minimum,
                legal.weekly_rest_attribution_mode,
            )
            if legal.weekly_rest_exception_enabled and exception_options:
                exceptions.append(window_start)
                reusable_options.append(
                    [period_index for period_index, _ in exception_options]
                )
                if legal.weekly_rest_compensation_required:
                    deadline = window_end + timedelta(
                        minutes=legal.weekly_rest_compensation_deadline_minutes or 0
                    )
                    compensation = _maximum_free_minutes(
                        work,
                        window_end,
                        deadline,
                    )
                    if compensation < (
                        legal.weekly_rest_compensation_minutes or 0
                    ):
                        messages.append(
                            error(
                                rules.RULE_REST_WEEKLY,
                                "Nie zapewniono wymaganej kompensacji odpoczynku.",
                                educator_id=educator.id,
                                required=legal.weekly_rest_compensation_minutes,
                                actual=compensation,
                                context={"windowNumber": window_index},
                            )
                        )
                continue
            messages.append(
                error(
                    rules.RULE_REST_WEEKLY,
                    "Brak wymaganego nieprzerwanego odpoczynku tygodniowego.",
                    educator_id=educator.id,
                    required=legal.minimum_weekly_rest_minutes,
                    actual=maximum,
                    context={"windowNumber": window_index},
                )
            )
        if (
            not legal.weekly_rest_reuse_across_windows_allowed
            and len(reusable_options) == len(windows)
            and not _has_distinct_rest_assignment(reusable_options)
        ):
            messages.append(
                error(
                    rules.RULE_REST_WEEKLY,
                    "Ten sam maksymalny okres odpoczynku musiałby zostać ponownie użyty w kilku oknach, choć profil tego zabrania.",
                    educator_id=educator.id,
                    required="odrębny okres odpoczynku dla każdego okna",
                    actual="brak pełnego dopasowania",
                )
            )
        maximum_exceptions = (
            legal.weekly_rest_exception_maximum_occurrences_per_cycle or 0
        )
        if len(exceptions) > maximum_exceptions:
            messages.append(
                error(
                    rules.RULE_REST_WEEKLY,
                    "Przekroczono liczbę wyjątków odpoczynku tygodniowego.",
                    educator_id=educator.id,
                    required=maximum_exceptions,
                    actual=len(exceptions),
                )
            )
        minimum_gap = legal.weekly_rest_exception_minimum_gap_minutes or 0
        for first, second in zip(exceptions, exceptions[1:]):
            actual_gap = int((second - first).total_seconds() // 60)
            if actual_gap < minimum_gap:
                messages.append(
                    error(
                        rules.RULE_REST_WEEKLY,
                        "Wyjątki odpoczynku tygodniowego są zbyt blisko siebie.",
                        educator_id=educator.id,
                        required=minimum_gap,
                        actual=actual_gap,
                    )
                )
    return messages


def _weekend_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    for week_number in range(
        1, configuration.planning_horizon_weeks + 1
    ):
        saturday = configuration.cycle_start_date + timedelta(
            days=(week_number - 1) * 7 + 5
        )
        sunday = saturday + timedelta(days=1)
        variant = selected_weekend_variant(
            configuration,
            week_number=week_number,
            saturday=saturday,
            sunday=sunday,
        )
        for target_date, template in (
            (saturday, variant.saturday_template),
            (sunday, variant.sunday_template),
        ):
            expected = [
                (sequence, educator_id, start, end)
                for sequence, educator_id, start, end in template_tuples(template)
            ]
            actual_items = sorted(
                [item for item in assignments if item.date == target_date],
                key=lambda item: (
                    item.start_minute,
                    item.end_minute,
                    item.educator_id,
                ),
            )
            actual = [
                (
                    sequence,
                    item.educator_id,
                    item.start_minute,
                    item.end_minute,
                )
                for sequence, item in enumerate(actual_items, start=1)
            ]
            if actual != expected:
                messages.append(
                    error(
                        rules.RULE_WEEKEND,
                        "Rzeczywiste krotki weekendu nie są identyczne z zatwierdzonym wzorcem.",
                        date_value=target_date,
                        required=str(expected),
                        actual=str(actual),
                        context={"variantId": variant.id},
                    )
                )

    if not (
        configuration.educator_count == 3
        and configuration.planning_horizon_weeks == rules.ROTATION_WEEKS
        and configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
    ):
        return messages

    off_counts: Counter[str] = Counter()
    pair_counts: Counter[tuple[str, str]] = Counter()
    for week_number in range(1, rules.ROTATION_WEEKS + 1):
        saturday = configuration.cycle_start_date + timedelta(
            days=(week_number - 1) * 7 + 5
        )
        variant = selected_weekend_variant(
            configuration,
            week_number=week_number,
            saturday=saturday,
            sunday=saturday + timedelta(days=1),
        )
        if variant.off_educator_id is not None:
            off_counts[variant.off_educator_id] += 1
        working = sorted(
            {
                educator_id
                for template in (
                    variant.saturday_template,
                    variant.sunday_template,
                )
                for _, educator_id, _, _ in template_tuples(template)
            }
        )
        if len(working) == 2:
            pair_counts[(working[0], working[1])] += 1
    for educator in configuration.educators:
        if educator.active and off_counts[educator.id] != 2:
            messages.append(
                error(
                    rules.RULE_ROTATION,
                    "Wychowawca nie ma dokładnie dwóch wolnych weekendów.",
                    educator_id=educator.id,
                    required=2,
                    actual=off_counts[educator.id],
                )
            )
    if sorted(pair_counts.values()) != [2, 2, 2]:
        messages.append(
            error(
                rules.RULE_ROTATION,
                "Każda para musi wspólnie pracować dokładnie dwa weekendy.",
                required="[2, 2, 2]",
                actual=str(sorted(pair_counts.values())),
            )
        )
    return messages


def _absolute_limits_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    daily_limit = configuration.legal_rules.maximum_absolute_daily_work_minutes
    segment_limit = configuration.legal_rules.maximum_absolute_segment_minutes
    totals: dict[tuple[str, date], int] = defaultdict(int)
    for item in assignments:
        duration = item.end_minute - item.start_minute
        totals[(item.educator_id, item.date)] += duration
        if segment_limit is not None and duration > segment_limit:
            messages.append(
                error(
                    rules.RULE_LEGAL,
                    "Odcinek przekracza bezwzględny limit profilu prawnego.",
                    educator_id=item.educator_id,
                    date_value=item.date,
                    required=segment_limit,
                    actual=duration,
                )
            )
    if daily_limit is not None:
        for (educator_id, target_date), actual in totals.items():
            if actual > daily_limit:
                messages.append(
                    error(
                        rules.RULE_LEGAL,
                        "Dzienny czas pracy przekracza bezwzględny limit profilu prawnego.",
                        educator_id=educator_id,
                        date_value=target_date,
                        required=daily_limit,
                        actual=actual,
                    )
                )
    return messages


def _external_as_assignments(
    configuration: ScheduleConfiguration,
) -> list[WorkAssignment]:
    result = list(configuration.locked_assignments)
    result.extend(a for a in configuration.required_assignments if a.group_id not in configuration.selected_group_ids)
    time_zone_id = configuration.time_zone_id
    project_zone = zone(time_zone_id)
    for duty in configuration.external_duty_assignments:
        if not duty.locked:
            continue
        start = duty.start_date_time.astimezone(project_zone)
        end = duty.end_date_time.astimezone(project_zone)
        current_date = start.date()
        while current_date <= end.date():
            start_minute = (
                start.hour * 60 + start.minute
                if current_date == start.date()
                else 0
            )
            end_minute = (
                end.hour * 60 + end.minute
                if current_date == end.date()
                else 1440
            )
            in_cycle = configuration.cycle_start_date <= current_date < configuration.cycle_start_date + timedelta(days=7 * configuration.planning_horizon_weeks)
            if end_minute > start_minute and (configuration.schedule_boundary_mode != ScheduleBoundaryMode.CYCLIC or in_cycle):
                # Konwersja granic jest wykonywana ponownie, niezależnie od solvera.
                aware_local_datetime(current_date, start_minute, time_zone_id)
                aware_local_datetime(current_date, end_minute, time_zone_id)
                result.append(
                    WorkAssignment(
                        group_id="EXTERNAL",
                        educator_id=duty.educator_id,
                        date=current_date,
                        start_minute=start_minute,
                        end_minute=end_minute,
                    )
                )
            current_date += timedelta(days=1)
    return result


def _no_return_messages(
    care: list[CalculatedCareDay],
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    canonical = canonicalize_assignments(assignments)
    by_group_date: dict[tuple[str, date], list[WorkAssignment]] = defaultdict(list)
    for item in canonical:
        by_group_date[(item.group_id, item.date)].append(item)
    for day in care:
        for interval in day.intervals:
            segments = sorted(
                [
                    item
                    for item in by_group_date[(day.group_id, day.date)]
                    if item.start_minute < interval.end_minute
                    and interval.start_minute < item.end_minute
                ],
                key=lambda item: (item.start_minute, item.end_minute),
            )
            sequence = [item.educator_id for item in segments]
            seen: set[str] = set()
            previous: str | None = None
            for educator_id in sequence:
                if educator_id in seen and educator_id != previous:
                    messages.append(
                        error(
                            rules.RULE_NO_RETURN_WITHIN_BLOCK,
                            "Wychowawca wraca po odcinku innej osoby w tym samym ciągłym bloku opieki.",
                            group_id=day.group_id,
                            educator_id=educator_id,
                            date_value=day.date,
                            start_time=format_hhmm(interval.start_minute),
                            end_time=format_hhmm(interval.end_minute),
                            required="każda osoba najwyżej w jednym ciągu",
                            actual="–".join(sequence),
                        )
                    )
                    break
                seen.add(educator_id)
                previous = educator_id
    return messages


def _cross_group_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
    *, complete: bool = False,
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    all_assignments = canonicalize_assignments(
        [*assignments, *_external_as_assignments(configuration)]
    )
    by_educator: dict[str, list[WorkAssignment]] = defaultdict(list)
    for item in all_assignments:
        by_educator[item.educator_id].append(item)
    for educator_id, values in by_educator.items():
        ordered = sorted(
            values,
            key=lambda item: (
                item.date,
                item.start_minute,
                item.end_minute,
                item.group_id,
            ),
        )
        for first_index, first in enumerate(ordered):
            for second in ordered[first_index + 1 :]:
                if second.date > first.date:
                    break
                if second.start_minute >= first.end_minute:
                    break
                messages.append(
                    error(
                        rules.RULE_CROSS_GROUP_NO_OVERLAP,
                        "Wychowawca ma nakładające się przydziały w grupach albo dyżurach.",
                        educator_id=educator_id,
                        date_value=first.date,
                        start_time=format_hhmm(
                            max(first.start_minute, second.start_minute)
                        ),
                        end_time=format_hhmm(
                            min(first.end_minute, second.end_minute)
                        ),
                        actual=f"{first.group_id} + {second.group_id}",
                    )
                )

    rest_messages = [
        *_daily_rest_messages(configuration, all_assignments),
        *_weekly_rest_messages(configuration, all_assignments),
    ]
    for item in rest_messages:
        messages.append(
            item.model_copy(
                update={
                    "rule_id": rules.RULE_CROSS_GROUP_REST,
                    "context": {
                        **item.context,
                        "relatedRuleId": item.rule_id,
                    },
                }
            )
        )

    messages.extend(combined_limit_messages(configuration, all_assignments))
    for duty in configuration.external_duty_assignments:
        if duty.locked and duty.duty_type != "NIGHT":
            single = configuration.model_copy(update={"external_duty_assignments": [duty], "locked_assignments": []})
            messages.extend(night_assignment_messages(configuration, _external_as_assignments(single)))

    required_days = configuration.organizational_rules.required_work_days_per_week
    external_start_dates = {
        (
            duty.educator_id,
            duty.start_date_time.astimezone(
                zone(configuration.time_zone_id)
            ).date(),
        )
        for duty in configuration.external_duty_assignments
        if duty.locked
    }
    relevant_ids = {
        item.educator_id
        for item in configuration.group_memberships
        if item.active and item.group_id in set(configuration.selected_group_ids)
    }
    for educator_id in relevant_ids:
        for week_number in range(1, configuration.planning_horizon_weeks + 1):
            start = configuration.cycle_start_date + timedelta(
                days=(week_number - 1) * 7
            )
            end = start + timedelta(days=7)
            days = {
                item.date
                for item in all_assignments
                if item.educator_id == educator_id
                and start <= item.date < end
            }
            days.update(
                duty_date
                for duty_educator_id, duty_date in external_start_dates
                if duty_educator_id == educator_id and start <= duty_date < end
            )
            if len(days) > required_days or (complete and len(days) != required_days):
                messages.append(
                    error(
                        rules.RULE_DAYS,
                        f"Szkoła, internat i obie daty nocki zajmują łącznie {len(days)} dni zamiast pięciu. Wygeneruj plan ponownie; każdy tydzień musi mieć pięć dni pracy i dwa całkowicie wolne.",
                        educator_id=educator_id,
                        date_value=start,
                        required=required_days,
                        actual=len(days),
                        context={"weekNumber": week_number, "workDates": [str(d) for d in sorted(days)]},
                    )
                )
    return messages


def _validate_internat_schedule(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
    calculated_care: list[CalculatedCareDay] | None,
) -> ValidationReport:
    active_groups = configuration.active_groups()
    sole_group_id = active_groups[0].id if len(active_groups) == 1 else None
    normalized_assignments = [
        (
            item.model_copy(update={"group_id": sole_group_id})
            if not item.group_id and sole_group_id is not None
            else item
        )
        for item in assignments
    ]
    canonical = canonicalize_assignments(normalized_assignments)
    messages: list[DomainMessage] = []
    independent_care: list[CalculatedCareDay] = []
    for group in active_groups:
        group_configuration = configuration.configuration_for_group(group.id)
        group_assignments = [
            item for item in canonical if item.group_id == group.id
        ]
        supplied = (
            [
                item for item in calculated_care if item.group_id == group.id
            ]
            if calculated_care is not None
            else None
        )
        report = validate_schedule(
            group_configuration,
            group_assignments,
            supplied,
            _group_view=True,
        )
        independent_care.extend(calculate_care_independently(group_configuration))
        use_global_work_rules = (
            len(active_groups) > 1
            or bool(configuration.external_duty_assignments)
            or bool(configuration.locked_assignments)
            or bool(configuration.required_assignments)
        )
        ignored_global_rules = (
            {
                rules.RULE_DAYS,
                rules.RULE_REST_DAILY,
                rules.RULE_REST_WEEKLY,
                rules.RULE_CROSS_WEEK,
            }
            if use_global_work_rules
            else set()
        )
        for message in report.messages:
            if message.rule_id in ignored_global_rules:
                continue
            messages.append(
                message
                if message.group_id is not None
                else message.model_copy(update={"group_id": group.id})
            )

    messages.extend(_no_return_messages(independent_care, canonical))
    messages.extend(commitment_messages(configuration, independent_care, canonical))
    messages.extend(night_assignment_messages(configuration, canonical))
    messages.extend(_cross_group_messages(configuration, canonical, complete=True))
    messages.extend(weekend_days_off_messages(configuration, canonical))
    objective = calculate_objective(configuration, independent_care, canonical)
    has_errors = any(item.severity == "ERROR" for item in messages)
    if has_errors:
        public_result = PublicResult.BLAD_WEWNETRZNY
    elif configuration.requested_operation_mode == OperationMode.DEMONSTRATION:
        public_result = PublicResult.POPRAWNY_TRYB_DEMONSTRACYJNY
    else:
        public_result = PublicResult.POPRAWNY
    relevant_date = configuration.legal_rules.effective_to
    if relevant_date is None and configuration.legal_rules.verified_at is not None:
        relevant_date = configuration.legal_rules.verified_at.date()
    return ValidationReport(
        status=ValidationStatus.INVALID if has_errors else ValidationStatus.VALID,
        public_result=public_result,
        messages=messages,
        objective=objective,
        legal_profile_status=configuration.legal_rules.verification_status,
        legal_profile_version=configuration.legal_rules.version,
        legal_profile_relevant_date=relevant_date,
        demonstration_use_prohibited_notice=(
            "WYŁĄCZNIE DEMONSTRACJA — wynik nie jest dopuszczony do rzeczywistego użycia."
            if configuration.requested_operation_mode == OperationMode.DEMONSTRATION
            else None
        ),
    )


def validate_schedule(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
    calculated_care: list[CalculatedCareDay] | None = None,
    *, _group_view: bool = False,
) -> ValidationReport:
    if not _group_view and (len(configuration.groups) > 1 or any(
        item.group_id is None for item in configuration.educators
    ) or configuration.external_duty_assignments or configuration.required_assignments or configuration.locked_assignments or configuration.weekend_days_off_patterns):
        return _validate_internat_schedule(
            configuration,
            assignments,
            calculated_care,
        )
    messages: list[DomainMessage] = []
    if configuration.schedule_boundary_mode == ScheduleBoundaryMode.FINITE:
        contexts = (
            {
                item.educator_id: item
                for item in configuration.boundary_context.educators
            }
            if configuration.boundary_context is not None
            else {}
        )
        incomplete = [
            educator.id
            for educator in configuration.educators
            if educator.active
            and (
                educator.id not in contexts
                or contexts[educator.id].last_assignment_before is None
                or contexts[educator.id].first_assignment_after is None
            )
        ]
        if incomplete:
            messages.append(
                warning(
                    rules.RULE_CROSS_WEEK,
                    "Brak pełnego kontekstu granicznego ogranicza walidację odpoczynku przed i po horyzoncie.",
                    actual=", ".join(incomplete),
                )
            )
    try:
        independent_care = calculate_care_independently(configuration)
    except (ValueError, TimeDomainError) as exc:
        return ValidationReport(
            status=ValidationStatus.INVALID,
            public_result=PublicResult.BLAD_WEWNETRZNY,
            messages=[
                error(
                    rules.RULE_VALIDATOR_INDEPENDENT,
                    f"Niezależne obliczenie zapotrzebowania nie powiodło się: {exc}",
                )
            ],
            legal_profile_status=configuration.legal_rules.verification_status,
            legal_profile_version=configuration.legal_rules.version,
            legal_profile_relevant_date=configuration.legal_rules.effective_to,
        )

    internal_error = False
    if calculated_care is not None:
        invalid_staff = [
            (day.date, interval.required_staff_count)
            for day in calculated_care
            for interval in day.intervals
            if interval.required_staff_count != 1
        ]
        if invalid_staff:
            internal_error = True
            messages.append(
                error(
                    rules.RULE_VALIDATOR_INDEPENDENT,
                    "Moduł przekazał pochodną liczbę obsady inną niż jeden.",
                    required=1,
                    actual=str(invalid_staff),
                    context={"relatedRuleId": rules.RULE_STAFFING},
                )
            )
        independent_dump = [
            item.model_dump(mode="json") for item in independent_care
        ]
        supplied_dump = [item.model_dump(mode="json") for item in calculated_care]
        if supplied_dump != independent_dump:
            internal_error = True
            messages.append(
                error(
                    rules.RULE_VALIDATOR_INDEPENDENT,
                    "Zapotrzebowanie przekazane przez generator różni się od wyniku niezależnego walidatora.",
                    context={"relatedRuleId": rules.RULE_COVERAGE},
                )
            )

    messages.extend(_assignment_shape_messages(configuration, assignments))
    messages.extend(_coverage_messages(configuration, independent_care, assignments))
    messages.extend(_hours_and_days_messages(configuration, assignments))
    messages.extend(_unavailability_messages(configuration, assignments))
    if not any(
        item.rule_id in (rules.RULE_SAME_DAY, rules.RULE_TIME_STEP)
        for item in messages
    ):
        messages.extend(_daily_rest_messages(configuration, assignments))
        messages.extend(_weekly_rest_messages(configuration, assignments))
    messages.extend(_weekend_messages(configuration, assignments))
    messages.extend(_absolute_limits_messages(configuration, assignments))

    objective = calculate_objective(
        configuration,
        independent_care,
        assignments,
    )
    if objective.preferred_unavailability_penalty:
        messages.append(
            warning(
                rules.RULE_PREF_UNAVAILABLE,
                "Harmonogram wykorzystuje preferowaną niedostępność; reguła nie jest twarda.",
                actual=objective.preferred_unavailability_penalty,
            )
        )
    has_errors = any(item.severity == "ERROR" for item in messages)
    if internal_error:
        public_result = PublicResult.BLAD_WEWNETRZNY
    elif has_errors:
        public_result = PublicResult.BRAK_ROZWIAZANIA
    elif configuration.requested_operation_mode == OperationMode.DEMONSTRATION:
        public_result = PublicResult.POPRAWNY_TRYB_DEMONSTRACYJNY
    else:
        public_result = PublicResult.POPRAWNY
    notice = None
    if configuration.requested_operation_mode == OperationMode.DEMONSTRATION:
        notice = (
            "WYŁĄCZNIE DEMONSTRACJA — profil prawny nie dopuszcza wyniku "
            "do rzeczywistego planowania pracy."
        )
    relevant_date = configuration.legal_rules.effective_to
    if relevant_date is None and configuration.legal_rules.verified_at is not None:
        relevant_date = configuration.legal_rules.verified_at.date()
    return ValidationReport(
        status=ValidationStatus.INVALID if has_errors else ValidationStatus.VALID,
        public_result=public_result,
        messages=messages,
        objective=objective,
        legal_profile_status=configuration.legal_rules.verification_status,
        legal_profile_version=configuration.legal_rules.version,
        legal_profile_relevant_date=relevant_date,
        demonstration_use_prohibited_notice=notice,
    )
