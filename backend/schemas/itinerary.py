from datetime import date as Date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Activity(BaseModel):
    title: str
    description: str
    time_slot: str
    estimated_cost_eur: int | None = Field(default=None, ge=0)


class DailySchedule(BaseModel):
    day_number: int
    date: Date | None = None
    activities: list[Activity]

    @field_validator("activities")
    @classmethod
    def require_minimum_activities(cls, value: list[Activity]) -> list[Activity]:
        if len(value) != 3:
            raise ValueError(
                f"Each day must have exactly 3 activities, but got {len(value)}."
            )
        return value


class ItineraryResponse(BaseModel):
    destination: str
    currency: Literal["EUR"] = "EUR"
    total_estimated_cost_eur: int | None = Field(default=None, ge=0)
    start_date: Date | None = None
    end_date: Date | None = None
    budget_eur: int | None = Field(default=None, ge=0)
    days: list[DailySchedule]


class RegenerateActivityRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    destination: str
    day_index: int = Field(..., ge=0, alias="dayIndex")
    activity_index: int = Field(..., ge=0, alias="activityIndex")
    old_activity: Activity = Field(..., alias="oldActivity")
    itinerary: ItineraryResponse | None = None
    day_plan: DailySchedule | None = Field(default=None, alias="dayPlan")
    user_preferences: dict[str, Any] = Field(default_factory=dict, alias="userPreferences")
    constraints: dict[str, Any] = Field(default_factory=dict)


class RegenerateActivityResponse(BaseModel):
    activity: Activity
