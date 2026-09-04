from types import SimpleNamespace
from ortools.sat.python import cp_model
from app.services.mornings import morning_balance_cost, morning_distribution_messages
from app.fixtures.demo import demo_configuration
from app.models.schemas import WorkAssignment
from datetime import timedelta


def morning_model(force_four=False):
    model = cp_model.CpModel()
    people = {f"{g}-{n}": i for i, (g,n) in enumerate((g,n) for g in ("VI","VII") for n in range(3))}
    members = [SimpleNamespace(group_id=p.split("-")[0], educator_id=p, fixed_partial_schedule=False) for p in people]
    x = {}
    for g in ("VI", "VII"):
        for day in range(5):
            owners = []
            for n in range(3):
                i = people[f"{g}-{n}"]
                used = model.new_bool_var(f"{g}-{day}-{n}")
                owners.append(used)
                for slot in range(12,16):
                    x[g,i,day,slot] = used
                if force_four and g == "VII" and n == 0 and day < 4:
                    model.add(used == 1)
            model.add(sum(owners) == 1)
    cost, bound = morning_balance_cost(model, x, members, people, 1, 30)
    model.minimize(cost)
    solver = cp_model.CpSolver()
    assert solver.solve(model) == cp_model.OPTIMAL
    return {g: [sum(solver.value(x[g,people[f"{g}-{n}"],d,12]) for d in range(5)) for n in range(3)] for g in ("VI","VII")}


def test_mornings_balance_per_group_not_across_internat():
    assert all(sorted(counts) == [1,2,2] for counts in morning_model().values())


def test_four_fixed_mornings_remain_feasible_and_do_not_distort_other_group():
    counts = morning_model(force_four=True)
    assert counts["VII"][0] == 4
    assert sorted(counts["VI"]) == [1,2,2]


def test_morning_notice_counts_days_not_segments_and_is_not_an_error():
    c = demo_configuration()
    duties = [WorkAssignment(group_id="G1", educator_id="A", date=c.cycle_start_date + timedelta(days=d),
                             start_minute=s, end_minute=s+60) for d in range(4) for s in (360,420)]
    messages = morning_distribution_messages(c, duties)
    assert len(messages) == 1 and messages[0].severity == "INFO"
    assert messages[0].context["counts"]["A"] == 4
