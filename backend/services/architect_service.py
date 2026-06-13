import json
import logging
import os
import re
from copy import deepcopy
from datetime import date, timedelta
from time import perf_counter

import httpx
from pydantic import ValidationError
from sqlalchemy.orm import Session

from models import AIGenerationStatus
from repositories.ai_generation_log_repository import ITINERARY_AGENT_NAME
from schemas.itinerary import (
    Activity,
    DailySchedule,
    ItineraryResponse,
    RegenerateActivityRequest,
)
from services.ai_generation_logger import record_ai_generation_log, response_time_ms

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_ITINERARY_MODEL = os.getenv(
    "OLLAMA_ITINERARY_MODEL",
    os.getenv("OLLAMA_FALLBACK_MODEL", "phi3"),
)
ENABLE_OFFLINE_ITINERARY_FALLBACK = (
    os.getenv("ENABLE_OFFLINE_ITINERARY_FALLBACK", "true").lower()
    not in {"0", "false", "no"}
)
TIME_SLOT_PATTERN = re.compile(r"^\d{2}:\d{2} - \d{2}:\d{2}$")
VARIED_TIME_SLOT_TEMPLATES = [
    ["09:00 - 11:30", "13:00 - 15:30", "17:30 - 20:00"],
    ["10:00 - 12:00", "14:00 - 16:00", "18:30 - 20:30"],
    ["08:30 - 10:30", "12:30 - 14:30", "16:30 - 18:30"],
]
logger = logging.getLogger(__name__)

ACTIVITY_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "time_slot": {"type": "string"},
        "estimated_cost_eur": {"type": "integer"},
    },
    "required": ["title", "description", "time_slot", "estimated_cost_eur"],
}

ITINERARY_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "destination": {"type": "string"},
        "currency": {"type": "string", "enum": ["EUR"]},
        "total_estimated_cost_eur": {"type": "integer"},
        "days": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "day_number": {"type": "integer"},
                    "activities": {
                        "type": "array",
                        "minItems": 3,
                        "maxItems": 3,
                        "items": ACTIVITY_JSON_SCHEMA,
                    },
                },
                "required": ["day_number", "activities"],
            },
        },
    },
    "required": ["destination", "currency", "total_estimated_cost_eur", "days"],
}

_LEGACY_SYSTEM_PROMPT = """You are an elite, highly structured travel architect.

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

_LEGACY_USER_PROMPT_TEMPLATE = (
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

_LEGACY_REGENERATE_ACTIVITY_SYSTEM_PROMPT = """You are an elite travel-planning editor.

TASK:
Replace exactly one activity inside an existing itinerary.

OUTPUT RULES - follow these without exception:
1. Output ONLY raw, valid JSON. Do not use markdown or explanatory text.
2. Return ONLY the replacement activity object, not the full itinerary.
3. Use EXACTLY this JSON structure:
{
  "title": "<short replacement activity title>",
  "description": "<specific, practical description>",
  "time_slot": "<same HH:MM - HH:MM value as the original activity>"
}
4. The replacement MUST keep the exact same time_slot as the original activity.
5. The replacement MUST fit the destination, day context, nearby activities, travel style, budget, and user preferences.
6. When the original activity implies a specific area, district, landmark cluster, or route, stay in that same area or clearly adjacent area.
7. The replacement MUST be meaningfully different from the original activity.
8. Do not duplicate any existing activity title from the itinerary.
9. Prefer real neighborhoods, landmarks, museums, parks, markets, routes, restaurants, transit choices, or local experiences.
10. Keep the description concise but actionable: include why it fits this slot and one practical detail.
11. Do not invent impossible transfers or locations far from the day context unless the constraints explicitly allow it."""

REGENERATE_ACTIVITY_USER_TEMPLATE = (
    "Destination: {destination}\n"
    "Replace activity index {activity_index} on day {day_number}.\n"
    "Original activity JSON:\n{old_activity_json}\n\n"
    "Current day plan JSON:\n{day_plan_json}\n\n"
    "Full itinerary activity titles to avoid:\n{existing_titles_json}\n\n"
    "Traveler preferences JSON:\n{preferences_json}\n\n"
    "Constraints JSON:\n{constraints_json}\n\n"
    "Return a single replacement activity. Keep time_slot exactly {time_slot_json}."
)

_COST_SYSTEM_PROMPT = """You are an elite, highly structured travel architect.

OUTPUT RULES - follow these without exception:
1. You must output ONLY raw, valid JSON. Do not use markdown formatting like ```json.
2. Do not include conversational greetings, explanations, or conclusions of any kind.
3. You must provide EXACTLY the following JSON structure and nothing else:
{
  "destination": "<city or region name>",
  "currency": "EUR",
  "total_estimated_cost_eur": <sum of all activity estimated_cost_eur values>,
  "days": [
    {
      "day_number": 1,
      "activities": [
        {
          "title": "<short activity title>",
          "description": "<one concise practical sentence>",
          "time_slot": "<HH:MM - HH:MM>",
          "estimated_cost_eur": <integer activity cost in euros>
        }
      ]
    }
  ]
}
4. The "days" array must contain exactly the requested number of days.
5. Every single day must contain exactly 3 activities, not fewer and not more.
6. Each activity must include title, description, time_slot, and estimated_cost_eur.
7. Use euros only. estimated_cost_eur and total_estimated_cost_eur must be integers, not strings.
8. total_estimated_cost_eur must equal the sum of all activity estimated_cost_eur values.
9. When an activity budget is provided, the sum of all activity costs must be less than or equal to that budget.
10. Within each day, the 3 time_slot values must be chronological and must never overlap."""

_COST_USER_PROMPT_TEMPLATE = (
    "Generate a concise {days}-day travel itinerary for {destination}{date_note}. "
    "Return exactly {days} day objects and exactly 3 activities for each day. "
    "Group size: {travelers} traveler(s). Activity budget: {budget_note}. "
    "{interests_note}"
    "Every activity must name a real local place, district, landmark, transit "
    "choice, or food option in the destination. Keep each description to one "
    "concise sentence with a practical budget-aware detail. Avoid generic phrases like "
    "'central area' or 'well-known museum'. "
    "The sum of all estimated_cost_eur values must be less than or equal to "
    "the activity budget when one is provided. Within each day, the 3 time slots "
    "must be chronological and non-overlapping. "
    "Remember: output only the raw JSON, no markdown, no extra text."
)

_COST_REGENERATE_ACTIVITY_SYSTEM_PROMPT = """You are an elite travel-planning editor.

TASK:
Replace exactly one activity inside an existing itinerary.

OUTPUT RULES - follow these without exception:
1. Output ONLY raw, valid JSON. Do not use markdown or explanatory text.
2. Return ONLY the replacement activity object, not the full itinerary.
3. Use EXACTLY this JSON structure:
{
  "title": "<short replacement activity title>",
  "description": "<specific, practical description>",
  "time_slot": "<same HH:MM - HH:MM value as the original activity>",
  "estimated_cost_eur": <integer activity cost in euros>
}
4. The replacement MUST keep the exact same time_slot as the original activity.
5. The replacement MUST fit the destination, day context, nearby activities, travel style, budget, and user preferences.
6. When the original activity implies a specific area, district, landmark cluster, or route, stay in that same area or clearly adjacent area.
7. The replacement MUST be meaningfully different from the original activity.
8. Do not duplicate any existing activity title from the itinerary.
9. Prefer real neighborhoods, landmarks, museums, parks, markets, routes, restaurants, transit choices, or local experiences.
10. Keep the description concise but actionable: include why it fits this slot and one practical detail.
11. Do not invent impossible transfers or locations far from the day context unless the constraints explicitly allow it.
12. Use euros only. estimated_cost_eur must be an integer, not a string."""

SYSTEM_PROMPT = _COST_SYSTEM_PROMPT
USER_PROMPT_TEMPLATE = _COST_USER_PROMPT_TEMPLATE
REGENERATE_ACTIVITY_SYSTEM_PROMPT = _COST_REGENERATE_ACTIVITY_SYSTEM_PROMPT

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
        previous_end: int | None = None
        for activity in day.activities:
            parsed_time_slot = _parse_time_slot(activity.time_slot)
            if parsed_time_slot is None:
                raise ValueError(
                    "Itinerary activity time_slot could not be normalized to "
                    f"HH:MM - HH:MM format, got {activity.time_slot!r}."
                )
            start_minutes, end_minutes = parsed_time_slot
            if previous_end is not None and start_minutes < previous_end:
                raise ValueError(
                    "Itinerary activity time_slots must be chronological and "
                    "non-overlapping."
                )
            previous_end = end_minutes


def _format_minutes(minutes: int) -> str:
    hours = minutes // 60
    remainder = minutes % 60
    return f"{hours:02d}:{remainder:02d}"


def _parse_time_slot(value: object) -> tuple[int, int] | None:
    if not isinstance(value, str) or not TIME_SLOT_PATTERN.fullmatch(value):
        return None

    start, end = value.split(" - ", 1)
    start_hour, start_minute = [int(part) for part in start.split(":", 1)]
    end_hour, end_minute = [int(part) for part in end.split(":", 1)]
    if (
        start_hour > 23
        or end_hour > 23
        or start_minute > 59
        or end_minute > 59
    ):
        return None

    start_minutes = start_hour * 60 + start_minute
    end_minutes = end_hour * 60 + end_minute
    if start_minutes >= end_minutes:
        return None
    return start_minutes, end_minutes


def _is_valid_time_slot(value: object) -> bool:
    return _parse_time_slot(value) is not None


def _varied_time_slot(day_index: int, activity_index: int) -> str:
    return _varied_time_slots_for_day(day_index, activity_index + 1)[activity_index]


def _varied_time_slots_for_day(day_index: int, activity_count: int) -> list[str]:
    day_template = VARIED_TIME_SLOT_TEMPLATES[day_index % len(VARIED_TIME_SLOT_TEMPLATES)]
    if activity_count <= len(day_template):
        return day_template[:activity_count]

    start_options = [9 * 60, 10 * 60, 8 * 60 + 30]
    current = start_options[day_index % len(start_options)]
    latest_end = 21 * 60
    gap = 30
    available = max(latest_end - current - gap * (activity_count - 1), 45 * activity_count)
    duration = max(45, (available // activity_count) // 15 * 15)

    slots = []
    for _ in range(activity_count):
        end = current + duration
        slots.append(f"{_format_minutes(current)} - {_format_minutes(end)}")
        current = end + gap
    return slots


def _day_time_slots_are_chronological(activities: list[dict]) -> bool:
    previous_end: int | None = None
    for activity in activities:
        parsed_time_slot = _parse_time_slot(activity.get("time_slot"))
        if parsed_time_slot is None:
            return False

        start_minutes, end_minutes = parsed_time_slot
        if previous_end is not None and start_minutes < previous_end:
            return False
        previous_end = end_minutes
    return True


def _normalize_day_time_slots_if_needed(activities: list[dict], day_index: int) -> None:
    if _day_time_slots_are_chronological(activities):
        return

    for activity, time_slot in zip(
        activities,
        _varied_time_slots_for_day(day_index, len(activities)),
    ):
        activity["time_slot"] = time_slot


def _iter_activities(itinerary: ItineraryResponse) -> list[Activity]:
    return [
        activity
        for day in itinerary.days
        for activity in day.activities
    ]


def _require_activity_costs(itinerary: ItineraryResponse) -> None:
    for day in itinerary.days:
        for activity in day.activities:
            if activity.estimated_cost_eur is None:
                raise ValueError(
                    "Ollama response activity estimated_cost_eur must be an integer."
                )


def _int_cost_or_none(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, float) and value.is_integer() and value >= 0:
        return int(value)
    return None


def _normalize_activity_payload_fields(
    activity: dict,
    *,
    day_index: int,
    activity_index: int,
    budget: int | None,
    requested_days: int,
) -> None:
    if not _is_valid_time_slot(activity.get("time_slot")):
        activity["time_slot"] = _varied_time_slot(day_index, activity_index)

    cost = _int_cost_or_none(activity.get("estimated_cost_eur"))
    if cost is None:
        activity["estimated_cost_eur"] = _fallback_activity_cost_eur(
            budget,
            requested_days,
            activity_index % 3,
        )
    else:
        activity["estimated_cost_eur"] = cost


def _normalize_itinerary_payload_fields(
    parsed: object,
    *,
    requested_days: int,
    budget: int | None,
) -> object:
    if not isinstance(parsed, dict):
        return parsed

    payload = deepcopy(parsed)
    if payload.get("currency") != "EUR":
        payload["currency"] = "EUR"

    days = payload.get("days")
    if not isinstance(days, list):
        return payload

    total = 0
    for day_index, day in enumerate(days):
        if not isinstance(day, dict):
            continue

        if day.get("day_number") != day_index + 1:
            day["day_number"] = day_index + 1

        activities = day.get("activities")
        if not isinstance(activities, list):
            continue

        usable_activities = [
            activity
            for activity in activities
            if isinstance(activity, dict)
        ]
        for activity_index, activity in enumerate(activities):
            if not isinstance(activity, dict):
                continue
            _normalize_activity_payload_fields(
                activity,
                day_index=day_index,
                activity_index=activity_index,
                budget=budget,
                requested_days=requested_days,
            )
            total += int(activity.get("estimated_cost_eur") or 0)

        _normalize_day_time_slots_if_needed(usable_activities, day_index)

    if _int_cost_or_none(payload.get("total_estimated_cost_eur")) != total:
        payload["total_estimated_cost_eur"] = total

    return payload


def _fill_missing_activity_costs(
    itinerary: ItineraryResponse,
    budget: int | None,
) -> None:
    requested_days = max(len(itinerary.days), 1)
    for day in itinerary.days:
        for activity_index, activity in enumerate(day.activities):
            if activity.estimated_cost_eur is None:
                activity.estimated_cost_eur = _fallback_activity_cost_eur(
                    budget,
                    requested_days,
                    activity_index % 3,
                )


def _normalize_activity_costs_to_budget(
    itinerary: ItineraryResponse,
    budget: int | None,
) -> None:
    activities = _iter_activities(itinerary)
    total = sum(activity.estimated_cost_eur or 0 for activity in activities)

    if budget is None or total <= budget:
        itinerary.total_estimated_cost_eur = total
        itinerary.currency = "EUR"
        return

    if budget < 0:
        raise ValueError("Budget must be greater than or equal to zero.")

    if total <= 0:
        itinerary.total_estimated_cost_eur = 0
        itinerary.currency = "EUR"
        return

    scaled_costs: list[int] = []
    remainders: list[tuple[float, int]] = []
    for index, activity in enumerate(activities):
        raw_cost = activity.estimated_cost_eur or 0
        scaled = raw_cost * budget / total
        scaled_floor = int(scaled)
        scaled_costs.append(scaled_floor)
        remainders.append((scaled - scaled_floor, index))

    remaining = budget - sum(scaled_costs)
    for _, index in sorted(remainders, key=lambda item: (-item[0], item[1]))[:remaining]:
        scaled_costs[index] += 1

    for activity, cost in zip(activities, scaled_costs):
        activity.estimated_cost_eur = cost

    itinerary.total_estimated_cost_eur = sum(scaled_costs)
    itinerary.currency = "EUR"


def _finalize_itinerary_costs(
    itinerary: ItineraryResponse,
    budget: int | None,
    *,
    require_costs: bool,
) -> None:
    if budget is not None and budget < 0:
        raise ValueError("Budget must be greater than or equal to zero.")
    if require_costs:
        _require_activity_costs(itinerary)
    _fill_missing_activity_costs(itinerary, budget)
    _normalize_activity_costs_to_budget(itinerary, budget)


def _apply_trip_metadata(
    itinerary: ItineraryResponse,
    start_date: date | None,
    end_date: date | None,
    budget: int | None,
) -> None:
    itinerary.start_date = start_date
    itinerary.end_date = (
        end_date
        if end_date is not None
        else start_date + timedelta(days=len(itinerary.days) - 1)
        if start_date is not None and itinerary.days
        else None
    )
    itinerary.budget_eur = budget

    if start_date is None:
        return

    for day in itinerary.days:
        day.date = start_date + timedelta(days=max(day.day_number - 1, 0))


def _constraint_int(constraints: dict[str, object], key: str) -> int | None:
    value = constraints.get(key)
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def _ollama_options(days: int | None = None) -> dict[str, float | int]:
    num_predict = 512 if days is None else min(1400, max(700, days * 300))
    return {
        "temperature": 0.2,
        "num_predict": num_predict,
    }


def _log_ollama_stats(raw_body: dict, operation: str) -> None:
    eval_count = raw_body.get("eval_count")
    eval_duration = raw_body.get("eval_duration")
    tokens_per_second = None
    if isinstance(eval_count, int) and isinstance(eval_duration, int) and eval_duration > 0:
        tokens_per_second = round(eval_count / (eval_duration / 1_000_000_000), 2)

    logger.info(
        "ollama_%s_stats model=%s total_duration_ns=%s load_duration_ns=%s "
        "prompt_eval_count=%s eval_count=%s eval_duration_ns=%s tokens_per_second=%s",
        operation,
        raw_body.get("model"),
        raw_body.get("total_duration"),
        raw_body.get("load_duration"),
        raw_body.get("prompt_eval_count"),
        eval_count,
        eval_duration,
        tokens_per_second,
    )


def _extract_first_json_object(raw_text: str) -> str | None:
    start = raw_text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False

    for index in range(start, len(raw_text)):
        char = raw_text[index]

        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw_text[start:index + 1]

    return None


def _load_json_from_model_text(raw_text: str):
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, str):
            return json.loads(parsed)
        return parsed
    except json.JSONDecodeError as first_exc:
        extracted = _extract_first_json_object(raw_text)
        if extracted and extracted != raw_text:
            try:
                return json.loads(extracted)
            except json.JSONDecodeError:
                pass
        raise ValueError(
            f"Ollama returned non-JSON content: {raw_text[:300]}"
        ) from first_exc


def _parse_json_model(raw_text: str, model_type):
    try:
        parsed = _load_json_from_model_text(raw_text)
    except ValueError:
        raise

    try:
        return model_type.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(
            f"Ollama response did not match the expected schema: {exc}"
        ) from exc


async def _post_ollama_json(
    prompt: str,
    *,
    operation: str = "regenerate_activity",
    days: int | None = None,
    response_format: dict | str = "json",
) -> str:
    raw_body = await _post_ollama_json_body(
        prompt,
        operation=operation,
        days=days,
        response_format=response_format,
    )
    return raw_body.get("response", "")


async def _post_ollama_json_body(
    prompt: str,
    *,
    operation: str = "regenerate_activity",
    days: int | None = None,
    response_format: dict | str = "json",
) -> dict:
    payload = {
        "model": OLLAMA_ITINERARY_MODEL,
        "prompt": prompt,
        "format": response_format,
        "stream": False,
        "keep_alive": "10m",
        "options": _ollama_options(days),
    }

    timeout = httpx.Timeout(connect=10.0, read=600.0, write=30.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        response.raise_for_status()

    raw_body = response.json()
    _log_ollama_stats(raw_body, operation)
    return raw_body


async def _repair_ollama_json(
    raw_text: str,
    *,
    target: str,
    operation: str,
    response_format: dict,
) -> str:
    repair_prompt = (
        "Convert the following model output into ONLY valid raw JSON. "
        f"The JSON must match this target: {target}. "
        "Do not add markdown, comments, greetings, or explanations. "
        "Preserve the same travel content where possible.\n\n"
        f"Model output:\n{raw_text[:6000]}"
    )
    return await _post_ollama_json(
        repair_prompt,
        operation=f"{operation}_repair",
        response_format=response_format,
    )


async def _parse_json_model_with_repair(
    raw_text: str,
    model_type,
    *,
    target: str,
    operation: str,
    response_format: dict,
):
    try:
        return _parse_json_model(raw_text, model_type)
    except ValueError as exc:
        if "non-JSON content" not in str(exc):
            raise

    repaired_text = await _repair_ollama_json(
        raw_text,
        target=target,
        operation=operation,
        response_format=response_format,
    )
    return _parse_json_model(repaired_text, model_type)


async def _load_json_with_repair(
    raw_text: str,
    *,
    target: str,
    operation: str,
    response_format: dict,
):
    try:
        return _load_json_from_model_text(raw_text)
    except ValueError as exc:
        if "non-JSON content" not in str(exc):
            raise

    repaired_text = await _repair_ollama_json(
        raw_text,
        target=target,
        operation=operation,
        response_format=response_format,
    )
    return _load_json_from_model_text(repaired_text)


async def _parse_itinerary_with_repair(
    raw_text: str,
    *,
    requested_days: int,
    budget: int | None,
) -> ItineraryResponse:
    parsed = await _load_json_with_repair(
        raw_text,
        target="a complete itinerary object",
        operation="generate_itinerary",
        response_format=ITINERARY_JSON_SCHEMA,
    )
    normalized = _normalize_itinerary_payload_fields(
        parsed,
        requested_days=requested_days,
        budget=budget,
    )

    try:
        return ItineraryResponse.model_validate(normalized)
    except ValidationError as exc:
        raise ValueError(
            f"Ollama response did not provide a usable itinerary structure: {exc}"
        ) from exc


def _normalize_replacement_payload_fields(
    parsed: object,
    old_activity: Activity,
) -> object:
    if not isinstance(parsed, dict):
        return parsed

    replacement = deepcopy(parsed)
    replacement["time_slot"] = old_activity.time_slot

    cost = _int_cost_or_none(replacement.get("estimated_cost_eur"))
    replacement["estimated_cost_eur"] = (
        cost
        if cost is not None
        else old_activity.estimated_cost_eur or 0
    )
    return replacement


async def _parse_replacement_activity_with_repair(
    raw_text: str,
    old_activity: Activity,
) -> Activity:
    parsed = await _load_json_with_repair(
        raw_text,
        target="a single replacement activity object",
        operation="regenerate_activity",
        response_format=ACTIVITY_JSON_SCHEMA,
    )
    normalized = _normalize_replacement_payload_fields(parsed, old_activity)

    try:
        return Activity.model_validate(normalized)
    except ValidationError as exc:
        raise ValueError(
            f"Ollama response did not provide a usable replacement activity: {exc}"
        ) from exc


def _activity_title_key(activity: Activity) -> str:
    return re.sub(r"\s+", " ", activity.title.strip().lower())


def _get_day_plan(payload: RegenerateActivityRequest) -> DailySchedule:
    if payload.day_plan is not None:
        if payload.day_plan.day_number != payload.day_index + 1:
            raise ValueError("Day plan does not match the requested day index.")
        return payload.day_plan

    if payload.itinerary is None:
        raise ValueError("Either itinerary or dayPlan must be provided.")
    if payload.day_index >= len(payload.itinerary.days):
        raise ValueError("Invalid day index.")

    return payload.itinerary.days[payload.day_index]


def _itinerary_titles(payload: RegenerateActivityRequest, day_plan: DailySchedule) -> list[str]:
    days = payload.itinerary.days if payload.itinerary else [day_plan]
    titles: list[str] = []
    for day in days:
        for activity in day.activities:
            title = activity.title.strip()
            if title:
                titles.append(title)
    return titles


def _build_regenerate_activity_prompt(
    payload: RegenerateActivityRequest,
    day_plan: DailySchedule,
) -> str:
    existing_titles = _itinerary_titles(payload, day_plan)
    preferences = payload.user_preferences or {}
    constraints = {
        "preserveExactTimeSlot": payload.old_activity.time_slot,
        "preserveSameAreaWhenInferable": True,
        "avoidDuplicateTitles": True,
        "keepDayFlowCoherent": True,
        **(payload.constraints or {}),
    }

    return (
        f"{REGENERATE_ACTIVITY_SYSTEM_PROMPT}\n\n"
        "Replacement request:\n"
        + REGENERATE_ACTIVITY_USER_TEMPLATE.format(
            destination=payload.destination,
            activity_index=payload.activity_index,
            day_number=day_plan.day_number,
            old_activity_json=payload.old_activity.model_dump_json(),
            day_plan_json=day_plan.model_dump_json(),
            existing_titles_json=json.dumps(existing_titles, ensure_ascii=False),
            preferences_json=json.dumps(preferences, ensure_ascii=False),
            constraints_json=json.dumps(constraints, ensure_ascii=False),
            time_slot_json=json.dumps(payload.old_activity.time_slot),
        )
    )


def _validate_replacement_activity(
    payload: RegenerateActivityRequest,
    day_plan: DailySchedule,
    replacement: Activity,
) -> None:
    if payload.activity_index >= len(day_plan.activities):
        raise ValueError("Invalid activity index.")

    selected_activity = day_plan.activities[payload.activity_index]
    if _activity_title_key(selected_activity) != _activity_title_key(payload.old_activity):
        raise ValueError("Old activity does not match the selected itinerary activity.")

    if replacement.time_slot != payload.old_activity.time_slot:
        raise ValueError("Replacement activity must keep the original time_slot.")

    replacement_key = _activity_title_key(replacement)
    old_key = _activity_title_key(payload.old_activity)
    if replacement_key == old_key:
        raise ValueError("Replacement activity must be different from the original.")

    duplicate_titles = {
        _activity_title_key(activity)
        for index, activity in enumerate(day_plan.activities)
        if index != payload.activity_index
    }
    if replacement_key in duplicate_titles:
        raise ValueError("Replacement activity duplicates an existing activity.")


def _fallback_replacement_activity(payload: RegenerateActivityRequest) -> Activity:
    time_slot = payload.old_activity.time_slot
    destination = payload.destination.strip() or "the destination"
    old_title = payload.old_activity.title.lower()

    if any(word in old_title for word in ["museum", "gallery", "historic", "castle"]):
        title = f"{destination} neighborhood heritage walk"
        detail = "Swap the indoor stop for a nearby heritage route with visible landmarks and flexible pacing."
    elif any(word in old_title for word in ["dinner", "lunch", "food", "restaurant", "market"]):
        title = f"{destination} local market tasting route"
        detail = "Use a casual market or food street to keep the same meal window without committing to one restaurant."
    elif any(word in old_title for word in ["park", "hike", "garden", "beach", "nature"]):
        title = f"{destination} scenic viewpoint and easy walk"
        detail = "Choose a viewpoint or short walking loop that preserves outdoor time and avoids a long transfer."
    else:
        title = f"{destination} local discovery walk"
        detail = "Pick a nearby district, landmark cluster, or waterfront route that fits between the surrounding activities."

    return Activity(
        title=title,
        description=f"{detail} Keep it in the {time_slot} slot and avoid repeating the original activity.",
        time_slot=time_slot,
        estimated_cost_eur=payload.old_activity.estimated_cost_eur or 0,
    )


async def regenerate_single_activity(payload: RegenerateActivityRequest) -> Activity:
    day_plan = _get_day_plan(payload)
    if payload.activity_index >= len(day_plan.activities):
        raise ValueError("Invalid activity index.")

    prompt = _build_regenerate_activity_prompt(payload, day_plan)

    try:
        raw_text = await _post_ollama_json(
            prompt,
            operation="regenerate_activity",
            response_format=ACTIVITY_JSON_SCHEMA,
        )
        replacement = await _parse_replacement_activity_with_repair(
            raw_text,
            payload.old_activity,
        )
    except httpx.ReadTimeout as exc:
        raise ValueError(
            "Ollama did not respond in time while regenerating this activity."
        ) from exc
    except httpx.ConnectError as exc:
        if ENABLE_OFFLINE_ITINERARY_FALLBACK:
            replacement = _fallback_replacement_activity(payload)
        else:
            raise ValueError(
                f"Could not connect to Ollama at {OLLAMA_BASE_URL}. "
                "Make sure the ollama service is running."
            ) from exc
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Ollama returned an error: {exc.response.status_code} {exc.response.text[:200]}"
        ) from exc

    max_replacement_cost = _constraint_int(payload.constraints or {}, "maxReplacementCostEur")
    if (
        max_replacement_cost is not None
        and max_replacement_cost >= 0
        and replacement.estimated_cost_eur is not None
        and replacement.estimated_cost_eur > max_replacement_cost
    ):
        replacement.estimated_cost_eur = max_replacement_cost

    _validate_replacement_activity(payload, day_plan, replacement)
    return replacement


def _format_interest_label(value: str) -> str:
    return value.replace("_", " ").strip()


def _budget_note(budget: int | None, travelers: int, days: int) -> str:
    if not budget:
        return "no fixed activity budget, but keep activity costs in euros and cost-aware"

    per_day = budget / max(days, 1)
    if per_day < 45:
        tier = "very lean"
    elif per_day < 90:
        tier = "moderate"
    else:
        tier = "flexible"

    return (
        f"total activity budget EUR {budget} for the whole trip, about "
        f"EUR {per_day:.0f} per day, {tier} style"
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


def _fallback_activity_cost_eur(
    budget: int | None,
    days: int,
    activity_number: int,
) -> int:
    if budget is None:
        return [0, 15, 20][activity_number]

    per_activity = budget // max(days * 3, 1)
    if activity_number == 0:
        return min(per_activity, 8)
    if activity_number == 1:
        return min(max(per_activity, 5), 18)
    return min(max(per_activity, 8), 25)


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

    schedules: list[DailySchedule] = []
    for day_number in range(1, days + 1):
        day_activities = []
        slots = _varied_time_slots_for_day(day_number - 1, 3)
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
                    estimated_cost_eur=_fallback_activity_cost_eur(
                        budget,
                        days,
                        activity_number,
                    ),
                )
            )

        schedules.append(DailySchedule(day_number=day_number, activities=day_activities))

    itinerary = ItineraryResponse(destination=destination, days=schedules)
    _finalize_itinerary_costs(itinerary, budget, require_costs=False)
    _apply_trip_metadata(itinerary, start_date, end_date, budget)
    return itinerary


async def generate_itinerary(
    destination: str,
    days: int,
    start_date: date | None = None,
    end_date: date | None = None,
    travelers: int = 1,
    budget: int | None = None,
    user_interests: list[str] | None = None,
    db: Session | None = None,
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

    started_at = perf_counter()
    raw_body: dict | None = None

    try:
        raw_body = await _post_ollama_json_body(
            f"{SYSTEM_PROMPT}\n\nUser request: {user_message}",
            operation="generate_itinerary",
            days=days,
            response_format=ITINERARY_JSON_SCHEMA,
        )
        raw_text = raw_body.get("response", "")
    except httpx.ReadTimeout as exc:
        message = (
            "Ollama did not respond in time. The model may still be loading or "
            "the prompt is too large. Try again in a moment."
        )
        record_ai_generation_log(
            db,
            agent_name=ITINERARY_AGENT_NAME,
            operation="generate_itinerary",
            status=AIGenerationStatus.FAILED,
            model=OLLAMA_ITINERARY_MODEL,
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
        if ENABLE_OFFLINE_ITINERARY_FALLBACK:
            record_ai_generation_log(
                db,
                agent_name=ITINERARY_AGENT_NAME,
                operation="generate_itinerary",
                status=AIGenerationStatus.FAILED,
                model=OLLAMA_ITINERARY_MODEL,
                destination=destination,
                response_time_ms=response_time_ms(raw_body, started_at),
                error_message=message,
                fallback_used=True,
            )
            return _build_offline_itinerary(
                destination=destination,
                days=days,
                start_date=start_date,
                end_date=end_date,
                travelers=travelers,
                budget=budget,
                user_interests=user_interests,
            )
        record_ai_generation_log(
            db,
            agent_name=ITINERARY_AGENT_NAME,
            operation="generate_itinerary",
            status=AIGenerationStatus.FAILED,
            model=OLLAMA_ITINERARY_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc
    except httpx.HTTPStatusError as exc:
        message = f"Ollama returned an error: {exc.response.status_code} {exc.response.text[:200]}"
        record_ai_generation_log(
            db,
            agent_name=ITINERARY_AGENT_NAME,
            operation="generate_itinerary",
            status=AIGenerationStatus.FAILED,
            model=OLLAMA_ITINERARY_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=message,
        )
        raise ValueError(message) from exc

    try:
        itinerary = await _parse_itinerary_with_repair(
            raw_text,
            requested_days=days,
            budget=budget,
        )

        _validate_daily_schedule(itinerary, requested_days=days)
        _finalize_itinerary_costs(itinerary, budget, require_costs=False)
        _apply_trip_metadata(itinerary, start_date, end_date, budget)
    except ValueError as exc:
        record_ai_generation_log(
            db,
            agent_name=ITINERARY_AGENT_NAME,
            operation="generate_itinerary",
            status=AIGenerationStatus.FAILED,
            model=raw_body.get("model") or OLLAMA_ITINERARY_MODEL,
            destination=destination,
            response_time_ms=response_time_ms(raw_body, started_at),
            error_message=str(exc),
        )
        raise

    record_ai_generation_log(
        db,
        agent_name=ITINERARY_AGENT_NAME,
        operation="generate_itinerary",
        status=AIGenerationStatus.SUCCESS,
        model=raw_body.get("model") or OLLAMA_ITINERARY_MODEL,
        destination=destination,
        response_time_ms=response_time_ms(raw_body, started_at),
    )
    return itinerary
