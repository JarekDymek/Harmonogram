from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models.schemas import TimeInterval


class TimeDomainError(ValueError):
    pass


def parse_hhmm(value: str) -> int:
    """Zamienia HH:MM na minuty od początku dnia, bez obliczeń na tekście."""
    try:
        hour_text, minute_text = value.split(":", maxsplit=1)
        hour, minute = int(hour_text), int(minute_text)
    except (ValueError, AttributeError) as exc:
        raise TimeDomainError(f"Niepoprawny czas: {value!r}.") from exc
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise TimeDomainError(f"Czas poza zakresem doby: {value!r}.")
    return hour * 60 + minute


def format_hhmm(minutes: int) -> str:
    if not 0 <= minutes <= 1440:
        raise TimeDomainError(f"Minuty poza zakresem doby: {minutes}.")
    if minutes == 1440:
        return "24:00"
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def validate_interval(
    interval: TimeInterval,
    *,
    time_step_minutes: int,
) -> tuple[int, int]:
    start = parse_hhmm(interval.start_time)
    end = parse_hhmm(interval.end_time)
    if end <= start:
        raise TimeDomainError(
            f"Przedział [{interval.start_time},{interval.end_time}) ma niedodatnią długość "
            "albo przechodzi przez północ."
        )
    if start % time_step_minutes or end % time_step_minutes:
        raise TimeDomainError(
            f"Granice [{interval.start_time},{interval.end_time}) nie są zgodne "
            f"z krokiem {time_step_minutes} minut."
        )
    return start, end


def normalize_pairs(pairs: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Suma zbiorów czasu: sortowanie i scalanie styku oraz nakładania."""
    if not pairs:
        return []
    ordered = sorted(pairs)
    result: list[list[int]] = []
    for start, end in ordered:
        if end <= start:
            raise TimeDomainError("Przedział musi mieć dodatnią długość.")
        if not result or start > result[-1][1]:
            result.append([start, end])
        else:
            result[-1][1] = max(result[-1][1], end)
    return [(start, end) for start, end in result]


def normalize_intervals(
    intervals: list[TimeInterval],
    *,
    time_step_minutes: int,
) -> list[tuple[int, int]]:
    return normalize_pairs(
        [
            validate_interval(interval, time_step_minutes=time_step_minutes)
            for interval in intervals
        ]
    )


def subtract_pairs(
    minuend: list[tuple[int, int]],
    subtrahend: list[tuple[int, int]],
) -> list[tuple[int, int]]:
    """Różnica dwóch znormalizowanych zbiorów przedziałów."""
    result: list[tuple[int, int]] = []
    for start, end in minuend:
        cursor = start
        for remove_start, remove_end in subtrahend:
            if remove_end <= cursor:
                continue
            if remove_start >= end:
                break
            if remove_start > cursor:
                result.append((cursor, min(remove_start, end)))
            cursor = max(cursor, remove_end)
            if cursor >= end:
                break
        if cursor < end:
            result.append((cursor, end))
    return result


def is_subset(
    subset: list[tuple[int, int]],
    superset: list[tuple[int, int]],
) -> bool:
    for start, end in subset:
        if not any(container_start <= start and end <= container_end for container_start, container_end in superset):
            return False
    return True


def zone(value: str) -> ZoneInfo:
    try:
        return ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise TimeDomainError(f"Nieznana strefa czasu IANA: {value}.") from exc


def aware_local_datetime(
    local_date: date,
    minute_of_day: int,
    time_zone_id: str,
) -> datetime:
    """Tworzy jednoznaczną chwilę. Odrzuca lukę i powtórzenie czasu lokalnego."""
    if not 0 <= minute_of_day <= 1440:
        raise TimeDomainError("Minuta lokalna jest poza zakresem.")
    if minute_of_day == 1440:
        local_date += timedelta(days=1)
        minute_of_day = 0
    local = datetime.combine(
        local_date,
        time(minute_of_day // 60, minute_of_day % 60),
    )
    tz = zone(time_zone_id)
    candidates: list[datetime] = []
    for fold in (0, 1):
        candidate = local.replace(tzinfo=tz, fold=fold)
        roundtrip = candidate.astimezone(UTC).astimezone(tz).replace(tzinfo=None)
        if roundtrip == local:
            candidates.append(candidate)
    unique_offsets = {candidate.utcoffset() for candidate in candidates}
    if not candidates:
        raise TimeDomainError(
            f"Nieistniejący czas lokalny {local.isoformat(timespec='minutes')} "
            f"w strefie {time_zone_id}."
        )
    if len(unique_offsets) > 1:
        raise TimeDomainError(
            f"Niejednoznaczny czas lokalny {local.isoformat(timespec='minutes')} "
            f"w strefie {time_zone_id}."
        )
    return candidates[0]


def elapsed_minutes(
    start_date: date,
    start_minute: int,
    end_date: date,
    end_minute: int,
    time_zone_id: str,
) -> int:
    start = aware_local_datetime(start_date, start_minute, time_zone_id)
    end = aware_local_datetime(end_date, end_minute, time_zone_id)
    return int((end.astimezone(UTC) - start.astimezone(UTC)).total_seconds() // 60)


def daterange(start: date, count: int) -> list[date]:
    return [start + timedelta(days=index) for index in range(count)]


def interval_slots(
    pairs: list[tuple[int, int]],
    *,
    step: int,
) -> set[int]:
    slots: set[int] = set()
    for start, end in pairs:
        slots.update(range(start // step, end // step))
    return slots
