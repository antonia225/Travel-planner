import os

import pytest

from services import ai_service


@pytest.mark.integration
def test_local_ollama_connection_returns_models(monkeypatch):
    base_url = os.getenv("OLLAMA_TEST_BASE_URL", "http://localhost:11434")
    monkeypatch.setenv("OLLAMA_BASE_URL", base_url)

    result = ai_service.check_ollama_connection()

    assert result["status"] == "ok"
    assert result["base_url"] == base_url
    assert isinstance(result["models"], list)
    assert result["models"]
