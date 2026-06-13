from dataclasses import dataclass

from sqlalchemy.orm import Session

from database import DatabaseSingleton
from models import UserRole
from repositories.user_repository import UserRepository
from services.auth_service import hash_password


@dataclass(frozen=True)
class DemoUser:
    name: str
    email: str
    password: str
    role: UserRole


DEMO_USERS: tuple[DemoUser, ...] = (
    DemoUser(
        name="Elena Super Admin",
        email="elena.super.admin@example.com",
        password="ElenaSuperAdmin1",
        role=UserRole.SUPER_ADMIN,
    ),
    DemoUser(
        name="Andrei Admin",
        email="andrei.admin@example.com",
        password="AndreiAdmin1",
        role=UserRole.ADMIN,
    ),
    DemoUser(
        name="Maria Admin",
        email="maria.admin@example.com",
        password="MariaAdmin1",
        role=UserRole.ADMIN,
    ),
    DemoUser(
        name="Emma Ionescu",
        email="emma.ionescu@example.com",
        password="EmmaUser1",
        role=UserRole.USER,
    ),
    DemoUser(
        name="Alex Popescu",
        email="alex.popescu@example.com",
        password="AlexUser1",
        role=UserRole.USER,
    ),
    DemoUser(
        name="Sofia Marin",
        email="sofia.marin@example.com",
        password="SofiaUser1",
        role=UserRole.USER,
    ),
    DemoUser(
        name="David Georgescu",
        email="david.georgescu@example.com",
        password="DavidUser1",
        role=UserRole.USER,
    ),
)


def seed_demo_users(db: Session | None = None) -> None:
    if db is None:
        session = DatabaseSingleton().get_session()
        should_close = True
    else:
        session = db
        should_close = False

    try:
        repo = UserRepository(session)
        for demo_user in DEMO_USERS:
            existing_user = repo.get_by_email(demo_user.email)
            hashed_password = hash_password(demo_user.password)

            if existing_user:
                existing_user.name = demo_user.name
                existing_user.hashed_password = hashed_password
                existing_user.role = demo_user.role.value
                existing_user.is_active = True
                continue

            repo.create(
                email=demo_user.email,
                hashed_password=hashed_password,
                name=demo_user.name,
                role=demo_user.role,
            )

        session.commit()
    finally:
        if should_close:
            session.close()
