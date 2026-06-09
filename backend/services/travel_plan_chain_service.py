from datetime import date
from typing import TypedDict

from schemas.budget import BudgetOptimizerResponse
from schemas.itinerary import ItineraryResponse
from services.architect_service import generate_itinerary
from services.budget_optimizer_service import generate_budget_plan


class TravelPlanChainResult(TypedDict):
    itinerary: ItineraryResponse
    budget_plan: BudgetOptimizerResponse


async def generate_itinerary_with_budget_plan(
    destination: str,
    days: int,
    budget: int,
    start_date: date | None = None,
    end_date: date | None = None,
    travelers: int = 1,
    user_interests: list[str] | None = None,
) -> TravelPlanChainResult:
    """
    Orchestrates Agent 1 (travel architect) and Agent 2 (budget optimizer).

    Agent 1 builds a validated itinerary. Agent 2 then uses the destination
    returned by Agent 1, plus the requested budget, to generate recommendations.
    """
    if budget <= 0:
        raise ValueError("Budget must be greater than zero to optimize a travel plan.")

    try:
        itinerary = await generate_itinerary(
            destination=destination,
            days=days,
            start_date=start_date,
            end_date=end_date,
            travelers=travelers,
            budget=budget,
            user_interests=user_interests,
        )
    except ValueError as exc:
        raise ValueError(f"Agent 1 itinerary generation failed: {exc}") from exc

    try:
        budget_plan = await generate_budget_plan(
            destination=itinerary.destination,
            budget=budget,
        )
    except ValueError as exc:
        raise ValueError(f"Agent 2 budget optimization failed: {exc}") from exc

    return {
        "itinerary": itinerary,
        "budget_plan": budget_plan,
    }
