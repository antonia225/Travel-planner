from enum import Enum
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String, Enum as SQLEnum, func
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Relationships
    interests = relationship("UserInterest", back_populates="user", cascade="all, delete-orphan")
    saved_trips = relationship("SavedTrip", back_populates="user", cascade="all, delete-orphan")


class UserInterest(Base):
    __tablename__ = "user_interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(SQLEnum(UserInterestCategory), nullable=False)

    # Relationships
    user = relationship("User", back_populates="interests")


class SavedTrip(Base):
    __tablename__ = "saved_trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False)
    itinerary_data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="saved_trips")


def create_all_tables() -> None:
    engine = DatabaseSingleton().get_engine()
    Base.metadata.create_all(bind=engine)
