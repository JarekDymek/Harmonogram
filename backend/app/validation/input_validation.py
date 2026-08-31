from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta

from app.domain import rules
from app.validation.work_calendar import commitment_messages
from app.validation.weekend_days_off import weekend_days_off_messages
from app.models.schemas import (
    CalculatedCareDay,
    DomainMessage,
    InputStatus,
    InputValidationResponse,
    LegalStatus,
    OperationMode,
    PlanScope,
    PublicResult,
    ScheduleConfiguration,
    ScheduleBoundaryMode,
    UnavailabilityScope,
    WeekendDay,
    WeekendVariantKind,
)
from app.services.care_calculator import (
    CareCalculationError,
    calculate_care,
    calculate_plan_pairs,
    plan_duplicates,
    select_effective_plan,
)
from app.services.reports import error, warning
from app.services.time_utils import (
    TimeDomainError,
    aware_local_datetime,
    format_hhmm,
    normalize_pairs,
    parse_hhmm,
    validate_interval,
    zone,
)
from app.services.weekend import (
    base_variant,
    selected_weekend_variant,
    template_tuples,
    variant_working_educators,
)


def _has_errors(messages: list[DomainMessage]) -> bool:
    return any(message.severity == "ERROR" for message in messages)


def _validate_internat_project(
    configuration: ScheduleConfiguration,
) -> InputValidationResponse:
    messages: list[DomainMessage] = []
    active_groups = [item for item in configuration.groups if item.active]
    group_ids = {item.id for item in active_groups}
    educator_ids = {item.id for item in configuration.educators if item.active}
    if configuration.group_count != len(active_groups):
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Liczba grup nie odpowiada liczbie aktywnych konfiguracji grup.",
                required=configuration.group_count,
                actual=len(active_groups),
            )
        )
    selected = set(configuration.selected_group_ids)
    if not selected or not selected.issubset(group_ids):
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Zakres generowania musi wskazywać istniejące aktywne grupy.",
                required=str(sorted(group_ids)),
                actual=str(sorted(selected)),
            )
        )
    membership_keys: set[tuple[str, str]] = set()
    for membership in configuration.group_memberships:
        key = (membership.group_id, membership.educator_id)
        if key in membership_keys:
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Członkostwo wychowawcy w grupie nie może być zduplikowane.",
                    group_id=membership.group_id,
                    educator_id=membership.educator_id,
                    actual=str(key),
                )
            )
        membership_keys.add(key)
        if membership.group_id not in group_ids or membership.educator_id not in educator_ids:
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Członkostwo wskazuje nieistniejącą grupę albo wychowawcę.",
                    group_id=membership.group_id,
                    educator_id=membership.educator_id,
                )
            )
        if len(membership.weekly_target_hours_by_week) not in (
            1,
            configuration.planning_horizon_weeks,
        ):
            messages.append(
                error(
                    rules.RULE_HOURS,
                    "Wymiar członkostwa musi zawierać jedną wartość bazową albo wartość każdego tygodnia.",
                    group_id=membership.group_id,
                    educator_id=membership.educator_id,
                    required=configuration.planning_horizon_weeks,
                    actual=len(membership.weekly_target_hours_by_week),
                )
            )
        for value in membership.weekly_target_hours_by_week:
            if value < 0 or round(value * 2) != value * 2:
                messages.append(
                    error(
                        rules.RULE_TIME_STEP,
                        "Wymiar godzin musi być nieujemną wielokrotnością 30 minut.",
                        group_id=membership.group_id,
                        educator_id=membership.educator_id,
                        actual=value,
                    )
                )
    for group in active_groups:
        count = len(configuration.memberships_for_group(group.id))
        if count not in (3, 4):
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Aktywna grupa wymaga trzech lub czterech członkostw.",
                    group_id=group.id,
                    required="3 albo 4",
                    actual=count,
                )
            )
    for duty in configuration.external_duty_assignments:
        if duty.educator_id not in educator_ids:
            messages.append(
                error(
                    rules.RULE_CROSS_GROUP_REST,
                    "Dyżur zewnętrzny ma niepoprawną osobę albo zakres czasu.",
                    educator_id=duty.educator_id,
                    actual=f"{duty.start_date_time}–{duty.end_date_time}",
                )
            )
    for duty in configuration.common_area_duties:
        if duty.group_id not in group_ids:
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Dyżur wspólny wskazuje nieistniejącą grupę.",
                    group_id=duty.group_id,
                    date_value=duty.date,
                )
            )
    for assignment in configuration.locked_assignments:
        if (
            assignment.educator_id not in educator_ids
            or assignment.group_id not in {"EXTERNAL", *group_ids}
        ):
            messages.append(
                error(
                    rules.RULE_CROSS_GROUP_NO_OVERLAP,
                    "Zablokowany przydział wskazuje nieistniejącą osobę albo grupę.",
                    group_id=assignment.group_id,
                    educator_id=assignment.educator_id,
                    date_value=assignment.date,
                )
            )
    messages.extend(commitment_messages(configuration))
    if _has_errors(messages):
        return InputValidationResponse(
            status=InputStatus.INVALID_INPUT,
            public_result=PublicResult.DANE_NIEPOPRAWNE,
            messages=messages,
        )

    care: list[CalculatedCareDay] = []
    balances: list[dict] = []
    for group in configuration.active_groups():
        report = validate_configuration(configuration.configuration_for_group(group.id), _group_view=True)
        for message in report.messages:
            messages.append(
                message
                if message.group_id is not None
                else message.model_copy(update={"group_id": group.id})
            )
        care.extend(report.care)
        balances.extend(
            [{**item, "groupId": group.id} for item in report.weekly_balance]
        )
    messages.extend(commitment_messages(configuration, care))
    messages.extend(weekend_days_off_messages(configuration, care=care))
    from app.validation.schedule_validator import _cross_group_messages
    messages.extend(m for m in _cross_group_messages(configuration, [a for a in configuration.required_assignments if a.group_id in configuration.selected_group_ids])
                    if m.context.get("relatedRuleId") != rules.RULE_REST_WEEKLY)
    return InputValidationResponse(
        status=(
            InputStatus.INVALID_INPUT
            if _has_errors(messages)
            else InputStatus.VALID_INPUT
        ),
        public_result=(
            PublicResult.DANE_NIEPOPRAWNE if _has_errors(messages) else None
        ),
        messages=messages,
        care=sorted(care, key=lambda item: (item.date, item.group_id)),
        weekly_balance=balances,
    )


def _structural_messages(configuration: ScheduleConfiguration) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    org = configuration.organizational_rules
    legal = configuration.legal_rules

    if configuration.cycle_start_date.weekday() != 0 or configuration.week_start_day != "MONDAY":
        messages.append(
            error(
                rules.RULE_CROSS_WEEK,
                "Cykl musi rozpoczynać się w poniedziałek, a weekStartDay musi wynosić MONDAY.",
                required="poniedziałek / MONDAY",
                actual=f"{configuration.cycle_start_date:%A} / {configuration.week_start_day}",
                context={"field": "cycleStartDate"},
            )
        )
    if (
        configuration.schedule_boundary_mode == ScheduleBoundaryMode.CYCLIC
        and configuration.planning_horizon_weeks != 6
    ):
        messages.append(
            error(
                rules.RULE_CROSS_WEEK,
                "Tryb CYCLIC jest dozwolony wyłącznie dla sześciu tygodni.",
                required="6 tygodni",
                actual=configuration.planning_horizon_weeks,
            )
        )
    try:
        zone(configuration.time_zone_id)
    except TimeDomainError as exc:
        messages.append(
            error(
                rules.RULE_REST_DAILY,
                str(exc),
                required="jawna strefa IANA",
                actual=configuration.time_zone_id,
            )
        )

    if (
        org.time_step_minutes != rules.TIME_STEP_MINUTES
        or org.minimum_segment_minutes != rules.MINIMUM_SEGMENT_MINUTES
    ):
        messages.append(
            error(
                rules.RULE_TIME_STEP,
                "Krok musi wynosić 30 minut, a minimalny odcinek 120 minut.",
                required="30 / 120",
                actual=f"{org.time_step_minutes} / {org.minimum_segment_minutes}",
            )
        )
    if org.required_work_days_per_week != rules.REQUIRED_WORK_DAYS:
        messages.append(
            error(
                rules.RULE_DAYS,
                "Plan wymaga dokładnie pięciu dni pracy i dwóch dni całkowicie wolnych w tygodniu.",
                required=5,
                actual=org.required_work_days_per_week,
            )
        )

    active_educators = [item for item in configuration.educators if item.active]
    if len(active_educators) != configuration.educator_count:
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Liczba aktywnych wychowawców musi odpowiadać konfiguracji grupy.",
                required=configuration.educator_count,
                actual=len(active_educators),
            )
        )
    educator_ids = [item.id for item in active_educators]
    if len(set(educator_ids)) != len(educator_ids):
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Identyfikatory wychowawców muszą być unikalne.",
                required=f"{configuration.educator_count} unikalne identyfikatory",
                actual=educator_ids,
            )
        )
    for educator in active_educators:
        if not educator.display_name.strip() or not educator.short_code.strip():
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Każdy aktywny wychowawca wymaga nazwy i skrótu.",
                    educator_id=educator.id,
                    required="nazwa i skrót",
                    actual=f"{educator.display_name!r} / {educator.short_code!r}",
                )
            )
        if educator.group_id != configuration.group_id:
            messages.append(
                error(
                    rules.RULE_NO_GUESSING,
                    "Wychowawca należy do innej grupy niż konfiguracja.",
                    educator_id=educator.id,
                    required=configuration.group_id,
                    actual=educator.group_id,
                )
            )
        if not educator.can_work_weekends:
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Każdy aktywny wychowawca musi móc zostać wskazany w jawnym wzorcu weekendowym.",
                    educator_id=educator.id,
                    required=True,
                    actual=False,
                )
            )
        if educator.base_weekly_assigned_minutes % org.time_step_minutes:
            messages.append(
                error(
                    rules.RULE_HOURS,
                    "Podstawowy przydział musi być wielokrotnością 30 minut.",
                    educator_id=educator.id,
                    required="wielokrotność 30",
                    actual=educator.base_weekly_assigned_minutes,
                )
            )

    version_ids = {
        configuration.organizational_rules.configuration_version_id,
        configuration.legal_rules.configuration_version_id,
        *(plan.configuration_version_id for plan in configuration.day_plans),
        *(item.configuration_version_id for item in configuration.weekend_variants),
        *(item.configuration_version_id for item in configuration.assignment_overrides),
    }
    if version_ids != {configuration.configuration_version_id}:
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Relacje nie mogą łączyć różnych wersji konfiguracji.",
                required=configuration.configuration_version_id,
                actual=sorted(version_ids),
            )
        )

    for plan in configuration.day_plans:
        if plan.group_id != configuration.group_id:
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    "Plan dnia należy do innej grupy.",
                    required=configuration.group_id,
                    actual=plan.group_id,
                    context={"planId": plan.id},
                )
            )
        required_shape = (
            (plan.scope == PlanScope.BASE_WEEKLY and plan.day_of_week is not None and plan.week_number is None and plan.date is None)
            or (plan.scope == PlanScope.CYCLE_WEEK and plan.day_of_week is not None and plan.week_number is not None and plan.date is None)
            or (plan.scope == PlanScope.SPECIFIC_DATE and plan.date is not None and plan.week_number is None)
        )
        if not required_shape or not plan.approved:
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    "Plan jest częściowy, ma niezgodny zakres albo nie został zatwierdzony.",
                    required="kompletny i zatwierdzony plan",
                    actual=plan.scope,
                    context={"planId": plan.id},
                )
            )
        if plan.event_type == "CUSTOM" and not plan.custom_event_type:
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    "Dla wydarzenia CUSTOM wymagane jest customEventType.",
                    context={"planId": plan.id},
                )
            )
        try:
            calculate_plan_pairs(plan, time_step_minutes=org.time_step_minutes)
        except (CareCalculationError, TimeDomainError) as exc:
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    str(exc),
                    context={"planId": plan.id},
                )
            )

    duplicates = plan_duplicates(configuration.day_plans)
    for key in duplicates:
        messages.append(
            error(
                rules.RULE_SPECIAL_DAY,
                "Istnieją dwa zatwierdzone plany dla tego samego klucza.",
                required=1,
                actual=2,
                context={"key": [str(value) for value in key]},
            )
        )
    base_days = Counter(
        plan.day_of_week
        for plan in configuration.day_plans
        if plan.approved and plan.scope == PlanScope.BASE_WEEKLY
    )
    for day_of_week in range(7):
        if base_days[day_of_week] != 1:
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    "Dla każdego dnia tygodnia wymagany jest dokładnie jeden plan BASE_WEEKLY.",
                    required=1,
                    actual=base_days[day_of_week],
                    context={"dayOfWeek": day_of_week},
                )
            )

    override_keys: Counter[tuple[str, int]] = Counter()
    for item in configuration.assignment_overrides:
        override_keys[(item.educator_id, item.week_number)] += 1
        if item.educator_id not in educator_ids:
            messages.append(
                error(
                    rules.RULE_HOURS,
                    "Przydział zastępczy wskazuje nieznanego wychowawcę.",
                    educator_id=item.educator_id,
                )
            )
        if item.assigned_minutes % org.time_step_minutes:
            messages.append(
                error(
                    rules.RULE_HOURS,
                    "Przydział zastępczy musi być wielokrotnością 30 minut.",
                    educator_id=item.educator_id,
                    actual=item.assigned_minutes,
                )
            )
    for key, count in override_keys.items():
        if count > 1:
            messages.append(
                error(
                    rules.RULE_HOURS,
                    "Dla wychowawcy i tygodnia może istnieć najwyżej jeden przydział zastępczy.",
                    educator_id=key[0],
                    required=1,
                    actual=count,
                    context={"weekNumber": key[1]},
                )
            )

    for item in configuration.unavailability:
        if item.educator_id not in educator_ids:
            messages.append(
                error(
                    rules.RULE_HARD_UNAVAILABLE,
                    "Niedostępność wskazuje nieznanego wychowawcę.",
                    educator_id=item.educator_id,
                )
            )
        valid_scope = (
            (item.scope == UnavailabilityScope.RECURRING_WEEKLY and item.day_of_week is not None and item.week_number is None and item.date is None)
            or (item.scope == UnavailabilityScope.CYCLE_WEEK and item.day_of_week is not None and item.week_number is not None and item.date is None)
            or (item.scope == UnavailabilityScope.SPECIFIC_DATE and item.date is not None and item.week_number is None)
        )
        if not valid_scope:
            messages.append(
                error(
                    rules.RULE_HARD_UNAVAILABLE,
                    "Zakres niedostępności jest niekompletny.",
                    context={"unavailabilityId": item.id},
                )
            )
        try:
            validate_interval(
                type("_Interval", (), {"start_time": item.start_time, "end_time": item.end_time})(),
                time_step_minutes=org.time_step_minutes,
            )
        except TimeDomainError as exc:
            messages.append(
                error(
                    rules.RULE_TIME_STEP,
                    str(exc),
                    educator_id=item.educator_id,
                    context={"unavailabilityId": item.id},
                )
            )

    if legal.verification_status != LegalStatus.VERIFIED and configuration.requested_operation_mode == OperationMode.PRODUCTION:
        messages.append(
            error(
                rules.RULE_LEGAL,
                "Tryb produkcyjny wymaga ważnego profilu VERIFIED.",
                required="VERIFIED",
                actual=legal.verification_status,
            )
        )
    if legal.verification_status == LegalStatus.VERIFIED:
        missing_trace = [
            name
            for name, value in (
                ("sourceTitle", legal.source_title),
                (
                    "sourceIdentifierOrDescription",
                    legal.source_identifier or legal.source_section,
                ),
                ("verifiedAt", legal.verified_at),
                ("effectiveFrom", legal.effective_from),
                ("approvedBy", legal.approved_by),
                ("version", legal.version),
            )
            if not value
        ]
        if missing_trace:
            messages.append(
                error(
                    rules.RULE_LEGAL,
                    "Profil VERIFIED nie ma kompletnego śladu prawnego.",
                    required="pełny ślad",
                    actual=", ".join(missing_trace),
                )
            )
        cycle_end = configuration.cycle_start_date + timedelta(
            days=configuration.planning_horizon_weeks * 7 - 1
        )
        if (
            legal.effective_from is None
            or configuration.cycle_start_date < legal.effective_from
            or (
                legal.effective_to is not None
                and cycle_end > legal.effective_to
            )
        ):
            messages.append(
                error(
                    rules.RULE_LEGAL,
                    "Zakres obowiązywania profilu VERIFIED nie obejmuje całego cyklu.",
                    required=f"{configuration.cycle_start_date}–{cycle_end}",
                    actual=f"{legal.effective_from}–{legal.effective_to}",
                )
            )
    if legal.weekly_rest_exception_enabled:
        required_exception = (
            legal.weekly_rest_exception_minimum_minutes,
            legal.weekly_rest_exception_maximum_occurrences_per_cycle,
            legal.weekly_rest_exception_minimum_gap_minutes,
        )
        if any(value is None for value in required_exception):
            messages.append(
                error(
                    rules.RULE_REST_WEEKLY,
                    "Włączony wyjątek odpoczynku tygodniowego wymaga pełnej konfiguracji.",
                )
            )
    else:
        unused_exception_values = (
            legal.weekly_rest_exception_minimum_minutes,
            legal.weekly_rest_exception_maximum_occurrences_per_cycle,
            legal.weekly_rest_exception_minimum_gap_minutes,
        )
        if any(value is not None for value in unused_exception_values):
            messages.append(
                error(
                    rules.RULE_REST_WEEKLY,
                    "Wyłączony wyjątek odpoczynku musi mieć puste pola parametrów wyjątku.",
                    required="null / null / null",
                    actual=str(unused_exception_values),
                )
            )
    if legal.weekly_rest_compensation_required and (
        legal.weekly_rest_compensation_minutes is None
        or legal.weekly_rest_compensation_deadline_minutes is None
    ):
        messages.append(
            error(
                rules.RULE_REST_WEEKLY,
                "Wymagana kompensacja musi mieć wymiar i termin.",
            )
        )
    if not legal.weekly_rest_compensation_required and (
        legal.weekly_rest_compensation_minutes is not None
        or legal.weekly_rest_compensation_deadline_minutes is not None
    ):
        messages.append(
            error(
                rules.RULE_REST_WEEKLY,
                "Wyłączona kompensacja musi mieć puste pola wymiaru i terminu.",
            )
        )
    try:
        anchor_minute = parse_hhmm(legal.weekly_rest_anchor_time)
        if anchor_minute % org.time_step_minutes:
            raise TimeDomainError(
                "Kotwica odpoczynku tygodniowego nie jest zgodna z krokiem 30 minut."
            )
    except TimeDomainError as exc:
        messages.append(error(rules.RULE_REST_WEEKLY, str(exc)))
    if (
        legal.weekly_rest_window_length_minutes % org.time_step_minutes
        or legal.weekly_rest_window_step_minutes % org.time_step_minutes
        or legal.minimum_weekly_rest_minutes % org.time_step_minutes
    ):
        messages.append(
            error(
                rules.RULE_REST_WEEKLY,
                "Długość okna, krok okna i odpoczynek tygodniowy muszą być wielokrotnościami kroku czasu.",
                required="wielokrotność 30 minut",
                actual=(
                    f"{legal.weekly_rest_window_length_minutes} / "
                    f"{legal.weekly_rest_window_step_minutes} / "
                    f"{legal.minimum_weekly_rest_minutes}"
                ),
            )
        )

    base_variants = [
        item for item in configuration.weekend_variants if item.variant_kind == WeekendVariantKind.BASE and item.approved
    ]
    positions = Counter(item.position_in_cycle for item in base_variants)
    if len(base_variants) != 6 or set(positions) != set(range(1, 7)) or any(count != 1 for count in positions.values()):
        messages.append(
            error(
                rules.RULE_ROTATION,
                "Wymagane jest dokładnie sześć zatwierdzonych wariantów BASE pozycji 1–6.",
                required="1,2,3,4,5,6",
                actual=sorted(value for value in positions if value is not None),
            )
        )
    expected_pairs = (
        (0, 1, 2),
        (0, 2, 1),
        (1, 2, 0),
        (1, 0, 2),
        (2, 0, 1),
        (2, 1, 0),
    )
    for position in range(1, 7):
        matches = [
            item for item in base_variants if item.position_in_cycle == position
        ]
        if len(matches) != 1:
            continue
        variant = matches[0]
        working = variant_working_educators(variant)
        if len(working) != 2 or not working.issubset(set(educator_ids)):
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Każdy wariant weekendowy musi jawnie wskazywać dokładnie dwóch aktywnych wychowawców.",
                    required="2 aktywnych wychowawców",
                    actual=sorted(working),
                    context={"position": position},
                )
            )
        saturday_workers = {
            item.educator_id
            for item in variant.saturday_template.assignments
        }
        sunday_workers = {
            item.educator_id
            for item in variant.sunday_template.assignments
        }
        if saturday_workers != working or sunday_workers != working:
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Sobota i niedziela wariantu muszą wskazywać tę samą jawną parę.",
                    required=sorted(working),
                    actual=f"{sorted(saturday_workers)} / {sorted(sunday_workers)}",
                    context={"position": position},
                )
            )
        if len(educator_ids) == 3:
            pair = expected_pairs[position - 1]
            expected_working = {educator_ids[pair[0]], educator_ids[pair[1]]}
            expected_off = educator_ids[pair[2]]
            if working != expected_working or variant.off_educator_id != expected_off:
                messages.append(
                    error(
                        rules.RULE_ROTATION,
                        "Wariant weekendowy nie odpowiada zatwierdzonej parze i osobie wolnej.",
                        required=f"{sorted(expected_working)} / {expected_off}",
                        actual=f"{sorted(working)} / {variant.off_educator_id}",
                        context={"position": position},
                    )
                )
        elif (
            variant.off_educator_id is not None
            and variant.off_educator_id not in set(educator_ids) - working
        ):
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Opcjonalna osoba wolna musi należeć do aktywnych osób nieujętych we wzorcu.",
                    actual=variant.off_educator_id,
                    context={"position": position},
                )
            )
        for template, expected_day in (
            (variant.saturday_template, WeekendDay.SATURDAY),
            (variant.sunday_template, WeekendDay.SUNDAY),
        ):
            if template.day_of_week != expected_day:
                messages.append(
                    error(
                        rules.RULE_WEEKEND,
                        "Szablon weekendu ma niepoprawny dzień.",
                        required=expected_day,
                        actual=template.day_of_week,
                        context={"variantId": variant.id},
                    )
                )
            sequence = [
                item.sequence_number
                for item in sorted(
                    template.assignments,
                    key=lambda value: value.sequence_number,
                )
            ]
            if sequence != list(range(1, len(sequence) + 1)):
                messages.append(
                    error(
                        rules.RULE_WEEKEND,
                        "sequenceNumber musi być ciągły od 1.",
                        required=list(range(1, len(sequence) + 1)),
                        actual=sequence,
                        context={"variantId": variant.id},
                    )
                )
            for item in template.assignments:
                if item.educator_id not in educator_ids:
                    messages.append(
                        error(
                            rules.RULE_WEEKEND,
                            "Szablon wskazuje nieaktywnego wychowawcę.",
                            educator_id=item.educator_id,
                            context={"variantId": variant.id},
                        )
                    )
                try:
                    start = parse_hhmm(item.start_time)
                    end = parse_hhmm(item.end_time)
                    if start % org.time_step_minutes or end % org.time_step_minutes:
                        raise TimeDomainError(
                            "Granica szablonu nie jest zgodna z krokiem."
                        )
                    if end - start < org.minimum_segment_minutes:
                        raise TimeDomainError(
                            "Odcinek szablonu jest krótszy niż 120 minut."
                        )
                except TimeDomainError as exc:
                    messages.append(
                        error(
                            rules.RULE_WEEKEND,
                            str(exc),
                            educator_id=item.educator_id,
                            context={"variantId": variant.id},
                        )
                    )

    if configuration.boundary_context is not None:
        context_ids = [
            item.educator_id for item in configuration.boundary_context.educators
        ]
        if len(context_ids) != len(set(context_ids)):
            messages.append(
                error(
                    rules.RULE_CROSS_WEEK,
                    "Kontekst graniczny zawiera duplikat wychowawcy.",
                    actual=context_ids,
                )
            )
        unknown = sorted(set(context_ids) - set(educator_ids))
        if unknown:
            messages.append(
                error(
                    rules.RULE_CROSS_WEEK,
                    "Kontekst graniczny wskazuje nieaktywnych wychowawców.",
                    actual=unknown,
                )
            )
        horizon_end = configuration.cycle_start_date + timedelta(
            days=configuration.planning_horizon_weeks * 7
        )
        for item in configuration.boundary_context.educators:
            previous = item.last_assignment_before
            following = item.first_assignment_after
            for label, segment in (
                ("lastAssignmentBefore", previous),
                ("firstAssignmentAfter", following),
            ):
                if segment is not None:
                    duration = segment.end_minute - segment.start_minute
                    if (
                        duration < org.minimum_segment_minutes
                        or segment.start_minute % org.time_step_minutes
                        or segment.end_minute % org.time_step_minutes
                    ):
                        messages.append(
                            error(
                                rules.RULE_CROSS_WEEK,
                                "Odcinek kontekstu granicznego musi mieć co najmniej 2 godziny i granice w kroku 30 minut.",
                                educator_id=item.educator_id,
                                required="minimum 120, krok 30",
                                actual=f"{segment.start_minute}–{segment.end_minute}",
                                context={"field": label},
                            )
                        )
            if previous is not None and previous.date >= configuration.cycle_start_date:
                messages.append(
                    error(
                        rules.RULE_CROSS_WEEK,
                        "Poprzedni przydział graniczny musi przypadać przed horyzontem.",
                        educator_id=item.educator_id,
                        required=f"data < {configuration.cycle_start_date}",
                        actual=previous.date,
                    )
                )
            if following is not None and following.date < horizon_end:
                messages.append(
                    error(
                        rules.RULE_CROSS_WEEK,
                        "Następny przydział graniczny musi przypadać po horyzoncie.",
                        educator_id=item.educator_id,
                        required=f"data >= {horizon_end}",
                        actual=following.date,
                    )
                )

    substitute_keys: Counter[tuple[object, ...]] = Counter()
    for item in configuration.weekend_variants:
        if item.variant_kind != WeekendVariantKind.SUBSTITUTE:
            continue
        key = (
            item.replaces_weekend_rotation_variant_id,
            item.applicable_week_number,
            item.applicable_saturday_date,
            item.applicable_sunday_date,
        )
        substitute_keys[key] += 1
        if (
            item.position_in_cycle is not None
            or item.replaces_weekend_rotation_variant_id is None
            or item.applicable_week_number is None
            or item.applicable_saturday_date is None
            or item.applicable_sunday_date is None
        ):
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    "Wariant SUBSTITUTE jest niekompletny.",
                    context={"variantId": item.id},
                )
            )
    for key, count in substitute_keys.items():
        if count > 1:
            messages.append(
                error(
                    rules.RULE_SPECIAL_DAY,
                    "Dla weekendu może istnieć najwyżej jeden zatwierdzony SUBSTITUTE.",
                    required=1,
                    actual=count,
                    context={"key": [str(value) for value in key]},
                )
            )
    for variant in (
        item
        for item in configuration.weekend_variants
        if item.variant_kind == WeekendVariantKind.SUBSTITUTE
    ):
        working = variant_working_educators(variant)
        saturday_workers = {
            item.educator_id
            for item in variant.saturday_template.assignments
        }
        sunday_workers = {
            item.educator_id
            for item in variant.sunday_template.assignments
        }
        if (
            len(working) != 2
            or not working.issubset(set(educator_ids))
            or saturday_workers != working
            or sunday_workers != working
        ):
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Wariant SUBSTITUTE musi wskazywać tę samą jawną parę aktywnych wychowawców w sobotę i niedzielę.",
                    required="dokładnie 2 aktywne osoby",
                    actual=f"{sorted(saturday_workers)} / {sorted(sunday_workers)}",
                    context={"variantId": variant.id},
                )
            )
        if (
            variant.off_educator_id is not None
            and variant.off_educator_id not in set(educator_ids) - working
        ):
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Opcjonalna osoba wolna w SUBSTITUTE musi być aktywna i nie może należeć do pary pracującej.",
                    actual=variant.off_educator_id,
                    context={"variantId": variant.id},
                )
            )
        if len(educator_ids) == 3 and (
            len(set(educator_ids) - working) != 1
            or variant.off_educator_id
            != next(iter(set(educator_ids) - working), None)
        ):
            messages.append(
                error(
                    rules.RULE_WEEKEND,
                    "Wariant SUBSTITUTE dla trzech osób musi jawnie wskazywać jedyną osobę niepracującą.",
                    required=next(iter(set(educator_ids) - working), None),
                    actual=variant.off_educator_id,
                    context={"variantId": variant.id},
                )
            )
        for template, expected_day in (
            (variant.saturday_template, WeekendDay.SATURDAY),
            (variant.sunday_template, WeekendDay.SUNDAY),
        ):
            if template.day_of_week != expected_day:
                messages.append(
                    error(
                        rules.RULE_WEEKEND,
                        "Szablon SUBSTITUTE ma niepoprawny dzień.",
                        required=expected_day,
                        actual=template.day_of_week,
                        context={"variantId": variant.id},
                    )
                )
            ordered = sorted(
                template.assignments,
                key=lambda value: value.sequence_number,
            )
            sequence = [item.sequence_number for item in ordered]
            if sequence != list(range(1, len(sequence) + 1)):
                messages.append(
                    error(
                        rules.RULE_WEEKEND,
                        "sequenceNumber w SUBSTITUTE musi być ciągły od 1.",
                        required=list(range(1, len(sequence) + 1)),
                        actual=sequence,
                        context={"variantId": variant.id},
                    )
                )
            for assignment in ordered:
                try:
                    start = parse_hhmm(assignment.start_time)
                    end = parse_hhmm(assignment.end_time)
                    if (
                        assignment.educator_id not in educator_ids
                        or start % org.time_step_minutes
                        or end % org.time_step_minutes
                        or end - start < org.minimum_segment_minutes
                    ):
                        raise TimeDomainError(
                            "Odcinek SUBSTITUTE wskazuje nieaktywną osobę albo narusza krok 30 minut lub minimum 2 godzin."
                        )
                except TimeDomainError as exc:
                    messages.append(
                        error(
                            rules.RULE_WEEKEND,
                            str(exc),
                            educator_id=assignment.educator_id,
                            context={"variantId": variant.id},
                        )
                    )
    return messages


def _validate_effective_local_boundaries(
    configuration: ScheduleConfiguration,
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    for day_index in range(configuration.planning_horizon_weeks * 7):
        target_date = configuration.cycle_start_date + timedelta(days=day_index)
        week_number = day_index // 7 + 1
        try:
            plan = select_effective_plan(configuration, target_date, week_number)
        except CareCalculationError:
            continue
        for interval in [*plan.operating_intervals, *plan.no_care_intervals]:
            try:
                aware_local_datetime(
                    target_date,
                    parse_hhmm(interval.start_time),
                    configuration.time_zone_id,
                )
                aware_local_datetime(
                    target_date,
                    parse_hhmm(interval.end_time),
                    configuration.time_zone_id,
                )
            except TimeDomainError as exc:
                messages.append(
                    error(
                        rules.RULE_TIME_SAME_DAY if hasattr(rules, "RULE_TIME_SAME_DAY") else rules.RULE_SAME_DAY,
                        str(exc),
                        date_value=target_date,
                        context={"planId": plan.id},
                    )
                )
    return messages


def _weekly_balance(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
) -> tuple[list[dict[str, object]], list[DomainMessage]]:
    messages: list[DomainMessage] = []
    balances: list[dict[str, object]] = []
    overrides = {
        (item.educator_id, item.week_number): item.assigned_minutes
        for item in configuration.assignment_overrides
    }
    for week_number in range(1, configuration.planning_horizon_weeks + 1):
        days = [item for item in care if item.week_number == week_number]
        required = sum(item.total_required_minutes for item in days)
        educator_minutes = {
            educator.id: overrides.get(
                (educator.id, week_number),
                educator.base_weekly_assigned_minutes,
            )
            for educator in configuration.educators
            if educator.active
        }
        assigned = sum(educator_minutes.values())
        balance = {
            "weekNumber": week_number,
            "startDate": min(item.date for item in days).isoformat(),
            "endDate": max(item.date for item in days).isoformat(),
            "requiredMinutes": required,
            "assignedMinutes": assigned,
            "differenceMinutes": assigned - required,
            "educatorMinutes": educator_minutes,
        }
        balances.append(balance)
        if required != assigned:
            difference = abs(required - assigned)
            if assigned < required:
                description = (
                    f"W tygodniu {week_number} brakuje {difference / 60:g} godz. "
                    f"Plan wymaga {required / 60:g} godz., a wychowawcom "
                    f"wpisano razem {assigned / 60:g} godz."
                )
            else:
                description = (
                    f"W tygodniu {week_number} wpisano za dużo o "
                    f"{difference / 60:g} godz. Plan wymaga {required / 60:g} "
                    f"godz., a wychowawcom wpisano razem {assigned / 60:g} godz."
                )
            messages.append(
                error(
                    rules.RULE_HOURS,
                    description,
                    required=required,
                    actual=assigned,
                    context=balance,
                )
            )
    return balances, messages


def _fixed_weekend_conflict_messages(
    configuration: ScheduleConfiguration,
) -> list[DomainMessage]:
    """Wykrywa oczywisty konflikt stałej nocki z wymuszonym weekendem.

    Taki konflikt nie wymaga uruchamiania solvera: godziny mogą się zgadzać,
    ale ta sama osoba nie może zachować wymaganego odpoczynku pomiędzy
    zatwierdzonym odcinkiem weekendowym i zablokowanym dyżurem nocnym.
    """
    messages: list[DomainMessage] = []
    project_zone = zone(configuration.time_zone_id)
    educator_by_id = {
        item.id: item for item in configuration.educators if item.active
    }
    minimum_rest = configuration.legal_rules.minimum_daily_rest_minutes
    recurring_prefix = "RECURRING-NIGHT-"

    for week_number in range(1, configuration.planning_horizon_weeks + 1):
        saturday = configuration.cycle_start_date + timedelta(
            days=(week_number - 1) * 7 + 5
        )
        sunday = saturday + timedelta(days=1)
        try:
            variant = selected_weekend_variant(
                configuration,
                week_number=week_number,
                saturday=saturday,
                sunday=sunday,
            )
        except ValueError:
            # Brak albo duplikat wzorca ma już własny, prostszy komunikat
            # z _weekend_compatibility. Nie zasłaniamy go wyjątkiem.
            continue
        weekend_start = aware_local_datetime(
            saturday,
            0,
            configuration.time_zone_id,
        )
        weekend_end = aware_local_datetime(
            sunday,
            1440,
            configuration.time_zone_id,
        )
        forced_segments: dict[str, list[tuple[object, object, str]]] = defaultdict(list)
        for target_date, template in (
            (saturday, variant.saturday_template),
            (sunday, variant.sunday_template),
        ):
            for assignment in template.assignments:
                start_minute = parse_hhmm(assignment.start_time)
                end_minute = parse_hhmm(assignment.end_time)
                forced_segments[assignment.educator_id].append(
                    (
                        aware_local_datetime(
                            target_date,
                            start_minute,
                            configuration.time_zone_id,
                        ),
                        aware_local_datetime(
                            target_date,
                            end_minute,
                            configuration.time_zone_id,
                        ),
                        f"{target_date} {assignment.start_time}–{assignment.end_time}",
                    )
                )

        for unavailable in configuration.unavailability:
            if unavailable.type != "HARD":
                continue
            for target_date in (saturday, sunday):
                applies = (
                    unavailable.day_of_week == target_date.weekday()
                    if unavailable.scope == UnavailabilityScope.RECURRING_WEEKLY
                    else (
                        unavailable.week_number == week_number
                        and unavailable.day_of_week == target_date.weekday()
                        if unavailable.scope == UnavailabilityScope.CYCLE_WEEK
                        else unavailable.date == target_date
                    )
                )
                if not applies:
                    continue
                unavailable_start = aware_local_datetime(
                    target_date,
                    parse_hhmm(unavailable.start_time),
                    configuration.time_zone_id,
                )
                unavailable_end = aware_local_datetime(
                    target_date,
                    parse_hhmm(unavailable.end_time),
                    configuration.time_zone_id,
                )
                overlapping = [
                    label
                    for segment_start, segment_end, label in forced_segments.get(
                        unavailable.educator_id,
                        [],
                    )
                    if segment_start < unavailable_end
                    and unavailable_start < segment_end
                ]
                if not overlapping:
                    continue
                educator = educator_by_id.get(unavailable.educator_id)
                name = (
                    educator.display_name
                    if educator
                    else unavailable.educator_id
                )
                position = variant.position_in_cycle or week_number
                messages.append(
                    error(
                        rules.RULE_HARD_UNAVAILABLE,
                        (
                            f"{name} ma bezwzględną niedostępność "
                            f"{target_date} {unavailable.start_time}–"
                            f"{unavailable.end_time}, ale pozycja weekendu "
                            f"{position} przypisuje tej osobie dyżur "
                            f"{', '.join(overlapping)}. Wybierz inną osobę "
                            "w tym weekendzie albo popraw ten konkretny wpis "
                            "niedostępności."
                        ),
                        date_value=target_date,
                        educator_id=unavailable.educator_id,
                        group_id=configuration.group_id,
                        start_time=unavailable.start_time,
                        end_time=unavailable.end_time,
                        context={
                            "conflictType": "HARD_UNAVAILABILITY_WEEKEND",
                            "weekNumber": week_number,
                            "position": position,
                            "dayOfWeek": target_date.weekday(),
                            "unavailabilityId": unavailable.id,
                            "variantId": variant.id,
                        },
                    )
                )

        for duty in configuration.external_duty_assignments:
            if not duty.locked or duty.duty_type != "NIGHT":
                continue
            segments = forced_segments.get(duty.educator_id, [])
            if not segments:
                continue
            duty_start = duty.start_date_time.astimezone(project_zone)
            duty_end = duty.end_date_time.astimezone(project_zone)
            if duty_end <= weekend_start or duty_start >= weekend_end:
                continue

            conflicts: list[tuple[int, str]] = []
            for segment_start, segment_end, label in segments:
                if (segment_end == duty_start and segment_start.date() == duty_start.date() and segment_start.hour >= 20
                    or segment_start == duty_end and segment_end.date() == duty_end.date() and segment_end.hour <= 8):
                    continue
                if segment_end <= duty_start:
                    gap = int((duty_start - segment_end).total_seconds() // 60)
                elif duty_end <= segment_start:
                    gap = int((segment_start - duty_end).total_seconds() // 60)
                else:
                    gap = -1
                if gap < minimum_rest:
                    conflicts.append((gap, label))
            if not conflicts:
                continue

            educator = educator_by_id.get(duty.educator_id)
            name = educator.display_name if educator else duty.educator_id
            minimum_gap = min(value for value, _ in conflicts)
            actual_rest = max(0, minimum_gap)
            duty_label = (
                "Stała nocka"
                if duty.id.startswith(recurring_prefix)
                else "Nocka"
            )
            weekend_description = ", ".join(label for _, label in conflicts)
            position = variant.position_in_cycle or week_number
            messages.append(
                error(
                    rules.RULE_CROSS_GROUP_REST,
                    (
                        f"{duty_label} {name}: "
                        f"{duty_start:%Y-%m-%d %H:%M}–{duty_end:%Y-%m-%d %H:%M} "
                        f"koliduje z dzienną pracą w pozycji weekendu {position} "
                        f"({weekend_description}). Odpoczynek wynosi "
                        f"{actual_rest / 60:g} godz., a wymagane jest "
                        f"{minimum_rest / 60:g} godz. W tym weekendzie wybierz "
                        "inną osobę do pracy dziennej albo zmień nockę."
                    ),
                    date_value=saturday,
                    educator_id=duty.educator_id,
                    group_id=configuration.group_id,
                    required=minimum_rest,
                    actual=actual_rest,
                    context={
                        "conflictType": "NIGHT_WEEKEND_REST",
                        "weekNumber": week_number,
                        "position": position,
                        "dutyId": duty.id,
                        "variantId": variant.id,
                        "dutyStart": duty_start.isoformat(),
                        "dutyEnd": duty_end.isoformat(),
                        "weekendAssignments": [
                            label for _, label in conflicts
                        ],
                    },
                )
            )
    return messages


def _weekend_compatibility(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    by_date = {item.date: item for item in care}
    for week_number in range(1, configuration.planning_horizon_weeks + 1):
        saturday = configuration.cycle_start_date + timedelta(days=(week_number - 1) * 7 + 5)
        sunday = saturday + timedelta(days=1)
        try:
            base = base_variant(configuration, week_number)
            selected = selected_weekend_variant(
                configuration,
                week_number=week_number,
                saturday=saturday,
                sunday=sunday,
            )
        except ValueError as exc:
            messages.append(error(rules.RULE_WEEKEND, str(exc), date_value=saturday))
            continue
        for target_date, template in (
            (saturday, selected.saturday_template),
            (sunday, selected.sunday_template),
        ):
            tuples = template_tuples(template)
            template_pairs = normalize_pairs([(item[2], item[3]) for item in tuples])
            care_pairs = [
                (item.start_minute, item.end_minute)
                for item in by_date[target_date].intervals
            ]
            has_overlap = sum(end - start for start, end in [(item[2], item[3]) for item in tuples]) != sum(
                end - start for start, end in template_pairs
            )
            if template_pairs != care_pairs or has_overlap:
                if selected.id == base.id:
                    messages.append(
                        error(
                            rules.RULE_SPECIAL_DAY,
                            "Weekendowy popyt różni się od wzorca bazowego i brakuje zgodnego SUBSTITUTE.",
                            date_value=target_date,
                            required=str(care_pairs),
                            actual=str(template_pairs),
                            context={"weekNumber": week_number, "baseVariantId": base.id},
                        )
                    )
                else:
                    messages.append(
                        error(
                            rules.RULE_WEEKEND,
                            "Zatwierdzony SUBSTITUTE nie pokrywa dokładnie popytu weekendu.",
                            date_value=target_date,
                            required=str(care_pairs),
                            actual=str(template_pairs),
                            context={"variantId": selected.id},
                        )
                    )
    return messages


def validate_configuration(
    configuration: ScheduleConfiguration,
    *, _group_view: bool = False,
) -> InputValidationResponse:
    if not _group_view and (len(configuration.groups) > 1 or any(
        item.group_id is None for item in configuration.educators
    ) or configuration.external_duty_assignments or configuration.required_assignments or configuration.locked_assignments or configuration.weekend_days_off_patterns):
        return _validate_internat_project(configuration)
    messages = _structural_messages(configuration)
    if _has_errors(messages):
        return InputValidationResponse(
            status=InputStatus.INVALID_INPUT,
            public_result=PublicResult.DANE_NIEPOPRAWNE,
            messages=messages,
        )
    messages.extend(_validate_effective_local_boundaries(configuration))
    if _has_errors(messages):
        return InputValidationResponse(
            status=InputStatus.INVALID_INPUT,
            public_result=PublicResult.DANE_NIEPOPRAWNE,
            messages=messages,
        )
    try:
        care = calculate_care(configuration)
    except (CareCalculationError, TimeDomainError) as exc:
        messages.append(error(rules.RULE_SPECIAL_DAY, str(exc)))
        return InputValidationResponse(
            status=InputStatus.INVALID_INPUT,
            public_result=PublicResult.DANE_NIEPOPRAWNE,
            messages=messages,
        )
    balances, balance_messages = _weekly_balance(configuration, care)
    messages.extend(balance_messages)
    messages.extend(_weekend_compatibility(configuration, care))
    messages.extend(_fixed_weekend_conflict_messages(configuration))
    if configuration.schedule_boundary_mode == ScheduleBoundaryMode.FINITE:
        contexts = (
            {
                item.educator_id: item
                for item in configuration.boundary_context.educators
            }
            if configuration.boundary_context is not None
            else {}
        )
        incomplete = [
            educator.id
            for educator in configuration.educators
            if educator.active
            and (
                educator.id not in contexts
                or contexts[educator.id].last_assignment_before is None
                or contexts[educator.id].first_assignment_after is None
            )
        ]
        if incomplete:
            messages.append(
                warning(
                    rules.RULE_CROSS_WEEK,
                    "Tryb skończony nie ma pełnego kontekstu przydziałów przed i po horyzoncie; walidacja odpoczynku na tej granicy jest ograniczona.",
                    actual=", ".join(incomplete),
                )
            )
    if configuration.requested_operation_mode == OperationMode.DEMONSTRATION:
        messages.append(
            warning(
                rules.RULE_LEGAL,
                "Tryb demonstracyjny: wynik nie jest dopuszczony do rzeczywistego użycia.",
                actual=configuration.legal_rules.verification_status,
            )
        )
    return InputValidationResponse(
        status=InputStatus.INVALID_INPUT if _has_errors(messages) else InputStatus.VALID_INPUT,
        public_result=PublicResult.DANE_NIEPOPRAWNE if _has_errors(messages) else None,
        messages=messages,
        care=care,
        weekly_balance=balances,
    )
