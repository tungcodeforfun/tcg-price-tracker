"""Authentication endpoints."""

import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
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
from tcgtracker.api.schemas import Token, TokenRefresh, UserCreate, UserResponse
from tcgtracker.config import get_settings
from tcgtracker.database.models import User

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# In-memory token blacklist: {token_hash: expiry_timestamp}
# For production, replace with Redis for multi-process support
_token_blacklist: dict[str, float] = {}
_BLACKLIST_MAX_SIZE = 10000


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def blacklist_token(token: str, expires_at: float) -> None:
    """Add a token to the blacklist."""
    _cleanup_blacklist()
    _token_blacklist[_hash_token(token)] = expires_at


def is_token_blacklisted(token: str) -> bool:
    """Check if a token has been blacklisted."""
    _cleanup_blacklist()
    return _hash_token(token) in _token_blacklist


def _cleanup_blacklist() -> None:
    """Remove expired tokens from the blacklist."""
    now = datetime.now(timezone.utc).timestamp()
    expired = [h for h, exp in _token_blacklist.items() if exp < now]
    for h in expired:
        del _token_blacklist[h]


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("3/minute")
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
    verify_token = jwt.encode(
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


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_session),
) -> Token:
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

    return Token(
        access_token=access_token, refresh_token=refresh_token, token_type="bearer"
    )


@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")
async def refresh_token(
    request: Request,
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_session),
) -> Token:
    """Refresh access token using refresh token."""
    try:
        payload = jwt.decode(
            token_data.refresh_token,
            settings.security.secret_key,
            algorithms=[settings.security.algorithm],
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
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Check if refresh token was blacklisted
    if is_token_blacklisted(token_data.refresh_token):
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
    blacklist_token(token_data.refresh_token, float(exp))

    # Create new tokens
    access_token_expires = timedelta(
        minutes=settings.security.access_token_expire_minutes
    )
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return Token(
        access_token=access_token, refresh_token=new_refresh_token, token_type="bearer"
    )


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
            options={"verify_exp": True},
        )

        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "email_verify":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token",
            )
    except JWTError:
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
    token: Annotated[str, Depends(oauth2_scheme)],
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Logout by blacklisting the current access token."""
    # Decode token to get expiry
    payload = jwt.decode(
        token,
        settings.security.secret_key,
        algorithms=[settings.security.algorithm],
        options={"verify_exp": True},
    )
    exp = payload.get("exp", 0)

    blacklist_token(token, float(exp))

    return JSONResponse(content={"message": "Logged out successfully"}, status_code=200)
