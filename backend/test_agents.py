"""Tests for AI agents and factory."""

import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from agents.factory import AIAgentFactory
from agents.mock_agent import MockTravelAIAgent
from agents.ollama_agent import OllamaTravelAIAgent
from services.ai_service import generate_travel_plan


class TestMockAgent:
    """Test suite for MockTravelAIAgent."""

    def test_mock_agent_generates_response(self) -> None:
        """Test that mock agent generates a response."""
        agent = MockTravelAIAgent()
        prompt = "Plan a trip to Paris"
        response = agent.generate(prompt)

        assert response is not None
        assert "Mock travel plan" in response
        assert "Paris" in response

    def test_mock_agent_raises_on_empty_prompt(self) -> None:
        """Test that mock agent raises ValueError for empty prompt."""
        agent = MockTravelAIAgent()

        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            agent.generate("")

        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            agent.generate("   ")


class TestOllamaAgent:
    """Test suite for OllamaTravelAIAgent."""

    @patch.dict(os.environ, {
        "OLLAMA_BASE_URL": "http://test-ollama:11434",
        "OLLAMA_MODEL": "test-model",
        "OLLAMA_FALLBACK_MODEL": "test-fallback",
    })
    @patch("agents.ollama_agent.ollama.Client")
    def test_ollama_agent_generates_response(self, mock_client_class: MagicMock) -> None:
        """Test that Ollama agent generates a response."""
        # Mock the Ollama client
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.generate.return_value = {"response": "Sample travel plan"}

        agent = OllamaTravelAIAgent()
        response = agent.generate("Plan a trip to Tokyo")

        assert response == "Sample travel plan"
        mock_client.generate.assert_called_once()

    @patch.dict(os.environ, {
        "OLLAMA_BASE_URL": "http://test-ollama:11434",
        "OLLAMA_MODEL": "test-model",
        "OLLAMA_FALLBACK_MODEL": "test-fallback",
    })
    @patch("agents.ollama_agent.ollama.Client")
    def test_ollama_agent_raises_on_empty_prompt(self, mock_client_class: MagicMock) -> None:
        """Test that Ollama agent raises ValueError for empty prompt."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        agent = OllamaTravelAIAgent()

        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            agent.generate("")

        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            agent.generate("   ")

    @patch.dict(os.environ, {
        "OLLAMA_BASE_URL": "http://test-ollama:11434",
        "OLLAMA_MODEL": "test-model",
        "OLLAMA_FALLBACK_MODEL": "test-fallback",
    })
    @patch("agents.ollama_agent.ollama.Client")
    def test_ollama_agent_uses_fallback_model(self, mock_client_class: MagicMock) -> None:
        """Test that Ollama agent falls back to fallback model on primary failure."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        # First call fails, second call (fallback) succeeds
        mock_client.generate.side_effect = [
            ConnectionError("Primary model failed"),
            {"response": "Fallback response"},
        ]

        agent = OllamaTravelAIAgent()
        response = agent.generate("Plan a trip")

        assert response == "Fallback response"
        assert mock_client.generate.call_count == 2

    @patch.dict(os.environ, {
        "OLLAMA_BASE_URL": "http://test-ollama:11434",
        "OLLAMA_MODEL": "test-model",
        "OLLAMA_FALLBACK_MODEL": "test-fallback",
    })
    @patch("agents.ollama_agent.ollama.Client")
    def test_ollama_agent_raises_when_both_models_fail(self, mock_client_class: MagicMock) -> None:
        """Test that Ollama agent raises ConnectionError when both models fail."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.generate.side_effect = ConnectionError("Service unavailable")

        agent = OllamaTravelAIAgent()

        with pytest.raises(ConnectionError, match="Failed to connect to Ollama"):
            agent.generate("Plan a trip")


class TestAIAgentFactory:
    """Test suite for AIAgentFactory."""

    @patch.dict(os.environ, {"AI_AGENT_PROVIDER": "mock"})
    def test_factory_creates_mock_agent(self) -> None:
        """Test that factory creates MockTravelAIAgent when provider is 'mock'."""
        agent = AIAgentFactory.create_agent()
        assert isinstance(agent, MockTravelAIAgent)

    @patch.dict(os.environ, {"AI_AGENT_PROVIDER": "ollama"})
    @patch("agents.factory.OllamaTravelAIAgent")
    def test_factory_creates_ollama_agent(self, mock_ollama_class: MagicMock) -> None:
        """Test that factory creates OllamaTravelAIAgent when provider is 'ollama'."""
        mock_instance = MagicMock(spec=OllamaTravelAIAgent)
        mock_ollama_class.return_value = mock_instance

        agent = AIAgentFactory.create_agent()

        mock_ollama_class.assert_called_once()
        assert agent == mock_instance

    @patch.dict(os.environ, {"AI_AGENT_PROVIDER": "ollama"})
    def test_factory_defaults_to_ollama(self) -> None:
        """Test that factory defaults to Ollama agent."""
        with patch("agents.factory.OllamaTravelAIAgent") as mock_ollama_class:
            mock_instance = MagicMock(spec=OllamaTravelAIAgent)
            mock_ollama_class.return_value = mock_instance

            agent = AIAgentFactory.create_agent()

            mock_ollama_class.assert_called_once()

    @patch.dict(os.environ, {"AI_AGENT_PROVIDER": "unknown_provider"})
    def test_factory_raises_on_invalid_provider(self) -> None:
        """Test that factory raises ValueError for invalid provider."""
        with pytest.raises(ValueError, match="Unknown AI_AGENT_PROVIDER"):
            AIAgentFactory.create_agent()

    @patch.dict(os.environ, {}, clear=False)
    @patch("agents.factory.OllamaTravelAIAgent")
    def test_factory_uses_default_provider_when_env_var_missing(self, mock_ollama_class: MagicMock) -> None:
        """Test that factory defaults to 'ollama' when AI_AGENT_PROVIDER is not set."""
        mock_instance = MagicMock(spec=OllamaTravelAIAgent)
        mock_ollama_class.return_value = mock_instance

        # Remove AI_AGENT_PROVIDER if it exists
        os.environ.pop("AI_AGENT_PROVIDER", None)

        agent = AIAgentFactory.create_agent()

        mock_ollama_class.assert_called_once()


class TestAIService:
    """Test suite for ai_service.generate_travel_plan."""

    @patch("services.ai_service.AIAgentFactory.create_agent")
    def test_generate_travel_plan_uses_factory(self, mock_create_agent: MagicMock) -> None:
        """Test that generate_travel_plan uses AIAgentFactory."""
        mock_agent = MagicMock()
        mock_agent.generate.return_value = "Generated plan"
        mock_create_agent.return_value = mock_agent

        result = generate_travel_plan("Plan a trip to NYC")

        mock_create_agent.assert_called_once()
        mock_agent.generate.assert_called_once_with("Plan a trip to NYC")
        assert result == "Generated plan"

    @patch("services.ai_service.AIAgentFactory.create_agent")
    def test_generate_travel_plan_validates_empty_prompt(self, mock_create_agent: MagicMock) -> None:
        """Test that generate_travel_plan validates non-empty prompt."""
        with pytest.raises(HTTPException, match="Prompt must not be empty"):
            generate_travel_plan("")

        with pytest.raises(HTTPException, match="Prompt must not be empty"):
            generate_travel_plan("   ")

        # Verify factory was never called for invalid prompts
        mock_create_agent.assert_not_called()

    @patch("services.ai_service.AIAgentFactory.create_agent")
    def test_generate_travel_plan_propagates_agent_errors(self, mock_create_agent: MagicMock) -> None:
        """Test that generate_travel_plan converts agent errors to HTTPException."""
        mock_agent = MagicMock()
        mock_agent.generate.side_effect = ConnectionError("Service unavailable")
        mock_create_agent.return_value = mock_agent

        with pytest.raises(HTTPException, match="AI service unavailable"):
            generate_travel_plan("Plan a trip")


class TestIntegration:
    """Integration tests."""

    def test_generate_travel_plan_with_mock_agent(self) -> None:
        """Test end-to-end with mock agent."""
        with patch.dict(os.environ, {"AI_AGENT_PROVIDER": "mock"}):
            result = generate_travel_plan("Plan a trip to London")

            assert "Mock travel plan" in result
            assert "London" in result

    def test_generate_travel_plan_with_mock_agent_empty_prompt(self) -> None:
        """Test that empty prompt raises HTTPException even with mock agent."""
        with patch.dict(os.environ, {"AI_AGENT_PROVIDER": "mock"}):
            with pytest.raises(HTTPException, match="Prompt must not be empty"):
                generate_travel_plan("")
