from enum import Enum
from pydantic import BaseModel, Field


class InterestCategory(str, Enum):
    """Travel interest categories for LLM personalization."""

    # Activity & Adventure
    ADVENTURE = "adventure"  # Hiking, climbing, extreme sports
    WATER_SPORTS = "water_sports"  # Diving, surfing, kayaking
    NATURE_WILDLIFE = "nature_wildlife"  # Safaris, birdwatching, national parks

    # Culture & History
    CULTURE_HISTORY = "culture_history"  # Museums, historical sites, heritage
    PHOTOGRAPHY = "photography"  # Photography-focused trips
    SPIRITUAL_RELIGIOUS = "spiritual_religious"  # Religious sites, meditation

    # Food & Dining
    FOOD_CULINARY = "food_culinary"  # Food tours, cooking classes, local cuisine
    FINE_DINING = "fine_dining"  # Upscale restaurants, wine tasting

    # Relaxation & Wellness
    RELAXATION_WELLNESS = "relaxation_wellness"  # Spas, yoga, wellness retreats
    BEACH = "beach"  # Beach relaxation, coastal activities

    # Shopping & Entertainment
    SHOPPING = "shopping"  # Markets, boutiques, local shopping
    NIGHTLIFE = "nightlife"  # Clubs, bars, nightlife scene
    ENTERTAINMENT = "entertainment"  # Theater, concerts, shows

    # Travel Style
    BUDGET_CONSCIOUS = "budget_conscious"  # Budget accommodations, cheap eats
    LUXURY = "luxury"  # High-end hotels, premium experiences
    ECO_TOURISM = "eco_tourism"  # Sustainable travel, eco-lodges
    FAMILY_FRIENDLY = "family_friendly"  # Family activities, kid-friendly


class UserInterests(BaseModel):
    """User's travel interests for itinerary personalization."""

    interests: list[InterestCategory]

    class Config:
        json_schema_extra = {
            "example": {
                "interests": [
                    "adventure",
                    "food_culinary",
                    "culture_history",
                    "nature_wildlife",
                ]
            }
        }


class UserProfileWithInterests(BaseModel):
    """Extended user profile including interests."""

    id: int
    name: str
    email: str
    interests: list[InterestCategory] = Field(default_factory=list)


class InterestCategoriesResponse(BaseModel):
    """Response schema for the list-interest-categories endpoint."""

    categories: list[str]
    descriptions: dict[str, str]


class UserInterestRequest(BaseModel):
    """Request body for adding a single interest to a user."""

    category: InterestCategory


class UserInterestResponse(BaseModel):
    """Single user-interest record returned from the API."""

    id: int
    user_id: int
    category: InterestCategory


class UserInterestsResponse(BaseModel):
    """All interest categories for a given user."""

    user_id: int
    categories: list[InterestCategory] = Field(default_factory=list)
