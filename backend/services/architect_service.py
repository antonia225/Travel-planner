import json
import os
import re
from datetime import date

import httpx
from pydantic import ValidationError

from schemas.itinerary import Activity, DailySchedule, ItineraryResponse

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
ENABLE_OFFLINE_ITINERARY_FALLBACK = (
    os.getenv("ENABLE_OFFLINE_ITINERARY_FALLBACK", "true").lower()
    not in {"0", "false", "no"}
)
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
    "Generate a detailed {days}-day travel itinerary for {destination}{date_note}. "
    "Group size: {travelers} traveler(s). Budget context: {budget_note}. "
    "{interests_note}"
    "Every activity must name a real local place, district, landmark, transit "
    "choice, or food option in the destination. Include budget tactics in the "
    "description, such as free sights, walkable routes, public transit, casual "
    "food, or one carefully chosen paid highlight. Avoid generic phrases like "
    "'central area' or 'well-known museum'. "
    "Remember: output only the raw JSON, no markdown, no extra text."
)

DESTINATION_ALIASES = {
    "edinburgh": "edinburgh",
    "edinburg": "edinburgh",
}

DESTINATION_PROFILES = {
    "edinburgh": [
        {
            "title": "Arthur's Seat and Holyrood Park loop",
            "description": (
                "Hike from Holyrood Park toward Arthur's Seat, or choose the lower "
                "Salisbury Crags path for easier skyline views and open green space."
            ),
            "tags": {"adventure", "nature_wildlife", "eco_tourism", "relaxation_wellness"},
            "budget": "Free activity; walk from Old Town or use one short bus/tram leg if needed.",
        },
        {
            "title": "Royal Mile closes, St Giles and Old Town route",
            "description": (
                "Walk the Royal Mile, step into narrow closes, pause around St Giles' "
                "Cathedral, and use free viewpoints instead of stacking paid attractions."
            ),
            "tags": {"culture_history", "architecture_design", "photography"},
            "budget": "Low-cost route; reserve paid castle entry only if the budget allows.",
        },
        {
            "title": "National Museum of Scotland and Greyfriars",
            "description": (
                "Use the free National Museum of Scotland as the main cultural stop, "
                "then walk to Greyfriars Kirkyard and nearby Old Town lanes."
            ),
            "tags": {"culture_history", "family_friendly", "art_museums"},
            "budget": "Free main attraction; spend on a simple cafe or bakery stop nearby.",
        },
        {
            "title": "Stockbridge, Dean Village and Water of Leith",
            "description": (
                "Follow the Water of Leith path between Stockbridge and Dean Village "
                "for a calmer, greener side of Edinburgh away from the busiest streets."
            ),
            "tags": {"relaxation_wellness", "eco_tourism", "nature_wildlife", "photography"},
            "budget": "Free walking route; choose picnic snacks or a casual Stockbridge lunch.",
        },
        {
            "title": "Leith Shore and Royal Botanic Garden",
            "description": (
                "Take public transport toward Leith for the Shore, then pair it with "
                "the Royal Botanic Garden for a slower eco-friendly afternoon."
            ),
            "tags": {"eco_tourism", "food_culinary", "relaxation_wellness", "nature_wildlife"},
            "budget": "Public transport friendly; keep dining casual around Leith or split small plates.",
        },
        {
            "title": "Calton Hill sunset and New Town walk",
            "description": (
                "Climb Calton Hill for one of Edinburgh's best free views, then walk "
                "through New Town streets instead of paying for another evening attraction."
            ),
            "tags": {"photography", "architecture_design", "relaxation_wellness"},
            "budget": "Free viewpoint; spend the evening budget on one affordable meal.",
        },
        {
            "title": "Grassmarket food stop and Vennel viewpoint",
            "description": (
                "Use Grassmarket for a budget-conscious food stop, then walk to the "
                "Vennel for a classic castle view without buying an attraction ticket."
            ),
            "tags": {"food_culinary", "photography", "culture_history"},
            "budget": "Choose casual pubs, bakeries, or takeaway food rather than a formal dinner.",
        },
        {
            "title": "Portobello Beach slow afternoon",
            "description": (
                "Ride or bus to Portobello for beach time, sea air, and a quieter "
                "break from Old Town crowds."
            ),
            "tags": {"relaxation_wellness", "nature_wildlife", "family_friendly"},
            "budget": "Low-cost option; bring snacks or choose one simple seaside cafe stop.",
        },
        {
            "title": "Pentland Hills or Blackford Hill nature escape",
            "description": (
                "For a stronger nature focus, choose a half-day Pentland Hills outing, "
                "or keep it easier with Blackford Hill and Hermitage of Braid."
            ),
            "tags": {"adventure", "nature_wildlife", "eco_tourism"},
            "budget": "Free outdoor plan; budget mainly for transit and packed food.",
        },
    ],
}


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


def _format_interest_label(value: str) -> str:
    return value.replace("_", " ").strip()


def _budget_note(budget: int | None, travelers: int, days: int) -> str:
    if not budget:
        return "no fixed budget, but keep the plan cost-aware"

    per_traveler_day = budget / max(travelers, 1) / max(days, 1)
    if per_traveler_day < 45:
        tier = "very lean"
    elif per_traveler_day < 90:
        tier = "moderate"
    else:
        tier = "flexible"

    return (
        f"total budget {budget} for {travelers} traveler(s), about "
        f"{per_traveler_day:.0f} per traveler per day, {tier} style"
    )


def _fallback_spending_note(budget: int | None, travelers: int, days: int) -> str:
    if not budget:
        return "Keep costs controlled with walking, public transport, and casual meals."

    per_traveler_day = budget / max(travelers, 1) / max(days, 1)
    if per_traveler_day < 45:
        return (
            "Keep this stop free or very low-cost, and pair it with packed snacks "
            "or casual takeaway."
        )
    if per_traveler_day < 90:
        return (
            "This fits a moderate budget by mixing free sights with one simple "
            "paid food or transport choice."
        )
    return (
        "Using a free or low-cost stop here leaves room for one stronger paid "
        "highlight later in the day."
    )


def _date_note(start_date: date | None, end_date: date | None) -> str:
    if start_date and end_date:
        return f" from {start_date.isoformat()} to {end_date.isoformat()}"
    return ""


def _profile_key_for_destination(destination: str) -> str | None:
    normalized = re.sub(r"[^a-z]", "", destination.lower())
    for alias, key in DESTINATION_ALIASES.items():
        if alias in normalized:
            return key
    return None


def _generic_destination_activities(destination: str) -> list[dict[str, object]]:
    return [
        {
            "title": f"{destination} free walking route and transit check",
            "description": (
                f"Start with a walkable historic or downtown route in {destination}, "
                "marking public transport stops, affordable food areas, and free sights."
            ),
            "tags": {"culture_history", "eco_tourism", "photography"},
            "budget": "Keep the first block free and use it to avoid unnecessary taxi costs.",
        },
        {
            "title": f"{destination} local market or casual food area",
            "description": (
                f"Choose a local market, bakery street, or casual dining district in "
                f"{destination} instead of a tourist-heavy restaurant."
            ),
            "tags": {"food_culinary", "local_life"},
            "budget": "Use casual food stops to protect the daily budget.",
        },
        {
            "title": f"{destination} park, waterfront, or viewpoint",
            "description": (
                f"Add a free outdoor stop in {destination}, such as a park, viewpoint, "
                "waterfront, or green walking path."
            ),
            "tags": {"nature_wildlife", "relaxation_wellness", "eco_tourism"},
            "budget": "Free or low-cost recovery time between paid activities.",
        },
    ]


def _rank_activities(
    activities: list[dict[str, object]],
    user_interests: list[str] | None,
) -> list[dict[str, object]]:
    interest_set = set(user_interests or [])
    if not interest_set:
        return activities

    return sorted(
        activities,
        key=lambda activity: len(interest_set & set(activity["tags"])),
        reverse=True,
    )


def _build_offline_itinerary(
    destination: str,
    days: int,
    start_date: date | None = None,
    end_date: date | None = None,
    travelers: int = 1,
    budget: int | None = None,
    user_interests: list[str] | None = None,
) -> ItineraryResponse:
    interests = [_format_interest_label(interest) for interest in user_interests or []]
    interest_note = (
        f" Tailored for interests in {', '.join(interests[:3])}."
        if interests
        else " Balanced for culture, food, nature, and relaxed exploration."
    )

    profile_key = _profile_key_for_destination(destination)
    activities = (
        DESTINATION_PROFILES[profile_key]
        if profile_key
        else _generic_destination_activities(destination)
    )
    ranked_activities = _rank_activities(activities, user_interests)
    spending_note = _fallback_spending_note(budget, max(travelers, 1), days)
    slots = ["09:00 - 11:30", "13:00 - 15:30", "17:30 - 20:00"]

    schedules: list[DailySchedule] = []
    for day_number in range(1, days + 1):
        day_activities = []
        for activity_number, time_slot in enumerate(slots):
            activity = ranked_activities[
                ((day_number - 1) * len(slots) + activity_number)
                % len(ranked_activities)
            ]
            day_activities.append(
                Activity(
                    title=str(activity["title"]),
                    description=(
                        f"{activity['description']} {activity['budget']} "
                        f"{spending_note}{interest_note}"
                    ),
                    time_slot=time_slot,
                )
            )

        schedules.append(DailySchedule(day_number=day_number, activities=day_activities))

    return ItineraryResponse(destination=destination, days=schedules)


async def generate_itinerary(
    destination: str,
    days: int,
    start_date: date | None = None,
    end_date: date | None = None,
    travelers: int = 1,
    budget: int | None = None,
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
        date_note=_date_note(start_date, end_date),
        travelers=max(travelers, 1),
        budget_note=_budget_note(budget, max(travelers, 1), days),
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
        if ENABLE_OFFLINE_ITINERARY_FALLBACK:
            return _build_offline_itinerary(
                destination=destination,
                days=days,
                start_date=start_date,
                end_date=end_date,
                travelers=travelers,
                budget=budget,
                user_interests=user_interests,
            )
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
