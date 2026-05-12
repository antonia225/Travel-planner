"""AI services for travel planning."""

import os

import httpx
from fastapi import HTTPException

from agents.factory import AIAgentFactory


def generate_travel_plan(user_prompt: str) -> str:
    """
    Generate a travel plan based on user input.

    Args:
        user_prompt: The user's travel planning request

    Returns:
        str: A generated travel plan

    Raises:
        HTTPException: If prompt is empty or AI agent fails
    """
    prompt = user_prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt must not be empty.")

    try:
        agent = AIAgentFactory.create_agent()
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail="AI agent configuration is invalid.",
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected AI service failure.") from exc

    try:
        return agent.generate(prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=f"AI service unavailable: {str(exc)}") from exc
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise HTTPException(status_code=503, detail="Could not connect to Ollama service.") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected AI service failure.") from exc


def check_ollama_connection() -> dict[str, object]:
    """Check if Ollama service is available and list available models."""
    base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")

    try:
        response = httpx.get(f"{base_url}/api/tags", timeout=5.0)
        response.raise_for_status()
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise HTTPException(status_code=503, detail="Could not connect to Ollama service.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama health check failed with status {exc.response.status_code}.",
        ) from exc

    data = response.json()
    models = [model.get("name") for model in data.get("models", []) if model.get("name")]
    return {"status": "ok", "base_url": base_url, "models": models}

