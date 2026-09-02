"""Calendar dates with work, distinct from payroll hours and legal rest periods."""
from datetime import timedelta

from app.services.time_utils import aware_local_datetime, zone


def duty_dates(configuration, duty):
    tz = zone(configuration.time_zone_id)
    first = duty.start_date_time.astimezone(tz).date()
    last = (duty.end_date_time.astimezone(tz) - timedelta(microseconds=1)).date()
    return {first + timedelta(days=i) for i in range((last - first).days + 1)}


def night_credit_minutes(configuration, membership, week):
    start = configuration.cycle_start_date + timedelta(days=7 * (week - 1))
    end = start + timedelta(days=7)
    tz = zone(configuration.time_zone_id)
    return sum(
        duty.credited_minutes if duty.credited_minutes is not None else 480
        for duty in configuration.external_duty_assignments
        if duty.locked and duty.regular_night and duty.duty_type == "NIGHT"
        and duty.counts_towards_hours
        and duty.budget_group_id == membership.group_id
        and duty.educator_id == membership.educator_id
        and start <= duty.start_date_time.astimezone(tz).date() < end
    )


def care_target_minutes(configuration, membership, week):
    values = membership.weekly_target_hours_by_week
    total = round(values[min(week - 1, len(values) - 1)] * 60)
    if membership.hours_include_fixed_nights:
        total -= night_credit_minutes(configuration, membership, week)
    return total


def uses_fixed_partial_schedule(configuration, educator_id):
    """Whether every selected membership is an explicit fixed support plan."""
    selected = set(configuration.selected_group_ids)
    memberships = [
        item
        for item in configuration.group_memberships
        if item.active
        and item.group_id in selected
        and item.educator_id == educator_id
    ]
    return bool(memberships) and all(
        item.role == "SUPPORT" and item.fixed_partial_schedule
        for item in memberships
    )


def night_windows(configuration, educator_id):
    tz = zone(configuration.time_zone_id)
    return [
        (d.start_date_time.astimezone(tz), d.end_date_time.astimezone(tz))
        for d in configuration.external_duty_assignments
        if d.locked and d.duty_type == "NIGHT" and d.educator_id == educator_id
    ]


def allowed_beside_night(configuration, educator_id, date, start, end):
    for night_start, night_end in night_windows(configuration, educator_id):
        if date == night_start.date() and not (1200 <= start < end <= 1320):
            return False
        if date == night_end.date() and not (360 <= start < end <= 480):
            return False
    return True


def same_night_block(configuration, educator_id, date, start, next_date, end):
    """Adjacent work 20–22 + night + 06–08 is one duty, not two rest breaks."""
    return any(
        date == night_start.date() and next_date == night_end.date()
        and start >= 1200 and end <= 480
        for night_start, night_end in night_windows(configuration, educator_id)
    )


def fixed_on_date(configuration, educator_id, date):
    return any(d.locked and d.educator_id == educator_id and date in duty_dates(configuration, d)
               for d in configuration.external_duty_assignments) or any(
        a.educator_id == educator_id and a.date == date for a in [*configuration.locked_assignments,
          *(a for a in configuration.required_assignments if a.group_id not in configuration.selected_group_ids)]
    )
