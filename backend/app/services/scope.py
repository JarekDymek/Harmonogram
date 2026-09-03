"""Request-only projection. Suspended groups remain intact in the saved project."""
def selected_configuration(configuration):
    selected = set(configuration.selected_group_ids)
    active = {g.id for g in configuration.groups if g.active}
    if not selected or not selected <= active:
        return configuration  # Input validation reports the invalid scope.
    if selected == active:
        return configuration
    result = configuration.model_copy(deep=True)
    result.groups = [g for g in result.groups if g.id in selected]
    result.group_count = len(result.groups)
    result.group_memberships = [m for m in result.group_memberships if m.group_id in selected]
    people = {m.educator_id for m in result.group_memberships if m.active}
    result.educators = [e for e in result.educators if e.id in people]
    for field in ("day_plans", "weekend_variants", "assignment_overrides", "common_area_duties"):
        setattr(result, field, [v for v in getattr(result, field) if v.group_id in selected])
    for field in ("unavailability", "weekend_days_off_patterns", "external_duty_assignments"):
        setattr(result, field, [v for v in getattr(result, field) if v.educator_id in people])
    # Known fixed work of a shared educator still occupies their time. It does
    # not make the suspended group's unfinished staffing/budget part of the solve.
    outside = [a.model_copy(update={"group_id": "EXTERNAL"}) for a in result.required_assignments
               if a.group_id not in selected and a.educator_id in people]
    result.required_assignments = [a for a in result.required_assignments if a.group_id in selected]
    result.locked_assignments = [
        a if a.group_id in selected else a.model_copy(update={"group_id": "EXTERNAL"})
        for a in result.locked_assignments if a.educator_id in people
    ] + outside
    for duty in result.external_duty_assignments:
        if duty.budget_group_id not in selected:
            duty.counts_towards_hours = False
            duty.budget_group_id = None
    if result.boundary_context:
        result.boundary_context.educators = [e for e in result.boundary_context.educators if e.educator_id in people]
    group = next((g for g in result.groups if g.id == result.active_group_id), result.groups[0])
    result.active_group_id = result.group_id = group.id
    result.group_name = group.name
    result.educator_count = len(result.memberships_for_group(group.id))
    return result
