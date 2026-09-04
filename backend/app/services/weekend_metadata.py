"""Normalize redundant weekend labels on a copy; never change actual duties."""


def normalize_weekend_metadata(configuration):
    result = configuration.model_copy(deep=True)
    active = {e.id for e in result.educators if e.active}
    for variant in result.weekend_variants:
        group_id = variant.group_id or result.group_id
        members = {m.educator_id for m in result.group_memberships
                   if m.active and m.group_id == group_id and m.educator_id in active}
        working = {a.educator_id for template in (variant.saturday_template, variant.sunday_template)
                   for a in template.assignments}
        free = members - working
        variant.off_educator_id = next(iter(free)) if len(free) == 1 else None
    return result
