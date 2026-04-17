import os
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()


def _to_sqlalchemy_sqlite_url(raw_value: str) -> str:
    if raw_value.startswith("sqlite:///"):
        return raw_value
    return f"sqlite:///{raw_value}"


class DatabaseSingleton:
    _instance: Optional["DatabaseSingleton"] = None

    def __new__(cls) -> "DatabaseSingleton":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            db_url = _to_sqlalchemy_sqlite_url(os.getenv("DATABASE_URL", "./travel.db"))
            cls._instance._engine = create_engine(
                db_url,
                connect_args={"check_same_thread": False},
                future=True,
            )
            cls._instance._session_factory = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=cls._instance._engine,
            )
        return cls._instance

    def get_engine(self) -> Engine:
        return self._engine

    def get_session(self) -> Session:
        return self._session_factory()


_db_singleton = DatabaseSingleton()


def get_db() -> Session:
    session = _db_singleton.get_session()
    try:
        yield session
    finally:
        session.close()
