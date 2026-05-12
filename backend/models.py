from enum import Enum

from sqlalchemy import Column, ForeignKey, Integer, String, JSON
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
    interests = Column(JSON, nullable=False, default=list)

    interest_records = relationship("UserInterest", back_populates="user", cascade="all, delete-orphan")


class UserInterest(Base):
    __tablename__ = "user_interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String, nullable=False)

    user = relationship("User", back_populates="interest_records")


def create_all_tables() -> None:
    engine = DatabaseSingleton().get_engine()
    Base.metadata.create_all(bind=engine)
