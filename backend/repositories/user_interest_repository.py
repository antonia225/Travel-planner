from typing import Optional

from sqlalchemy.orm import Session

from models import UserInterest, UserInterestCategory


class UserInterestRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add_interest(self, user_id: int, category: UserInterestCategory) -> UserInterest:
        """Add a single interest category for a user"""
        interest = UserInterest(user_id=user_id, category=category)
        self._db.add(interest)
        self._db.commit()
        self._db.refresh(interest)
        return interest

    def add_interests(self, user_id: int, categories: list[UserInterestCategory]) -> list[UserInterest]:
        """Add multiple interest categories for a user"""
        interests = [UserInterest(user_id=user_id, category=cat) for cat in categories]
        self._db.add_all(interests)
        self._db.commit()
        for interest in interests:
            self._db.refresh(interest)
        return interests

    def get_by_user_id(self, user_id: int) -> list[UserInterest]:
        """Get all interests for a specific user"""
        return self._db.query(UserInterest).filter(UserInterest.user_id == user_id).all()

    def get_categories_by_user_id(self, user_id: int) -> list[UserInterestCategory]:
        """Get just the category enums for a user"""
        interests = self.get_by_user_id(user_id)
        return [interest.category for interest in interests]

    def delete_interest(self, interest_id: int) -> bool:
        """Delete a specific interest"""
        interest = self._db.query(UserInterest).filter(UserInterest.id == interest_id).first()
        if interest:
            self._db.delete(interest)
            self._db.commit()
            return True
        return False

    def delete_interests_by_user(self, user_id: int) -> int:
        """Delete all interests for a user. Returns count of deleted records"""
        count = self._db.query(UserInterest).filter(UserInterest.user_id == user_id).delete()
        self._db.commit()
        return count

    def delete_interest_by_category(self, user_id: int, category: UserInterestCategory) -> bool:
        """Delete a specific category interest for a user"""
        interest = self._db.query(UserInterest).filter(
            UserInterest.user_id == user_id,
            UserInterest.category == category
        ).first()
        if interest:
            self._db.delete(interest)
            self._db.commit()
            return True
        return False

    def has_interest(self, user_id: int, category: UserInterestCategory) -> bool:
        """Check if a user has a specific interest"""
        return self._db.query(UserInterest).filter(
            UserInterest.user_id == user_id,
            UserInterest.category == category
        ).first() is not None
