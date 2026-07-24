from __future__ import annotations

import pytest

from app.fixtures.demo import demo_configuration
from app.services.generation import generate_schedule


@pytest.fixture
def demo_config():
    return demo_configuration()


@pytest.fixture(scope="session")
def generated_demo():
    configuration = demo_configuration()
    response = generate_schedule(configuration)
    assert response.generation_status == "CANDIDATE_FOUND"
    assert response.validation_report is not None
    assert response.validation_report.status == "VALID"
    return configuration, response
