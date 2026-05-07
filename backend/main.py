import bcrypt
import re
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from services.ai_service import check_ollama_connection
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models import create_all_tables, UserInterestCategory
from repositories.user_repository import UserRepository
from repositories.user_interest_repository import UserInterestRepository
from schemas.itinerary import ItineraryResponse
from services.architect_service import generate_itinerary

app = FastAPI(title="AI Travel Planner API")

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
