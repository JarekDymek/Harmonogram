from __future__ import annotations

from datetime import datetime, timedelta
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from app.domain import rules
from app.fixtures.demo import demo_configuration
from app.models.schemas import (
    Educator,
    ExternalDutyAssignment,
    GroupConfiguration,
    GroupEducatorMembership,
    GroupEducatorRole,
    ScheduleConfiguration,
    WorkAssignment,
)
from app.services.care_calculator import calculate_care
from app.services.generation import generate_schedule
from app.services.objective import (
    calculate_objective,
    canonicalize_assignments,
    objective_priority_key,
)
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import validate_schedule


def _add_group(configuration, number: int, *, shared_a: bool = False) -> None:
    group_id = f"G{number}"
    configuration.groups.append(
        GroupConfiguration(
            id=group_id,
            display_order=number,
            code=str(number),
            name=f"Grupa {number}",
            class_label=f"kl. {number}",
        )
    )
    ids = ["A"] if shared_a else []
    ids.extend(f"G{number}{letter}" for letter in "ABC")
    for index, educator_id in enumerate(ids):
        if educator_id != "A":
            configuration.educators.append(
                Educator(
                    id=educator_id,
                    display_name=f"Wychowawca {educator_id}",
                    short_code=educator_id,
                )
            )
        configuration.group_memberships.append(
            GroupEducatorMembership(
                id=f"MEM-{group_id}-{educator_id}",
                group_id=group_id,
                educator_id=educator_id,
                role=(
                    GroupEducatorRole.PRIMARY
                    if index < 3
                    else GroupEducatorRole.SUPPORT
                ),
                weekly_target_hours_by_week=[
                    0 if shared_a and educator_id == "A" else (27.5, 27.5, 27)[index - int(shared_a)]
                ],
            )
        )
    for plan in [item for item in configuration.day_plans if item.group_id == "G1"]:
        configuration.day_plans.append(
            plan.model_copy(
                deep=True,
                update={"id": f"{plan.id}-{group_id}", "group_id": group_id},
            )
        )
    mapping = {"A": ids[-3], "B": ids[-2], "C": ids[-1]}
    for source in [
        item for item in configuration.weekend_variants if item.group_id == "G1"
    ]:
        variant = source.model_copy(deep=True)
        variant.id = f"{source.id}-{group_id}"
        variant.group_id = group_id
        if variant.off_educator_id is not None:
            variant.off_educator_id = mapping[variant.off_educator_id]
        for template in (variant.saturday_template, variant.sunday_template):
            template.id = f"{template.id}-{group_id}"
            for assignment in template.assignments:
                assignment.id = f"{assignment.id}-{group_id}"
                assignment.educator_id = mapping[assignment.educator_id]
        configuration.weekend_variants.append(variant)
    configuration.group_count = len(configuration.groups)
    configuration.selected_group_ids = [item.id for item in configuration.groups]


def two_group_configuration(*, shared_a: bool = False):
    configuration = demo_configuration()
    _add_group(configuration, 2, shared_a=shared_a)
    return configuration


def test_no_return_a_b_a_is_rejected_by_independent_validator():
    configuration = demo_configuration()
    care = calculate_care(configuration)
    day = care[0]
    block = max(day.intervals, key=lambda item: item.end_minute - item.start_minute)
    first_end = block.start_minute + 150
    second_end = first_end + 150
    assignments = [
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=block.start_minute, end_minute=first_end),
        WorkAssignment(group_id="G1", educator_id="B", date=day.date, start_minute=first_end, end_minute=second_end),
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=second_end, end_minute=block.end_minute),
    ]

    report = validate_schedule(configuration, assignments)

    assert rules.RULE_NO_RETURN_WITHIN_BLOCK in {
        item.rule_id for item in report.messages
    }


def test_same_educator_in_two_separate_care_blocks_is_allowed():
    configuration = demo_configuration()
    care = calculate_care(configuration)
    day = next(item for item in care if len(item.intervals) == 2)
    assignments = [
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=day.intervals[0].start_minute, end_minute=day.intervals[0].end_minute),
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=day.intervals[1].start_minute, end_minute=day.intervals[1].start_minute + 180),
    ]

    report = validate_schedule(configuration, assignments)

    assert rules.RULE_NO_RETURN_WITHIN_BLOCK not in {
        item.rule_id for item in report.messages
    }
    assert report.objective is not None
    assert report.objective.split_days_penalty == 1


def test_adjacent_slots_are_canonically_merged():
    target_date = demo_configuration().cycle_start_date
    merged = canonicalize_assignments(
        [
            WorkAssignment(group_id="G1", educator_id="A", date=target_date, start_minute=840, end_minute=960),
            WorkAssignment(group_id="G1", educator_id="A", date=target_date, start_minute=960, end_minute=1080),
        ]
    )
    assert [(item.start_minute, item.end_minute) for item in merged] == [
        (840, 1080)
    ]


def test_lexicographic_quality_prefers_two_people_over_three():
    configuration = demo_configuration()
    care = calculate_care(configuration)
    day = care[0]
    block = max(day.intervals, key=lambda item: item.end_minute - item.start_minute)
    middle = block.start_minute + (block.end_minute - block.start_minute) // 2
    solution_x = [
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=block.start_minute, end_minute=middle),
        WorkAssignment(group_id="G1", educator_id="B", date=day.date, start_minute=middle, end_minute=block.end_minute),
    ]
    first = block.start_minute + 120
    second = first + 120
    solution_y = [
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=block.start_minute, end_minute=first),
        WorkAssignment(group_id="G1", educator_id="B", date=day.date, start_minute=first, end_minute=second),
        WorkAssignment(group_id="G1", educator_id="C", date=day.date, start_minute=second, end_minute=block.end_minute),
    ]
    x = calculate_objective(configuration, care, solution_x)
    y = calculate_objective(configuration, care, solution_y)

    assert x.continuous_block_handovers == 1
    assert y.continuous_block_handovers == 2
    assert objective_priority_key(x) < objective_priority_key(y)


def test_three_people_in_one_block_remain_allowed_without_return():
    configuration = demo_configuration()
    care = calculate_care(configuration)
    day = care[0]
    block = max(day.intervals, key=lambda item: item.end_minute - item.start_minute)
    assignments = [
        WorkAssignment(group_id="G1", educator_id="A", date=day.date, start_minute=block.start_minute, end_minute=block.start_minute + 120),
        WorkAssignment(group_id="G1", educator_id="B", date=day.date, start_minute=block.start_minute + 120, end_minute=block.start_minute + 240),
        WorkAssignment(group_id="G1", educator_id="C", date=day.date, start_minute=block.start_minute + 240, end_minute=block.end_minute),
    ]

    report = validate_schedule(configuration, assignments)

    assert rules.RULE_NO_RETURN_WITHIN_BLOCK not in {
        item.rule_id for item in report.messages
    }


def test_two_groups_are_generated_in_one_model():
    configuration = two_group_configuration()

    response = generate_schedule(configuration)

    assert response.generation_status == "CANDIDATE_FOUND"
    assert {item.group_id for item in response.assignments} == {"G1", "G2"}
    assert response.validation_report is not None
    assert response.validation_report.status == "VALID"


def test_eight_group_project_passes_input_validation():
    configuration = demo_configuration()
    for number in range(2, 9):
        _add_group(configuration, number)

    report = validate_configuration(configuration)

    assert configuration.group_count == 8
    assert report.status == "VALID_INPUT"
    assert {item.group_id for item in report.care} == {
        f"G{number}" for number in range(1, 9)
    }


def test_cross_group_overlap_is_reported_for_one_global_educator():
    configuration = two_group_configuration(shared_a=True)
    target_date = configuration.cycle_start_date
    assignments = [
        WorkAssignment(group_id="G1", educator_id="A", date=target_date, start_minute=840, end_minute=1080),
        WorkAssignment(group_id="G2", educator_id="A", date=target_date, start_minute=900, end_minute=1140),
    ]

    report = validate_schedule(configuration, assignments)

    assert rules.RULE_CROSS_GROUP_NO_OVERLAP in {
        item.rule_id for item in report.messages
    }


def test_cross_group_rest_is_calculated_globally():
    configuration = two_group_configuration(shared_a=True)
    target_date = configuration.cycle_start_date
    assignments = [
        WorkAssignment(group_id="G1", educator_id="A", date=target_date, start_minute=1200, end_minute=1320),
        WorkAssignment(group_id="G2", educator_id="A", date=target_date + timedelta(days=1), start_minute=360, end_minute=480),
    ]

    report = validate_schedule(configuration, assignments)

    assert rules.RULE_CROSS_GROUP_REST in {
        item.rule_id for item in report.messages
    }


def test_night_duty_blocks_overlapping_group_assignment():
    configuration = demo_configuration()
    start = datetime.combine(
        configuration.cycle_start_date,
        datetime.min.time(),
        tzinfo=ZoneInfo(configuration.time_zone_id),
    ) + timedelta(hours=22)
    configuration.external_duty_assignments.append(
        ExternalDutyAssignment(
            id="NIGHT-A",
            educator_id="A",
            start_date_time=start,
            end_date_time=start + timedelta(hours=8),
            duty_type="NIGHT",
        )
    )
    assignments = [
        WorkAssignment(
            group_id="G1",
            educator_id="A",
            date=configuration.cycle_start_date + timedelta(days=1),
            start_minute=300,
            end_minute=420,
        )
    ]

    report = validate_schedule(configuration, assignments)

    assert rules.RULE_CROSS_GROUP_NO_OVERLAP in {
        item.rule_id for item in report.messages
    }


def test_solver_respects_cross_midnight_night_duty():
    configuration = demo_configuration()
    start = datetime.combine(
        configuration.cycle_start_date,
        datetime.min.time(),
        tzinfo=ZoneInfo(configuration.time_zone_id),
    ) + timedelta(hours=22)
    configuration.external_duty_assignments.append(
        ExternalDutyAssignment(
            id="NIGHT-SOLVER-A",
            educator_id="A",
            start_date_time=start,
            end_date_time=start + timedelta(hours=8),
            duty_type="NIGHT",
        )
    )

    response = generate_schedule(configuration)

    assert response.generation_status == "CANDIDATE_FOUND"
    assert response.validation_report is not None
    assert response.validation_report.status == "VALID"
    following_date = configuration.cycle_start_date + timedelta(days=1)
    assert all(
        not (
            item.educator_id == "A"
            and item.date == following_date
            and item.start_minute < 6 * 60
        )
        for item in response.assignments
    )


def test_legacy_single_group_payload_is_migrated_without_data_loss():
    source = demo_configuration()
    payload = source.model_dump(mode="json", by_alias=True)
    payload["schemaVersion"] = 2
    for field in (
        "groupCount",
        "groups",
        "activeGroupId",
        "selectedGroupIds",
        "groupMemberships",
        "externalDutyAssignments",
        "commonAreaDuties",
        "lockedAssignments",
    ):
        payload.pop(field, None)
    for educator in payload["educators"]:
        educator["groupId"] = payload["groupId"]
    for variant in payload["weekendVariants"]:
        variant.pop("groupId", None)

    migrated = ScheduleConfiguration.model_validate(payload)

    assert migrated.schema_version == 3
    assert migrated.group_count == 1
    assert len(migrated.groups) == 1
    assert len(migrated.educators) == 3
    assert len(migrated.group_memberships) == 3
    assert len(migrated.day_plans) == len(source.day_plans)
    assert len(migrated.weekend_variants) == len(source.weekend_variants)
    assert all(item.group_id == migrated.groups[0].id for item in migrated.weekend_variants)


def test_reference_fixture_matches_selected_docx_cells():
    path = Path(__file__).parents[1] / "app" / "fixtures" / "internat_week_42_2026.json"
    fixture = json.loads(path.read_text(encoding="utf-8"))
    group_vi = next(item for item in fixture["groups"] if item["code"] == "VI")
    monday = [item for item in group_vi["dailyAssignments"] if item["date"] == "2026-06-15"]
    tuesday = [item for item in group_vi["dailyAssignments"] if item["date"] == "2026-06-16"]

    assert fixture["groupCount"] == 8
    assert [item["code"] for item in fixture["groups"]] == ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
    assert [(item["startTime"], item["endTime"], item["educatorId"]) for item in monday] == [
        ("06:00", "08:00", "EDU-KOWALSKA"),
        ("14:30", "20:00", "EDU-KOWALSKA"),
        ("20:00", "22:00", "EDU-DEMBINSKI"),
    ]
    assert [(item["startTime"], item["endTime"], item["educatorId"]) for item in tuesday] == [
        ("06:00", "08:00", "EDU-DEMBINSKI"),
        ("13:30", "15:30", "EDU-CHLEBOWSKI"),
        ("15:30", "19:00", "EDU-KOWALSKA"),
        ("19:00", "22:00", "EDU-DYMEK"),
    ]
    assert len(group_vi["educatorHourSummary"]) == 4
    assert len(fixture["externalDutyAssignments"]) == 8
    assert len(fixture["commonAreaDuties"]) == 7
    assert fixture["commonAreaDuties"][0]["date"] == "2026-06-15"
    assert fixture["commonAreaDuties"][0]["groupId"] == "G5"
    assert fixture["commonAreaDuties"][0]["dutyType"] == "DINING_ROOM"
