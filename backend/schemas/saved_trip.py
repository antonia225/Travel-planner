from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SaveGeneratedTripRequest(BaseModel):
    name: str = Field(..., min_length=1)
    trip_data: dict[str, Any] = Field(..., alias="tripData")

    model_config = {
        "populate_by_name": True,
    }

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Trip name cannot be empty.")
        return cleaned


class RenameSavedTripRequest(BaseModel):
    name: str = Field(..., min_length=1)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Trip name cannot be empty.")
        return cleaned


class SavedTripResponse(BaseModel):
    id: int
    user_id: int
    name: str
    trip_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }
