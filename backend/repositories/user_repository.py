from typing import Optional

from sqlalchemy.orm import Session

from models import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_email(self, email: str) -> Optional[User]:
        return self._db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self._db.query(User).filter(User.id == user_id).first()

    def create(
        self,
        email: str,
        hashed_password: str,
        name: str,
        interests: list[str] | None = None,
    ) -> User:
        user = User(
            email=email,
            hashed_password=hashed_password,
            name=name,
            interests=interests or [],
        )
        self._db.add(user)
        self._db.commit()
        self._db.refresh(user)
        return user

    def update_interests(self, user_id: int, interests: list[str]) -> Optional[User]:
        """Update user's interests and return updated user."""
        user = self.get_by_id(user_id)
        if user:
            user.interests = interests
            self._db.commit()
            self._db.refresh(user)
        return user

    def update_profile(self, user_id: int, name: str, email: str) -> Optional[User]:
        user = self.get_by_id(user_id)
        if user:
            user.name = name
            user.email = email
            self._db.commit()
            self._db.refresh(user)
        return user

    def update_password(self, user_id: int, hashed_password: str) -> Optional[User]:
        user = self.get_by_id(user_id)
        if user:
            user.hashed_password = hashed_password
            self._db.commit()
            self._db.refresh(user)
        return user
