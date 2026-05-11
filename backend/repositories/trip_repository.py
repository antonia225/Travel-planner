from datetime import date
from typing import Any, Optional

from sqlalchemy.orm import Session

from models import SavedTrip


class TripRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create_trip(
        self,
        user_id: int,
        title: str,
        destination: str,
        start_date: date,
        duration_days: int,
        itinerary_data: dict[str, Any],
    ) -> SavedTrip:
        trip = SavedTrip(
            user_id=user_id,
            title=title,
            destination=destination,
            start_date=start_date,
            duration_days=duration_days,
            itinerary_data=itinerary_data,
        )
        self._db.add(trip)
        self._db.commit()
        self._db.refresh(trip)
        return trip

    def get_user_trips(self, user_id: int) -> list[SavedTrip]:
        return (
            self._db.query(SavedTrip)
            .filter(SavedTrip.user_id == user_id)
            .order_by(SavedTrip.created_at.desc())
            .all()
        )

    def get_trip_by_id(self, trip_id: int) -> Optional[SavedTrip]:
        return self._db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()

    def update_trip(self, trip_id: int, updates: dict[str, Any]) -> Optional[SavedTrip]:
        trip = self.get_trip_by_id(trip_id)
        if not trip:
            return None

        for field, value in updates.items():
            if value is not None and hasattr(trip, field):
                setattr(trip, field, value)

        self._db.commit()
        self._db.refresh(trip)
        return trip

    def delete_trip(self, trip_id: int) -> bool:
        trip = self.get_trip_by_id(trip_id)
        if not trip:
            return False

        self._db.delete(trip)
        self._db.commit()
        return True
