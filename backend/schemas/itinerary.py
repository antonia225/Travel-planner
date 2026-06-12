from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Activity(BaseModel):
    title: str
    description: str
    time_slot: str


class DailySchedule(BaseModel):
    day_number: int
    activities: list[Activity]

    @field_validator("activities")
    @classmethod
    def require_minimum_activities(cls, value: list[Activity]) -> list[Activity]:
        if len(value) < 3:
            raise ValueError(
                f"Each day must have at least 3 activities, but got {len(value)}."
            )
        return value


class ItineraryResponse(BaseModel):
    destination: str
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
