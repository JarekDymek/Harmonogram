from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from app.domain import rules
from app.models.schemas import (
    CalculatedCareDay,
    CareInterval,
    DomainMessage,
    LegalStatus,
    OperationMode,
    PlanScope,
    PublicResult,
    ScheduleConfiguration,
    UnavailabilityScope,
    UnavailabilityType,
    ValidationReport,
    ValidationStatus,
    WeeklyRestAttributionMode,
    WeeklyRestWindowType,
    WorkAssignment,
)
from app.services.objective import calculate_objective
from app.services.reports import error, warning
from app.services.time_utils import (
    TimeDomainError,
    aware_local_datetime,
    format_hhmm,
    is_subset,
    normalize_pairs,
    parse_hhmm,
    subtract_pairs,
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
    for day_index in range(rules.CYCLE_DAYS):
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
    cycle_end = configuration.cycle_start_date + timedelta(days=rules.CYCLE_DAYS)
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
                    "Przydział znajduje się poza sześciotygodniowym cyklem.",
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
        for week_number in range(1, rules.CYCLE_WEEKS + 1):
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
                        "Liczba dni pracy w tygodniu nie jest równa pięć.",
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
    for educator in configuration.educators:
        if not educator.active:
            continue
        by_date: dict[date, list[WorkAssignment]] = defaultdict(list)
        for item in assignments:
            if item.educator_id == educator.id:
                by_date[item.date].append(item)
                by_date[item.date + timedelta(days=rules.CYCLE_DAYS)].append(
                    item.model_copy(
                        update={
                            "date": item.date + timedelta(days=rules.CYCLE_DAYS)
                        }
                    )
                )
        work_dates = sorted(by_date)
        original_dates = [
            value
            for value in work_dates
            if value < configuration.cycle_start_date
            + timedelta(days=rules.CYCLE_DAYS)
        ]
        for work_date in original_dates:
            next_date = next(
                (value for value in work_dates if value > work_date),
                None,
            )
            if next_date is None:
                continue
            last = max(by_date[work_date], key=lambda item: item.end_minute)
            first = min(by_date[next_date], key=lambda item: item.start_minute)
            last_end = aware_local_datetime(
                last.date,
                last.end_minute,
                configuration.time_zone_id,
            ).astimezone(UTC)
            first_start = aware_local_datetime(
                first.date,
                first.start_minute,
                configuration.time_zone_id,
            ).astimezone(UTC)
            actual = int((first_start - last_end).total_seconds() // 60)
            if actual < minimum:
                rule_id = (
                    rules.RULE_CROSS_WEEK
                    if next_date
                    >= configuration.cycle_start_date
                    + timedelta(days=rules.CYCLE_DAYS)
                    else rules.RULE_REST_DAILY
                )
                messages.append(
                    error(
                        rule_id,
                        "Rzeczywisty odpoczynek dobowy jest za krótki.",
                        educator_id=educator.id,
                        date_value=work_date,
                        required=minimum,
                        actual=actual,
                        context={"nextWorkDate": next_date.isoformat()},
                    )
                )
    return messages


def _merged_utc_work(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
    educator_id: str,
) -> list[tuple[datetime, datetime]]:
    raw = []
    for item in assignments:
        if item.educator_id != educator_id:
            continue
        raw.append(_utc_interval(configuration, item, date_shift=-rules.CYCLE_DAYS))
        raw.append(_utc_interval(configuration, item))
        raw.append(_utc_interval(configuration, item, date_shift=rules.CYCLE_DAYS))
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
) -> list[tuple[datetime, datetime]]:
    return [
        (current_end, next_start)
        for (_, current_end), (next_start, _) in zip(work, work[1:])
        if next_start > current_end
    ]


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
        configuration.cycle_start_date + timedelta(days=rules.CYCLE_DAYS),
        0,
        configuration.time_zone_id,
    ).astimezone(UTC)
    if legal.weekly_rest_window_type == WeeklyRestWindowType.FIXED_LOCAL_WEEK:
        result = []
        window_slots = legal.weekly_rest_window_length_minutes // step
        cursor = first_anchor_index
        while cursor < rules.CYCLE_DAYS * rules.SLOTS_PER_DAY:
            result.append(
                (local_boundary_utc(cursor), local_boundary_utc(cursor + window_slots))
            )
            cursor += 7 * rules.SLOTS_PER_DAY
        return result
    result = []
    start = local_boundary_utc(first_anchor_index)
    while start < cycle_end:
        result.append(
            (
                start,
                start
                + timedelta(minutes=legal.weekly_rest_window_length_minutes),
            )
        )
        start += timedelta(minutes=legal.weekly_rest_window_step_minutes)
    return result


def _weekly_rest_messages(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    legal = configuration.legal_rules
    windows = _weekly_windows(configuration)
    for educator in configuration.educators:
        if not educator.active:
            continue
        work = _merged_utc_work(configuration, assignments, educator.id)
        free_periods = _global_free_periods(work)
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
    for week_number in range(1, rules.CYCLE_WEEKS + 1):
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

    off_counts: Counter[str] = Counter()
    pair_counts: Counter[tuple[str, str]] = Counter()
    for week_number in range(1, rules.CYCLE_WEEKS + 1):
        saturday = configuration.cycle_start_date + timedelta(
            days=(week_number - 1) * 7 + 5
        )
        variant = selected_weekend_variant(
            configuration,
            week_number=week_number,
            saturday=saturday,
            sunday=saturday + timedelta(days=1),
        )
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


def validate_schedule(
    configuration: ScheduleConfiguration,
    assignments: list[WorkAssignment],
    calculated_care: list[CalculatedCareDay] | None = None,
) -> ValidationReport:
    messages: list[DomainMessage] = []
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
