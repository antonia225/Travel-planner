import json

import httpx
from fastapi.testclient import TestClient

from models import AIGenerationStatus, UserRole
from repositories.ai_generation_log_repository import (
    BUDGET_OPTIMIZER_AGENT_NAME,
    ITINERARY_AGENT_NAME,
    AIGenerationLogRepository,
)
from repositories.user_repository import UserRepository
from services import architect_service, budget_optimizer_service
from tests.conftest import _TestingSessionLocal


_OLLAMA_GENERATE_URL = "http://ollama:11434/api/generate"


def _register_and_login(
    client: TestClient,
    email: str,
    role: UserRole = UserRole.USER,
) -> dict[str, str]:
    payload = {
        "name": email.split("@")[0].title(),
        "email": email,
        "password": "Secure1Password",
    }
    response = client.post("/register", json=payload)
    user_id = response.json()["id"]

    if role != UserRole.USER:
        db = _TestingSessionLocal()
        try:
            UserRepository(db).update_role(user_id, role)
        finally:
            db.close()

    login_response = client.post(
        "/login",
        json={"email": email, "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login_response.json()['access_token']}"}


def _create_ai_log(
    *,
    agent_name: str = ITINERARY_AGENT_NAME,
    operation: str = "generate_itinerary",
    destination: str = "Paris",
    status: AIGenerationStatus = AIGenerationStatus.SUCCESS,
    response_time_ms: int = 120,
    error_message: str | None = None,
    fallback_used: bool = False,
) -> None:
    db = _TestingSessionLocal()
    try:
        AIGenerationLogRepository(db).create(
            agent_name=agent_name,
            operation=operation,
            status=status,
            model="phi3",
            destination=destination,
            response_time_ms=response_time_ms,
            error_message=error_message,
            fallback_used=fallback_used,
        )
    finally:
        db.close()


def _recent_logs(limit: int = 10):
    db = _TestingSessionLocal()
    try:
        return AIGenerationLogRepository(db).list_recent(limit)
    finally:
        db.close()


def _sample_ai_itinerary(destination: str = "Tokyo", day_count: int = 2) -> dict:
    return {
        "destination": destination,
        "currency": "EUR",
        "total_estimated_cost_eur": day_count * 60,
        "days": [
            {
                "day_number": day_number,
                "activities": [
                    {
                        "title": f"Day {day_number} activity {activity_number}",
                        "description": f"Activity {activity_number} details.",
                        "time_slot": f"{8 + activity_number:02d}:00 - {9 + activity_number:02d}:00",
                        "estimated_cost_eur": activity_number * 10,
                    }
                    for activity_number in range(1, 4)
                ],
            }
            for day_number in range(1, day_count + 1)
        ],
    }


def _install_fake_itinerary_ollama(monkeypatch, raw_body: dict | Exception) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return raw_body  # type: ignore[return-value]

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            if isinstance(raw_body, Exception):
                raise raw_body
            return FakeResponse()

    monkeypatch.setattr(architect_service.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(architect_service, "OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setattr(architect_service, "OLLAMA_ITINERARY_MODEL", "phi3")


def _install_fake_budget_ollama(monkeypatch, raw_body: dict) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return raw_body

    class FakeAsyncClient:
        def __init__(self, timeout: httpx.Timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            return FakeResponse()

    monkeypatch.setattr(
        budget_optimizer_service.httpx,
        "AsyncClient",
        FakeAsyncClient,
    )


def test_admin_ai_metrics_requires_admin_role(client: TestClient):
    admin_headers = _register_and_login(client, "admin@example.com", UserRole.ADMIN)
    super_headers = _register_and_login(client, "super@example.com", UserRole.SUPER_ADMIN)
    user_headers = _register_and_login(client, "traveler@example.com")

    assert client.get("/admin/ai-agent-metrics", headers=admin_headers).status_code == 200
    assert client.get("/admin/ai-agent-metrics", headers=super_headers).status_code == 200
    assert client.get("/admin/ai-agent-metrics", headers=user_headers).status_code == 403
    assert client.get("/admin/ai-agent-metrics").status_code == 401


def test_admin_ai_metrics_returns_summary_alerts_and_latest_50_logs(client: TestClient):
    admin_headers = _register_and_login(client, "admin@example.com", UserRole.ADMIN)
    _create_ai_log(
        agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
        operation="optimize_budget",
        destination="Rome",
        response_time_ms=333,
    )

    for index in range(55):
        _create_ai_log(
            destination=f"City {index}",
            status=(
                AIGenerationStatus.FAILED
                if index == 54
                else AIGenerationStatus.SUCCESS
            ),
            response_time_ms=100 + index,
            error_message="Model failed" if index == 54 else None,
        )

    response = client.get("/admin/ai-agent-metrics", headers=admin_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["itinerary_agent_response_time_ms"] == 154
    assert body["summary"]["budget_optimizer_agent_response_time_ms"] == 333
    assert body["summary"]["recent_failure_count"] == 1
    assert len(body["logs"]) == 50
    assert body["logs"][0]["destination"] == "City 54"
    assert body["logs"][0]["metric_label"] == "Itinerary Agent Response Time"
    assert body["alerts"][0]["agent_name"] == "Itinerary Agent"
    assert body["alerts"][0]["message"] == "Model failed"


def test_successful_itinerary_generation_creates_itinerary_agent_log(
    client: TestClient,
    monkeypatch,
):
    headers = _register_and_login(client, "traveler@example.com")
    _install_fake_itinerary_ollama(
        monkeypatch,
        {
            "response": json.dumps(_sample_ai_itinerary("Tokyo", 2)),
            "model": "phi3",
            "total_duration": 125_000_000,
        },
    )

    response = client.post(
        "/generate-itinerary",
        json={"destination": "Tokyo", "num_days": 2},
        headers=headers,
    )

    assert response.status_code == 200
    log = _recent_logs(1)[0]
    assert log.agent_name == ITINERARY_AGENT_NAME
    assert log.operation == "generate_itinerary"
    assert log.destination == "Tokyo"
    assert log.status == "success"
    assert log.response_time_ms == 125
    assert log.fallback_used is False


def test_failed_itinerary_generation_creates_alert_log(client: TestClient, monkeypatch):
    headers = _register_and_login(client, "traveler@example.com")
    _install_fake_itinerary_ollama(
        monkeypatch,
        {
            "response": "not json",
            "model": "phi3",
            "total_duration": 222_000_000,
        },
    )

    response = client.post(
        "/generate-itinerary",
        json={"destination": "Tokyo", "num_days": 2},
        headers=headers,
    )

    assert response.status_code == 422
    log = _recent_logs(1)[0]
    assert log.agent_name == ITINERARY_AGENT_NAME
    assert log.status == "failed"
    assert log.response_time_ms == 222
    assert "non-JSON" in log.error_message


def test_offline_itinerary_fallback_creates_failed_fallback_log(
    client: TestClient,
    monkeypatch,
):
    headers = _register_and_login(client, "traveler@example.com")
    _install_fake_itinerary_ollama(monkeypatch, httpx.ConnectError("down"))
    monkeypatch.setattr(architect_service, "ENABLE_OFFLINE_ITINERARY_FALLBACK", True)

    response = client.post(
        "/generate-itinerary",
        json={"destination": "Tokyo", "num_days": 2},
        headers=headers,
    )

    assert response.status_code == 200
    log = _recent_logs(1)[0]
    assert log.agent_name == ITINERARY_AGENT_NAME
    assert log.status == "failed"
    assert log.fallback_used is True
    assert "Could not connect to Ollama" in log.error_message


def test_successful_budget_optimization_creates_budget_agent_log(
    client: TestClient,
    monkeypatch,
):
    _install_fake_budget_ollama(
        monkeypatch,
        {
            "response": json.dumps(
                {
                    "destination": "Rome",
                    "total_budget": 1000,
                    "recommendations": [
                        {
                            "category": "food",
                            "recommendation": "Eat at local markets",
                            "estimated_cost": "200 USD",
                        }
                    ],
                }
            ),
            "model": "phi3",
            "total_duration": 88_000_000,
        },
    )

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
    )

    assert response.status_code == 200
    log = _recent_logs(1)[0]
    assert log.agent_name == BUDGET_OPTIMIZER_AGENT_NAME
    assert log.operation == "optimize_budget"
    assert log.destination == "Rome"
    assert log.status == "success"
    assert log.response_time_ms == 88


def test_failed_budget_optimization_creates_budget_agent_alert_log(
    client: TestClient,
    monkeypatch,
):
    _install_fake_budget_ollama(
        monkeypatch,
        {
            "response": "{not-valid-json",
            "model": "phi3",
            "total_duration": 99_000_000,
        },
    )

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
    )

    assert response.status_code == 422
    log = _recent_logs(1)[0]
    assert log.agent_name == BUDGET_OPTIMIZER_AGENT_NAME
    assert log.status == "failed"
    assert log.response_time_ms == 99
    assert "invalid JSON" in log.error_message
