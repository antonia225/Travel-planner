"""Ollama-based AI agent for travel planning."""

import os

import httpx
import ollama

from agents.base import TravelAIAgent


class OllamaTravelAIAgent(TravelAIAgent):
    """Ollama-based implementation of TravelAIAgent."""

    def __init__(self) -> None:
        """Initialize the Ollama agent with configuration from environment variables."""
        self.base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model: str = os.getenv("OLLAMA_MODEL", "llama3")
        self.fallback_model: str = os.getenv("OLLAMA_FALLBACK_MODEL", "phi3")
        self._client = ollama.Client(host=self.base_url)

    def generate(self, prompt: str) -> str:
        """
        Generate a travel plan using Ollama.

        Args:
            prompt: The user's input prompt for travel planning

        Returns:
            str: The generated travel plan

        Raises:
            ValueError: If prompt is empty
            httpx.HTTPError: If Ollama service is unavailable
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        try:
            response = self._client.generate(
                model=self.model,
                prompt=prompt,
                stream=False,
            )
            return response.get("response", "").strip()
        except (httpx.HTTPError, ConnectionError) as e:
            # Attempt fallback to secondary model
            try:
                response = self._client.generate(
                    model=self.fallback_model,
                    prompt=prompt,
                    stream=False,
                )
                return response.get("response", "").strip()
            except (httpx.HTTPError, ConnectionError) as fallback_error:
                raise ConnectionError(
                    f"Failed to connect to Ollama at {self.base_url} "
                    f"(tried models: {self.model}, {self.fallback_model})"
                ) from fallback_error
