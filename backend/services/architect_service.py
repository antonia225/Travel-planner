import json
import os
import re
import httpx
from pydantic import ValidationError

from schemas.itinerary import ItineraryResponse

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
TIME_SLOT_PATTERN = re.compile(r"^\d{2}:\d{2} - \d{2}:\d{2}$")

SYSTEM_PROMPT = """You are an elite, highly structured travel architect.

OUTPUT RULES — follow these without exception:
1. You must output ONLY raw, valid JSON. Do not use markdown formatting like ```json.
2. Do not include conversational greetings, explanations, or conclusions of any kind.
3. You must provide EXACTLY the following JSON structure and nothing else:
{
  "destination": "<city or region name>",
  "days": [
    {
      "day_number": 1,
      "activities": [
        {
          "title": "<short activity title>",
          "description": "<detailed description of the activity>",
          "time_slot": "<HH:MM - HH:MM>"
        }
      ]
    }
  ]
}
4. Every single day must have a minimum of 3 activities.
5. Each activity must include a title, a detailed description, and a time_slot in the format HH:MM - HH:MM.
6. The number of objects in the "days" array must equal exactly the number of days requested."""

USER_PROMPT_TEMPLATE = (
    "Generate a detailed {days}-day travel itinerary for {destination}. "
    "{interests_note}"
    "Remember: output only the raw JSON, no markdown, no extra text."
)


def _validate_daily_schedule(itinerary: ItineraryResponse, requested_days: int) -> None:
    actual_days = len(itinerary.days)
    if actual_days != requested_days:
        raise ValueError(
            f"Ollama response must include exactly {requested_days} days, "
            f"but got {actual_days}."
        )

    expected_day_numbers = list(range(1, requested_days + 1))
    actual_day_numbers = [day.day_number for day in itinerary.days]
    if actual_day_numbers != expected_day_numbers:
        raise ValueError(
            "Ollama response must include sequential day numbers "
            f"{expected_day_numbers}, but got {actual_day_numbers}."
        )

    for day in itinerary.days:
        for activity in day.activities:
            if not TIME_SLOT_PATTERN.fullmatch(activity.time_slot):
                raise ValueError(
                    "Ollama response activity time_slot must use HH:MM - HH:MM "
                    f"format, but got {activity.time_slot!r}."
                )


async def generate_itinerary(
    destination: str,
    days: int,
    user_interests: list[str] | None = None,
) -> ItineraryResponse:
    """
    Sends a structured prompt to the local Ollama instance and returns a
    validated ItineraryResponse. Personalizes itinerary based on user interests.
    Raises ValueError on parse/validation failure and httpx.HTTPStatusError on non-2xx responses.
    """
    # Build interests note for prompt
    interests_note = ""
    if user_interests:
        interests_str = ", ".join(user_interests)
        interests_note = f"The traveler is interested in: {interests_str}. Prioritize activities aligned with these interests. "

    user_message = USER_PROMPT_TEMPLATE.format(
        days=days,
        destination=destination,
        interests_note=interests_note,
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
            response = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            response.raise_for_status()
    except httpx.ReadTimeout as exc:
        raise ValueError(
            "Ollama did not respond in time. The model may still be loading or "
            "the prompt is too large. Try again in a moment."
        ) from exc
    except httpx.ConnectError as exc:
        raise ValueError(
            f"Could not connect to Ollama at {OLLAMA_BASE_URL}. "
            "Make sure the ollama service is running."
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Ollama returned an error: {exc.response.status_code} {exc.response.text[:200]}"
        ) from exc

    raw_body = response.json()
    raw_text: str = raw_body.get("response", "")

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Ollama returned non-JSON content: {raw_text[:300]}"
        ) from exc

    try:
        itinerary = ItineraryResponse.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(
            f"Ollama response did not match the expected itinerary schema: {exc}"
        ) from exc

    _validate_daily_schedule(itinerary, requested_days=days)
    return itinerary
