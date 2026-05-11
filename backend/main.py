import asyncio
import bcrypt
import hmac
import os
import re
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from services.ai_service import check_ollama_connection
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models import create_all_tables, UserInterestCategory
from repositories.user_repository import UserRepository
from repositories.user_interest_repository import UserInterestRepository
from schemas.itinerary import ItineraryResponse
from services.architect_service import generate_itinerary

from schemas.budget import BudgetOptimizerResponse
from services.budget_optimizer_service import generate_budget_plan

app = FastAPI(title="AI Travel Planner API")

# Prometheus metrics instrumentation
if os.getenv("ENABLE_METRICS_ENDPOINT", "false").lower() == "true":
    Instrumentator().instrument(app).expose(app, include_in_schema=False)


async def _query_prometheus(client: httpx.AsyncClient, prom_url: str, promql: str) -> float:
    try:
        response = await client.get(f"{prom_url}/api/v1/query", params={"query": promql})
        response.raise_for_status()
        result = response.json().get("data", {}).get("result", [])
        return float(result[0]["value"][1]) if result else 0.0
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return 0.0


async def _require_admin_token(x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> None:
    configured_admin_token = os.getenv("ADMIN_API_TOKEN", "").strip()
    if not configured_admin_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API token not configured.",
        )

    if not x_admin_token or not hmac.compare_digest(x_admin_token, configured_admin_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized.")


@app.get("/admin/stats")
async def admin_stats(_: None = Depends(_require_admin_token)) -> dict:
    """
    Queries Prometheus directly for aggregated system metrics.
    Falls back to zeros if Prometheus is unreachable (e.g. during tests).
    """
    prom_url = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")

    async with httpx.AsyncClient(timeout=3.0) as client:
        total, active, latency, errors = await asyncio.gather(
            _query_prometheus(client, prom_url, 'sum(http_requests_total)'),
            _query_prometheus(client, prom_url, 'sum(http_requests_in_progress)'),
            _query_prometheus(client, prom_url, 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'),
            _query_prometheus(client, prom_url, 'sum(http_requests_total{status=~"4..|5.."})'),
        )

    return {
        "total_requests": int(total),
        "active_requests": int(active),
        "p95_latency_ms": round(latency * 1000, 2),
        "error_count": int(errors),
    }

# Development CORS policy; tighten in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


@app.on_event("startup")
def on_startup() -> None:
    create_all_tables()


# ---------- Schemas ----------

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    interests: list[UserInterestCategory] = []

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        errors: list[str] = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", v):
            errors.append("one uppercase letter (A–Z)")
        if not re.search(r"[a-z]", v):
            errors.append("one lowercase letter (a–z)")
        if not re.search(r"[0-9]", v):
            errors.append("one number (0–9)")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))
        return v


class RegisterResponse(BaseModel):
    id: int
    name: str
    email: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


class UserInterestRequest(BaseModel):
    category: UserInterestCategory


class UserInterestResponse(BaseModel):
    id: int
    user_id: int
    category: UserInterestCategory

    class Config:
        from_attributes = True


class UserInterestsResponse(BaseModel):
    user_id: int
    categories: list[UserInterestCategory]

class BudgetOptimizerRequest(BaseModel):
    destination: str
    budget: int


# ---------- Routes ----------

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ollama")
def ollama_health_check() -> dict[str, object]:
    return check_ollama_connection()


@app.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    repo = UserRepository(db)
    interest_repo = UserInterestRepository(db)

    if repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    hashed = _hash_password(payload.password)
    user = repo.create(email=payload.email, hashed_password=hashed, name=payload.name)
    
    # Save user interests if provided
    if payload.interests:
        interest_repo.add_interests(user.id, payload.interests)
    
    return RegisterResponse(id=user.id, email=user.email, name=user.name)

@app.post("/login", response_model=RegisterResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    repo = UserRepository(db)

    user = repo.get_by_email(payload.email)
    if not user or not _verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    return RegisterResponse(
        id=user.id,
        name=user.name,
        email=user.email,
    )

@app.patch("/users/{user_id}/profile", response_model=RegisterResponse)
def update_profile(
    user_id: int,
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    repo = UserRepository(db)

    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if payload.email is not None:
        existing_user = repo.get_by_email(payload.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

    updated_user = repo.update(
        user=user,
        name=payload.name,
        email=payload.email,
    )

    return RegisterResponse(
        id=updated_user.id,
        name=updated_user.name,
        email=updated_user.email,
    )


# ---------- Itinerary ----------

class ItineraryRequest(BaseModel):
    destination: str
    num_days: int


@app.post("/generate-itinerary", response_model=ItineraryResponse)
async def create_itinerary(payload: ItineraryRequest) -> ItineraryResponse:
    try:
        return await generate_itinerary(
            destination=payload.destination,
            days=payload.num_days,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

@app.post("/optimize-budget", response_model=BudgetOptimizerResponse)
async def optimize_budget(payload: BudgetOptimizerRequest) -> BudgetOptimizerResponse:
    try:
        return await generate_budget_plan(
            destination=payload.destination,
            budget=payload.budget,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

# ---------- User Interests Routes ----------

@app.get("/users/{user_id}/interests", response_model=UserInterestsResponse)
def get_user_interests(user_id: int, db: Session = Depends(get_db)) -> UserInterestsResponse:
    """Get all interest categories for a user"""
    interest_repo = UserInterestRepository(db)
    categories = interest_repo.get_categories_by_user_id(user_id)
    return UserInterestsResponse(user_id=user_id, categories=categories)


@app.post("/users/{user_id}/interests", response_model=UserInterestResponse, status_code=status.HTTP_201_CREATED)
def add_user_interest(user_id: int, payload: UserInterestRequest, db: Session = Depends(get_db)) -> UserInterestResponse:
    """Add a single interest category for a user"""
    repo = UserRepository(db)
    interest_repo = UserInterestRepository(db)
    
    # Verify user exists
    if not repo.get_by_id(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    
    # Check if interest already exists
    if interest_repo.has_interest(user_id, payload.category):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has this interest.",
        )
    
    interest = interest_repo.add_interest(user_id, payload.category)
    return UserInterestResponse(id=interest.id, user_id=interest.user_id, category=interest.category)


@app.delete("/users/{user_id}/interests/{category}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_interest(user_id: int, category: UserInterestCategory, db: Session = Depends(get_db)) -> None:
    """Remove a specific interest category for a user"""
    interest_repo = UserInterestRepository(db)
    
    if not interest_repo.delete_interest_by_category(user_id, category):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interest not found.",
        )
