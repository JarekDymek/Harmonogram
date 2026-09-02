from __future__ import annotations

from datetime import date

from app.models.schemas import (
    ScheduleConfiguration,
    WeekendAssignmentTemplate,
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
    selected = substitutes[0] if substitutes else base
    updates = {}
    for field, target_date in (("saturday_template", saturday), ("sunday_template", sunday)):
        template = getattr(selected, field)
        required = [a for a in configuration.required_assignments
                    if a.group_id == configuration.group_id and a.date == target_date]
        if not required:
            continue
        # A required care duty already covers demand. It takes precedence over
        # rotation; keep the saved rotation intact and resolve a working copy.
        step = configuration.organizational_rules.time_step_minutes
        owners = {minute: educator for _, educator, start, end in template_tuples(template)
                  for minute in range(start, end, step)}
        for duty in required:
            for minute in range(duty.start_minute, duty.end_minute, step):
                if minute in owners:
                    owners[minute] = duty.educator_id
        segments = []
        for minute, educator in sorted(owners.items()):
            if segments and segments[-1][0] == educator and segments[-1][2] == minute:
                segments[-1] = (educator, segments[-1][1], minute + step)
            else:
                segments.append((educator, minute, minute + step))
        updates[field] = template.model_copy(update={"assignments": [
            WeekendAssignmentTemplate(id=f"RESOLVED-{template.id}-{index}", educator_id=educator,
                                      start_time=f"{start // 60:02d}:{start % 60:02d}",
                                      end_time=f"{end // 60:02d}:{end % 60:02d}", sequence_number=index)
            for index, (educator, start, end) in enumerate(segments, start=1)
        ]})
    return selected.model_copy(update=updates) if updates else selected


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


def fixed_support_educators(configuration: ScheduleConfiguration) -> set[str]:
    return {
        item.educator_id for item in configuration.group_memberships
        if item.active and item.group_id == configuration.group_id
        and item.role == "SUPPORT" and item.fixed_partial_schedule
    }
