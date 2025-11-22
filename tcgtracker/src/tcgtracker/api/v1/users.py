"""User management endpoints."""

from typing import List, cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from tcgtracker.api.dependencies import (
    get_current_active_user,
    get_password_hash,
    get_session,
)
from tcgtracker.api.schemas import (
    PasswordChange,
    PriceAlertCreate,
    PriceAlertResponse,
    UserResponse,
    UserUpdate,
)
from tcgtracker.database.models import Card, CollectionItem, User, UserAlert

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current user's profile."""
    return current_user


def _convert_alert_schema_to_model_data(
    alert_data: PriceAlertCreate, user_id: int
) -> dict:
    """Convert PriceAlertCreate schema to UserAlert model data."""
    from tcgtracker.utils.enum_mappings import map_alert_type_to_db

    try:
        alert_type_enum, comparison_op = map_alert_type_to_db(alert_data.alert_type)
    except KeyError:
        raise ValueError(
            f"Invalid alert_type: {alert_data.alert_type}. Must be 'above' or 'below'"
        )

    return {
        "user_id": user_id,
        "card_id": alert_data.card_id,
        "price_threshold": alert_data.target_price,
        "alert_type": alert_type_enum,
        "comparison_operator": comparison_op,
        "is_active": alert_data.is_active,
    }


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

    # Update fields - password is not included in UserUpdate schema
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.put("/me/password", response_model=UserResponse)
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_session),
) -> User:
    """Change user password."""
    from tcgtracker.api.dependencies import verify_password

    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect current password"
        )

    # Update password
    current_user.password_hash = get_password_hash(password_data.new_password)
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

    # Convert alert_type string to enum for comparison
    converted_data = _convert_alert_schema_to_model_data(alert_data, current_user.id)

    existing_query = select(UserAlert).where(
        and_(
            UserAlert.user_id == current_user.id,
            UserAlert.card_id == alert_data.card_id,
            UserAlert.alert_type == converted_data["alert_type"],
            UserAlert.is_active,  # Fixed E712: comparison to True should be `is True` or `is not False`
        )
    )
    result = await db.execute(existing_query)
    existing_alert = cast(UserAlert | None, result.scalar_one_or_none())

    if existing_alert:
        # Update existing alert with proper field mapping
        model_data = _convert_alert_schema_to_model_data(alert_data, current_user.id)
        existing_alert.price_threshold = model_data["price_threshold"]
        existing_alert.alert_type = model_data["alert_type"]
        existing_alert.comparison_operator = model_data["comparison_operator"]
        existing_alert.is_active = model_data["is_active"]
        await db.commit()
        await db.refresh(existing_alert, ["card"])
        return existing_alert

    # Create new alert with proper field mapping
    model_data = _convert_alert_schema_to_model_data(alert_data, current_user.id)
    new_alert = UserAlert(**model_data)
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
        query = query.where(UserAlert.is_active)

    result_alerts = await db.execute(query)
    alerts = cast(List[UserAlert], result_alerts.scalars().all())

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
    from sqlalchemy import Integer, func

    # Get collection stats
    collection_query = select(
        func.count(CollectionItem.id).label("total_items"),
        func.sum(CollectionItem.quantity).label("total_cards"),
    ).where(CollectionItem.user_id == current_user.id)

    result = await db.execute(collection_query)
    collection_stats = result.one()

    # Get alert stats
    alert_query = select(
        func.count(UserAlert.id).label("total_alerts"),
        func.sum(func.cast(UserAlert.is_active, Integer)).label("active_alerts"),
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
