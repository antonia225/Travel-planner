import pytest


@pytest.fixture
def admin_headers(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    monkeypatch.setenv("ADMIN_API_TOKEN", "test-admin-token")
    return {"X-Admin-Token": "test-admin-token"}


def test_admin_stats_returns_200(client, admin_headers):
    response = client.get("/admin/stats", headers=admin_headers)
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


def test_admin_stats_requires_admin_token(client, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "test-admin-token")
    response = client.get("/admin/stats")
    assert response.status_code == 401
