import json
import os
from time import perf_counter

import httpx
from pydantic import ValidationError
from sqlalchemy.orm import Session

from models import AIGenerationStatus
from repositories.ai_generation_log_repository import BUDGET_OPTIMIZER_AGENT_NAME
from schemas.budget import BudgetOptimizerActivity, BudgetOptimizerResponse
from services.ai_generation_logger import record_ai_generation_log, response_time_ms

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

ACTIVITY_SYSTEM_PROMPT = """You are an expert travel budget optimizer.

Your job is to review only the provided expensive itinerary activities and
suggest one realistic free or cheaper alternative for each.

OUTPUT RULES:
1. Output ONLY raw valid JSON.
2. No markdown formatting.
3. No explanations outside JSON.
4. Use EXACTLY this structure:

{
  "destination": "<destination>",
  "total_budget": <integer>,
  "total_estimated_savings_eur": <integer>,
  "recommendations": [
    {
      "original_activity": "<activity title>",
      "original_cost_eur": <integer>,
      "suggested_alternative": "<specific cheaper or free alternative>",
      "estimated_alternative_cost_eur": <integer>,
      "estimated_savings_eur": <integer>,
      "reason": "<short reason this saves money and still fits the trip>"
    }
  ]
}

5. Return exactly one recommendation for each provided expensive activity.
6. Use EUR only. Cost and savings fields must be integers, not strings.
7. estimated_savings_eur must equal original_cost_eur minus estimated_alternative_cost_eur.
8. total_estimated_savings_eur must equal the sum of all estimated_savings_eur values.
9. Alternatives must fit the destination, day number, and time slot.
"""

ACTIVITY_USER_PROMPT_TEMPLATE = (
    "Optimize the most expensive itinerary activities for a trip to {destination} "
    "with a total budget of {budget} EUR.\n\n"
    "Activities to optimize:\n{activities_json}"
)


def _build_prompt(
    destination: str,
    budget: int,
    expensive_activities: list[BudgetOptimizerActivity] | None,
) -> tuple[str, bool]:
    if expensive_activities:
        activities_json = json.dumps(
            [activity.model_dump() for activity in expensive_activities],
            ensure_ascii=False,
        )
        user_message = ACTIVITY_USER_PROMPT_TEMPLATE.format(
            destination=destination,
            budget=budget,
            activities_json=activities_json,
        )
        return f"{ACTIVITY_SYSTEM_PROMPT}\n\nUser request: {user_message}", True

    user_message = USER_PROMPT_TEMPLATE.format(
        destination=destination,
        budget=budget,
    )
    return f"{SYSTEM_PROMPT}\n\nUser request: {user_message}", False


async def generate_budget_plan(
    destination: str,
    budget: int,
    expensive_activities: list[BudgetOptimizerActivity] | None = None,
    db: Session | None = None,
) -> BudgetOptimizerResponse:
    prompt, has_activity_context = _build_prompt(
        destination,
        budget,
        expensive_activities,
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "format": "json",
        "stream": False,
    }

    if has_activity_context:
        payload["keep_alive"] = "10m"
        payload["options"] = {
            "temperature": 0.2,
            "num_predict": 700,
        }

    read_timeout = 90.0 if has_activity_context else 600.0
    timeout = httpx.Timeout(connect=10.0, read=read_timeout, write=30.0, pool=10.0)
    started_at = perf_counter()
    raw_body: dict | None = None

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            response.raise_for_status()
        raw_body = response.json()
    except httpx.ReadTimeout as exc:
        message = (
            "The budget optimizer did not respond in time. The model may still be "
            "loading or the prompt is too large. Try again in a moment."
        )
        record_ai_generation_log(
            db,
            agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
            operation="optimize_budget",
            status=AIGenerationStatus.FAILED,
            model=OLLAMA_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc
    except httpx.ConnectError as exc:
        message = (
            f"Could not connect to Ollama at {OLLAMA_BASE_URL}. "
            "Make sure the ollama service is running."
        )
        record_ai_generation_log(
            db,
            agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
            operation="optimize_budget",
            status=AIGenerationStatus.FAILED,
            model=OLLAMA_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc
    except httpx.HTTPStatusError as exc:
        message = (
            f"Ollama returned an error: {exc.response.status_code} "
            f"{exc.response.text[:200]}"
        )
        record_ai_generation_log(
            db,
            agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
            operation="optimize_budget",
            status=AIGenerationStatus.FAILED,
            model=OLLAMA_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc

    raw_text: str = raw_body.get("response", "")

    try:
        parsed = json.loads(raw_text)

        if isinstance(parsed, str):
            parsed = json.loads(parsed)
    except json.JSONDecodeError as exc:
        message = f"Phi-3 returned invalid JSON: {raw_text[:300]}"
        record_ai_generation_log(
            db,
            agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
            operation="optimize_budget",
            status=AIGenerationStatus.FAILED,
            model=raw_body.get("model") or OLLAMA_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc

    try:
        result = BudgetOptimizerResponse.model_validate(parsed)
    except ValidationError as exc:
        message = f"Budget optimizer response validation failed: {exc}"
        record_ai_generation_log(
            db,
            agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
            operation="optimize_budget",
            status=AIGenerationStatus.FAILED,
            model=raw_body.get("model") or OLLAMA_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc

    record_ai_generation_log(
        db,
        agent_name=BUDGET_OPTIMIZER_AGENT_NAME,
        operation="optimize_budget",
        status=AIGenerationStatus.SUCCESS,
        model=raw_body.get("model") or OLLAMA_MODEL,
        destination=destination,
        response_time_ms=response_time_ms(raw_body, started_at),
    )
    return result
