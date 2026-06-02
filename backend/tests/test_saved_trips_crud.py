from fastapi.testclient import TestClient


_USER_ONE = {
    "name": "Jane Doe",
    "email": "jane.saved@example.com",
    "password": "Secure1Password",
}
_USER_TWO = {
    "name": "Alex Doe",
    "email": "alex.saved@example.com",
    "password": "Secure1Password",
}
_TRIP_DATA = {
    "destination": "Paris",
    "days": [
        {
            "day_number": 1,
            "activities": [
                {"title": "Eiffel Tower", "description": "Visit the tower", "time_slot": "Morning"},
                {"title": "Louvre", "description": "Explore the museum", "time_slot": "Afternoon"},
                {"title": "Dinner", "description": "Try a bistro", "time_slot": "Evening"},
            ],
        }
    ],
}


def _auth_headers(client: TestClient, payload: dict[str, str]) -> dict[str, str]:
    client.post("/register", json=payload)
    response = client.post(
        "/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestSavedTripsCrud:
    def test_requires_authentication(self, client: TestClient):
        response = client.get("/saved-trips")

        assert response.status_code == 401

    def test_save_list_and_read_owned_trip(self, client: TestClient):
        headers = _auth_headers(client, _USER_ONE)

        create_response = client.post(
            "/saved-trips",
            json={"name": "Paris weekend", "tripData": _TRIP_DATA},
            headers=headers,
        )

        assert create_response.status_code == 201
        saved = create_response.json()
        assert saved["name"] == "Paris weekend"
        assert saved["trip_data"] == _TRIP_DATA

        list_response = client.get("/saved-trips", headers=headers)
        assert list_response.status_code == 200
        assert [trip["id"] for trip in list_response.json()] == [saved["id"]]

        read_response = client.get(f"/saved-trips/{saved['id']}", headers=headers)
        assert read_response.status_code == 200
        assert read_response.json()["trip_data"]["destination"] == "Paris"

    def test_list_only_returns_current_users_trips(self, client: TestClient):
        user_one_headers = _auth_headers(client, _USER_ONE)
        user_two_headers = _auth_headers(client, _USER_TWO)

        client.post(
            "/saved-trips",
            json={"name": "Jane trip", "tripData": _TRIP_DATA},
            headers=user_one_headers,
        )
        client.post(
            "/saved-trips",
            json={"name": "Alex trip", "tripData": {**_TRIP_DATA, "destination": "Rome"}},
            headers=user_two_headers,
        )

        response = client.get("/saved-trips", headers=user_one_headers)

        assert response.status_code == 200
        trips = response.json()
        assert len(trips) == 1
        assert trips[0]["name"] == "Jane trip"

    def test_rename_updates_name_and_preserves_trip_data(self, client: TestClient):
        headers = _auth_headers(client, _USER_ONE)
        saved = client.post(
            "/saved-trips",
            json={"name": "Original name", "tripData": _TRIP_DATA},
            headers=headers,
        ).json()

        response = client.patch(
            f"/saved-trips/{saved['id']}",
            json={"name": "Renamed trip"},
            headers=headers,
        )

        assert response.status_code == 200
        renamed = response.json()
        assert renamed["name"] == "Renamed trip"
        assert renamed["trip_data"] == _TRIP_DATA
        assert renamed["updated_at"] >= saved["updated_at"]

    def test_delete_removes_owned_trip(self, client: TestClient):
        headers = _auth_headers(client, _USER_ONE)
        saved = client.post(
            "/saved-trips",
            json={"name": "Delete me", "tripData": _TRIP_DATA},
            headers=headers,
        ).json()

        delete_response = client.delete(f"/saved-trips/{saved['id']}", headers=headers)
        assert delete_response.status_code == 204

        read_response = client.get(f"/saved-trips/{saved['id']}", headers=headers)
        assert read_response.status_code == 404

    def test_non_owner_read_update_delete_return_404(self, client: TestClient):
        owner_headers = _auth_headers(client, _USER_ONE)
        other_headers = _auth_headers(client, _USER_TWO)
        saved = client.post(
            "/saved-trips",
            json={"name": "Private trip", "tripData": _TRIP_DATA},
            headers=owner_headers,
        ).json()

        read_response = client.get(f"/saved-trips/{saved['id']}", headers=other_headers)
        rename_response = client.patch(
            f"/saved-trips/{saved['id']}",
            json={"name": "Not mine"},
            headers=other_headers,
        )
        delete_response = client.delete(f"/saved-trips/{saved['id']}", headers=other_headers)

        assert read_response.status_code == 404
        assert rename_response.status_code == 404
        assert delete_response.status_code == 404

    def test_empty_name_is_rejected(self, client: TestClient):
        headers = _auth_headers(client, _USER_ONE)

        response = client.post(
            "/saved-trips",
            json={"name": "   ", "tripData": _TRIP_DATA},
            headers=headers,
        )

        assert response.status_code == 422
