from pydantic import BaseModel


class BudgetRecommendation(BaseModel):
    category: str
    recommendation: str
    estimated_cost: str


class BudgetOptimizerResponse(BaseModel):
    destination: str
    total_budget: int
    recommendations: list[BudgetRecommendation]