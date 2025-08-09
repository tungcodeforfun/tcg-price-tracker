"""User management endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from tcgtracker.api.dependencies import get_current_active_user, get_password_hash
from tcgtracker.api.schemas import (
    PriceAlertCreate,
    PriceAlertResponse,
    UserResponse,
    UserUpdate,
)
from tcgtracker.database.connection import get_session
from tcgtracker.database.models import Card, UserAlert, User

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current user's profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Update current user's profile."""
    # Check if email/username already taken
    if user_update.email and user_update.email != current_user.email:
        result = await db.execute(select(User).where(User.email == user_update.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    if user_update.username and user_update.username != current_user.username:
        result = await db.execute(
            select(User).where(User.username == user_update.username)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
            )

    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.post(
    "/alerts", response_model=PriceAlertResponse, status_code=status.HTTP_201_CREATED
)
async def create_price_alert(
    alert_data: PriceAlertCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> UserAlert:
    """Create a price alert for a card."""
    # Verify card exists
    result = await db.execute(select(Card).where(Card.id == alert_data.card_id))
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )

    # Check if similar alert already exists
    from sqlalchemy import and_

    existing_query = select(UserAlert).where(
        and_(
            UserAlert.user_id == current_user.id,
            UserAlert.card_id == alert_data.card_id,
            UserAlert.alert_type == alert_data.alert_type,
            UserAlert.is_active == True,
        )
    )
    result = await db.execute(existing_query)
    existing_alert = result.scalar_one_or_none()

    if existing_alert:
        # Update existing alert
        existing_alert.target_price = alert_data.target_price
        await db.commit()
        await db.refresh(existing_alert, ["card"])
        return existing_alert

    # Create new alert
    new_alert = PriceAlert(user_id=current_user.id, **alert_data.model_dump())
    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert, ["card"])

    return new_alert


@router.get("/alerts", response_model=List[PriceAlertResponse])
async def get_price_alerts(
    active_only: bool = True,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> List[UserAlert]:
    """Get user's price alerts."""
    from sqlalchemy.orm import selectinload

    query = (
        select(UserAlert)
        .options(selectinload(UserAlert.card))
        .where(UserAlert.user_id == current_user.id)
    )

    if active_only:
        query = query.where(UserAlert.is_active == True)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return alerts


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_price_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a price alert."""
    from sqlalchemy import and_

    result = await db.execute(
        select(UserAlert).where(
            and_(
                UserAlert.id == alert_id,
                UserAlert.user_id == current_user.id,
            )
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        )

    await db.delete(alert)
    await db.commit()


@router.put("/alerts/{alert_id}/toggle", response_model=PriceAlertResponse)
async def toggle_price_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> UserAlert:
    """Toggle a price alert active/inactive."""
    from sqlalchemy import and_

    result = await db.execute(
        select(UserAlert).where(
            and_(
                UserAlert.id == alert_id,
                UserAlert.user_id == current_user.id,
            )
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found"
        )

    alert.is_active = not alert.is_active
    await db.commit()
    await db.refresh(alert, ["card"])

    return alert


@router.get("/stats", response_model=dict)
async def get_user_stats(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get user statistics."""
    from sqlalchemy import func
    from tcgtracker.database.models import Card

    # Get collection stats
    collection_query = select(
        func.count(Card.id).label("total_items"),
        func.sum(Card.quantity).label("total_cards"),
    ).where(Card.user_id == current_user.id)

    result = await db.execute(collection_query)
    collection_stats = result.one()

    # Get alert stats
    alert_query = select(
        func.count(UserAlert.id).label("total_alerts"),
        func.sum(func.cast(UserAlert.is_active, int)).label("active_alerts"),
    ).where(UserAlert.user_id == current_user.id)

    result = await db.execute(alert_query)
    alert_stats = result.one()

    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "joined": current_user.created_at.isoformat(),
        },
        "collection": {
            "total_items": collection_stats.total_items or 0,
            "total_cards": collection_stats.total_cards or 0,
        },
        "alerts": {
            "total": alert_stats.total_alerts or 0,
            "active": alert_stats.active_alerts or 0,
        },
    }
