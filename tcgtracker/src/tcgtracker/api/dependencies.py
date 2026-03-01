"""API dependencies and common utilities."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from tcgtracker.config import get_settings
from tcgtracker.database.connection import get_session as _get_session
from tcgtracker.database.models import User

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _get_token_from_request(
    token: Optional[str], request: Request
) -> str:
    """Extract token from Authorization header or access_token cookie."""
    if token:
        return token
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


# Create a global password context to avoid recreation on every call
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def get_session():
    """Dependency to get database session."""
    async with _get_session() as session:
        yield session


async def get_current_user(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme)] = None,
    db: AsyncSession = Depends(get_session),
) -> User:
    """Get current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    resolved_token = _get_token_from_request(token, request)

    # Check if token has been blacklisted (logout)
    from tcgtracker.api.v1.auth import is_token_blacklisted

    if await is_token_blacklisted(resolved_token):
        raise credentials_exception

    try:
        payload = jwt.decode(
            resolved_token,
            settings.security.secret_key,
            algorithms=[settings.security.algorithm],
            options={"require": ["exp", "iat", "sub", "type"]},
        )

        # Validate required claims
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        # Validate token type is access
        if payload.get("type") != "access":
            raise credentials_exception

    except PyJWTError:
        raise credentials_exception
    except HTTPException:
        raise
    except Exception:
        raise credentials_exception

    # Validate user_id is a valid integer
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id_int))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to be an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(
            minutes=settings.security.access_token_expire_minutes
        )
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode, settings.security.secret_key, algorithm=settings.security.algorithm
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(
        days=settings.security.refresh_token_expire_days
    )
    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode, settings.security.secret_key, algorithm=settings.security.algorithm
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash password."""
    return pwd_context.hash(password)
