from services import ai_service


def test_generate_travel_plan_returns_non_empty_string(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, host: str):
            captured["host"] = host

        def generate(self, model: str, prompt: str) -> dict[str, str]:
            captured["model"] = model
            captured["prompt"] = prompt
            return {"response": "Day 1: Explore the city center."}

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3")
    monkeypatch.setenv("OLLAMA_FALLBACK_MODEL", "phi3")
    monkeypatch.setattr(ai_service, "Client", FakeClient)

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
