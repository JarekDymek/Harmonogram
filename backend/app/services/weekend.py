from __future__ import annotations

from datetime import date

from app.models.schemas import (
    ScheduleConfiguration,
    WeekendDayTemplate,
    WeekendRotationVariant,
    WeekendVariantKind,
)
from app.services.time_utils import parse_hhmm


def expected_weekend_position(starting_position: int, week_number: int) -> int:
    return 1 + ((starting_position - 1 + week_number - 1) % 6)


def base_variant(
    configuration: ScheduleConfiguration,
    week_number: int,
) -> WeekendRotationVariant:
    position = expected_weekend_position(
        configuration.starting_weekend_variant,
        week_number,
    )
    matches = [
        item
        for item in configuration.weekend_variants
        if item.variant_kind == WeekendVariantKind.BASE
        and item.position_in_cycle == position
        and item.approved
    ]
    if len(matches) != 1:
        raise ValueError(
            f"Oczekiwano jednego zatwierdzonego wariantu BASE pozycji {position}, "
            f"znaleziono {len(matches)}."
        )
    return matches[0]


def selected_weekend_variant(
    configuration: ScheduleConfiguration,
    *,
    week_number: int,
    saturday: date,
    sunday: date,
) -> WeekendRotationVariant:
    base = base_variant(configuration, week_number)
    substitutes = [
        item
        for item in configuration.weekend_variants
        if item.variant_kind == WeekendVariantKind.SUBSTITUTE
        and item.approved
        and item.replaces_weekend_rotation_variant_id == base.id
        and item.applicable_week_number == week_number
        and item.applicable_saturday_date == saturday
        and item.applicable_sunday_date == sunday
    ]
    if len(substitutes) > 1:
        raise ValueError(
            f"Dla weekendu {saturday}–{sunday} istnieje więcej niż jeden SUBSTITUTE."
        )
    return substitutes[0] if substitutes else base


def template_tuples(
    template: WeekendDayTemplate,
) -> list[tuple[int, str, int, int]]:
    return [
        (
            item.sequence_number,
            item.educator_id,
            parse_hhmm(item.start_time),
            parse_hhmm(item.end_time),
        )
        for item in sorted(template.assignments, key=lambda value: value.sequence_number)
    ]


def variant_working_educators(variant: WeekendRotationVariant) -> set[str]:
    return {
        item.educator_id
        for template in (variant.saturday_template, variant.sunday_template)
        for item in template.assignments
    }
