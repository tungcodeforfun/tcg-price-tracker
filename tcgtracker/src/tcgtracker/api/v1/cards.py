"""Card management endpoints."""

from typing import List, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from tcgtracker.api.dependencies import get_current_user, get_session
from tcgtracker.api.schemas import (
    CardCreate,
    CardResponse,
    CardSearchParams,
    CardUpdate,
    TCGType,
)
from tcgtracker.database.models import Card, CollectionItem, User

router = APIRouter()


@router.post("/", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(
    card_data: CardCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
) -> Card:
    """Get a specific card by ID."""
    result = await db.execute(
        select(Card).where(Card.id == card_id)
    )
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )

    card.latest_price = card.latest_market_price

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
    current_user: User = Depends(get_current_user),
) -> List[Card]:
    """List cards with optional filters."""
    query = select(Card)

    # Apply filters
    filters = []
    if tcg_type:
        filters.append(Card.tcg_type == tcg_type)
    if set_name:
        from tcgtracker.validation.sanitizers import sanitize_search_input

        sanitized = sanitize_search_input(set_name)
        filters.append(Card.set_name.ilike(f"%{sanitized}%", escape="\\"))
    if rarity:
        filters.append(Card.rarity == rarity)
    if search:
        from tcgtracker.validation.sanitizers import sanitize_search_input

        sanitized_search = sanitize_search_input(search)
        filters.append(
            or_(
                Card.name.ilike(f"%{sanitized_search}%", escape="\\"),
                Card.set_name.ilike(f"%{sanitized_search}%", escape="\\"),
                Card.card_number.ilike(f"%{sanitized_search}%", escape="\\"),
            )
        )

    if filters:
        query = query.where(and_(*filters))

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    cards = result.scalars().all()

    for card in cards:
        card.latest_price = card.latest_market_price

    return cast(List[Card], cards)


@router.put("/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: int,
    card_update: CardUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a card."""
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )

    # Check if any collection items reference this card
    collection_result = await db.execute(
        select(CollectionItem.id).where(CollectionItem.card_id == card_id).limit(1)
    )
    if collection_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete card that exists in user collections",
        )

    await db.delete(card)
    await db.commit()


@router.post("/search", response_model=List[CardResponse])
async def search_cards(
    search_params: CardSearchParams,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> List[Card]:
    """Advanced card search with multiple parameters."""
    query = select(Card)

    filters = []

    if search_params.query:
        # Query is already sanitized by the schema validator
        filters.append(
            or_(
                Card.name.ilike(f"%{search_params.query}%", escape="\\"),
                Card.set_name.ilike(f"%{search_params.query}%", escape="\\"),
                Card.card_number.ilike(f"%{search_params.query}%", escape="\\"),
            )
        )

    if search_params.tcg_type:
        filters.append(Card.tcg_type == search_params.tcg_type)

    if search_params.set_name:
        # Set name is already sanitized by the schema validator
        filters.append(Card.set_name.ilike(f"%{search_params.set_name}%", escape="\\"))

    if search_params.rarity:
        filters.append(Card.rarity == search_params.rarity)

    # Handle price filters using denormalized column
    if search_params.min_price is not None:
        filters.append(Card.latest_market_price >= search_params.min_price)

    if search_params.max_price is not None:
        filters.append(Card.latest_market_price <= search_params.max_price)

    if filters:
        query = query.where(and_(*filters))

    query = query.limit(search_params.limit).offset(search_params.offset)

    result = await db.execute(query)
    cards = result.scalars().all()

    for card in cards:
        card.latest_price = card.latest_market_price

    return cast(List[Card], cards)
