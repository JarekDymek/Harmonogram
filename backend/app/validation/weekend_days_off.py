"""Whole-calendar days off, conditional on actual weekend work.

Input checks use only fixed commitments and selected weekend templates. Final
checks use the returned schedule, never the solver's work-day variables.
"""
from collections import defaultdict
from datetime import timedelta

from app.domain.work_calendar import allowed_beside_night, care_target_minutes, duty_dates
from app.services.reports import error, warning
from app.services.time_utils import aware_local_datetime, parse_hhmm
from app.services.weekend import selected_weekend_variant

RULE = "REQ-WEEKEND-DAYS-OFF-001"
DAY_NAMES = ("poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela")


def _optimistic_capacity_message(configuration, pattern, week, care, person_work):
    """Prove an hours shortage without duplicating solver/rest logic.

    This deliberately overestimates capacity (it ignores rest and segment
    lengths). Therefore it reports only conflicts that cannot be repaired by a
    different search result.
    """
    monday = configuration.cycle_start_date + timedelta(days=7 * week)
    sunday = monday + timedelta(days=6)
    memberships = [
        member for member in configuration.group_memberships
        if member.active and member.educator_id == pattern.educator_id
        and member.group_id in configuration.selected_group_ids
    ]
    if not memberships:
        return None
    target = sum(care_target_minutes(configuration, member, week + 1) for member in memberships)
    group_ids = {member.group_id for member in memberships}
    step = configuration.organizational_rules.time_step_minutes
    weekend_slots = defaultdict(set)
    for group_id in group_ids:
        try:
            variant = selected_weekend_variant(
                configuration.configuration_for_group(group_id),
                week_number=week + 1,
                saturday=monday + timedelta(days=5),
                sunday=sunday,
            )
        except ValueError:
            return None  # Existing weekend validation provides the message.
        for day_offset, template in enumerate((variant.saturday_template, variant.sunday_template)):
            for assignment in template.assignments:
                if assignment.educator_id == pattern.educator_id:
                    weekend_slots[(group_id, monday + timedelta(days=5 + day_offset))].update(
                        range(parse_hhmm(assignment.start_time), parse_hhmm(assignment.end_time), step)
                    )

    available_by_date = defaultdict(set)
    for day in care:
        if day.group_id not in group_ids or not monday <= day.date <= sunday:
            continue
        if day.date.weekday() in pattern.days_off:
            continue
        for interval in day.intervals:
            for minute in range(interval.start_minute, interval.end_minute, step):
                # Required care already fills this group's demand; it is not
                # available capacity for another educator.
                if any(
                    required.group_id == day.group_id and required.date == day.date
                    and required.educator_id != pattern.educator_id
                    and required.start_minute < minute + step and minute < required.end_minute
                    for required in configuration.required_assignments
                ):
                    continue
                if day.date.weekday() >= 5 and minute not in weekend_slots[(day.group_id, day.date)]:
                    continue
                if not allowed_beside_night(
                    configuration, pattern.educator_id, day.date, minute, minute + step
                ):
                    continue
                if any(
                    unavailable.educator_id == pattern.educator_id
                    and unavailable.type == "HARD"
                    and (
                        unavailable.scope == "RECURRING_WEEKLY"
                        and unavailable.day_of_week == day.date.weekday()
                        or unavailable.scope == "CYCLE_WEEK"
                        and unavailable.week_number == week + 1
                        and unavailable.day_of_week == day.date.weekday()
                        or unavailable.scope == "SPECIFIC_DATE"
                        and unavailable.date == day.date
                    )
                    and parse_hhmm(unavailable.start_time) < minute + step
                    and minute < parse_hhmm(unavailable.end_time)
                    for unavailable in configuration.unavailability
                ):
                    continue
                start = aware_local_datetime(day.date, minute, configuration.time_zone_id)
                end = aware_local_datetime(day.date, minute + step, configuration.time_zone_id)
                if any(
                    duty.locked and duty.educator_id == pattern.educator_id
                    and duty.start_date_time < end and start < duty.end_date_time
                    for duty in configuration.external_duty_assignments
                ):
                    continue
                # A person can cover only one group in the same half-hour.
                available_by_date[day.date].add(minute)

    capacity = sum(len(slots) * step for slots in available_by_date.values())
    if capacity >= target:
        return None
    educator = next(item for item in configuration.educators if item.id == pattern.educator_id)
    details = "; ".join(
        f"{DAY_NAMES[date.weekday()]}: {len(slots) * step / 60:g} godz."
        for date, slots in sorted(available_by_date.items())
    ) or "brak dostępnych godzin"
    return error(
        RULE,
        f"{educator.display_name}, tydzień {week + 1}: trzeba przydzielić "
        f"{target / 60:g} godz. opieki dziennej, ale przy tej parze wolnego "
        f"można zmieścić najwyżej {capacity / 60:g} godz. Brakuje "
        f"co najmniej {(target - capacity) / 60:g} godz. Dostępne: {details} "
        "Godziny obowiązkowych dyżurów innych osób są już obsadzone i nie mogą być liczone drugi raz. "
        "Wybierz inną parę dni wolnych albo zmień obsadę weekendu lub niedostępność. "
        "Jeśli para wolnego jest życzeniem, wybierz „Preferuj dwa kolejne dni” zamiast obowiązkowych dni. "
        "Nocka i jej oba dni pracy są już uwzględnione.",
        educator_id=pattern.educator_id,
        date_value=monday,
        required=target,
        actual=capacity,
        context={
            "patternId": pattern.id,
            "weekNumber": week + 1,
            "conflictType": "WEEKEND_OFF_CAPACITY",
            "availableMinutesByDate": {
                str(date): len(slots) * step
                for date, slots in sorted(available_by_date.items())
            },
            "workDates": [
                str(date) for date in sorted(person_work)
                if monday <= date <= sunday
            ],
        },
    )


def weekend_days_off_messages(configuration, assignments=None, *, care=None):
    messages = []
    educators = {e.id: e for e in configuration.educators if e.active}
    patterns = []
    seen = set()
    for pattern in configuration.weekend_days_off_patterns:
        if not pattern.active:
            continue
        problem = None
        if pattern.educator_id not in educators:
            problem = "Wybierz istniejącego, aktywnego wychowawcę albo usuń nieaktualny wzorzec wolnego."
        elif pattern.mode == "FIXED" and (len(pattern.days_off) != 2 or len(set(pattern.days_off)) != 2 or any(d not in range(7) for d in pattern.days_off)):
            problem = "Wybierz dwa różne dni tygodnia jako dni całkowicie wolne."
        elif pattern.educator_id in seen:
            problem = "Ta osoba ma więcej niż jeden aktywny wzorzec wolnego. Pozostaw jeden wzorzec wspólny dla wszystkich grup."
        seen.add(pattern.educator_id)
        if problem:
            messages.append(error(RULE, problem, educator_id=pattern.educator_id,
                                  context={"patternId": pattern.id}))
        else:
            patterns.append(pattern)
    if messages:
        return messages

    work = defaultdict(lambda: defaultdict(set))
    for duty in configuration.external_duty_assignments:
        if duty.locked:
            source = {"NIGHT": "nocka", "SCHOOL": "praca w szkole"}.get(duty.duty_type, "dyżur zewnętrzny")
            for date in duty_dates(configuration, duty):
                work[duty.educator_id][date].add(source)
    for values, source in ((configuration.locked_assignments, "zablokowany dyżur"),
                           (configuration.required_assignments, "obowiązkowy dyżur"),
                           (assignments or [], "dyżur w wygenerowanym planie")):
        for a in values:
            work[a.educator_id][a.date].add(source)
    if assignments is None:
        for group in configuration.active_groups():
            view = configuration.configuration_for_group(group.id)
            for week in range(configuration.planning_horizon_weeks):
                saturday = configuration.cycle_start_date + timedelta(days=7 * week + 5)
                try:
                    variant = selected_weekend_variant(view, week_number=week + 1,
                                                       saturday=saturday, sunday=saturday + timedelta(days=1))
                except ValueError:
                    # The existing weekend validator reports missing/ambiguous variants.
                    continue
                for offset, template in enumerate((variant.saturday_template, variant.sunday_template)):
                    for a in template.assignments:
                        work[a.educator_id][saturday + timedelta(days=offset)].add("dyżur we wzorcu weekendu")

    for pattern in patterns:
        person_work = work[pattern.educator_id]
        for week in range(configuration.planning_horizon_weeks):
            monday = configuration.cycle_start_date + timedelta(days=7 * week)
            if not any(monday + timedelta(days=d) in person_work for d in (5, 6)):
                continue
            if pattern.mode == "PREFER_CONSECUTIVE":
                if assignments is not None:
                    free = [d for d in range(7) if monday + timedelta(days=d) not in person_work]
                    if not any(d + 1 in free for d in free):
                        name = educators[pattern.educator_id].display_name
                        messages.append(warning("PREF-CONSECUTIVE-DAYS-OFF",
                            f"{name}, tydzień {week + 1} ({monday:%d.%m}–{monday + timedelta(days=6):%d.%m}): "
                            f"dni wolne: {', '.join(DAY_NAMES[d] for d in free) or 'brak'}. "
                            "W znalezionym planie nie udało się połączyć ich w dwa kolejne dni. "
                            "To niespełniona preferencja, nie błąd planu. Wymagane dni pracy, dyżury i odpoczynki nadal obowiązują; "
                            "wynik nie dowodzi, że lepszy układ jest niemożliwy.",
                            educator_id=pattern.educator_id, date_value=monday,
                            context={"patternId": pattern.id, "weekNumber": week + 1, "freeDays": free}))
                continue
            for day in pattern.days_off:
                date = monday + timedelta(days=day)
                if date not in person_work:
                    continue
                source = ", ".join(sorted(person_work[date]))
                name = educators[pattern.educator_id].display_name
                messages.append(error(RULE,
                    f"{name}: {DAY_NAMES[day]} {date:%d.%m.%Y} ma być wolny za pracujący weekend, "
                    f"ale jest wpisana praca: {source}. W kroku Weekendy wybierz inny dzień wolny "
                    "albo przenieś wskazany dyżur. Wzorzec dotyczy tego samego tygodnia poniedziałek–niedziela.",
                    educator_id=pattern.educator_id, date_value=date,
                    required=0, actual=1,
                    context={"patternId": pattern.id, "weekNumber": week + 1,
                             "dayOfWeek": day, "workSources": sorted(person_work[date])}))
            has_specific_conflict = any(
                message.context.get("patternId") == pattern.id
                and message.context.get("weekNumber") == week + 1
                for message in messages
            )
            if care is not None and not has_specific_conflict:
                capacity_message = _optimistic_capacity_message(
                    configuration, pattern, week, care, person_work
                )
                if capacity_message is not None:
                    messages.append(capacity_message)
    return messages
