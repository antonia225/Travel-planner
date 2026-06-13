from collections import Counter

from models import User, UserRole
from seed_users import DEMO_USERS, seed_demo_users
from services.auth_service import hash_password, verify_password
from tests.conftest import _TestingSessionLocal


def _demo_user_by_email(email: str):
    return next(user for user in DEMO_USERS if user.email == email)


def test_seed_demo_users_creates_expected_accounts():
    db = _TestingSessionLocal()
    try:
        seed_demo_users(db)

        users = db.query(User).order_by(User.email.asc()).all()

        assert len(users) == len(DEMO_USERS)
        assert {user.email for user in users} == {demo_user.email for demo_user in DEMO_USERS}
        assert all(user.is_active for user in users)

        role_counts = Counter(user.role for user in users)
        assert role_counts[UserRole.SUPER_ADMIN.value] == 1
        assert role_counts[UserRole.ADMIN.value] == 2
        assert role_counts[UserRole.USER.value] == 4

        for user in users:
            demo_user = _demo_user_by_email(user.email)
            assert user.name == demo_user.name
            assert user.role == demo_user.role.value
            assert verify_password(demo_user.password, user.hashed_password)
    finally:
        db.close()


def test_seed_demo_users_is_idempotent():
    db = _TestingSessionLocal()
    try:
        seed_demo_users(db)
        seed_demo_users(db)

        users = db.query(User).all()

        assert len(users) == len(DEMO_USERS)
        assert {user.email for user in users} == {demo_user.email for demo_user in DEMO_USERS}
    finally:
        db.close()


def test_seed_demo_users_normalizes_existing_seeded_account():
    db = _TestingSessionLocal()
    try:
        seed_demo_users(db)
        demo_user = DEMO_USERS[0]
        existing_user = db.query(User).filter(User.email == demo_user.email).one()
        existing_user.name = "Wrong Name"
        existing_user.hashed_password = hash_password("WrongPassword1")
        existing_user.role = UserRole.USER.value
        existing_user.is_active = False
        db.commit()

        seed_demo_users(db)
        normalized_user = db.query(User).filter(User.email == demo_user.email).one()

        assert normalized_user.name == demo_user.name
        assert normalized_user.role == demo_user.role.value
        assert normalized_user.is_active is True
        assert verify_password(demo_user.password, normalized_user.hashed_password)
    finally:
        db.close()
