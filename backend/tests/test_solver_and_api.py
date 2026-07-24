from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.generation import generate_schedule


def test_solver_is_deterministic(generated_demo):
    configuration, first = generated_demo
    second = generate_schedule(configuration)
    assert second.generation_status == "CANDIDATE_FOUND"
    assert second.assignments == first.assignments


def test_time_limit_does_not_publish_candidate(demo_config):
    demo_config.solver_time_limit_seconds = 0.001
    response = generate_schedule(demo_config)
    assert response.public_result == "NIE_ZAKONCZONO_WYSZUKIWANIA"
    assert response.assignments == []


def test_api_health_demo_and_input_validation():
    client = TestClient(app)
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    demo = client.get("/api/demo")
    assert demo.status_code == 200
    assert len(demo.json()["educators"]) == 3
    validated = client.post("/api/validate-input", json=demo.json())
    assert validated.status_code == 200
    assert validated.json()["status"] == "VALID_INPUT"
