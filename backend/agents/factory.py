"""Factory for creating AI agents based on environment configuration."""

import os

from agents.base import TravelAIAgent
from agents.mock_agent import MockTravelAIAgent
from agents.ollama_agent import OllamaTravelAIAgent


class AIAgentFactory:
    """Factory for instantiating the appropriate AI agent based on configuration."""

    @staticmethod
    def create_agent() -> TravelAIAgent:
        """
        Create and return an AI agent based on environment configuration.

        The agent type is determined by the AI_AGENT_PROVIDER environment variable:
        - "ollama": Returns OllamaTravelAIAgent
        - "mock": Returns MockTravelAIAgent

        Environment variables:
        - AI_AGENT_PROVIDER: Type of agent to create (default: "ollama")
        - OLLAMA_BASE_URL: Ollama service URL (default: "http://localhost:11434")
        - OLLAMA_MODEL: Primary Ollama model (default: "llama3")
        - OLLAMA_FALLBACK_MODEL: Fallback Ollama model (default: "phi3")

        Returns:
            TravelAIAgent: An instance of the appropriate AI agent

        Raises:
            ValueError: If AI_AGENT_PROVIDER is set to an unknown value
        """
        provider = os.getenv("AI_AGENT_PROVIDER", "ollama").lower()

        if provider == "ollama":
            return OllamaTravelAIAgent()
        elif provider == "mock":
            return MockTravelAIAgent()
        else:
            raise ValueError(
                f"Unknown AI_AGENT_PROVIDER: {provider}. "
                f"Supported providers: 'ollama', 'mock'"
            )
