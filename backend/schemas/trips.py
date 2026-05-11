from datetime import date, datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TripCreate(BaseModel):
    title: str
    destination: str
    start_date: date
    duration_days: int
    itinerary_data: Dict[str, Any] = Field(default_factory=dict)


class TripUpdate(BaseModel):
    title: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[date] = None
    duration_days: Optional[int] = None
    itinerary_data: Optional[Dict[str, Any]] = None


class TripResponse(BaseModel):
    id: int
    user_id: int
    title: str
    destination: str
    start_date: date
    duration_days: int
    itinerary_data: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class TripListResponse(BaseModel):
    trips: list[TripResponse]

    class Config:
        from_attributes = True
