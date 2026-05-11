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

    def create(self, email: str, hashed_password: str, name: str) -> User:
        user = User(email=email, hashed_password=hashed_password, name=name)
        self._db.add(user)
        self._db.commit()
        self._db.refresh(user)
        return user

    def update(self, user: User, name: Optional[str] = None, email: Optional[str] = None) -> User:
        if name is not None:
            user.name = name

        if email is not None:
            user.email = email

        self._db.commit()
        self._db.refresh(user)
        return user