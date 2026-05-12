import ollama
import pytest
from unittest.mock import patch
from fastapi import HTTPException

from services import ai_service


def test_generate_travel_plan_returns_non_empty_string(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, host: str):
            captured["host"] = host

        def generate(self, model: str, prompt: str, stream: bool = False) -> dict[str, str]:
            captured["model"] = model
            captured["prompt"] = prompt
            return {"response": "Day 1: Explore the city center."}

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3")
    monkeypatch.setenv("OLLAMA_FALLBACK_MODEL", "phi3")
    monkeypatch.setenv("AI_AGENT_PROVIDER", "ollama")
    
    with patch("agents.ollama_agent.ollama.Client", FakeClient):
        plan = ai_service.generate_travel_plan("Plan a weekend trip to Rome")

        assert isinstance(plan, str)
        assert plan.strip() != ""
        assert captured["host"] == "http://ollama:11434"
        assert captured["model"] == "llama3"
        assert captured["prompt"] == "Plan a weekend trip to Rome"


def test_check_ollama_connection_returns_available_models(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, list[dict[str, str]]]:
            return {"models": [{"name": "llama3:latest"}, {"name": "phi3:latest"}]}

    def fake_get(url: str, timeout: float) -> FakeResponse:
        captured["url"] = url
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setattr(ai_service.httpx, "get", fake_get)

    result = ai_service.check_ollama_connection()

    assert result == {
        "status": "ok",
        "base_url": "http://ollama:11434",
        "models": ["llama3:latest", "phi3:latest"],
    }
    assert captured["url"] == "http://ollama:11434/api/tags"
    assert captured["timeout"] == 5.0


def test_generate_travel_plan_retries_with_fallback_model_on_primary_404(monkeypatch):
    calls: list[str] = []

    class FakeClient:
        def __init__(self, host: str):
            self.host = host

        def generate(self, model: str, prompt: str, stream: bool = False) -> dict[str, str]:
            calls.append(model)
            if model == "llama3":
                raise ollama.ResponseError("model not found", 404)
            return {"response": "Fallback plan generated."}

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3")
    monkeypatch.setenv("OLLAMA_FALLBACK_MODEL", "phi3")
    monkeypatch.setenv("AI_AGENT_PROVIDER", "ollama")

    with patch("agents.ollama_agent.ollama.Client", FakeClient):
        plan = ai_service.generate_travel_plan("Plan 3 days in Lisbon")

        assert plan == "Fallback plan generated."
        assert calls == ["llama3", "phi3"]


def test_generate_travel_plan_surfaces_non_404_response_errors_as_500(monkeypatch):
    """Non-404 ollama.ResponseError → agent raises RuntimeError → HTTP 500."""

    class FakeClient:
        def __init__(self, host: str):
            self.host = host

        def generate(self, model: str, prompt: str, stream: bool = False) -> dict[str, str]:
            raise ollama.ResponseError("internal model error", 500)

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3")
    monkeypatch.setenv("OLLAMA_FALLBACK_MODEL", "phi3")
    monkeypatch.setenv("AI_AGENT_PROVIDER", "ollama")

    with patch("agents.ollama_agent.ollama.Client", FakeClient):
        with pytest.raises(HTTPException) as exc_info:
            ai_service.generate_travel_plan("Plan 2 days in Milan")

        assert exc_info.value.status_code == 500


def test_generate_travel_plan_surfaces_connection_errors_as_502(monkeypatch):
    """ConnectionError on both primary and fallback → HTTP 502."""

    class FakeClient:
        def __init__(self, host: str):
            self.host = host

        def generate(self, model: str, prompt: str, stream: bool = False) -> dict[str, str]:
            raise ConnectionError("connection refused")

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3")
    monkeypatch.setenv("OLLAMA_FALLBACK_MODEL", "phi3")
    monkeypatch.setenv("AI_AGENT_PROVIDER", "ollama")

    with patch("agents.ollama_agent.ollama.Client", FakeClient):
        with pytest.raises(HTTPException) as exc_info:
            ai_service.generate_travel_plan("Plan 2 days in Milan")

        assert exc_info.value.status_code == 502
