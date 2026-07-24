from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta

from app.domain import rules
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
            )
        )
    if configuration.cycle_length_weeks != 6 or not configuration.cycle_is_repeating:
        messages.append(
            error(
                rules.RULE_CROSS_WEEK,
                "Pierwsza wersja wymaga kołowego cyklu sześciu tygodni.",
                required="6 / true",
                actual=f"{configuration.cycle_length_weeks} / {configuration.cycle_is_repeating}",
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
                "Każdy wychowawca musi pracować dokładnie pięć dni w tygodniu.",
                required=5,
                actual=org.required_work_days_per_week,
            )
        )

    active_educators = [item for item in configuration.educators if item.active]
    if len(active_educators) != 3:
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Pierwsza wersja wymaga dokładnie trzech aktywnych wychowawców.",
                required=3,
                actual=len(active_educators),
            )
        )
    educator_ids = [item.id for item in active_educators]
    if len(set(educator_ids)) != len(educator_ids):
        messages.append(
            error(
                rules.RULE_NO_GUESSING,
                "Identyfikatory wychowawców muszą być unikalne.",
                required="3 unikalne identyfikatory",
                actual=educator_ids,
            )
        )
    for educator in active_educators:
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
                    "W sztywnej rotacji wszyscy trzej wychowawcy muszą móc pracować w weekend.",
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
                ("sourceIdentifier", legal.source_identifier),
                ("verifiedAt", legal.verified_at),
                ("approvedBy", legal.approved_by),
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
        cycle_end = configuration.cycle_start_date + timedelta(days=41)
        if (
            legal.effective_from is None
            or legal.effective_to is None
            or configuration.cycle_start_date < legal.effective_from
            or cycle_end > legal.effective_to
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
    if len(educator_ids) == 3:
        for position, pair in enumerate(expected_pairs, start=1):
            matches = [item for item in base_variants if item.position_in_cycle == position]
            if len(matches) != 1:
                continue
            variant = matches[0]
            expected_working = {educator_ids[pair[0]], educator_ids[pair[1]]}
            expected_off = educator_ids[pair[2]]
            working = variant_working_educators(variant)
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
                sequence = [item.sequence_number for item in sorted(template.assignments, key=lambda value: value.sequence_number)]
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
                    try:
                        start = parse_hhmm(item.start_time)
                        end = parse_hhmm(item.end_time)
                        if start % org.time_step_minutes or end % org.time_step_minutes:
                            raise TimeDomainError("Granica szablonu nie jest zgodna z krokiem.")
                        if end - start < org.minimum_segment_minutes:
                            raise TimeDomainError("Odcinek szablonu jest krótszy niż 120 minut.")
                    except TimeDomainError as exc:
                        messages.append(
                            error(
                                rules.RULE_WEEKEND,
                                str(exc),
                                educator_id=item.educator_id,
                                context={"variantId": variant.id},
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
    return messages


def _validate_effective_local_boundaries(
    configuration: ScheduleConfiguration,
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    for day_index in range(42):
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
    for week_number in range(1, 7):
        days = [item for item in care if item.week_number == week_number]
        required = sum(item.total_required_minutes for item in days)
        educator_minutes = {
            educator.id: overrides.get(
                (educator.id, week_number),
                educator.base_weekly_assigned_minutes,
            )
            for educator in configuration.educators
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
            messages.append(
                error(
                    rules.RULE_HOURS,
                    f"Bilans tygodnia {week_number} nie jest równy zapotrzebowaniu.",
                    required=required,
                    actual=assigned,
                    context=balance,
                )
            )
    return balances, messages


def _weekend_compatibility(
    configuration: ScheduleConfiguration,
    care: list[CalculatedCareDay],
) -> list[DomainMessage]:
    messages: list[DomainMessage] = []
    by_date = {item.date: item for item in care}
    for week_number in range(1, 7):
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
) -> InputValidationResponse:
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
