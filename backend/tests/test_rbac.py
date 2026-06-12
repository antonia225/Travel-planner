from fastapi.testclient import TestClient

from models import UserRole
from repositories.user_repository import UserRepository
from tests.conftest import _TestingSessionLocal


def _register_and_login(
    client: TestClient,
    email: str,
    role: UserRole = UserRole.USER,
) -> tuple[int, dict[str, str]]:
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
    return user_id, {"Authorization": f"Bearer {login_response.json()['access_token']}"}


def test_regular_user_cannot_open_admin_user_list(client: TestClient):
    _, headers = _register_and_login(client, "traveler@example.com")

    response = client.get("/admin/users", headers=headers)

    assert response.status_code == 403


def test_admin_can_view_user_list(client: TestClient):
    admin_id, headers = _register_and_login(client, "admin@example.com", UserRole.ADMIN)
    _register_and_login(client, "traveler@example.com")

    response = client.get("/admin/users", headers=headers)

    assert response.status_code == 200
    users = response.json()
    assert {user["email"] for user in users} == {"admin@example.com", "traveler@example.com"}
    admin = next(user for user in users if user["id"] == admin_id)
    assert admin["role"] == "admin"
    assert admin["is_active"] is True


def test_admin_can_deactivate_user_and_login_is_blocked(client: TestClient):
    _, admin_headers = _register_and_login(client, "admin@example.com", UserRole.ADMIN)
    user_id, _ = _register_and_login(client, "traveler@example.com")

    response = client.patch(
        f"/admin/users/{user_id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False

    login_response = client.post(
        "/login",
        json={"email": "traveler@example.com", "password": "Secure1Password"},
    )
    assert login_response.status_code == 403
    assert "deactivated" in login_response.json()["detail"].lower()


def test_admin_cannot_deactivate_self(client: TestClient):
    admin_id, admin_headers = _register_and_login(client, "admin@example.com", UserRole.ADMIN)

    response = client.patch(
        f"/admin/users/{admin_id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert response.status_code == 400


def test_role_changes_require_super_admin(client: TestClient):
    _, admin_headers = _register_and_login(client, "admin@example.com", UserRole.ADMIN)
    user_id, _ = _register_and_login(client, "traveler@example.com")

    denied = client.patch(
        f"/admin/users/{user_id}/role",
        json={"role": "admin"},
        headers=admin_headers,
    )
    assert denied.status_code == 403

    _, super_headers = _register_and_login(
        client,
        "super@example.com",
        UserRole.SUPER_ADMIN,
    )
    allowed = client.patch(
        f"/admin/users/{user_id}/role",
        json={"role": "admin"},
        headers=super_headers,
    )
    assert allowed.status_code == 200
    assert allowed.json()["role"] == "admin"
