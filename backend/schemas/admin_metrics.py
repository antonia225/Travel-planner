from datetime import datetime
from typing import Literal

from pydantic import BaseModel


AgentName = Literal["Itinerary Agent", "Budget Optimizer Agent"]
AgentMetricLabel = Literal[
    "Itinerary Agent Response Time",
    "Budget Optimizer Agent Response Time",
]
AgentOperation = Literal["generate_itinerary", "optimize_budget"]
AgentStatus = Literal["success", "failed"]


class AdminAIAgentSummary(BaseModel):
    itinerary_agent_response_time_ms: int | None
    budget_optimizer_agent_response_time_ms: int | None
    recent_failure_count: int


class AdminAIAgentAlert(BaseModel):
    id: int
    agent_name: AgentName
    operation: str
    message: str
    created_at: datetime


class AdminAIAgentLog(BaseModel):
    id: int
    agent_name: AgentName
    metric_label: AgentMetricLabel
    operation: AgentOperation
    destination: str | None
    model: str | None
    status: AgentStatus
    response_time_ms: int | None
    error_message: str | None
    fallback_used: bool
    created_at: datetime


class AdminAIAgentMetricsResponse(BaseModel):
    summary: AdminAIAgentSummary
    alerts: list[AdminAIAgentAlert]
    logs: list[AdminAIAgentLog]
