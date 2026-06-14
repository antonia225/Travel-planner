from datetime import datetime

from sqlalchemy.orm import Session

from models import AIGenerationLog, AIGenerationStatus


ITINERARY_AGENT_NAME = "Itinerary Agent"
BUDGET_OPTIMIZER_AGENT_NAME = "Budget Optimizer Agent"

ITINERARY_AGENT_RESPONSE_TIME_LABEL = "Itinerary Agent Response Time"
BUDGET_OPTIMIZER_AGENT_RESPONSE_TIME_LABEL = "Budget Optimizer Agent Response Time"


def metric_label_for_agent(agent_name: str) -> str:
    if agent_name == ITINERARY_AGENT_NAME:
        return ITINERARY_AGENT_RESPONSE_TIME_LABEL
    if agent_name == BUDGET_OPTIMIZER_AGENT_NAME:
        return BUDGET_OPTIMIZER_AGENT_RESPONSE_TIME_LABEL
    return f"{agent_name} Response Time"


class AIGenerationLogRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def create(
        self,
        *,
        agent_name: str,
        operation: str,
        status: AIGenerationStatus,
        model: str | None = None,
        destination: str | None = None,
        response_time_ms: int | None = None,
        error_message: str | None = None,
        fallback_used: bool = False,
    ) -> AIGenerationLog:
        log = AIGenerationLog(
            agent_name=agent_name,
            operation=operation,
            model=model,
            destination=destination,
            status=status.value,
            response_time_ms=response_time_ms,
            error_message=error_message,
            fallback_used=fallback_used,
            created_at=datetime.utcnow(),
        )
        self._db.add(log)
        self._db.commit()
        self._db.refresh(log)
        return log

    def list_recent(self, limit: int = 50) -> list[AIGenerationLog]:
        safe_limit = max(1, min(limit, 100))
        return (
            self._db.query(AIGenerationLog)
            .order_by(AIGenerationLog.created_at.desc(), AIGenerationLog.id.desc())
            .limit(safe_limit)
            .all()
        )

    def latest_response_time_ms(self, agent_name: str) -> int | None:
        log = (
            self._db.query(AIGenerationLog)
            .filter(
                AIGenerationLog.agent_name == agent_name,
                AIGenerationLog.response_time_ms.isnot(None),
            )
            .order_by(AIGenerationLog.created_at.desc(), AIGenerationLog.id.desc())
            .first()
        )
        return log.response_time_ms if log else None
