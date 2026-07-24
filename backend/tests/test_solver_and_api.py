from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app, configured_cors_origins, create_app
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


def test_static_frontend_and_spa_fallback(tmp_path):
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "index.html").write_text("<h1>Harmonogram</h1>", encoding="utf-8")
    (frontend / "manifest.webmanifest").write_text("{}", encoding="utf-8")
    client = TestClient(create_app(frontend))

    root = client.get("/")
    nested = client.get("/konfiguracja")
    manifest = client.get("/manifest.webmanifest")
    missing_api = client.get("/api/nie-istnieje")

    assert root.status_code == 200
    assert "Harmonogram" in root.text
    assert nested.status_code == 200
    assert "Harmonogram" in nested.text
    assert manifest.json() == {}
    assert missing_api.status_code == 404


def test_cors_origins_are_configurable(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://jarekdymek.github.io, https://example.test/",
    )
    assert configured_cors_origins() == [
        "https://jarekdymek.github.io",
        "https://example.test",
    ]


def test_github_pages_origin_passes_cors_preflight():
    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://jarekdymek.github.io",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "https://jarekdymek.github.io"
    )
