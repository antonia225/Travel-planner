import asyncio

import pytest

from schemas.budget import BudgetOptimizerResponse
from schemas.itinerary import Activity, DailySchedule, ItineraryResponse
from services import travel_plan_chain_service


def _sample_itinerary(destination: str = "Lisbon") -> ItineraryResponse:
    return ItineraryResponse(
        destination=destination,
        days=[
            DailySchedule(
                day_number=1,
                activities=[
                    Activity(
                        title="Alfama walk",
                        description="Explore Alfama on foot.",
                        time_slot="09:00 - 11:00",
                    ),
                    Activity(
                        title="Baixa lunch",
                        description="Choose an affordable local lunch.",
                        time_slot="12:00 - 13:30",
                    ),
                    Activity(
                        title="Miradouro sunset",
                        description="Visit a free viewpoint.",
                        time_slot="17:00 - 19:00",
                    ),
                ],
            )
        ],
    )


def _sample_budget_plan(destination: str = "Lisbon") -> BudgetOptimizerResponse:
    return BudgetOptimizerResponse(
        destination=destination,
        total_budget=800,
        recommendations=[
            {
                "category": "transportation",
                "recommendation": "Use public transport passes.",
                "estimated_cost": "60 USD",
            }
        ],
    )


def test_chain_runs_itinerary_then_budget_optimizer_with_itinerary_destination(monkeypatch):
    calls: list[tuple[str, dict[str, object]]] = []

    async def fake_generate_itinerary(**kwargs):
        calls.append(("itinerary_agent", kwargs))
        return _sample_itinerary(destination="Porto")

    async def fake_generate_budget_plan(**kwargs):
        calls.append(("budget_optimizer_agent", kwargs))
        return _sample_budget_plan(destination=kwargs["destination"])

    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_itinerary",
        fake_generate_itinerary,
    )
    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_budget_plan",
        fake_generate_budget_plan,
    )

    result = asyncio.run(
        travel_plan_chain_service.generate_itinerary_with_budget_plan(
            destination="Lisbon",
            days=3,
            budget=800,
            travelers=2,
            user_interests=["culture_history"],
        )
    )

    assert result["itinerary"].destination == "Porto"
    assert result["budget_plan"].destination == "Porto"
    assert [call[0] for call in calls] == [
        "itinerary_agent",
        "budget_optimizer_agent",
    ]
    assert calls[0][1]["destination"] == "Lisbon"
    assert calls[0][1]["days"] == 3
    assert calls[0][1]["budget"] == 800
    assert calls[0][1]["travelers"] == 2
    assert calls[0][1]["user_interests"] == ["culture_history"]
    assert calls[1][1] == {"destination": "Porto", "budget": 800}


def test_chain_does_not_call_budget_optimizer_when_itinerary_agent_fails(monkeypatch):
    async def fake_generate_itinerary(**kwargs):
        raise ValueError("invalid itinerary JSON")

    async def fake_generate_budget_plan(**kwargs):
        raise AssertionError(
            "Budget Optimizer Agent should not be called when Itinerary Agent fails."
        )

    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_itinerary",
        fake_generate_itinerary,
    )
    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_budget_plan",
        fake_generate_budget_plan,
    )

    with pytest.raises(
        ValueError,
        match="Itinerary Agent generation failed: invalid itinerary JSON",
    ):
        asyncio.run(
            travel_plan_chain_service.generate_itinerary_with_budget_plan(
                destination="Lisbon",
                days=3,
                budget=800,
            )
        )


def test_chain_wraps_budget_optimizer_agent_errors(monkeypatch):
    async def fake_generate_itinerary(**kwargs):
        return _sample_itinerary()

    async def fake_generate_budget_plan(**kwargs):
        raise ValueError("invalid budget JSON")

    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_itinerary",
        fake_generate_itinerary,
    )
    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_budget_plan",
        fake_generate_budget_plan,
    )

    with pytest.raises(
        ValueError,
        match="Budget Optimizer Agent generation failed: invalid budget JSON",
    ):
        asyncio.run(
            travel_plan_chain_service.generate_itinerary_with_budget_plan(
                destination="Lisbon",
                days=3,
                budget=800,
            )
        )


def test_chain_rejects_non_positive_budget_before_calling_agents(monkeypatch):
    async def fake_generate_itinerary(**kwargs):
        raise AssertionError("Itinerary Agent should not be called for invalid budget.")

    async def fake_generate_budget_plan(**kwargs):
        raise AssertionError(
            "Budget Optimizer Agent should not be called for invalid budget."
        )

    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_itinerary",
        fake_generate_itinerary,
    )
    monkeypatch.setattr(
        travel_plan_chain_service,
        "generate_budget_plan",
        fake_generate_budget_plan,
    )

    with pytest.raises(
        ValueError,
        match="Budget must be greater than zero to optimize a travel plan.",
    ):
        asyncio.run(
            travel_plan_chain_service.generate_itinerary_with_budget_plan(
                destination="Lisbon",
                days=3,
                budget=0,
            )
        )
