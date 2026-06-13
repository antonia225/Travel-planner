from enum import Enum
from sqlalchemy import Boolean, Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, String, Text, inspect, text
from sqlalchemy.orm import DeclarativeBase, relationship

from database import DatabaseSingleton


class Base(DeclarativeBase):
    pass


class UserInterestCategory(str, Enum):
    """User interest categories for travel personalization"""
    ADVENTURE = "adventure"
    CULTURAL = "cultural"
    CULINARY = "culinary"
    NATURE = "nature"
    WELLNESS = "wellness"
    NIGHTLIFE = "nightlife"
    SHOPPING = "shopping"
    FAMILY = "family"
    LUXURY = "luxury"
    SPIRITUAL = "spiritual"
    PHOTOGRAPHY = "photography"
    BUDGET = "budget"


class TripStatus(str, Enum):
    UPCOMING = "upcoming"
    PAST = "past"


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class AIGenerationStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    interests = Column(JSON, nullable=False, default=list)
    role = Column(String, nullable=False, default=UserRole.USER.value)
    is_active = Column(Boolean, nullable=False, default=True)

    interest_records = relationship("UserInterest", back_populates="user", cascade="all, delete-orphan")
    saved_trips = relationship("SavedTrip", back_populates="user", cascade="all, delete-orphan")


class UserInterest(Base):
    __tablename__ = "user_interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String, nullable=False)

    user = relationship("User", back_populates="interest_records")


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    destination = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False)
    summary = Column(Text, nullable=False)
    itinerary_json = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    status = Column(SQLEnum(TripStatus), nullable=False)

    @property
    def itinerary(self) -> dict:
        import json

        return json.loads(self.itinerary_json)


class SavedTrip(Base):
    __tablename__ = "saved_trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    trip_data_json = Column("trip_data", Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="saved_trips")

    @property
    def trip_data(self) -> dict:
        import json

        return json.loads(self.trip_data_json)


class AIGenerationLog(Base):
    __tablename__ = "ai_generation_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String, nullable=False, index=True)
    operation = Column(String, nullable=False, index=True)
    model = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    status = Column(String, nullable=False, index=True)
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    fallback_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, index=True)


def create_all_tables() -> None:
    engine = DatabaseSingleton().get_engine()
    Base.metadata.create_all(bind=engine)
    _ensure_user_rbac_columns()


def _ensure_user_rbac_columns() -> None:
    engine = DatabaseSingleton().get_engine()
    inspector = inspect(engine)
    if not inspector.has_table("users"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    statements: list[str] = []

    if "role" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'user'")
    if "is_active" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
