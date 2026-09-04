from datetime import timedelta
from app.fixtures.demo import demo_configuration
from app.models.schemas import Educator, GroupConfiguration, GroupEducatorMembership, WorkAssignment, WeekendDaysOffPattern
from app.services.scope import selected_configuration
from app.services.generation import generate_schedule
from app.validation.input_validation import validate_configuration
from app.validation.work_calendar import commitment_messages
from app.validation.weekend_days_off import _optimistic_capacity_message
from app.services.care_calculator import calculate_care


def four():
    c = demo_configuration()
    c.educators.append(Educator(id="D", display_name="Support", short_code="D"))
    c.group_memberships.append(GroupEducatorMembership(id="D-M", group_id="G1", educator_id="D",
        role="SUPPORT", fixed_partial_schedule=True, weekly_target_hours_by_week=[0]))
    c.educator_count = 4
    return c


def test_weekend_metadata_is_derived_for_every_position_and_never_edits_input():
    c = four()
    for v in c.weekend_variants:
        v.off_educator_id = v.saturday_template.assignments[0].educator_id
    before = c.model_dump()
    report = validate_configuration(c)
    assert report.status == "VALID_INPUT", report.messages
    assert all(v.off_educator_id is None for v in selected_configuration(c).weekend_variants)
    assert c.model_dump() == before


def test_bad_weekend_cannot_invent_missing_demand_for_required_duties():
    c = four()
    c.unavailability = []
    c.required_assignments = [WorkAssignment(group_id="G1", educator_id="A", date=c.cycle_start_date,
                                            start_minute=360, end_minute=480)]
    c.weekend_variants[0].saturday_template.assignments[0].educator_id = "UNKNOWN"
    report = validate_configuration(c)
    assert report.status == "INVALID_INPUT"
    assert any(m.rule_id == "REQ-WEEKEND-001" for m in report.messages)
    assert not any("nie wymaga opieki" in m.message for m in report.messages)
    assert not any("brak godzin" in m.message.lower() for m in report.messages)


def test_unknown_care_is_not_zero_but_known_outside_demand_still_errors():
    c = four()
    c.unavailability = []
    c.required_assignments = [WorkAssignment(group_id="G1", educator_id="A", date=c.cycle_start_date,
                                            start_minute=540, end_minute=600)]
    assert not any("nie wymaga opieki" in m.message for m in commitment_messages(c, []))
    assert any("nie wymaga opieki" in m.message for m in commitment_messages(c, calculate_care(c)))
    pattern = WeekendDaysOffPattern(id="OFF", educator_id="A", days_off=[0, 1])
    assert _optimistic_capacity_message(c, pattern, 0, [], {}) is None
    assert _optimistic_capacity_message(c, pattern, 0, calculate_care(c)[:1], {}) is None


def two_ready_groups():
    c = demo_configuration()
    c.groups[0].code = "VI"
    c.groups[0].name = "Group VI"
    c.groups.append(GroupConfiguration(id="G7", code="VII", name="Group VII", display_order=7))
    for e in list(c.educators):
        c.educators.append(e.model_copy(update={"id": "VII-" + e.id, "group_id": None}))
    for m in list(c.group_memberships):
        c.group_memberships.append(m.model_copy(update={"id": "VII-" + m.id, "group_id": "G7", "educator_id": "VII-" + m.educator_id}))
    for p in list(c.day_plans):
        c.day_plans.append(p.model_copy(deep=True, update={"id": "VII-" + p.id, "group_id": "G7"}))
    for v in list(c.weekend_variants):
        clone = v.model_copy(deep=True, update={"id": "VII-" + v.id, "group_id": "G7", "off_educator_id": "STALE"})
        for t in (clone.saturday_template, clone.sunday_template):
            for a in t.assignments:
                a.educator_id = "VII-" + a.educator_id
        c.weekend_variants.append(clone)
    c.group_count = 2
    c.selected_group_ids = ["G1", "G7"]
    c.active_group_id = "G7"
    c.solver_time_limit_seconds = 12
    return c


def test_vi_and_vii_use_their_own_people_and_care_with_six_drafts_suspended():
    c = two_ready_groups()
    for n in range(1, 7):
        c.groups.append(GroupConfiguration(id=f"DRAFT-{n}", code=f"Draft-{n}", name="Unfinished", display_order=n))
    c.group_count = 8
    before = c.model_dump()
    report = validate_configuration(c)
    assert report.status == "VALID_INPUT", report.messages
    result = generate_schedule(c)
    assert result.validation_report and result.validation_report.status == "VALID", result.messages
    assert {a.group_id for a in result.assignments} == {"G1", "G7"}
    assert all(a.educator_id.startswith("VII-") == (a.group_id == "G7") for a in result.assignments)
    assert c.model_dump() == before
    c.selected_group_ids = ["G7"]
    assert validate_configuration(c).status == "VALID_INPUT"
    c.selected_group_ids = ["G1", "DRAFT-3"]
    blocked = validate_configuration(c)
    assert blocked.status == "INVALID_INPUT"
    assert any(m.group_id == "DRAFT-3" for m in blocked.messages)
