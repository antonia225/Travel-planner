import json

from fastapi.testclient import TestClient


_USER_PAYLOAD = {
    "name": "Jane Traveler",
    "email": "jane.regenerate@example.com",
    "password": "Secure1Password",
}


def _auth_headers(client: TestClient) -> dict[str, str]:
    client.post("/register", json=_USER_PAYLOAD)
    login_response = client.post(
        "/login",
        json={
            "email": _USER_PAYLOAD["email"],
            "password": _USER_PAYLOAD["password"],
        },
    )
    return {"Authorization": f"Bearer {login_response.json()['access_token']}"}


def _regenerate_payload() -> dict:
    return {
        "destination": "Paris",
        "dayIndex": 0,
        "activityIndex": 1,
        "oldActivity": {
            "title": "Louvre Museum Visit",
            "description": "Explore the Louvre galleries.",
            "time_slot": "13:00 - 15:00",
            "estimated_cost_eur": 22,
        },
        "itinerary": {
            "destination": "Paris",
            "currency": "EUR",
            "total_estimated_cost_eur": 57,
            "days": [
                {
                    "day_number": 1,
                    "activities": [
                        {
                            "title": "Eiffel Tower Walk",
                            "description": "Walk around the tower and Champ de Mars.",
                            "time_slot": "09:00 - 11:00",
                            "estimated_cost_eur": 10,
                        },
                        {
                            "title": "Louvre Museum Visit",
                            "description": "Explore the Louvre galleries.",
                            "time_slot": "13:00 - 15:00",
                            "estimated_cost_eur": 22,
                        },
                        {
                            "title": "Seine Evening Cruise",
                            "description": "Take a sunset river cruise.",
                            "time_slot": "18:00 - 20:00",
                            "estimated_cost_eur": 25,
                        },
                    ],
                }
            ],
        },
        "userPreferences": {"interests": ["food_culinary", "culture_history"]},
        "constraints": {"budget": "moderate", "pace": "relaxed"},
    }


def test_regenerate_activity_requires_authentication(client: TestClient):
    response = client.post("/itinerary/regenerate-activity", json=_regenerate_payload())

    assert response.status_code == 401


def test_regenerate_activity_returns_single_replacement_and_optimized_prompt(
    client: TestClient,
    monkeypatch,
):
    headers = _auth_headers(client)
    captured_prompt = ""

    async def fake_post_ollama_json(prompt: str, **_kwargs) -> str:
        nonlocal captured_prompt
        captured_prompt = prompt
        return json.dumps(
            {
                "title": "Musee d'Orsay Impressionist Stop",
                "description": (
                    "Use the same afternoon window for Musee d'Orsay, which stays "
                    "close to the Seine and keeps the day focused on art without "
                    "repeating the Louvre."
                ),
                "time_slot": "13:00 - 15:00",
            }
        )

    monkeypatch.setattr(
        "services.architect_service._post_ollama_json",
        fake_post_ollama_json,
    )

    response = client.post(
        "/itinerary/regenerate-activity",
        json=_regenerate_payload(),
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"activity"}
    assert body["activity"]["title"] == "Musee d'Orsay Impressionist Stop"
    assert body["activity"]["time_slot"] == "13:00 - 15:00"
    assert body["activity"]["estimated_cost_eur"] == 22
    assert "Return ONLY the replacement activity object" in captured_prompt
    assert "Keep time_slot exactly" in captured_prompt
    assert "estimated_cost_eur" in captured_prompt
    assert "Louvre Museum Visit" in captured_prompt
    assert "Seine Evening Cruise" in captured_prompt
    assert "food_culinary" in captured_prompt


def test_regenerate_activity_preserves_old_slot_when_replacement_time_is_invalid(
    client: TestClient,
    monkeypatch,
):
    headers = _auth_headers(client)

    async def fake_post_ollama_json(_: str, **_kwargs) -> str:
        return json.dumps(
            {
                "title": "Latin Quarter Bookshop Walk",
                "description": "A nearby alternative walk around bookshops and cafes.",
                "time_slot": "afternoon",
            }
        )

    monkeypatch.setattr(
        "services.architect_service._post_ollama_json",
        fake_post_ollama_json,
    )

    response = client.post(
        "/itinerary/regenerate-activity",
        json=_regenerate_payload(),
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["activity"]["title"] == "Latin Quarter Bookshop Walk"
    assert body["activity"]["time_slot"] == "13:00 - 15:00"
    assert body["activity"]["estimated_cost_eur"] == 22


def test_regenerate_activity_caps_replacement_cost_to_budget_constraint(
    client: TestClient,
    monkeypatch,
):
    headers = _auth_headers(client)
    payload = _regenerate_payload()
    payload["constraints"]["maxReplacementCostEur"] = 12

    async def fake_post_ollama_json(_: str, **_kwargs) -> str:
        return json.dumps(
            {
                "title": "Musee d'Orsay Impressionist Stop",
                "description": "Use the same afternoon window for a nearby art stop.",
                "time_slot": "13:00 - 15:00",
                "estimated_cost_eur": 40,
            }
        )

    monkeypatch.setattr(
        "services.architect_service._post_ollama_json",
        fake_post_ollama_json,
    )

    response = client.post(
        "/itinerary/regenerate-activity",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["activity"]["estimated_cost_eur"] == 12
