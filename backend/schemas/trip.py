from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .itinerary import ItineraryResponse


class TripStatus(str, Enum):
    UPCOMING = "upcoming"
    PAST = "past"


class SaveTripRequest(BaseModel):
    destination: str
    startDate: date = Field(..., alias="startDate")
    endDate: date = Field(..., alias="endDate")
    summary: str
    itinerary: ItineraryResponse
    status: Optional[TripStatus] = None

    model_config = {
        "populate_by_name": True,
    }

    @field_validator("endDate")
    @classmethod
    def validate_date_order(cls, value: date, info):
        start = info.data.get("startDate")
        if start is not None and value < start:
            raise ValueError("endDate must be the same or later than startDate")
        return value

    @field_validator("status", mode="after")
    @classmethod
    def infer_status(cls, value: Optional[TripStatus], info):
        if value is not None:
            return value

        start_date = info.data.get("startDate")
        if start_date is None:
            return TripStatus.UPCOMING
        return TripStatus.UPCOMING if start_date >= date.today() else TripStatus.PAST

    def duration_days(self) -> int:
        return (self.endDate - self.startDate).days + 1


class TripListResponse(BaseModel):
    id: int
    destination: str
    startDate: date = Field(..., alias="start_date")
    endDate: date = Field(..., alias="end_date")
    numberOfDays: int = Field(..., alias="duration_days")
    summary: str
    createdAt: datetime = Field(..., alias="created_at")
    status: TripStatus

    model_config = {
        "from_attributes": True,
    }


class TripDetailsResponse(TripListResponse):
    itinerary: ItineraryResponse

    model_config = {
        "from_attributes": True,
    }
