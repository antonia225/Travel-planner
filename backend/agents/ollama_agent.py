"""Ollama-based AI agent for travel planning."""

import os

import httpx
import ollama

from agents.base import TravelAIAgent


class OllamaTravelAIAgent(TravelAIAgent):
    """Ollama-based implementation of TravelAIAgent."""

    def __init__(self) -> None:
        """Initialize the Ollama agent with configuration from environment variables."""
        self.base_url: str = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
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
            ValueError: If prompt is empty or Ollama returns an empty response
            RuntimeError: If Ollama returns a non-404 response error for either model
            ConnectionError: If Ollama service is unreachable for both models
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        try:
            response = self._client.generate(
                model=self.model,
                prompt=prompt,
                stream=False,
            )
            text = response.get("response", "").strip()
            if not text:
                raise ValueError(f"Empty response from model '{self.model}'")
            return text
        except ollama.ResponseError as e:
            if e.status_code != 404:
                raise RuntimeError(
                    f"Ollama error for model '{self.model}': {e}"
                ) from e
            # 404 means model not found – fall through to fallback
        except (httpx.HTTPError, ConnectionError):
            pass  # connectivity issue – fall through to fallback

        # Attempt fallback to secondary model
        try:
            response = self._client.generate(
                model=self.fallback_model,
                prompt=prompt,
                stream=False,
            )
            text = response.get("response", "").strip()
            if not text:
                raise ValueError(
                    f"Empty response from fallback model '{self.fallback_model}'"
                )
            return text
        except ollama.ResponseError as e:
            raise RuntimeError(
                f"Ollama error for fallback model '{self.fallback_model}': {e}"
            ) from e
        except (httpx.HTTPError, ConnectionError) as fallback_error:
            raise ConnectionError(
                f"Failed to connect to Ollama at {self.base_url} "
                f"(tried models: {self.model}, {self.fallback_model})"
            ) from fallback_error
