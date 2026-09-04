"""Actionable checks on explicit commitments, independently of search variables."""
from datetime import UTC, timedelta

from app.domain.work_calendar import allowed_beside_night, care_target_minutes, duty_dates
from app.services.reports import error
from app.services.time_utils import aware_local_datetime, format_hhmm, parse_hhmm, zone


def commitment_messages(configuration, care=None, assignments=None):
    messages = []
    memberships = {(m.group_id, m.educator_id): m for m in configuration.group_memberships if m.active}
    for member in memberships.values():
        if member.fixed_partial_schedule and member.role != "SUPPORT":
            messages.append(error(
                "REQ-REQUIRED-DUTY-001",
                "Stały plan częściowy można włączyć tylko dla wychowawcy pomocniczego. Zmień rolę na pomocniczą albo wyłącz ten przełącznik.",
                group_id=member.group_id,
                educator_id=member.educator_id,
                context={"field": "fixedPartialSchedule"},
            ))
        for week in range(1, configuration.planning_horizon_weeks + 1):
            target_minutes = care_target_minutes(configuration, member, week)
            if target_minutes < 0:
                messages.append(error("REQ-HOURS-001", "Łączny wymiar jest mniejszy niż wpisane stałe nocki. Zwiększ łączny wymiar albo popraw nockę.",
                                      group_id=member.group_id, educator_id=member.educator_id,
                                      context={"weekNumber": week, "field": "weeklyTargetHoursByWeek"}))
            if member.fixed_partial_schedule:
                week_start = configuration.cycle_start_date + timedelta(days=(week - 1) * 7)
                week_end = week_start + timedelta(days=7)
                fixed_minutes = sum(
                    item.end_minute - item.start_minute
                    for item in configuration.required_assignments
                    if item.group_id == member.group_id
                    and item.educator_id == member.educator_id
                    and week_start <= item.date < week_end
                )
                if fixed_minutes != target_minutes:
                    messages.append(error(
                        "REQ-REQUIRED-DUTY-001",
                        "Stały plan pomocniczy musi obejmować dokładnie cały wymiar opieki tej osoby. Dodaj lub popraw jej obowiązkowe dyżury powtarzane co tydzień.",
                        group_id=member.group_id,
                        educator_id=member.educator_id,
                        date_value=week_start,
                        required=target_minutes,
                        actual=fixed_minutes,
                        context={
                            "weekNumber": week,
                            "field": "recurringRequiredDuties",
                            "conflictType": "FIXED_PARTIAL_SCHEDULE_HOURS",
                        },
                    ))
    care_map = {(d.group_id, d.date): d for d in care or []}
    first = configuration.cycle_start_date
    last = first + timedelta(days=configuration.planning_horizon_weeks * 7)
    step = configuration.organizational_rules.time_step_minutes
    for duty in configuration.external_duty_assignments:
        if duty.regular_night and (duty.duty_type != "NIGHT" or not duty.counts_towards_hours
                                  or (duty.budget_group_id, duty.educator_id) not in memberships):
            messages.append(error("REQ-NIGHT-WINDOW-001", "Przypisz stałą nockę do jednej grupy tej osoby, aby jej 8 godzin nie zgubiło się ani nie zostało naliczone podwójnie.", educator_id=duty.educator_id))
    for item in configuration.required_assignments:
        problem = None
        if (item.group_id, item.educator_id) not in memberships:
            problem = "Wybierz wychowawcę należącego do tej grupy."
        elif not (first <= item.date < last and 0 <= item.start_minute < item.end_minute <= 1440):
            problem = "Popraw datę i godziny obowiązkowego dyżuru — muszą mieścić się w planie."
        elif item.start_minute % step or item.end_minute % step:
            problem = "Obowiązkowy dyżur wpisz w krokach co 30 minut."
        elif not allowed_beside_night(configuration, item.educator_id, item.date, item.start_minute, item.end_minute):
            problem = "W dniu rozpoczęcia nocki wybierz tylko 20:00–22:00, a po nocce tylko 06:00–08:00, albo inną osobę."
        elif care is not None and item.group_id in configuration.selected_group_ids:
            day = care_map.get((item.group_id, item.date))
            # A missing calculation is unknown, not a day with zero demand.
            # The originating group's validation already reports why it failed.
            if day is not None and any(not any(i.start_minute <= minute < i.end_minute for i in day.intervals)
                                  for minute in range(item.start_minute, item.end_minute, step)):
                problem = "W tych godzinach grupa nie wymaga opieki. Popraw plan pobytu albo godziny obowiązkowego dyżuru."
        if problem is None:
            start = aware_local_datetime(item.date, item.start_minute, configuration.time_zone_id)
            end = aware_local_datetime(item.date, item.end_minute, configuration.time_zone_id)
            if any(d.locked and d.educator_id == item.educator_id and d.start_date_time < end and start < d.end_date_time
                   for d in configuration.external_duty_assignments):
                problem = "Wychowawca pracuje wtedy w szkole albo ma inny dyżur. Zmień osobę lub godziny obowiązkowego dyżuru."
            for u in configuration.unavailability:
                active = (u.scope == "RECURRING_WEEKLY" and u.day_of_week == item.date.weekday()
                          or u.scope == "CYCLE_WEEK" and u.day_of_week == item.date.weekday() and u.week_number == (item.date - first).days // 7 + 1
                          or u.scope == "SPECIFIC_DATE" and u.date == item.date)
                if active and u.type == "HARD" and u.educator_id == item.educator_id and parse_hhmm(u.start_time) < item.end_minute and item.start_minute < parse_hhmm(u.end_time):
                    problem = "Obowiązkowy dyżur koliduje z niedostępnością. Popraw niedostępność, osobę lub godziny dyżuru."
        if problem is None and assignments is not None and item.group_id in configuration.selected_group_ids:
            if any(not any(a.group_id == item.group_id and a.educator_id == item.educator_id and a.date == item.date
                           and a.start_minute <= minute < a.end_minute for a in assignments)
                   for minute in range(item.start_minute, item.end_minute, step)):
                problem = "Wynik pominął obowiązkowy dyżur. Nie wolno go używać; wygeneruj plan ponownie."
        if problem:
            messages.append(error("REQ-REQUIRED-DUTY-001", problem, group_id=item.group_id,
                                  educator_id=item.educator_id, date_value=item.date,
                                  start_time=format_hhmm(item.start_minute), end_time=format_hhmm(item.end_minute),
                                  context={"field": "requiredAssignments"}))

    for index, a in enumerate(configuration.required_assignments):
        for b in configuration.required_assignments[index + 1:]:
            if a.date == b.date and a.start_minute < b.end_minute and b.start_minute < a.end_minute and (a.educator_id == b.educator_id or a.group_id == b.group_id):
                messages.append(error("REQ-REQUIRED-DUTY-001", "Dwa obowiązkowe dyżury nakładają się. Usuń duplikat albo zmień godziny.",
                                      educator_id=a.educator_id, group_id=a.group_id, date_value=a.date))

    for educator in configuration.educators:
        days = {a.date for a in [*configuration.required_assignments, *configuration.locked_assignments] if a.educator_id == educator.id}
        for duty in configuration.external_duty_assignments:
            if duty.locked and duty.educator_id == educator.id:
                days.update(duty_dates(configuration, duty))
        for week in range(configuration.planning_horizon_weeks):
            start = first + timedelta(days=week * 7)
            actual = sorted(d for d in days if start <= d < start + timedelta(days=7))
            if len(actual) > configuration.organizational_rules.required_work_days_per_week:
                messages.append(error("REQ-WORK-CALENDAR-001", "Same wpisane nocki, szkoła i obowiązkowe dyżury zajmują ponad pięć dni. Przenieś jeden z dyżurów na już zajęty dzień; pozostaw dwa dni całkowicie wolne.",
                                      educator_id=educator.id, date_value=start, required=5, actual=len(actual),
                                      context={"weekNumber": week + 1, "workDates": [str(d) for d in actual]}))
    return messages


def night_assignment_messages(configuration, assignments):
    return [error("REQ-NIGHT-WINDOW-001", "Przy nocce dopuszczalna jest dodatkowa opieka tylko 20:00–22:00 przed nocą i 06:00–08:00 po niej. Wybierz inną osobę albo te godziny.",
                  group_id=a.group_id, educator_id=a.educator_id, date_value=a.date,
                  start_time=format_hhmm(a.start_minute), end_time=format_hhmm(a.end_minute))
            for a in assignments if not allowed_beside_night(configuration, a.educator_id, a.date, a.start_minute, a.end_minute)]


def combined_limit_messages(configuration, assignments):
    messages = []
    for educator_id in {a.educator_id for a in assignments}:
        values = sorted((a for a in assignments if a.educator_id == educator_id), key=lambda a: (a.date, a.start_minute, a.end_minute))
        daily_limit = configuration.legal_rules.maximum_absolute_daily_work_minutes
        if daily_limit is not None:
            for day in {a.date for a in values}:
                actual = sum(a.end_minute - a.start_minute for a in values if a.date == day)
                if actual > daily_limit:
                    messages.append(error("REQ-WORK-CALENDAR-001", "Łączna praca w szkole, grupach i na nocce przekracza dobowy limit profilu. Skróć lub przenieś jeden z dyżurów.",
                                          educator_id=educator_id, date_value=day, required=daily_limit, actual=actual, context={"limitKind":"daily"}))
        segment_limit = configuration.legal_rules.maximum_absolute_segment_minutes
        if segment_limit is not None:
            merged = []
            for item in values:
                start = aware_local_datetime(item.date, item.start_minute, configuration.time_zone_id).astimezone(UTC)
                end = aware_local_datetime(item.date, item.end_minute, configuration.time_zone_id).astimezone(UTC)
                if merged and start <= merged[-1][1]:
                    merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
                else:
                    merged.append((start, end))
            for start, end in merged:
                actual = int((end - start).total_seconds() // 60)
                if actual > segment_limit:
                    messages.append(error("REQ-WORK-CALENDAR-001", "Łączny ciągły dyżur przekracza limit odcinka w profilu. Skróć obowiązkowy dyżur (np. pracę przed lub po nocce) albo wybierz inną osobę.",
                                          educator_id=educator_id, date_value=start.astimezone(zone(configuration.time_zone_id)).date(), required=segment_limit, actual=actual, context={"limitKind":"continuous"}))
    return messages
