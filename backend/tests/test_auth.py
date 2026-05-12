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
    def test_success_returns_200(self, client: TestClient):
        client.post("/register", json=_VALID_PAYLOAD)

        response = client.post(
            "/login",
            json={
                "email": _VALID_PAYLOAD["email"],
                "password": _VALID_PAYLOAD["password"],
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["email"] == _VALID_PAYLOAD["email"]
        assert body["name"] == _VALID_PAYLOAD["name"]
        assert isinstance(body["id"], int)

    def test_wrong_password_returns_401(self, client: TestClient):
        client.post("/register", json=_VALID_PAYLOAD)

        response = client.post(
            "/login",
            json={
                "email": _VALID_PAYLOAD["email"],
                "password": "WrongPassword1",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."

    def test_unknown_user_returns_401(self, client: TestClient):
        response = client.post(
            "/login",
            json={"email": "nobody@example.com", "password": "Secure1Password"},
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."


class TestUpdateProfile:
    @pytest.fixture
    def profile_update_headers(self, monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
        monkeypatch.setenv("PROFILE_UPDATE_ADMIN_TOKEN", "profile-update-token")
        return {"X-Admin-Token": "profile-update-token"}

    def test_success_returns_200(
        self,
        client: TestClient,
        profile_update_headers: dict[str, str],
    ):
        created_user = client.post("/register", json=_VALID_PAYLOAD).json()

        response = client.patch(
            f"/users/{created_user['id']}/profile",
            headers=profile_update_headers,
            json={"name": "Jane Updated", "email": "jane.updated@example.com"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == created_user["id"]
        assert body["name"] == "Jane Updated"
        assert body["email"] == "jane.updated@example.com"

    def test_email_conflict_returns_409(
        self,
        client: TestClient,
        profile_update_headers: dict[str, str],
    ):
        first_user = client.post("/register", json=_VALID_PAYLOAD).json()
        second_user = client.post(
            "/register",
            json={
                "name": "John Doe",
                "email": "john@example.com",
                "password": "Secure1Password",
            },
        ).json()

        response = client.patch(
            f"/users/{first_user['id']}/profile",
            headers=profile_update_headers,
            json={"email": second_user["email"]},
        )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()
