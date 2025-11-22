"""Card management endpoints."""

from typing import List, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from tcgtracker.api.dependencies import get_current_active_user, get_session
from tcgtracker.api.schemas import (
    CardCreate,
    CardResponse,
    CardSearchParams,
    CardUpdate,
    TCGType,
)
from tcgtracker.database.models import Card, PriceHistory, User

router = APIRouter()


@router.post("/", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(
    card_data: CardCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> Card:
    """Create a new card."""
    # Check if card already exists
    result = await db.execute(
        select(Card).where(
            and_(
                Card.name == card_data.name,
                Card.set_name == card_data.set_name,
                Card.tcg_type == card_data.tcg_type,
                Card.card_number == card_data.card_number,
            )
        )
    )
    existing_card = result.scalar_one_or_none()

    if existing_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Card already exists"
        )

    # Create new card
    new_card = Card(**card_data.model_dump())
    db.add(new_card)
    await db.commit()
    await db.refresh(new_card)

    return new_card


@router.get("/{card_id}", response_model=CardResponse)
async def get_card(
    card_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> Card:
    """Get a specific card by ID."""
    result = await db.execute(
        select(Card).options(selectinload(Card.price_history)).where(Card.id == card_id)
    )
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )

    # Get latest price with proper null checks
    if card.price_history:
        price_history_list = list(card.price_history)
        if price_history_list:
            latest_price = max(price_history_list, key=lambda p: p.timestamp)
            card.latest_price = latest_price.market_price
        else:
            card.latest_price = None
    else:
        card.latest_price = None

    return card


@router.get("/", response_model=List[CardResponse])
async def list_cards(
    tcg_type: Optional[TCGType] = Query(None),
    set_name: Optional[str] = Query(None),
    rarity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> List[Card]:
    """List cards with optional filters."""
    query = select(Card).options(selectinload(Card.price_history))

    # Apply filters
    filters = []
    if tcg_type:
        filters.append(Card.tcg_type == tcg_type)
    if set_name:
        from tcgtracker.validation.sanitizers import sanitize_search_input

        sanitized = sanitize_search_input(set_name)
        filters.append(Card.set_name.ilike(f"%{sanitized}%"))
    if rarity:
        filters.append(Card.rarity == rarity)
    if search:
        from tcgtracker.validation.sanitizers import sanitize_search_input

        sanitized_search = sanitize_search_input(search)
        filters.append(
            or_(
                Card.name.ilike(f"%{sanitized_search}%"),
                Card.set_name.ilike(f"%{sanitized_search}%"),
                Card.card_number.ilike(f"%{sanitized_search}%"),
            )
        )

    if filters:
        query = query.where(and_(*filters))

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    cards = result.scalars().all()

    # Add latest prices with proper null checks
    for card in cards:
        if card.price_history:
            price_history_list = list(card.price_history)
            if price_history_list:
                latest_price = max(price_history_list, key=lambda p: p.timestamp)
                card.latest_price = latest_price.market_price
            else:
                card.latest_price = None
        else:
            card.latest_price = None

    return cast(List[Card], cards)


@router.put("/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: int,
    card_update: CardUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> Card:
    """Update a card."""
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )

    # Update card fields
    update_data = card_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)

    await db.commit()
    await db.refresh(card)

    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a card."""
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )

    await db.delete(card)
    await db.commit()


@router.post("/search", response_model=List[CardResponse])
async def search_cards(
    search_params: CardSearchParams,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> List[Card]:
    """Advanced card search with multiple parameters."""
    query = select(Card).options(selectinload(Card.price_history))

    filters = []

    if search_params.query:
        # Query is already sanitized by the schema validator
        filters.append(
            or_(
                Card.name.ilike(f"%{search_params.query}%"),
                Card.set_name.ilike(f"%{search_params.query}%"),
                Card.card_number.ilike(f"%{search_params.query}%"),
            )
        )

    if search_params.tcg_type:
        filters.append(Card.tcg_type == search_params.tcg_type)

    if search_params.set_name:
        # Set name is already sanitized by the schema validator
        filters.append(Card.set_name.ilike(f"%{search_params.set_name}%"))

    if search_params.rarity:
        filters.append(Card.rarity == search_params.rarity)

    if filters:
        query = query.where(and_(*filters))

    # Handle price filters by joining with price_history table
    if search_params.min_price is not None or search_params.max_price is not None:
        query = query.join(PriceHistory)

        if search_params.min_price is not None:
            query = query.where(PriceHistory.market_price >= search_params.min_price)

        if search_params.max_price is not None:
            query = query.where(PriceHistory.market_price <= search_params.max_price)

        query = query.distinct()

    query = query.limit(search_params.limit).offset(search_params.offset)

    result = await db.execute(query)
    cards = result.scalars().all()

    # Add latest prices and trend with proper null checks
    for card in cards:
        if card.price_history:
            price_history_list = list(card.price_history)
            if price_history_list:
                sorted_prices = sorted(price_history_list, key=lambda p: p.timestamp)
                latest_price = sorted_prices[-1]
                card.latest_price = latest_price.market_price

                # Calculate simple trend
                if len(sorted_prices) > 1:
                    prev_price = sorted_prices[-2].market_price
                    if (
                        latest_price.market_price
                        and prev_price
                        and latest_price.market_price > prev_price
                    ):
                        card.price_trend = "up"
                    elif (
                        latest_price.market_price
                        and prev_price
                        and latest_price.market_price < prev_price
                    ):
                        card.price_trend = "down"
                    else:
                        card.price_trend = "stable"
                else:
                    card.price_trend = "stable"
            else:
                card.latest_price = None
                card.price_trend = "no_data"
        else:
            card.latest_price = None
            card.price_trend = "no_data"

    return cast(List[Card], cards)
