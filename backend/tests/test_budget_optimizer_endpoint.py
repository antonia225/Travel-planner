import json

import httpx

_OLLAMA_GENERATE_URL = "http://ollama:11434/api/generate"
_VALID_USER = {
    "name": "Budget Tester",
    "email": "budget@example.com",
    "password": "Secure1Password",
}
_EXPENSIVE_ACTIVITIES = [
    {
        "title": "Rooftop dinner",
        "description": "Dinner with a city view.",
        "time_slot": "19:00 - 21:00",
        "day_number": 2,
        "estimated_cost_eur": 90,
    },
    {
        "title": "Private museum tour",
        "description": "Guided tour with skip-the-line access.",
        "time_slot": "10:00 - 12:00",
        "day_number": 1,
        "estimated_cost_eur": 70,
    },
]


def _auth_headers(client) -> dict[str, str]:
    client.post("/register", json=_VALID_USER)
    login_response = client.post(
        "/login",
        json={"email": _VALID_USER["email"], "password": _VALID_USER["password"]},
    )
    return {"Authorization": f"Bearer {login_response.json()['access_token']}"}


def _patch_async_client(monkeypatch, response):
    captured: dict[str, object] = {}

    class FakeAsyncClient:
        def __init__(self, timeout: httpx.Timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url: str, json: dict):
            captured["url"] = url
            captured["json"] = json
            return response

    monkeypatch.setattr(
        "services.budget_optimizer_service.httpx.AsyncClient",
        FakeAsyncClient,
    )
    return captured


def test_optimize_budget_returns_200_with_valid_model_json(client, monkeypatch):
    class FakeResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict[str, str]:
            return {
                "response": json.dumps(
                    {
                        "destination": "Rome",
                        "total_budget": 1000,
                        "recommendations": [
                            {
                                "category": "accommodation",
                                "recommendation": "Stay in a hostel outside center",
                                "estimated_cost": "300 USD",
                            },
                            {
                                "category": "food",
                                "recommendation": "Eat at local markets",
                                "estimated_cost": "200 USD",
                            },
                        ],
                    }
                )
            }

    captured = _patch_async_client(monkeypatch, FakeResponse())

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
        headers=_auth_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["destination"] == "Rome"
    assert body["total_budget"] == 1000
    assert len(body["recommendations"]) == 2
    assert captured["url"] == _OLLAMA_GENERATE_URL
    assert (captured["json"])["model"] == "phi3"
    assert "accommodation" in (captured["json"])["prompt"]


def test_optimize_budget_uses_expensive_activities_for_savings_prompt(
    client,
    monkeypatch,
):
    class FakeResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict[str, str]:
            return {
                "response": json.dumps(
                    {
                        "destination": "Rome",
                        "total_budget": 1000,
                        "total_estimated_savings_eur": 105,
                        "recommendations": [
                            {
                                "original_activity": "Rooftop dinner",
                                "original_cost_eur": 90,
                                "suggested_alternative": "Choose a neighborhood trattoria.",
                                "estimated_alternative_cost_eur": 35,
                                "estimated_savings_eur": 55,
                                "reason": "Keeps dinner local while lowering menu prices.",
                            },
                            {
                                "original_activity": "Private museum tour",
                                "original_cost_eur": 70,
                                "suggested_alternative": "Use a standard ticket and free audio guide.",
                                "estimated_alternative_cost_eur": 20,
                                "estimated_savings_eur": 50,
                                "reason": "Preserves the museum visit without the guide fee.",
                            },
                        ],
                    }
                )
            }

    captured = _patch_async_client(monkeypatch, FakeResponse())

    response = client.post(
        "/optimize-budget",
        json={
            "destination": "Rome",
            "budget": 1000,
            "expensive_activities": _EXPENSIVE_ACTIVITIES,
        },
        headers=_auth_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_estimated_savings_eur"] == 105
    assert body["recommendations"][0]["estimated_savings_eur"] == 55
    assert captured["url"] == _OLLAMA_GENERATE_URL
    assert (captured["json"])["keep_alive"] == "10m"
    assert (captured["json"])["options"]["num_predict"] == 700
    assert captured["timeout"].read == 90.0
    assert "Rooftop dinner" in (captured["json"])["prompt"]
    assert '"day_number": 2' in (captured["json"])["prompt"]
    assert '"time_slot": "19:00 - 21:00"' in (captured["json"])["prompt"]
    assert '"estimated_cost_eur": 90' in (captured["json"])["prompt"]


def test_optimize_budget_returns_422_when_model_json_is_invalid(client, monkeypatch):
    class FakeResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict[str, str]:
            return {"response": "{not-valid-json"}

    captured = _patch_async_client(monkeypatch, FakeResponse())

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
        headers=_auth_headers(client),
    )

    assert response.status_code == 422
    assert "Phi-3 returned invalid JSON" in response.json()["detail"]
    assert captured["url"] == _OLLAMA_GENERATE_URL


def test_optimize_budget_returns_422_on_upstream_http_error(client, monkeypatch):
    class FakeResponse:
        def raise_for_status(self) -> None:
            request = httpx.Request("POST", _OLLAMA_GENERATE_URL)
            response = httpx.Response(500, request=request)
            raise httpx.HTTPStatusError(
                "Server error from Ollama",
                request=request,
                response=response,
            )

        def json(self) -> dict[str, str]:
            return {"response": "{}"}

    captured = _patch_async_client(monkeypatch, FakeResponse())

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
        headers=_auth_headers(client),
    )

    assert response.status_code == 422
    assert "Ollama returned an error: 500" in response.json()["detail"]
    assert captured["url"] == _OLLAMA_GENERATE_URL


def test_optimize_budget_requires_authentication(client):
    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
    )

    assert response.status_code == 401
