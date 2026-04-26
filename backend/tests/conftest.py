"""
Pytest configuration for backend tests.

Sets up an isolated in-memory SQLite database so the real travel.db is
never touched during the test run.  The DATABASE_URL env-var must be set
*before* any project module is imported, which is why it lives at the top
of this file (conftest.py is always executed first by pytest).
"""
import os

# Must precede all project imports so DatabaseSingleton picks up :memory:
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Project imports (order matters – database before models before main)
from database import get_db
from main import app
from models import Base

# ---------------------------------------------------------------------------
# Test engine – StaticPool keeps a single connection so that the in-memory
# database is shared across all sessions within the same test run.
# ---------------------------------------------------------------------------
_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_database():
    """Drop and recreate all tables before every test for full isolation."""
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def client() -> TestClient:
    """Return a synchronous TestClient wired to the test database."""
    return TestClient(app)
