import bcrypt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models import create_all_tables
from repositories.user_repository import UserRepository

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
    email: EmailStr
    password: str


class RegisterResponse(BaseModel):
    id: int
    email: str


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

    hashed = _hash_password(payload.password)
    user = repo.create(email=payload.email, hashed_password=hashed)
    return RegisterResponse(id=user.id, email=user.email)
