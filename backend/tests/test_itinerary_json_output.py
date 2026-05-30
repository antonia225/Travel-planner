import asyncio

import pytest
from fastapi.testclient import TestClient

import main
from dependencies.auth import get_current_user
from models import User
from schemas.itinerary import ItineraryResponse
from services import architect_service


_SAMPLE_AI_ITINERARY = {
    "destination": "Tokyo",
    "days": [
        {
            "day_number": 1,
            "activities": [
                {
                    "title": "Visit Senso-ji Temple",
                    "description": "Explore Tokyo's oldest temple and the Nakamise shopping street.",
                    "time_slot": "09:00 - 11:00",
                },
                {
                    "title": "Lunch in Asakusa",
                    "description": "Try local dishes near the temple district.",
                    "time_slot": "12:00 - 13:30",
                },
                {
                    "title": "Tokyo Skytree",
                    "description": "Enjoy panoramic views of the city from the observation deck.",
                    "time_slot": "15:00 - 17:00",
                },
            ],
        },
        {
            "day_number": 2,
            "activities": [
                {
                    "title": "Meiji Shrine",
                    "description": "Walk through the forested shrine grounds in Harajuku.",
                    "time_slot": "09:00 - 10:30",
                },
                {
                    "title": "Takeshita Street",
                    "description": "Discover fashion shops, snacks, and youth culture.",
                    "time_slot": "11:00 - 13:00",
                },
                {
                    "title": "Shibuya Crossing",
                    "description": "Experience the famous crossing and surrounding shopping area.",
                    "time_slot": "16:00 - 18:00",
                },
            ],
        },
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


@pytest.fixture(autouse=True)
def override_auth_dependency():
    main.app.dependency_overrides[get_current_user] = _fake_current_user
    yield
    main.app.dependency_overrides.pop(get_current_user, None)


def test_generate_itinerary_endpoint_returns_valid_ai_json_structure(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_generate_itinerary(
        destination: str,
        days: int,
        user_interests: list[str] | None = None,
    ) -> ItineraryResponse:
        assert destination == "Tokyo"
        assert days == 2
        assert user_interests == ["culture_history", "food_culinary"]

        return ItineraryResponse.model_validate(_SAMPLE_AI_ITINERARY)

    monkeypatch.setattr(main, "generate_itinerary", fake_generate_itinerary)

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
    assert "days" in data
    assert isinstance(data["days"], list)
    assert len(data["days"]) == 2

    first_day = data["days"][0]
    assert first_day["day_number"] == 1
    assert "activities" in first_day
    assert isinstance(first_day["activities"], list)
    assert len(first_day["activities"]) >= 3

    first_activity = first_day["activities"][0]
    assert isinstance(first_activity["title"], str)
    assert first_activity["title"]
    assert isinstance(first_activity["description"], str)
    assert first_activity["description"]
    assert isinstance(first_activity["time_slot"], str)
    assert first_activity["time_slot"]


def test_generate_itinerary_service_accepts_valid_ai_json():
    parsed = ItineraryResponse.model_validate(_SAMPLE_AI_ITINERARY)

    assert parsed.destination == "Tokyo"
    assert len(parsed.days) == 2
    assert parsed.days[0].day_number == 1
    assert len(parsed.days[0].activities) == 3
    assert parsed.days[0].activities[0].title == "Visit Senso-ji Temple"
    assert parsed.days[0].activities[0].time_slot == "09:00 - 11:00"


def test_generate_itinerary_service_rejects_day_with_too_few_activities():
    invalid_itinerary = {
        "destination": "Tokyo",
        "days": [
            {
                "day_number": 1,
                "activities": [
                    {
                        "title": "Only activity",
                        "description": "This should fail because the schema requires at least 3 activities.",
                        "time_slot": "09:00 - 10:00",
                    }
                ],
            }
        ],
    }

    with pytest.raises(ValueError, match="at least 3 activities"):
        ItineraryResponse.model_validate(invalid_itinerary)


def test_generate_itinerary_endpoint_returns_422_when_ai_json_is_invalid(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_generate_itinerary(
        destination: str,
        days: int,
        user_interests: list[str] | None = None,
    ) -> ItineraryResponse:
        raise ValueError("Ollama response did not match the expected itinerary schema.")

    monkeypatch.setattr(main, "generate_itinerary", fake_generate_itinerary)

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 422
    assert (
        response.json()["detail"]
        == "Ollama response did not match the expected itinerary schema."
    )


def test_architect_service_sends_json_format_request_to_ollama(
    monkeypatch: pytest.MonkeyPatch,
):
    async def run_test():
        captured_request = {}

        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, str]:
                import json

                return {
                    "response": json.dumps(_SAMPLE_AI_ITINERARY),
                }

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
        monkeypatch.setattr(
            architect_service,
            "OLLAMA_BASE_URL",
            "http://ollama:11434",
        )
        monkeypatch.setattr(architect_service, "OLLAMA_MODEL", "llama3")

        result = await architect_service.generate_itinerary(
            destination="Tokyo",
            days=2,
            user_interests=["culture_history"],
        )

        assert result.destination == "Tokyo"
        assert len(result.days) == 2

        assert captured_request["url"] == "http://ollama:11434/api/generate"
        assert captured_request["payload"]["model"] == "llama3"
        assert captured_request["payload"]["format"] == "json"
        assert captured_request["payload"]["stream"] is False
        assert "Tokyo" in captured_request["payload"]["prompt"]
        assert "2-day travel itinerary" in captured_request["payload"]["prompt"]
        assert "culture_history" in captured_request["payload"]["prompt"]

    asyncio.run(run_test())