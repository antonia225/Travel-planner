import logging
from time import perf_counter

from sqlalchemy.orm import Session

from models import AIGenerationStatus
from repositories.ai_generation_log_repository import AIGenerationLogRepository

logger = logging.getLogger(__name__)


def response_time_ms(raw_body: dict | None, started_at: float) -> int:
    total_duration = raw_body.get("total_duration") if raw_body else None
    if isinstance(total_duration, int) and total_duration > 0:
        return round(total_duration / 1_000_000)

    return max(0, round((perf_counter() - started_at) * 1000))


def record_ai_generation_log(
    db: Session | None,
    *,
    agent_name: str,
    operation: str,
    status: AIGenerationStatus,
    model: str | None,
    destination: str | None,
    response_time_ms: int | None,
    error_message: str | None = None,
    fallback_used: bool = False,
) -> None:
    if db is None:
        return

    try:
        AIGenerationLogRepository(db).create(
            agent_name=agent_name,
            operation=operation,
            status=status,
            model=model,
            destination=destination,
            response_time_ms=response_time_ms,
            error_message=error_message,
            fallback_used=fallback_used,
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to record AI generation log.")
