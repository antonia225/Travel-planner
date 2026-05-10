from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_admin_stats_returns_200():
    response = client.get("/admin/stats")
    assert response.status_code == 200

def test_admin_stats_response_shape():
    body = client.get("/admin/stats").json()
    assert set(body.keys()) == {"total_requests", "active_requests", "avg_latency_ms", "error_count"}

def test_admin_stats_values_are_numeric():
    body = client.get("/admin/stats").json()
    assert isinstance(body["total_requests"], int)
    assert isinstance(body["active_requests"], int)
    assert isinstance(body["avg_latency_ms"], float)
    assert isinstance(body["error_count"], int)

def test_admin_stats_fallback_to_zero_when_prometheus_unreachable():
    """Prometheus is not running in CI — all values must be >= 0, not exceptions."""
    body = client.get("/admin/stats").json()
    for key, val in body.items():
        assert val >= 0, f"{key} should be >= 0, got {val}"
