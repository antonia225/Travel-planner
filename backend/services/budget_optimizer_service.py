import json
import os
import httpx
from json_repair import repair_json
from pydantic import ValidationError

from schemas.budget import BudgetOptimizerResponse

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# Force Phi-3 for this specialized budget agent
OLLAMA_MODEL = "phi3"

SYSTEM_PROMPT = """You are a travel budget optimizer. Output ONLY a JSON object. No prose, no markdown.

The JSON must have exactly these three top-level keys:
- "destination": string
- "total_budget": integer
- "recommendations": array of objects

Each object in "recommendations" must have exactly these three keys:
- "category": one short word (accommodation | transportation | food | activities)
- "recommendation": one sentence describing what to do
- "estimated_cost": a short cost string like "20 USD per night"

Do NOT put long text in "category". Do NOT merge fields together. Do NOT add extra keys.

Example of a valid single recommendation object:
{"category": "accommodation", "recommendation": "Stay at a budget hostel.", "estimated_cost": "25 USD per night"}

Provide exactly 4 recommendation objects, one for each category.
"""

USER_PROMPT_TEMPLATE = (
    "Generate budget travel recommendations for a trip to {destination} "
    "with a total budget of {budget} USD."
)


_REQUIRED_REC_FIELDS = {"category", "recommendation", "estimated_cost"}


def _strip_keys(obj):
    """Recursively strip whitespace from all dictionary keys."""
    if isinstance(obj, dict):
        return {k.strip(): _strip_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_strip_keys(item) for item in obj]
    return obj


def _repair_recommendation(rec: dict) -> dict | None:
    """
    Recover a recommendation dict when phi3 merges a key with its value.
    E.g. {'categorydeparture_point': '...', 'estimated_cost': '60 USD'}
    → {'category': 'departure_point', 'recommendation': '...', 'estimated_cost': '60 USD'}

    Returns None if the item cannot be meaningfully repaired.
    """
    if _REQUIRED_REC_FIELDS.issubset(rec.keys()):
        # Drop items where category is suspiciously long (model hallucinated garbage)
        if len(str(rec.get("category", ""))) > 40:
            return None
        return rec

    repaired = dict(rec)

    for field in ("category", "recommendation", "estimated_cost"):
        if field in repaired:
            continue
        for key in list(repaired.keys()):
            if key.startswith(field) and key != field:
                extracted = key[len(field):].strip("_ ")
                repaired[field] = extracted or key
                repaired.pop(key, None)
                break

    if not _REQUIRED_REC_FIELDS.issubset(repaired.keys()):
        return None

    if len(str(repaired.get("category", ""))) > 40:
        return None

    return repaired


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
    except json.JSONDecodeError:
        try:
            parsed = json.loads(repair_json(raw_text))
        except (json.JSONDecodeError, Exception) as exc:
            raise ValueError(
                f"Phi-3 returned invalid JSON that could not be repaired: {raw_text[:300]}"
            ) from exc

    if not isinstance(parsed, dict):
        raise ValueError(
            f"Phi-3 returned invalid JSON: {raw_text[:300]}"
        )

    parsed = _strip_keys(parsed)

    if isinstance(parsed.get("recommendations"), list):
        repaired = [
            _repair_recommendation(r)
            for r in parsed["recommendations"]
            if isinstance(r, dict)
        ]
        parsed["recommendations"] = [r for r in repaired if r is not None]

    try:
        return BudgetOptimizerResponse.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(
            f"Budget optimizer response validation failed: {exc}"
        ) from exc