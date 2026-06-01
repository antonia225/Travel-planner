import json

import pytest
from fastapi.testclient import TestClient

import main
from dependencies.auth import get_current_user
from models import User
from services import architect_service


def _sample_ai_itinerary(destination: str = "Tokyo", day_count: int = 2) -> dict:
    return {
        "destination": destination,
        "days": [
            {
                "day_number": day_number,
                "activities": [
                    {
                        "title": f"Day {day_number} activity {activity_number}",
                        "description": (
                            f"Detailed plan for activity {activity_number} "
                            f"on day {day_number}."
                        ),
                        "time_slot": f"{8 + activity_number:02d}:00 - {9 + activity_number:02d}:00",
                    }
                    for activity_number in range(1, 4)
                ],
            }
            for day_number in range(1, day_count + 1)
        ],
    }


def _fake_current_user() -> User:
    return User(
        id=1,
        email="test@example.com",
        name="Test User",
        hashed_password="not-used-in-this-test",
        interests=["culture_history", "food_culinary"],
    )


def _install_fake_ollama(
    monkeypatch: pytest.MonkeyPatch,
    ollama_response: dict,
    captured_request: dict,
) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"response": json.dumps(ollama_response)}

    class FakeAsyncClient:
        def __init__(self, timeout):
            captured_request["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            captured_request["url"] = url
            captured_request["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(architect_service.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(architect_service, "OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setattr(architect_service, "OLLAMA_MODEL", "llama3")


@pytest.fixture(autouse=True)
def override_auth_dependency():
    main.app.dependency_overrides[get_current_user] = _fake_current_user
    yield
    main.app.dependency_overrides.pop(get_current_user, None)


def test_generate_itinerary_endpoint_builds_daily_schedule_from_ollama_json(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    captured_request = {}
    _install_fake_ollama(
        monkeypatch,
        _sample_ai_itinerary(destination="Tokyo", day_count=2),
        captured_request,
    )

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200

    data = response.json()
    assert data["destination"] == "Tokyo"
    assert [day["day_number"] for day in data["days"]] == [1, 2]

    for day in data["days"]:
        assert len(day["activities"]) == 3
        for activity in day["activities"]:
            assert activity["title"]
            assert activity["description"]
            assert activity["time_slot"]

    payload = captured_request["payload"]
    assert captured_request["url"] == "http://ollama:11434/api/generate"
    assert payload["model"] == "llama3"
    assert payload["format"] == "json"
    assert payload["stream"] is False
    assert "Tokyo" in payload["prompt"]
    assert "2-day travel itinerary" in payload["prompt"]
    assert "culture_history" in payload["prompt"]
    assert "food_culinary" in payload["prompt"]


@pytest.mark.parametrize(
    ("invalid_response", "expected_detail"),
    [
        (
            {
                "destination": "Tokyo",
                "days": [
                    {
                        "day_number": 1,
                        "activities": [
                            {
                                "title": "Only activity",
                                "description": "This should fail.",
                                "time_slot": "09:00 - 10:00",
                            }
                        ],
                    }
                ],
            },
            "at least 3 activities",
        ),
        (
            _sample_ai_itinerary(destination="Tokyo", day_count=1),
            "exactly 2 days",
        ),
        (
            {
                **_sample_ai_itinerary(destination="Tokyo", day_count=2),
                "days": [
                    {
                        **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0],
                        "day_number": 2,
                    },
                    {
                        **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][1],
                        "day_number": 1,
                    },
                ],
            },
            "sequential day numbers",
        ),
        (
            {
                **_sample_ai_itinerary(destination="Tokyo", day_count=2),
                "days": [
                    {
                        **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0],
                        "activities": [
                            {
                                **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0]["activities"][0],
                                "time_slot": "morning",
                            },
                            *_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0]["activities"][1:],
                        ],
                    },
                    _sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][1],
                ],
            },
            "HH:MM - HH:MM",
        ),
    ],
)
def test_generate_itinerary_endpoint_rejects_invalid_daily_schedule_json(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    invalid_response: dict,
    expected_detail: str,
):
    _install_fake_ollama(monkeypatch, invalid_response, {})

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 422
    assert expected_detail in response.json()["detail"]


def test_generate_itinerary_endpoint_rejects_non_json_ollama_text(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"response": "Here is your itinerary: Day 1..."}

    class FakeAsyncClient:
        def __init__(self, timeout):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            return FakeResponse()

    monkeypatch.setattr(architect_service.httpx, "AsyncClient", FakeAsyncClient)

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 422
    assert "non-JSON content" in response.json()["detail"]
