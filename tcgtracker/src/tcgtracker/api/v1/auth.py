"""Authentication endpoints."""

import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
from jwt.exceptions import PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from tcgtracker.api.dependencies import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    get_session,
    verify_password,
)
from tcgtracker.api.rate_limit import limiter
from tcgtracker.api.schemas import TokenRefresh, UserCreate, UserResponse
from tcgtracker.config import get_settings
from tcgtracker.database.models import User

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_COOKIE_SECURE = settings.app.environment == "production"
_COOKIE_SAMESITE: str = "lax"


def _set_token_cookies(response: JSONResponse, access_token: str, refresh_token: str) -> None:
    """Set httpOnly cookies for access and refresh tokens."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.security.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.security.refresh_token_expire_days * 86400,
        path="/api/v1/auth",
    )


def _clear_token_cookies(response: JSONResponse) -> None:
    """Remove token cookies."""
    response.delete_cookie(
        key="access_token", path="/",
        secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key="refresh_token", path="/api/v1/auth",
        secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
    )


_BLACKLIST_PREFIX = "token_blacklist:"

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis.url, decode_responses=True
        )
    return _redis_client


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def blacklist_token(token: str, expires_at: float) -> None:
    """Add a token to the Redis blacklist with auto-expiry."""
    ttl = int(expires_at - datetime.now(timezone.utc).timestamp())
    if ttl <= 0:
        return
    try:
        await _get_redis().setex(f"{_BLACKLIST_PREFIX}{_hash_token(token)}", ttl, "1")
    except aioredis.RedisError:
        logger.warning("Failed to blacklist token — Redis unavailable")


async def is_token_blacklisted(token: str) -> bool:
    """Check if a token has been blacklisted."""
    try:
        return await _get_redis().exists(f"{_BLACKLIST_PREFIX}{_hash_token(token)}") > 0
    except aioredis.RedisError:
        logger.warning("Failed to check token blacklist — Redis unavailable")
        return False


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("30/minute" if settings.app.environment != "production" else "3/minute")
async def register(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_session),
) -> User:
    """Register a new user."""
    # Check if user already exists
    result = await db.execute(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    )
    existing_user = result.scalars().first()

    if existing_user:
        if existing_user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
            )

    # Create new user
    hashed_password = await asyncio.to_thread(get_password_hash, user_data.password)

    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_password,
        is_active=True,
        email_verified=False,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate email verification JWT
    verify_payload = {
        "sub": str(new_user.id),
        "type": "email_verify",
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    jwt.encode(
        verify_payload,
        settings.security.secret_key,
        algorithm=settings.security.algorithm,
    )
    # TODO: Send verification email once email service is configured
    logger.info(
        "Email verification token generated for user %s",
        new_user.username,
    )

    return new_user


@router.post("/login")
@limiter.limit("30/minute" if settings.app.environment != "production" else "5/minute")
async def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Login and receive access tokens."""
    # Find user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == form_data.username) | (User.email == form_data.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not await asyncio.to_thread(
        verify_password, form_data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )

    # Create tokens
    access_token_expires = timedelta(
        minutes=settings.security.access_token_expire_minutes
    )
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    response = JSONResponse(
        content={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    )
    _set_token_cookies(response, access_token, refresh_token)
    return response


@router.post("/refresh")
@limiter.limit("60/minute" if settings.app.environment != "production" else "10/minute")
async def refresh_token(
    request: Request,
    token_data: TokenRefresh | None = None,
    db: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Refresh access token using refresh token."""
    raw_refresh = (token_data.refresh_token if token_data else None) or request.cookies.get("refresh_token")
    if not raw_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token provided"
        )

    try:
        payload = jwt.decode(
            raw_refresh,
            settings.security.secret_key,
            algorithms=[settings.security.algorithm],
            options={"require": ["exp", "iat", "sub", "type"]},
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
            )

        # Validate token type is refresh
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
            )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Check if refresh token was blacklisted
    if await is_token_blacklisted(raw_refresh):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    # Verify user exists and is active
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    result = await db.execute(select(User).where(User.id == user_id_int))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Blacklist old refresh token
    exp = payload.get("exp", 0)
    await blacklist_token(raw_refresh, float(exp))

    # Create new tokens
    access_token_expires = timedelta(
        minutes=settings.security.access_token_expire_minutes
    )
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    response = JSONResponse(
        content={
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }
    )
    _set_token_cookies(response, access_token, new_refresh_token)
    return response


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_session),
) -> JSONResponse:
    """Verify a user's email address using a verification token."""
    try:
        payload = jwt.decode(
            token,
            settings.security.secret_key,
            algorithms=[settings.security.algorithm],
            options={"require": ["exp", "iat", "sub", "type"]},
        )

        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "email_verify":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token",
            )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token",
        )

    result = await db.execute(select(User).where(User.id == user_id_int))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.email_verified:
        return JSONResponse(content={"message": "Email already verified"}, status_code=200)

    user.email_verified = True
    await db.commit()

    return JSONResponse(content={"message": "Email verified successfully"}, status_code=200)


@router.post("/logout")
async def logout(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Logout by blacklisting the current access token."""
    from tcgtracker.api.dependencies import _get_token_from_request

    resolved_token = _get_token_from_request(token, request)
    # Token already validated by get_current_user; decode without verification to extract exp
    payload = jwt.decode(
        resolved_token,
        settings.security.secret_key,
        algorithms=[settings.security.algorithm],
        options={"verify_exp": False},
    )
    exp = payload.get("exp", 0)

    await blacklist_token(resolved_token, float(exp))

    response = JSONResponse(content={"message": "Logged out successfully"}, status_code=200)
    _clear_token_cookies(response)
    return response
