"""
Authentication (JWT + passlib)

Developer: Aditi Devlekar
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "240"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# bcrypt only uses the first 72 BYTES of the password
_BCRYPT_MAX_LEN_BYTES = 72


def _bcrypt_safe_password(password: str) -> str:
    """
    Ensure password is safe for bcrypt:
    - bcrypt has a 72-byte limit (NOT 72 characters)
    - truncate by UTF-8 bytes and decode safely
    """
    s = password or ""
    b = s.encode("utf-8")
    if len(b) <= _BCRYPT_MAX_LEN_BYTES:
        return s
    return b[:_BCRYPT_MAX_LEN_BYTES].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    pw = _bcrypt_safe_password(password)
    return pwd_context.hash(pw)


def verify_password(password: str, password_hash: str) -> bool:
    pw = _bcrypt_safe_password(password)
    return pwd_context.verify(pw, password_hash)


def create_access_token(*, sub: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta else timedelta(minutes=JWT_EXPIRE_MINUTES))
    payload = {"sub": sub, "role": role, "iat": int(now.timestamp()), "exp": int(expire.timestamp())}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.username == username, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(required_role: str) -> Callable:
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role != required_role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed for this role")
        return user

    return _dep