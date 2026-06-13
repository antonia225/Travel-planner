import json

import httpx
import pytest
from fastapi.testclient import TestClient

import main
from dependencies.auth import get_current_user
from models import User
from services import architect_service


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
                        "description": (
                            f"Detailed plan for activity {activity_number} "
                            f"on day {day_number}."
                        ),
                        "time_slot": f"{8 + activity_number:02d}:00 - {9 + activity_number:02d}:00",
                        "estimated_cost_eur": activity_number * 10,
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
    monkeypatch.setattr(architect_service, "OLLAMA_ITINERARY_MODEL", "phi3")


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
    assert data["currency"] == "EUR"
    assert data["total_estimated_cost_eur"] == 120
    assert [day["day_number"] for day in data["days"]] == [1, 2]

    for day in data["days"]:
        assert len(day["activities"]) == 3
        for activity in day["activities"]:
            assert activity["title"]
            assert activity["description"]
            assert activity["time_slot"]
            assert isinstance(activity["estimated_cost_eur"], int)

    payload = captured_request["payload"]
    assert captured_request["url"] == "http://ollama:11434/api/generate"
    assert payload["model"] == "phi3"
    assert payload["format"]["type"] == "object"
    assert "days" in payload["format"]["required"]
    assert payload["format"]["properties"]["days"]["items"]["properties"]["activities"]["minItems"] == 3
    assert payload["format"]["properties"]["days"]["items"]["properties"]["activities"]["maxItems"] == 3
    assert payload["stream"] is False
    assert payload["keep_alive"] == "10m"
    assert payload["options"]["temperature"] == 0.2
    assert payload["options"]["num_predict"] == 700
    assert "Tokyo" in payload["prompt"]
    assert "2-day travel itinerary" in payload["prompt"]
    assert "culture_history" in payload["prompt"]
    assert "food_culinary" in payload["prompt"]
    assert "estimated_cost_eur" in payload["prompt"]
    assert "exactly 3 activities" in payload["prompt"]
    assert "chronological and non-overlapping" in payload["prompt"]


def test_generate_itinerary_endpoint_extracts_json_from_wrapped_text(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    ollama_response = _sample_ai_itinerary(destination="Tokyo", day_count=2)

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {
                "response": (
                    "Here is the JSON you requested:\n"
                    f"{json.dumps(ollama_response)}\nEnjoy your trip."
                )
            }

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

    assert response.status_code == 200
    assert response.json()["destination"] == "Tokyo"


def test_generate_itinerary_endpoint_repairs_non_json_once(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    valid_response = _sample_ai_itinerary(destination="Tokyo", day_count=2)
    responses = [
        {"response": "I can help. Day 1 starts with museums."},
        {"response": json.dumps(valid_response)},
    ]
    captured_payloads = []

    class FakeResponse:
        def __init__(self, body: dict[str, str]):
            self._body = body

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return self._body

    class FakeAsyncClient:
        def __init__(self, timeout):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            captured_payloads.append(json)
            return FakeResponse(responses.pop(0))

    monkeypatch.setattr(architect_service.httpx, "AsyncClient", FakeAsyncClient)

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200
    assert response.json()["destination"] == "Tokyo"
    assert len(captured_payloads) == 2
    assert "Convert the following model output" in captured_payloads[1]["prompt"]


def test_generate_itinerary_endpoint_normalizes_costs_to_budget(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    _install_fake_ollama(
        monkeypatch,
        _sample_ai_itinerary(destination="Tokyo", day_count=2),
        {},
    )

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
            "budget": 50,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    costs = [
        activity["estimated_cost_eur"]
        for day in data["days"]
        for activity in day["activities"]
    ]
    assert sum(costs) == 50
    assert data["total_estimated_cost_eur"] == 50


def test_generate_itinerary_endpoint_assigns_calendar_dates(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    _install_fake_ollama(
        monkeypatch,
        _sample_ai_itinerary(destination="Tokyo", day_count=3),
        {},
    )

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 3,
            "start_date": "2026-09-17",
            "end_date": "2026-09-19",
            "budget": 300,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["start_date"] == "2026-09-17"
    assert data["end_date"] == "2026-09-19"
    assert data["budget_eur"] == 300
    assert [day["date"] for day in data["days"]] == [
        "2026-09-17",
        "2026-09-18",
        "2026-09-19",
    ]


def test_generate_itinerary_endpoint_fills_missing_activity_costs(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    response_without_costs = _sample_ai_itinerary(destination="Tokyo", day_count=2)
    for day in response_without_costs["days"]:
        for activity in day["activities"]:
            activity.pop("estimated_cost_eur")

    _install_fake_ollama(monkeypatch, response_without_costs, {})

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 2,
            "budget": 500,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    costs = [
        activity["estimated_cost_eur"]
        for day in data["days"]
        for activity in day["activities"]
    ]
    assert all(isinstance(cost, int) for cost in costs)
    assert sum(costs) == data["total_estimated_cost_eur"]
    assert data["total_estimated_cost_eur"] <= 500


def test_generate_itinerary_endpoint_normalizes_repairable_strict_fields(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    repairable_response = _sample_ai_itinerary(destination="Tokyo", day_count=3)
    repairable_response["currency"] = "USD"
    repairable_response["total_estimated_cost_eur"] = "unknown"
    repairable_response["days"][0]["day_number"] = 3
    repairable_response["days"][1]["day_number"] = 1
    repairable_response["days"][2]["day_number"] = 2
    repairable_response["days"][0]["activities"][0]["time_slot"] = "morning"
    repairable_response["days"][1]["activities"][1]["time_slot"] = None
    repairable_response["days"][2]["activities"][2]["time_slot"] = ""
    repairable_response["days"][0]["activities"][0].pop("estimated_cost_eur")

    _install_fake_ollama(monkeypatch, repairable_response, {})

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Tokyo",
            "num_days": 3,
            "budget": 200,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "EUR"
    assert [day["day_number"] for day in data["days"]] == [1, 2, 3]
    assert data["days"][0]["activities"][0]["time_slot"] == "09:00 - 11:30"
    assert data["days"][1]["activities"][1]["time_slot"] == "14:00 - 16:00"
    assert data["days"][2]["activities"][2]["time_slot"] == "16:30 - 18:30"
    costs = [
        activity["estimated_cost_eur"]
        for day in data["days"]
        for activity in day["activities"]
    ]
    assert all(isinstance(cost, int) for cost in costs)
    assert sum(costs) == data["total_estimated_cost_eur"]
    assert data["total_estimated_cost_eur"] <= 200


def test_generate_itinerary_endpoint_normalizes_overlapping_time_slots(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    overlapping_response = _sample_ai_itinerary(destination="Tokyo", day_count=2)
    overlapping_response["days"][0]["activities"][0]["time_slot"] = "14:00 - 16:00"
    overlapping_response["days"][0]["activities"][1]["time_slot"] = "09:00 - 11:00"
    overlapping_response["days"][0]["activities"][2]["time_slot"] = "10:30 - 12:00"
    clean_day_two_slots = [
        activity["time_slot"]
        for activity in overlapping_response["days"][1]["activities"]
    ]

    _install_fake_ollama(monkeypatch, overlapping_response, {})

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
    assert [
        activity["time_slot"]
        for activity in data["days"][0]["activities"]
    ] == ["09:00 - 11:30", "13:00 - 15:30", "17:30 - 20:00"]
    assert [
        activity["time_slot"]
        for activity in data["days"][1]["activities"]
    ] == clean_day_two_slots


@pytest.mark.parametrize(
    ("invalid_response", "expected_detail"),
    [
        (
            {
                **_sample_ai_itinerary(destination="Tokyo", day_count=2),
                "days": [
                    {
                        **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0],
                        "activities": [
                            _sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0]["activities"][0],
                        ],
                    },
                    _sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][1],
                ],
            },
            "exactly 3 activities",
        ),
        (
            {
                **_sample_ai_itinerary(destination="Tokyo", day_count=2),
                "days": [
                    {
                        **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0],
                        "activities": _sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0]["activities"][:2],
                    },
                    _sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][1],
                ],
            },
            "exactly 3 activities",
        ),
        (
            {
                **_sample_ai_itinerary(destination="Tokyo", day_count=2),
                "days": [
                    {
                        **_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0],
                        "activities": [
                            *_sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][0]["activities"],
                            {
                                "title": "Extra activity",
                                "description": "This extra AI activity should make the day invalid.",
                                "time_slot": "20:30 - 21:30",
                                "estimated_cost_eur": 5,
                            },
                        ],
                    },
                    _sample_ai_itinerary(destination="Tokyo", day_count=2)["days"][1],
                ],
            },
            "exactly 3 activities",
        ),
        (
            _sample_ai_itinerary(destination="Tokyo", day_count=1),
            "exactly 2 days",
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


def test_generate_itinerary_endpoint_uses_offline_fallback_when_ollama_is_down(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    class FakeAsyncClient:
        def __init__(self, timeout):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            request = httpx.Request("POST", url)
            raise httpx.ConnectError("Ollama unavailable", request=request)

    monkeypatch.setattr(architect_service.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(architect_service, "ENABLE_OFFLINE_ITINERARY_FALLBACK", True)

    response = client.post(
        "/generate-itinerary",
        json={
            "destination": "Edinburgh",
            "num_days": 2,
            "start_date": "2026-09-17",
            "end_date": "2026-09-19",
            "travelers": 2,
            "budget": 500,
        },
        headers={"Authorization": "Bearer fake-test-token"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["destination"] == "Edinburgh"
    assert data["currency"] == "EUR"
    assert isinstance(data["total_estimated_cost_eur"], int)
    assert data["total_estimated_cost_eur"] <= 500
    assert data["start_date"] == "2026-09-17"
    assert data["end_date"] == "2026-09-19"
    assert data["budget_eur"] == 500
    assert [day["day_number"] for day in data["days"]] == [1, 2]
    assert [day["date"] for day in data["days"]] == ["2026-09-17", "2026-09-18"]
    assert all(len(day["activities"]) == 3 for day in data["days"])
    assert all(
        isinstance(activity["estimated_cost_eur"], int)
        for day in data["days"]
        for activity in day["activities"]
    )
    itinerary_text = json.dumps(data)
    assert "Budget context" not in itinerary_text
    assert "Trip dates" not in itinerary_text
    assert "per traveler" not in itinerary_text
    assert any(
        budget_phrase in itinerary_text
        for budget_phrase in ["free", "low-cost", "moderate budget"]
    )
    assert any(
        place in itinerary_text
        for place in ["Royal Mile", "Grassmarket", "Arthur's Seat", "Water of Leith"]
    )
