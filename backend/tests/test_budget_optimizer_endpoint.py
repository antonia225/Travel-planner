import json

import httpx


def test_optimize_budget_returns_200_with_valid_model_json(client, monkeypatch):
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

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
        "services.budget_optimizer_service.httpx.AsyncClient",
        FakeAsyncClient,
    )

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["destination"] == "Rome"
    assert body["total_budget"] == 1000
    assert len(body["recommendations"]) == 2


def test_optimize_budget_returns_422_when_model_json_is_invalid(client, monkeypatch):
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"response": "{not-valid-json"}

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
        "services.budget_optimizer_service.httpx.AsyncClient",
        FakeAsyncClient,
    )

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
    )

    assert response.status_code == 422
    assert "Phi-3 returned invalid JSON" in response.json()["detail"]


def test_optimize_budget_returns_422_on_upstream_http_error(client, monkeypatch):
    class FakeResponse:
        def raise_for_status(self) -> None:
            request = httpx.Request("POST", "http://ollama:11434/api/generate")
            response = httpx.Response(500, request=request)
            raise httpx.HTTPStatusError(
                "Server error from Ollama",
                request=request,
                response=response,
            )

        def json(self) -> dict[str, str]:
            return {"response": "{}"}

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
        "services.budget_optimizer_service.httpx.AsyncClient",
        FakeAsyncClient,
    )

    response = client.post(
        "/optimize-budget",
        json={"destination": "Rome", "budget": 1000},
    )

    assert response.status_code == 422
    assert "Budget optimizer request failed" in response.json()["detail"]
