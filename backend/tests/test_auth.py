"""
Unit tests for POST /register.

The TestClient and isolated in-memory database are provided by conftest.py.
"""
import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

_VALID_PAYLOAD = {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Secure1Password",
}


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
