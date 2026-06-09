import re

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from schemas.interests import InterestCategory


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    interests: Optional[list[InterestCategory]] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        errors: list[str] = []

        if len(value) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", value):
            errors.append("one uppercase letter (A–Z)")
        if not re.search(r"[a-z]", value):
            errors.append("one lowercase letter (a–z)")
        if not re.search(r"[0-9]", value):
            errors.append("one number (0–9)")

        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))

        return value


class RegisterResponse(BaseModel):
    id: int
    name: str
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UpdateProfileRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty.")
        return cleaned


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return RegisterRequest.validate_password_strength(value)


class UserProfile(BaseModel):
    id: int
    name: str
    email: EmailStr
    interests: list[str] = Field(default_factory=list)
