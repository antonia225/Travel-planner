from pydantic import BaseModel, Field


class BudgetRecommendation(BaseModel):
    category: str | None = None
    recommendation: str | None = None
    estimated_cost: str | None = None
    original_activity: str | None = None
    original_cost_eur: int | None = Field(default=None, ge=0)
    suggested_alternative: str | None = None
    estimated_alternative_cost_eur: int | None = Field(default=None, ge=0)
    estimated_savings_eur: int | None = Field(default=None, ge=0)
    reason: str | None = None


class BudgetOptimizerResponse(BaseModel):
    destination: str
    total_budget: int = Field(..., ge=0)
    total_estimated_savings_eur: int | None = Field(default=None, ge=0)
    recommendations: list[BudgetRecommendation]


class BudgetOptimizerActivity(BaseModel):
    title: str
    description: str
    time_slot: str
    day_number: int = Field(..., ge=1)
    estimated_cost_eur: int = Field(..., ge=0)


class BudgetOptimizerRequest(BaseModel):
    destination: str
    budget: int = Field(..., gt=0)
    expensive_activities: list[BudgetOptimizerActivity] = Field(default_factory=list)
