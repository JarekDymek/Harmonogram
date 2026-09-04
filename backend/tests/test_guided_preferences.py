from datetime import timedelta

from app.fixtures.demo import demo_configuration
from app.models.schemas import WeekendDaysOffPattern, WorkAssignment
from app.services.objective import calculate_objective
from app.services.generation import generate_schedule
from app.validation.weekend_days_off import weekend_days_off_messages
from app.validation.input_validation import validate_configuration


def work(c, day, start=840, end=960):
    return WorkAssignment(group_id="G1", educator_id="A", date=c.cycle_start_date+timedelta(days=day), start_minute=start, end_minute=end)


def config():
    c=demo_configuration()
    c.planning_horizon_weeks=2
    c.weekend_days_off_patterns=[WeekendDaysOffPattern(id="P",educator_id="A",mode="PREFER_AFTER_FREE_WEEKEND")]
    return c


def warnings(c, days):
    return weekend_days_off_messages(c,assignments=[work(c,d) for d in days])


def test_monday_tuesday_after_free_not_working_weekend():
    c=config()
    # Free preceding weekend; current Mon-Tue off, Wed-Sun on.
    assert not warnings(c,[0,1,2,3,4,9,10,11,12,13])
    missed=warnings(c,[0,1,2,3,4,7,8,9,12,13])
    assert len(missed)==1 and missed[0].context["preferredPair"]==[0,1]
    # Working preceding weekend: Thu-Fri off is equally acceptable.
    assert not warnings(c,[0,1,2,5,6,7,8,9,12,13])


def test_finite_first_week_does_not_invent_preceding_weekend():
    c=config()
    assert not warnings(c,[0,1,2,5,6])


def test_preference_is_warning_not_hard_constraint():
    c=config()
    messages=warnings(c,[0,2,4,5,6])
    assert messages and all(m.severity=="WARNING" for m in messages)


def test_visit_cost_merges_touching_segments_and_weights_only_selected_person():
    c=demo_configuration()
    assignments=[work(c,0,360,480),work(c,0,840,960),work(c,0,960,1080)]
    assert calculate_objective(c,[],assignments).split_days_penalty==1
    c.educators[0].prefer_single_daily_visit=True
    assert calculate_objective(c,[],assignments).split_days_penalty==3
    assert calculate_objective(c,[],assignments[1:]).split_days_penalty==0


def test_commuter_first_proposal_is_independently_validated_and_preserves_data():
    c=demo_configuration();c.educators[0].prefer_single_daily_visit=True
    c.solver_time_limit_seconds=15
    before=c.model_dump()
    result=generate_schedule(c)
    assert result.validation_report.status=="VALID",result.messages
    assert result.assignments
    assert c.model_dump()==before


def test_workday_override_is_explicit_warning_not_silent_legal_approval():
    c=demo_configuration();c.organizational_rules.required_work_days_per_week=6
    report=validate_configuration(c)
    assert any(m.rule_id=="LEGAL-WORK-DAYS-OVERRIDE" and m.severity=="WARNING" for m in report.messages)
    assert not any(m.rule_id=="REQ-DAYS-001" and m.severity=="ERROR" for m in report.messages)


def test_cyclic_first_week_uses_last_weekend():
    c=config();c.planning_horizon_weeks=6;c.schedule_boundary_mode="CYCLIC"
    messages=warnings(c,[0,1,2,5,6,35,36,37,38,39])
    assert any(m.context.get("preferredPair")==[0,1] and m.context["weekNumber"]==1 for m in messages)


def test_new_weekend_mode_generates_a_valid_two_week_proposal():
    c=config();c.solver_time_limit_seconds=15
    result=generate_schedule(c)
    assert result.assignments and result.validation_report.status=="VALID",result.messages
    assert result.objective.consecutive_days_off_penalty==len(weekend_days_off_messages(c,assignments=result.assignments))


def test_diagnostic_example_names_actual_rest_violation_without_publishing(monkeypatch):
    from types import SimpleNamespace
    import app.services.generation as service
    from app.models.schemas import GenerationStatus
    from app.services.care_calculator import calculate_care
    c=demo_configuration();c.unavailability=[];before=c.model_dump()
    monkeypatch.setattr(service,"_solve_once",lambda *a,**kw: SimpleNamespace(
        status=GenerationStatus.CANDIDATE_FOUND,assignments=[work(c,0,1200,1320),work(c,1,360,480)]))
    messages=service._diagnose_no_solution(c,calculate_care(c))
    assert any(m.context.get("diagnosticExample") and m.educator_id=="A" and m.date for m in messages)
    assert c.model_dump()==before


def test_inactive_exception_drafts_do_not_block_or_relax_rest():
    from app.validation.schedule_validator import validate_schedule
    c=demo_configuration()
    c.legal_rules.weekly_rest_exception_minimum_minutes=0
    c.legal_rules.weekly_rest_exception_maximum_occurrences_per_cycle=6
    c.legal_rules.weekly_rest_exception_minimum_gap_minutes=0
    c.legal_rules.weekly_rest_compensation_minutes=120
    c.legal_rules.weekly_rest_compensation_deadline_minutes=168*60
    assert validate_configuration(c).status=="VALID_INPUT"
    baseline=demo_configuration()
    assignments=[work(c,d,360,1320) for d in range(7)]
    a=validate_schedule(c,assignments).model_dump()
    b=validate_schedule(baseline,assignments).model_dump()
    assert a==b


def test_unreviewed_starting_template_is_blocked_in_production():
    c=demo_configuration();c.requested_operation_mode="PRODUCTION";c.initial_template_needs_review=True
    assert any(m.rule_id=="REQ-TEMPLATE-REVIEW" for m in validate_configuration(c).messages)
