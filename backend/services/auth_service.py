import os
from datetime import datetime, timedelta
from typing import Any

import bcrypt
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_SECONDS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_SECONDS", "3600"))


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict[str, Any], expires_seconds: int | None = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(seconds=expires_seconds or JWT_ACCESS_TOKEN_EXPIRE_SECONDS)
    payload.update({"exp": expire})
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError as exc:
        raise ValueError("Token has expired.") from exc
    except InvalidTokenError as exc:
        raise ValueError("Invalid token.") from exc
