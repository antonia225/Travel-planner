"""
Unit tests for POST /register.

The TestClient and isolated in-memory database are provided by conftest.py.
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from schemas.itinerary import ItineraryResponse

# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

_VALID_PAYLOAD = {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Secure1Password",
}


def _auth_headers(client: TestClient, payload: dict[str, str] | None = None) -> dict[str, str]:
    user_payload = payload or _VALID_PAYLOAD
    client.post("/register", json=user_payload)
    login_response = client.post(
        "/login",
        json={"email": user_payload["email"], "password": user_payload["password"]},
    )
    return {"Authorization": f"Bearer {login_response.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestRegister:
    def test_success_returns_201(self, client: TestClient):
        """A valid name + email + strong password creates the user and returns 201."""
        response = client.post("/register", json=_VALID_PAYLOAD)

        assert response.status_code == 201
        body = response.json()
        assert body["email"] == _VALID_PAYLOAD["email"]
        assert body["name"] == _VALID_PAYLOAD["name"]
        assert isinstance(body["id"], int)

    def test_duplicate_email_returns_409(self, client: TestClient):
        """Registering the same e-mail address twice returns 409 Conflict."""
        client.post("/register", json=_VALID_PAYLOAD)
        response = client.post("/register", json=_VALID_PAYLOAD)

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

    def test_missing_name_returns_422(self, client: TestClient):
        """A payload without the required 'name' field returns 422 Unprocessable Entity."""
        payload = {k: v for k, v in _VALID_PAYLOAD.items() if k != "name"}
        response = client.post("/register", json=payload)

        assert response.status_code == 422

    def test_weak_password_returns_422(self, client: TestClient):
        """
        A password that violates the strength rules (too short, no uppercase,
        no lowercase, or no digit) must be rejected with 422.
        """
        weak_cases = [
            "short1A",       # under 8 characters
            "alllowercase1", # no uppercase letter
            "ALLUPPERCASE1", # no lowercase letter
            "NoDigitsHere",  # no number
        ]
        for weak_pw in weak_cases:
            payload = {**_VALID_PAYLOAD, "password": weak_pw}
            response = client.post("/register", json=payload)
            assert response.status_code == 422, (
                f"Expected 422 for password {weak_pw!r}, got {response.status_code}"
            )


class TestLogin:
    def test_success_returns_access_token(self, client: TestClient):
        client.post("/register", json=_VALID_PAYLOAD)

        response = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": _VALID_PAYLOAD["password"]},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["token_type"] == "bearer"
        assert isinstance(body["access_token"], str)
        assert len(body["access_token"]) > 0

    def test_invalid_credentials_return_401(self, client: TestClient):
        client.post("/register", json=_VALID_PAYLOAD)

        response = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": "WrongPassword1"},
        )

        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()


class TestAuthGuard:
    def test_me_requires_authentication(self, client: TestClient):
        response = client.get("/me")

        assert response.status_code == 401

    def test_me_returns_profile_when_authorized(self, client: TestClient):
        client.post("/register", json=_VALID_PAYLOAD)
        login_response = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": _VALID_PAYLOAD["password"]},
        )

        token = login_response.json()["access_token"]
        response = client.get(
            "/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["email"] == _VALID_PAYLOAD["email"]
        assert body["name"] == _VALID_PAYLOAD["name"]
        assert body["interests"] == []  # Default empty interests


class TestInterests:
    def test_update_interests_succeeds(self, client: TestClient):
        """User can update their travel interests."""
        client.post("/register", json=_VALID_PAYLOAD)
        login_response = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": _VALID_PAYLOAD["password"]},
        )

        token = login_response.json()["access_token"]

        # Update interests
        interests_payload = {
            "interests": ["adventure", "food_culinary", "culture_history"]
        }
        response = client.put(
            "/me/interests",
            json=interests_payload,
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert set(body["interests"]) == set(interests_payload["interests"])

    def test_update_interests_requires_auth(self, client: TestClient):
        """Update interests endpoint requires authentication."""
        payload = {"interests": ["adventure"]}
        response = client.put("/me/interests", json=payload)

        assert response.status_code == 401

    def test_list_interest_categories(self, client: TestClient):
        """List all available interest categories."""
        response = client.get("/interests/categories")

        assert response.status_code == 200
        body = response.json()
        assert "categories" in body
        assert "descriptions" in body
        assert "adventure" in body["categories"]
        assert len(body["categories"]) > 0


class TestProfileUpdate:
    def test_update_profile_name_and_email_succeeds(self, client: TestClient):
        headers = _auth_headers(client)

        response = client.patch(
            "/me",
            json={"name": "Jane Traveler", "email": "jane.traveler@example.com"},
            headers=headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Jane Traveler"
        assert body["email"] == "jane.traveler@example.com"
        assert body["interests"] == []

    def test_update_profile_duplicate_email_returns_409(self, client: TestClient):
        headers = _auth_headers(client)
        client.post(
            "/register",
            json={
                "name": "Alex Doe",
                "email": "alex@example.com",
                "password": "Secure1Password",
            },
        )

        response = client.patch(
            "/me",
            json={"name": "Jane Doe", "email": "alex@example.com"},
            headers=headers,
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

    def test_change_password_requires_current_password(self, client: TestClient):
        headers = _auth_headers(client)

        response = client.put(
            "/me/password",
            json={
                "current_password": "WrongPassword1",
                "new_password": "NewSecure1Password",
            },
            headers=headers,
        )

        assert response.status_code == 401
        assert "current password" in response.json()["detail"].lower()

    def test_change_password_succeeds_and_new_password_can_login(self, client: TestClient):
        headers = _auth_headers(client)

        response = client.put(
            "/me/password",
            json={
                "current_password": _VALID_PAYLOAD["password"],
                "new_password": "NewSecure1Password",
            },
            headers=headers,
        )

        assert response.status_code == 204

        old_login = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": _VALID_PAYLOAD["password"]},
        )
        new_login = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": "NewSecure1Password"},
        )

        assert old_login.status_code == 401
        assert new_login.status_code == 200


_ITINERARY_PAYLOAD = {
    "destination": "Paris",
    "num_days": 2,
    "start_date": "2026-09-17",
    "end_date": "2026-09-19",
    "travelers": 2,
    "budget": 500,
}

_MOCK_ITINERARY = ItineraryResponse(
    destination="Paris",
    days=[
        {
            "day_number": 1,
            "activities": [
                {"title": "Eiffel Tower", "description": "Visit the tower", "time_slot": "09:00"},
                {"title": "Louvre", "description": "Explore the museum", "time_slot": "13:00"},
                {"title": "Seine cruise", "description": "Evening cruise", "time_slot": "19:00"},
            ],
        },
        {
            "day_number": 2,
            "activities": [
                {"title": "Montmartre", "description": "Explore the district", "time_slot": "10:00"},
                {"title": "Sacré-Cœur", "description": "Visit the basilica", "time_slot": "11:30"},
                {"title": "Local bistro", "description": "French dinner", "time_slot": "19:00"},
            ],
        },
    ],
)


class TestGenerateItinerary:
    def test_unauthenticated_request_returns_401(self, client: TestClient):
        """Calling /generate-itinerary without a token must return 401."""
        response = client.post("/generate-itinerary", json=_ITINERARY_PAYLOAD)

        assert response.status_code == 401

    def test_authenticated_request_passes_interests_to_service(self, client: TestClient):
        """Authenticated request succeeds and forwards user interests to generate_itinerary."""
        client.post("/register", json=_VALID_PAYLOAD)
        login_response = client.post(
            "/login",
            json={"email": _VALID_PAYLOAD["email"], "password": _VALID_PAYLOAD["password"]},
        )
        token = login_response.json()["access_token"]

        # Set interests so we can assert they are forwarded
        client.put(
            "/me/interests",
            json={"interests": ["adventure", "food_culinary"]},
            headers={"Authorization": f"Bearer {token}"},
        )

        with patch(
            "main.generate_itinerary",
            new_callable=AsyncMock,
            return_value=_MOCK_ITINERARY,
        ) as mock_generate:
            response = client.post(
                "/generate-itinerary",
                json=_ITINERARY_PAYLOAD,
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        _call_kwargs = mock_generate.call_args.kwargs
        assert _call_kwargs["destination"] == "Paris"
        assert _call_kwargs["days"] == 2
        assert _call_kwargs["start_date"].isoformat() == "2026-09-17"
        assert _call_kwargs["end_date"].isoformat() == "2026-09-19"
        assert _call_kwargs["travelers"] == 2
        assert _call_kwargs["budget"] == 500
        assert set(_call_kwargs["user_interests"]) == {"adventure", "food_culinary"}
