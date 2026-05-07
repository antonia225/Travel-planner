from pydantic import BaseModel, field_validator


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
