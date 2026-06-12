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
        },
        "itinerary": {
            "destination": "Paris",
            "days": [
                {
                    "day_number": 1,
                    "activities": [
                        {
                            "title": "Eiffel Tower Walk",
                            "description": "Walk around the tower and Champ de Mars.",
                            "time_slot": "09:00 - 11:00",
                        },
                        {
                            "title": "Louvre Museum Visit",
                            "description": "Explore the Louvre galleries.",
                            "time_slot": "13:00 - 15:00",
                        },
                        {
                            "title": "Seine Evening Cruise",
                            "description": "Take a sunset river cruise.",
                            "time_slot": "18:00 - 20:00",
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

    async def fake_post_ollama_json(prompt: str) -> str:
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
    assert "Return ONLY the replacement activity object" in captured_prompt
    assert "Keep time_slot exactly" in captured_prompt
    assert "Louvre Museum Visit" in captured_prompt
    assert "Seine Evening Cruise" in captured_prompt
    assert "food_culinary" in captured_prompt


def test_regenerate_activity_rejects_replacement_with_changed_time_slot(
    client: TestClient,
    monkeypatch,
):
    headers = _auth_headers(client)

    async def fake_post_ollama_json(_: str) -> str:
        return json.dumps(
            {
                "title": "Latin Quarter Bookshop Walk",
                "description": "A nearby alternative walk around bookshops and cafes.",
                "time_slot": "15:00 - 17:00",
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

    assert response.status_code == 422
    assert "time_slot" in response.json()["detail"]
