import json
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import Trip
from schemas.trip import TripStatus


class TripRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(
        self,
        destination: str,
        start_date: date,
        end_date: date,
        duration_days: int,
        summary: str,
        itinerary: dict,
        status: TripStatus,
    ) -> Trip:
        trip = Trip(
            destination=destination,
            start_date=start_date,
            end_date=end_date,
            duration_days=duration_days,
            summary=summary,
            itinerary_json=json.dumps(itinerary, ensure_ascii=False),
            created_at=datetime.utcnow(),
            status=status,
        )
        self._db.add(trip)
        self._db.commit()
        self._db.refresh(trip)
        return trip

    def get_all(self) -> list[Trip]:
        return self._db.query(Trip).order_by(Trip.created_at.desc()).all()

    def get_by_id(self, trip_id: int) -> Optional[Trip]:
        return self._db.query(Trip).filter(Trip.id == trip_id).first()

    def exists_by_details(self, destination: str, start_date: date, end_date: date) -> bool:
        return (
            self._db.query(Trip)
            .filter(
                Trip.destination == destination,
                Trip.start_date == start_date,
                Trip.end_date == end_date,
            )
            .first()
            is not None
        )
