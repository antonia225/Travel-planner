import os
from abc import ABC, abstractmethod

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException
from ollama import Client, ResponseError

load_dotenv()


class TravelAIAgent(ABC):
    @abstractmethod
    def generate(self, user_prompt: str) -> str:
        """Generate a travel-plan response for the provided user prompt."""


class OllamaTravelAIAgent(TravelAIAgent):
    def __init__(self, base_url: str, primary_model: str, fallback_model: str | None = None):
        self._client = Client(host=base_url)
        self._models = [primary_model]
        if fallback_model and fallback_model != primary_model:
            self._models.append(fallback_model)

    def generate(self, user_prompt: str) -> str:
        last_error: Exception | None = None

        for model in self._models:
            try:
                response = self._client.generate(model=model, prompt=user_prompt)
                plan_text = (response.get("response") or "").strip()
                if not plan_text:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Ollama returned an empty response for model '{model}'.",
                    )
                return plan_text
            except ResponseError as exc:
                last_error = exc
                if exc.status_code == 404 and model != self._models[-1]:
                    continue
                raise HTTPException(status_code=502, detail=f"Ollama error: {exc.error}") from exc

        raise HTTPException(
            status_code=502,
            detail=f"No available Ollama model could serve the request: {last_error}",
        ) from last_error


class AIAgentFactory:
    @staticmethod
    def create_travel_agent() -> TravelAIAgent:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        primary_model = os.getenv("OLLAMA_MODEL", "llama3")
        fallback_model = os.getenv("OLLAMA_FALLBACK_MODEL", "phi3")
        return OllamaTravelAIAgent(
            base_url=base_url,
            primary_model=primary_model,
            fallback_model=fallback_model,
        )


def generate_travel_plan(user_prompt: str) -> str:
    prompt = user_prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt must not be empty.")

    ai_agent = AIAgentFactory.create_travel_agent()

    try:
        return ai_agent.generate(prompt)
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise HTTPException(status_code=503, detail="Could not connect to Ollama service.") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected AI service failure.") from exc
