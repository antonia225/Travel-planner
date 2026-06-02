import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import SavedTrip


class SavedTripRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(self, user_id: int, name: str, trip_data: dict) -> SavedTrip:
        now = datetime.utcnow()
        saved_trip = SavedTrip(
            user_id=user_id,
            name=name.strip(),
            trip_data_json=json.dumps(trip_data, ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )
        self._db.add(saved_trip)
        self._db.commit()
        self._db.refresh(saved_trip)
        return saved_trip

    def list_for_user(self, user_id: int) -> list[SavedTrip]:
        return (
            self._db.query(SavedTrip)
            .filter(SavedTrip.user_id == user_id)
            .order_by(SavedTrip.updated_at.desc(), SavedTrip.created_at.desc())
            .all()
        )

    def get_for_user(self, trip_id: int, user_id: int) -> Optional[SavedTrip]:
        return (
            self._db.query(SavedTrip)
            .filter(SavedTrip.id == trip_id, SavedTrip.user_id == user_id)
            .first()
        )

    def rename(self, trip_id: int, user_id: int, name: str) -> Optional[SavedTrip]:
        saved_trip = self.get_for_user(trip_id, user_id)
        if not saved_trip:
            return None

        saved_trip.name = name.strip()
        saved_trip.updated_at = datetime.utcnow()
        self._db.commit()
        self._db.refresh(saved_trip)
        return saved_trip

    def delete(self, trip_id: int, user_id: int) -> bool:
        saved_trip = self.get_for_user(trip_id, user_id)
        if not saved_trip:
            return False

        self._db.delete(saved_trip)
        self._db.commit()
        return True
