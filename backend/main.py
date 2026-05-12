import asyncio
import hmac
import os

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from models import User, UserInterestCategory, create_all_tables
from repositories.user_interest_repository import UserInterestRepository
from repositories.user_repository import UserRepository
from schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserProfile,
)
from schemas.interests import (
    InterestCategoriesResponse,
    InterestCategory,
    UserInterestRequest,
    UserInterestResponse,
    UserInterests,
    UserInterestsResponse,
)
from schemas.itinerary import ItineraryResponse
from services.architect_service import generate_itinerary
from services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)

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


@app.on_event("startup")
def on_startup() -> None:
    create_all_tables()


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

    hashed = hash_password(payload.password)
    user = repo.create(email=payload.email, hashed_password=hashed, name=payload.name)
    
    # Save user interests if provided
    if payload.interests:
        interest_repo.add_interests(user.id, payload.interests)
    
    return RegisterResponse(id=user.id, email=user.email, name=user.name)


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    repo = UserRepository(db)
    user = repo.get_by_email(payload.email)

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": "user",
        }
    )
    return TokenResponse(access_token=access_token)


@app.get("/me", response_model=UserProfile)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        interests=current_user.interests or [],
    )


@app.put("/me/interests", response_model=UserProfile)
def update_user_interests(
    payload: UserInterests,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    """Update current user's travel interests."""
    repo = UserRepository(db)
    interests_list = [interest.value for interest in payload.interests]
    updated_user = repo.update_interests(current_user.id, interests_list)

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return UserProfile(
        id=updated_user.id,
        name=updated_user.name,
        email=updated_user.email,
        interests=updated_user.interests or [],
    )


@app.get("/interests/categories")
def list_interest_categories() -> InterestCategoriesResponse:
    """List all available interest categories for travel planning."""
    return {
        "categories": [interest.value for interest in InterestCategory],
        "descriptions": {
            "adventure": "Hiking, climbing, extreme sports",
            "water_sports": "Diving, surfing, kayaking",
            "nature_wildlife": "Safaris, birdwatching, national parks",
            "culture_history": "Museums, historical sites, heritage",
            "photography": "Photography-focused trips",
            "spiritual_religious": "Religious sites, meditation",
            "food_culinary": "Food tours, cooking classes, local cuisine",
            "fine_dining": "Upscale restaurants, wine tasting",
            "relaxation_wellness": "Spas, yoga, wellness retreats",
            "beach": "Beach relaxation, coastal activities",
            "shopping": "Markets, boutiques, local shopping",
            "nightlife": "Clubs, bars, nightlife scene",
            "entertainment": "Theater, concerts, shows",
            "budget_conscious": "Budget accommodations, cheap eats",
            "luxury": "High-end hotels, premium experiences",
            "eco_tourism": "Sustainable travel, eco-lodges",
            "family_friendly": "Family activities, kid-friendly",
        },
    }


# ---------- Itinerary ----------

class ItineraryRequest(BaseModel):
    destination: str
    num_days: int


@app.post("/generate-itinerary", response_model=ItineraryResponse)
async def create_itinerary(
    payload: ItineraryRequest,
    current_user: User = Depends(get_current_user),
) -> ItineraryResponse:
    try:
        return await generate_itinerary(
            destination=payload.destination,
            days=payload.num_days,
            user_interests=current_user.interests or [],
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
