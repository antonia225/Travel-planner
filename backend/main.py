from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies.auth import get_current_user
from models import User, create_all_tables
from repositories.user_repository import UserRepository
from schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserProfile,
)
from schemas.itinerary import ItineraryResponse
from services.architect_service import generate_itinerary
from services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)

app = FastAPI(title="AI Travel Planner API")

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


@app.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    repo = UserRepository(db)

    if repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    hashed = hash_password(payload.password)
    user = repo.create(email=payload.email, hashed_password=hashed, name=payload.name)
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
    return UserProfile(id=current_user.id, name=current_user.name, email=current_user.email)


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
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
