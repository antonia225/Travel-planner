from datetime import date

from fastapi.testclient import TestClient


_SAMPLE_ITINERARY = {
    "destination": "Paris",
    "days": [
        {
            "day_number": 1,
            "activities": [
                {"title": "Arrival", "description": "Check into hotel", "time_slot": "Morning"},
                {"title": "Louvre visit", "description": "Explore the museum", "time_slot": "Afternoon"},
                {"title": "Dinner", "description": "Try a local bistro", "time_slot": "Evening"},
            ],
        }
    ],
}


class TestSavedTrips:
    def test_empty_saved_trips_returns_empty_list(self, client: TestClient):
        response = client.get("/trips/saved")

        assert response.status_code == 200
        assert response.json() == []

    def test_save_trip_and_list_it(self, client: TestClient):
        payload = {
            "destination": "Paris",
            "startDate": str(date.today()),
            "endDate": str(date.today()),
            "summary": "A short Paris weekend.",
            "itinerary": _SAMPLE_ITINERARY,
        }

        save_response = client.post("/trips/save", json=payload)
        assert save_response.status_code == 201
        saved = save_response.json()

        assert saved["destination"] == "Paris"
        assert saved["summary"] == payload["summary"]
        assert saved["status"] in ["upcoming", "past"]
        assert saved["itinerary"]["destination"] == "Paris"

        list_response = client.get("/trips/saved")
        assert list_response.status_code == 200
        trips = list_response.json()
        assert len(trips) == 1
        assert trips[0]["destination"] == "Paris"
        assert trips[0]["numberOfDays"] == 1

        details_response = client.get(f"/trips/{saved['id']}")
        assert details_response.status_code == 200
        details = details_response.json()
        assert details["id"] == saved["id"]
        assert details["itinerary"]["destination"] == "Paris"

    def test_duplicate_save_returns_409(self, client: TestClient):
        payload = {
            "destination": "Rome",
            "startDate": str(date.today()),
            "endDate": str(date.today()),
            "summary": "Rome sample trip.",
            "itinerary": _SAMPLE_ITINERARY,
        }

        first_response = client.post("/trips/save", json=payload)
        assert first_response.status_code == 201

        duplicate_response = client.post("/trips/save", json=payload)
        assert duplicate_response.status_code == 409
        assert "has already been saved" in duplicate_response.json()["detail"].lower()

    def test_invalid_trip_id_returns_404(self, client: TestClient):
        response = client.get("/trips/999")
        assert response.status_code == 404

    def test_save_trip_with_past_start_date_returns_422(self, client: TestClient):
        from datetime import timedelta
        past_date = date.today() - timedelta(days=5)
        payload = {
            "destination": "Tokyo",
            "startDate": str(past_date),
            "endDate": str(date.today()),
            "summary": "Past trip should fail.",
            "itinerary": _SAMPLE_ITINERARY,
        }

        response = client.post("/trips/save", json=payload)
        assert response.status_code == 422
        assert "past" in response.json()["detail"][0]["msg"].lower()

    def test_save_trip_with_today_start_date_succeeds(self, client: TestClient):
        payload = {
            "destination": "Barcelona",
            "startDate": str(date.today()),
            "endDate": str(date.today()),
            "summary": "Today trip should succeed.",
            "itinerary": _SAMPLE_ITINERARY,
        }

        response = client.post("/trips/save", json=payload)
        assert response.status_code == 201
        assert response.json()["destination"] == "Barcelona"

    def test_save_trip_with_future_start_date_succeeds(self, client: TestClient):
        from datetime import timedelta
        future_date = date.today() + timedelta(days=30)
        payload = {
            "destination": "Sydney",
            "startDate": str(future_date),
            "endDate": str(future_date),
            "summary": "Future trip should succeed.",
            "itinerary": _SAMPLE_ITINERARY,
        }

        response = client.post("/trips/save", json=payload)
        assert response.status_code == 201
        assert response.json()["destination"] == "Sydney"
