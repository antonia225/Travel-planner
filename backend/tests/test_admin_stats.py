import pytest

from fastapi.testclient import TestClient

from models import UserRole
from repositories.user_repository import UserRepository
from tests.conftest import _TestingSessionLocal


def _register_and_login(
    client: TestClient,
    email: str,
    role: UserRole = UserRole.USER,
) -> dict[str, str]:
    payload = {
        "name": email.split("@")[0].title(),
        "email": email,
        "password": "Secure1Password",
    }
    response = client.post("/register", json=payload)
    user_id = response.json()["id"]

    if role != UserRole.USER:
        db = _TestingSessionLocal()
        try:
            UserRepository(db).update_role(user_id, role)
        finally:
            db.close()

    login_response = client.post(
        "/login",
        json={"email": email, "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login_response.json()['access_token']}"}


@pytest.fixture
def admin_headers(client: TestClient) -> dict[str, str]:
    return _register_and_login(client, "admin@example.com", UserRole.ADMIN)


def test_admin_stats_returns_200(client, admin_headers):
    response = client.get("/admin/stats", headers=admin_headers)
    assert response.status_code == 200


def test_super_admin_can_view_admin_stats(client: TestClient):
    headers = _register_and_login(client, "super@example.com", UserRole.SUPER_ADMIN)

    response = client.get("/admin/stats", headers=headers)

    assert response.status_code == 200


def test_admin_stats_response_shape(client, admin_headers):
    body = client.get("/admin/stats", headers=admin_headers).json()
    assert set(body.keys()) == {"total_requests", "active_requests", "p95_latency_ms", "error_count"}


def test_admin_stats_values_are_numeric(client, admin_headers):
    body = client.get("/admin/stats", headers=admin_headers).json()
    assert isinstance(body["total_requests"], int)
    assert isinstance(body["active_requests"], int)
    assert isinstance(body["p95_latency_ms"], float)
    assert isinstance(body["error_count"], int)


def test_admin_stats_fallback_to_zero_when_prometheus_unreachable(client, admin_headers):
    """Prometheus is not running in CI — all values must be >= 0, not exceptions."""
    body = client.get("/admin/stats", headers=admin_headers).json()
    for key, val in body.items():
        assert val >= 0, f"{key} should be >= 0, got {val}"


def test_admin_stats_requires_login(client):
    response = client.get("/admin/stats")
    assert response.status_code == 401


def test_admin_stats_requires_admin_role(client: TestClient):
    headers = _register_and_login(client, "traveler@example.com")

    response = client.get("/admin/stats", headers=headers)

    assert response.status_code == 403
