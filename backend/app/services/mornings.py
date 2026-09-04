"""Weekday morning load: group-local, soft and independent of result validity."""
from collections import defaultdict
from datetime import timedelta
from app.services.reports import info


def morning_balance_cost(model, x, memberships, educator_index, weeks, step):
    penalties = []
    for member in memberships:
        if member.fixed_partial_schedule:
            continue  # Explicit support duties must not be redistributed.
        index = educator_index[member.educator_id]
        for week in range(weeks):
            days = []
            for offset in range(5):
                values = [x.get((member.group_id, index, week * 7 + offset, slot), 0)
                          for slot in range(360 // step, 480 // step)]
                used = model.new_bool_var(f"morning_{member.group_id}_{index}_{week}_{offset}")
                model.add_max_equality(used, values)
                days.append(used)
            count = model.new_int_var(0, 5, f"morning_count_{member.group_id}_{index}_{week}")
            model.add(count == sum(days))
            squared = model.new_int_var(0, 25, f"morning_cost_{member.group_id}_{index}_{week}")
            model.add_element(count, [0, 1, 4, 9, 16, 25], squared)
            penalties.append(squared)
    return sum(penalties), 25 * len(penalties)


def morning_distribution_messages(configuration, assignments):
    counts = defaultdict(set)
    for assignment in assignments:
        if assignment.date.weekday() < 5 and assignment.start_minute < 480 and assignment.end_minute > 360:
            week = (assignment.date - configuration.cycle_start_date).days // 7 + 1
            counts[assignment.group_id, week, assignment.educator_id].add(assignment.date)
    names = {e.id: e.display_name for e in configuration.educators}
    result = []
    for group in configuration.active_groups():
        members = configuration.memberships_for_group(group.id)
        for week in range(1, configuration.planning_horizon_weeks + 1):
            amounts = {m.educator_id: len(counts[group.id, week, m.educator_id]) for m in members}
            flexible = [amounts[m.educator_id] for m in members if not m.fixed_partial_schedule]
            if not flexible or max(flexible) < 4:
                continue
            distribution = ", ".join(f"{names.get(person, person)}: {count}" for person, count in amounts.items())
            result.append(info("PREF-MORNING-BALANCE",
                f"Grupa {group.code}, tydzień {week}: pobudki pn–pt (06:00–08:00): {distribution}. "
                "Plan spełnia wymagane warunki, ale ten podział może być niewygodny. "
                "Generator preferuje równomierny podział; dostępność, stałe dyżury i odpoczynek mają pierwszeństwo. "
                "Nie dowodzi to, że lepszy podział jest niemożliwy. Możesz spróbować ulepszenia planu.",
                group_id=group.id, date_value=configuration.cycle_start_date + timedelta(days=(week-1)*7),
                context={"weekNumber": week, "counts": amounts, "conflictType": "QUALITY_OPTIONAL"}))
    return result
