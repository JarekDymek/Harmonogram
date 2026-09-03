from __future__ import annotations

import os

from fastapi import APIRouter

from app.fixtures.demo import demo_configuration
from app.models.schemas import (
    CalculateCareResponse,
    GenerateResponse,
    InputValidationResponse,
    ScheduleConfiguration,
    ValidateScheduleRequest,
    ValidationReport,
)
from app.services.care_calculator import CareCalculationError, calculate_care
from app.services.generation import generate_schedule
from app.services.reports import error
from app.validation.input_validation import validate_configuration
from app.validation.schedule_validator import validate_schedule
from app.domain import rules


router = APIRouter(prefix="/api")


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "harmonogram-mow-api",
        "generatorVersion": "manual-group-scope-v7",
        "revision": os.getenv("RENDER_GIT_COMMIT", "local"),
    }


@router.get(
    "/demo",
    response_model=ScheduleConfiguration,
    tags=["configuration"],
)
def get_demo_configuration() -> ScheduleConfiguration:
    return demo_configuration()


@router.post(
    "/validate-input",
    response_model=InputValidationResponse,
    tags=["schedule"],
)
def validate_input(
    configuration: ScheduleConfiguration,
) -> InputValidationResponse:
    return validate_configuration(configuration)


@router.post(
    "/calculate-care",
    response_model=CalculateCareResponse,
    tags=["schedule"],
)
def calculate_required_care(
    configuration: ScheduleConfiguration,
) -> CalculateCareResponse:
    input_report = validate_configuration(configuration)
    if input_report.status == "INVALID_INPUT":
        return CalculateCareResponse(
            status="INVALID_INPUT",
            care=input_report.care,
            messages=input_report.messages,
        )
    try:
        return CalculateCareResponse(
            status="CALCULATION_OK",
            care=calculate_care(configuration),
        )
    except CareCalculationError as exc:
        return CalculateCareResponse(
            status="INTERNAL_ERROR",
            messages=[
                error(
                    rules.RULE_VALIDATOR_INDEPENDENT,
                    str(exc),
                    context={"planId": exc.plan_id},
                )
            ],
        )


@router.post(
    "/generate",
    response_model=GenerateResponse,
    tags=["schedule"],
)
def generate(configuration: ScheduleConfiguration, optimize: bool = False) -> GenerateResponse:
    return generate_schedule(configuration, optimize=optimize)


@router.post(
    "/validate-schedule",
    response_model=ValidationReport | InputValidationResponse,
    tags=["schedule"],
)
def validate_existing_schedule(
    request: ValidateScheduleRequest,
) -> ValidationReport | InputValidationResponse:
    input_report = validate_configuration(request.configuration)
    if input_report.status == "INVALID_INPUT":
        return input_report
    return validate_schedule(
        request.configuration,
        request.assignments,
        request.calculated_care,
    )
