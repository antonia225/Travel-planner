from enum import Enum
from sqlalchemy import Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, String, Text
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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    interests = Column(JSON, nullable=False, default=list)

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


def create_all_tables() -> None:
    engine = DatabaseSingleton().get_engine()
    Base.metadata.create_all(bind=engine)
