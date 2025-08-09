"""Collection management endpoints."""

from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from tcgtracker.api.dependencies import get_current_active_user
from tcgtracker.api.schemas import (
    CardCondition,
    CollectionItemCreate,
    CollectionItemResponse,
    CollectionItemUpdate,
    CollectionStats,
    GameType,
)
from tcgtracker.database.connection import get_db_session
from tcgtracker.database.models import Card, CollectionItem, Price, User

router = APIRouter()


@router.post("/items", response_model=CollectionItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_collection(
    item_data: CollectionItemCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> CollectionItem:
    """Add a card to user's collection."""
    # Verify card exists
    result = await db.execute(select(Card).where(Card.id == item_data.card_id))
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    # Check if item already exists in collection
    existing_query = select(CollectionItem).where(
        and_(
            CollectionItem.user_id == current_user.id,
            CollectionItem.card_id == item_data.card_id,
            CollectionItem.condition == item_data.condition,
        )
    )
    result = await db.execute(existing_query)
    existing_item = result.scalar_one_or_none()
    
    if existing_item:
        # Update quantity instead of creating duplicate
        existing_item.quantity += item_data.quantity
        await db.commit()
        await db.refresh(existing_item)
        return existing_item
    
    # Create new collection item
    new_item = CollectionItem(
        user_id=current_user.id,
        **item_data.model_dump()
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    
    # Load related data
    await db.refresh(new_item, ["card"])
    
    return new_item


@router.get("/items", response_model=List[CollectionItemResponse])
async def get_collection_items(
    game_type: Optional[GameType] = Query(None),
    condition: Optional[CardCondition] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> List[CollectionItem]:
    """Get user's collection items."""
    query = (
        select(CollectionItem)
        .options(
            selectinload(CollectionItem.card).selectinload(Card.prices)
        )
        .where(CollectionItem.user_id == current_user.id)
    )
    
    # Apply filters
    if condition:
        query = query.where(CollectionItem.condition == condition)
    
    if game_type:
        query = query.join(Card).where(Card.game_type == game_type)
    
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    # Calculate current values
    for item in items:
        if item.card and item.card.prices:
            latest_price = max(item.card.prices, key=lambda p: p.created_at)
            item.current_value = latest_price.price * item.quantity
    
    return items


@router.get("/items/{item_id}", response_model=CollectionItemResponse)
async def get_collection_item(
    item_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> CollectionItem:
    """Get a specific collection item."""
    result = await db.execute(
        select(CollectionItem)
        .options(
            selectinload(CollectionItem.card).selectinload(Card.prices)
        )
        .where(
            and_(
                CollectionItem.id == item_id,
                CollectionItem.user_id == current_user.id,
            )
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection item not found"
        )
    
    # Calculate current value
    if item.card and item.card.prices:
        latest_price = max(item.card.prices, key=lambda p: p.created_at)
        item.current_value = latest_price.price * item.quantity
    
    return item


@router.put("/items/{item_id}", response_model=CollectionItemResponse)
async def update_collection_item(
    item_id: int,
    item_update: CollectionItemUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> CollectionItem:
    """Update a collection item."""
    result = await db.execute(
        select(CollectionItem)
        .where(
            and_(
                CollectionItem.id == item_id,
                CollectionItem.user_id == current_user.id,
            )
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection item not found"
        )
    
    # Update fields
    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    await db.commit()
    await db.refresh(item, ["card"])
    
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_collection(
    item_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Remove an item from collection."""
    result = await db.execute(
        select(CollectionItem)
        .where(
            and_(
                CollectionItem.id == item_id,
                CollectionItem.user_id == current_user.id,
            )
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection item not found"
        )
    
    await db.delete(item)
    await db.commit()


@router.get("/stats", response_model=CollectionStats)
async def get_collection_stats(
    game_type: Optional[GameType] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> CollectionStats:
    """Get collection statistics."""
    # Base query for user's collection
    query = select(CollectionItem).where(CollectionItem.user_id == current_user.id)
    
    if game_type:
        query = query.join(Card).where(Card.game_type == game_type)
    
    result = await db.execute(
        query.options(
            selectinload(CollectionItem.card).selectinload(Card.prices)
        )
    )
    items = result.scalars().all()
    
    # Calculate statistics
    total_cards = sum(item.quantity for item in items)
    unique_cards = len(items)
    total_invested = Decimal("0")
    total_value = Decimal("0")
    
    for item in items:
        # Add purchase price if available
        if item.purchase_price:
            total_invested += item.purchase_price * item.quantity
        
        # Calculate current value
        if item.card and item.card.prices:
            latest_price = max(item.card.prices, key=lambda p: p.created_at)
            total_value += latest_price.price * item.quantity
    
    profit_loss = total_value - total_invested
    profit_loss_percentage = (
        float((profit_loss / total_invested) * 100) 
        if total_invested > 0 
        else 0.0
    )
    
    return CollectionStats(
        total_cards=total_cards,
        unique_cards=unique_cards,
        total_value=total_value,
        total_invested=total_invested,
        profit_loss=profit_loss,
        profit_loss_percentage=profit_loss_percentage,
    )


@router.get("/value-history", response_model=dict)
async def get_collection_value_history(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get historical value of collection."""
    from datetime import datetime, timedelta
    
    # Get user's collection items
    result = await db.execute(
        select(CollectionItem)
        .options(selectinload(CollectionItem.card))
        .where(CollectionItem.user_id == current_user.id)
    )
    items = result.scalars().all()
    
    if not items:
        return {
            "days": days,
            "history": [],
            "current_value": 0,
            "change": 0,
            "change_percentage": 0,
        }
    
    # Get price history for each card in collection
    card_ids = [item.card_id for item in items]
    since_date = datetime.utcnow() - timedelta(days=days)
    
    price_query = (
        select(
            Price.card_id,
            func.date(Price.created_at).label("date"),
            func.avg(Price.price).label("avg_price"),
        )
        .where(
            and_(
                Price.card_id.in_(card_ids),
                Price.created_at >= since_date,
            )
        )
        .group_by(Price.card_id, func.date(Price.created_at))
        .order_by(func.date(Price.created_at))
    )
    
    result = await db.execute(price_query)
    price_history = result.all()
    
    # Build daily value history
    daily_values = {}
    for price_record in price_history:
        date_str = str(price_record.date)
        if date_str not in daily_values:
            daily_values[date_str] = Decimal("0")
        
        # Find corresponding collection item
        for item in items:
            if item.card_id == price_record.card_id:
                daily_values[date_str] += price_record.avg_price * item.quantity
                break
    
    # Format response
    history = [
        {"date": date, "value": float(value)}
        for date, value in sorted(daily_values.items())
    ]
    
    current_value = history[-1]["value"] if history else 0
    start_value = history[0]["value"] if history else 0
    change = current_value - start_value
    change_percentage = (
        (change / start_value) * 100 if start_value > 0 else 0
    )
    
    return {
        "days": days,
        "history": history,
        "current_value": current_value,
        "change": change,
        "change_percentage": change_percentage,
    }