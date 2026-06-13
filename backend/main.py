import asyncio
import hmac
import os

import httpx
from datetime import date
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user, require_roles
from models import User, UserInterestCategory, UserRole, create_all_tables
from repositories.saved_trip_repository import SavedTripRepository
from repositories.trip_repository import TripRepository
from repositories.user_interest_repository import UserInterestRepository
from repositories.user_repository import UserRepository
from schemas.auth import (
    ChangePasswordRequest,
    AdminUserResponse,
    AdminUserRoleUpdateRequest,
    AdminUserStatusUpdateRequest,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UpdateProfileRequest,
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
from schemas.saved_trip import (
    RenameSavedTripRequest,
    SaveGeneratedTripRequest,
    SavedTripResponse,
)
from schemas.budget import BudgetOptimizerResponse
from schemas.itinerary import (
    ItineraryResponse,
    RegenerateActivityRequest,
    RegenerateActivityResponse,
)
from schemas.trip import SaveTripRequest, TripDetailsResponse, TripListResponse, TripStatus
from services.ai_service import check_ollama_connection
from services.architect_service import generate_itinerary, regenerate_single_activity
from services.budget_optimizer_service import generate_budget_plan
from services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)
from seed_users import seed_demo_users

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
    seed_demo_users()


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
    
    return RegisterResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=UserRole(user.role),
        is_active=user.is_active,
    )


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

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
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
        role=UserRole(current_user.role),
        is_active=current_user.is_active,
    )


@app.patch("/me", response_model=UserProfile)
def update_current_user_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfile:
    repo = UserRepository(db)
    cleaned_name = payload.name.strip()
    normalized_email = str(payload.email)

    existing_user = repo.get_by_email(normalized_email)
    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    updated_user = repo.update_profile(
        current_user.id,
        name=cleaned_name,
        email=normalized_email,
    )
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
        role=UserRole(updated_user.role),
        is_active=updated_user.is_active,
    )


@app.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_current_user_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    repo = UserRepository(db)
    updated_user = repo.update_password(
        current_user.id,
        hashed_password=hash_password(payload.new_password),
    )
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
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
        role=UserRole(updated_user.role),
        is_active=updated_user.is_active,
    )


# ---------- Admin Users ----------

def _admin_user_response(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=UserRole(user.role),
        is_active=user.is_active,
    )


@app.get("/admin/users", response_model=list[AdminUserResponse])
def list_admin_users(
    _: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    return [_admin_user_response(user) for user in UserRepository(db).list_all()]


@app.patch("/admin/users/{user_id}/role", response_model=AdminUserResponse)
def update_admin_user_role(
    user_id: int,
    payload: AdminUserRoleUpdateRequest,
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    if user_id == current_user.id and payload.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admins cannot remove their own super admin role.",
        )

    updated_user = UserRepository(db).update_role(user_id, payload.role)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _admin_user_response(updated_user)


@app.patch("/admin/users/{user_id}/status", response_model=AdminUserResponse)
def update_admin_user_status(
    user_id: int,
    payload: AdminUserStatusUpdateRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    if user_id == current_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot deactivate their own account.",
        )

    repo = UserRepository(db)
    target_user = repo.get_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target_user.role == UserRole.SUPER_ADMIN.value and current_user.role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can modify super admin accounts.",
        )

    updated_user = repo.set_active(user_id, payload.is_active)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _admin_user_response(updated_user)


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
    start_date: date | None = None
    end_date: date | None = None
    travelers: int = 1
    budget: int | None = None


class BudgetOptimizerRequest(BaseModel):
    destination: str
    budget: int


@app.post("/generate-itinerary", response_model=ItineraryResponse)
async def create_itinerary(
    payload: ItineraryRequest,
    current_user: User = Depends(get_current_user),
) -> ItineraryResponse:
    try:
        return await generate_itinerary(
            destination=payload.destination,
            days=payload.num_days,
            start_date=payload.start_date,
            end_date=payload.end_date,
            travelers=payload.travelers,
            budget=payload.budget,
            user_interests=current_user.interests or [],
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


@app.post("/itinerary/regenerate-activity", response_model=RegenerateActivityResponse)
async def regenerate_activity(
    payload: RegenerateActivityRequest,
    _: User = Depends(get_current_user),
) -> RegenerateActivityResponse:
    try:
        activity = await regenerate_single_activity(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return RegenerateActivityResponse(activity=activity)


@app.post("/trips/save", response_model=TripDetailsResponse, status_code=status.HTTP_201_CREATED)
def save_trip(payload: SaveTripRequest, db: Session = Depends(get_db)) -> TripDetailsResponse:
    repo = TripRepository(db)

    if repo.exists_by_details(payload.destination, payload.startDate, payload.endDate):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This trip has already been saved.",
        )

    # Determine status based on end date if not provided
    trip_status = payload.status or (TripStatus.PAST if payload.endDate < date.today() else TripStatus.UPCOMING)

    trip = repo.create(
        destination=payload.destination,
        start_date=payload.startDate,
        end_date=payload.endDate,
        duration_days=payload.duration_days(),
        summary=payload.summary,
        itinerary=payload.itinerary.model_dump(),
        status=trip_status,
    )

    return TripDetailsResponse.from_orm(trip)


@app.get("/trips/saved", response_model=list[TripListResponse])
def list_saved_trips(db: Session = Depends(get_db)) -> list[TripListResponse]:
    repo = TripRepository(db)
    trips = repo.get_all()
    return [TripListResponse.from_orm(trip) for trip in trips]


@app.get("/trips/{trip_id}", response_model=TripDetailsResponse)
def get_saved_trip(trip_id: int, db: Session = Depends(get_db)) -> TripDetailsResponse:
    repo = TripRepository(db)
    trip = repo.get_by_id(trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved trip not found.")
    return TripDetailsResponse.from_orm(trip)


# ---------- Saved Trips Library ----------

@app.post("/saved-trips", response_model=SavedTripResponse, status_code=status.HTTP_201_CREATED)
def create_saved_trip(
    payload: SaveGeneratedTripRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedTripResponse:
    repo = SavedTripRepository(db)
    saved_trip = repo.create(
        user_id=current_user.id,
        name=payload.name,
        trip_data=payload.trip_data,
    )
    return SavedTripResponse.model_validate(saved_trip)


@app.get("/saved-trips", response_model=list[SavedTripResponse])
def list_user_saved_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SavedTripResponse]:
    repo = SavedTripRepository(db)
    return [SavedTripResponse.model_validate(trip) for trip in repo.list_for_user(current_user.id)]


@app.get("/saved-trips/{trip_id}", response_model=SavedTripResponse)
def read_user_saved_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedTripResponse:
    repo = SavedTripRepository(db)
    saved_trip = repo.get_for_user(trip_id, current_user.id)
    if not saved_trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved trip not found.")
    return SavedTripResponse.model_validate(saved_trip)


@app.patch("/saved-trips/{trip_id}", response_model=SavedTripResponse)
def rename_user_saved_trip(
    trip_id: int,
    payload: RenameSavedTripRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedTripResponse:
    repo = SavedTripRepository(db)
    saved_trip = repo.rename(trip_id, current_user.id, payload.name)
    if not saved_trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved trip not found.")
    return SavedTripResponse.model_validate(saved_trip)


@app.delete("/saved-trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_saved_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    repo = SavedTripRepository(db)
    if not repo.delete(trip_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved trip not found.")


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
