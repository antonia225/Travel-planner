import json
import os
import httpx
from pydantic import ValidationError

from schemas.budget import BudgetOptimizerResponse

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# Force Phi-3 for this specialized budget agent
OLLAMA_MODEL = "phi3"

SYSTEM_PROMPT = """You are an expert travel budget optimizer.

Your job is to generate affordable and realistic travel recommendations.

OUTPUT RULES:
1. Output ONLY raw valid JSON.
2. No markdown formatting.
3. No explanations outside JSON.
4. Use EXACTLY this structure:

{
  "destination": "<destination>",
  "total_budget": <integer>,
  "recommendations": [
    {
      "category": "<category>",
      "recommendation": "<specific recommendation>",
      "estimated_cost": "<cost estimate>"
    }
  ]
}

5. Include recommendations for:
- accommodation
- transportation
- food
- activities

6. Recommendations must prioritize saving money while maintaining a good experience.
"""

USER_PROMPT_TEMPLATE = (
    "Generate budget travel recommendations for a trip to {destination} "
    "with a total budget of {budget} USD."
)


async def generate_budget_plan(
    destination: str,
    budget: int,
) -> BudgetOptimizerResponse:
    user_message = USER_PROMPT_TEMPLATE.format(
        destination=destination,
        budget=budget,
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM_PROMPT}\n\nUser request: {user_message}",
        "format": "json",
        "stream": False,
    }

    timeout = httpx.Timeout(connect=10.0, read=600.0, write=30.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            response.raise_for_status()
    except httpx.ReadTimeout as exc:
        raise ValueError(
            "The budget optimizer did not respond in time. The model may still be "
            "loading or the prompt is too large. Try again in a moment."
        ) from exc
    except httpx.ConnectError as exc:
        raise ValueError(
            f"Could not connect to Ollama at {OLLAMA_BASE_URL}. "
            "Make sure the ollama service is running."
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Ollama returned an error: {exc.response.status_code} "
            f"{exc.response.text[:200]}"
        ) from exc

    raw_body = response.json()
    raw_text: str = raw_body.get("response", "")

    try:
        parsed = json.loads(raw_text)

        if isinstance(parsed, str):
            parsed = json.loads(parsed)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Phi-3 returned invalid JSON: {raw_text[:300]}"
        ) from exc

    try:
        return BudgetOptimizerResponse.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(
            f"Budget optimizer response validation failed: {exc}"
        ) from exc