"""Price tracking endpoints."""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

logger = logging.getLogger(__name__)
from sqlalchemy.orm import selectinload

from tcgtracker.api.dependencies import get_current_active_user
from tcgtracker.api.schemas import (
    BulkPriceUpdate,
    PriceCreate,
    PriceHistory as PriceHistorySchema,
    PriceResponse,
    PriceSource,
)
from tcgtracker.database.connection import get_session
from tcgtracker.database.models import Card, PriceHistory, UserAlert, User, CardConditionEnum
from tcgtracker.integrations.ebay import eBayClient
from tcgtracker.integrations.tcgplayer import TCGPlayerClient

router = APIRouter()


async def fetch_and_update_price(
    card: Card,
    source: PriceSource,
    db: AsyncSession,
) -> Optional[PriceHistory]:
    """Fetch price from external API and update database."""
    price_data = None
    
    if source == PriceSource.TCGPLAYER and card.external_id:
        # Fetch from TCGPlayer
        client = TCGPlayerClient()
        async with client:
            try:
                prices = await client.get_product_prices([int(card.external_id)])
                if prices and card.external_id in prices:
                    price_data = prices[card.external_id].get("market", 0)
            except Exception as e:
                logger.error("Error fetching TCGPlayer price", exc_info=e)
    
    elif source == PriceSource.EBAY:
        # Fetch from eBay
        client = eBayClient()
        async with client:
            try:
                query = f"{card.name} {card.set_name} {card.card_number or ''}".strip()
                results = await client.search_cards(query, game_type=card.game_type, limit=1)
                if results:
                    price_data = results[0].get("price")
            except Exception as e:
                logger.error("Error fetching eBay price", exc_info=e)
    
    if price_data:
        new_price = PriceHistory(
            card_id=card.id,
            source=source,
            market_price=Decimal(str(price_data)),
            condition=CardConditionEnum.NEAR_MINT,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(new_price)
        await db.commit()
        return new_price
    
    return None


@router.post("/", response_model=PriceResponse, status_code=status.HTTP_201_CREATED)
async def create_price(
    price_data: PriceCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> PriceHistory:
    """Manually add a price entry for a card."""
    # Verify card exists
    result = await db.execute(select(Card).where(Card.id == price_data.card_id))
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    # Create price entry
    new_price = PriceHistory(**price_data.model_dump())
    db.add(new_price)
    
    # Check price alerts
    alerts_query = select(UserAlert).where(
        and_(
            UserAlert.card_id == price_data.card_id,
            UserAlert.is_active == True,
        )
    )
    result = await db.execute(alerts_query)
    alerts = result.scalars().all()
    
    for alert in alerts:
        if (
            (alert.alert_type == "above" and price_data.market_price >= alert.target_price) or
            (alert.alert_type == "below" and price_data.market_price <= alert.target_price)
        ):
            alert.triggered_at = datetime.now(timezone.utc)
            # TODO: Send notification to user
    
    await db.commit()
    await db.refresh(new_price)
    
    return new_price


@router.get("/card/{card_id}", response_model=PriceHistorySchema)
async def get_price_history(
    card_id: int,
    days: int = Query(30, ge=1, le=365),
    source: Optional[PriceSource] = Query(None),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> PriceHistory:
    """Get price history for a specific card."""
    # Verify card exists
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    # Build price query
    since_date = datetime.now(timezone.utc) - timedelta(days=days)
    price_query = select(PriceHistory).where(
        and_(
            PriceHistory.card_id == card_id,
            PriceHistory.timestamp >= since_date,
        )
    )
    
    if source:
        price_query = price_query.where(PriceHistory.source == source)
    
    price_query = price_query.order_by(PriceHistory.timestamp)
    
    result = await db.execute(price_query)
    prices = result.scalars().all()
    
    # Calculate statistics
    if prices:
        price_values = [p.market_price for p in prices]
        avg_price = sum(price_values) / len(price_values)
        min_price = min(price_values)
        max_price = max(price_values)
        
        # Determine trend
        if len(prices) > 1:
            recent_avg = sum(price_values[-5:]) / len(price_values[-5:])
            older_avg = sum(price_values[:5]) / len(price_values[:5])
            if recent_avg > older_avg * 1.05:
                trend = "increasing"
            elif recent_avg < older_avg * 0.95:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"
    else:
        avg_price = None
        min_price = None
        max_price = None
        trend = "no_data"
    
    # Convert database objects to response schemas
    price_responses = [
        PriceResponse(
            id=p.id,
            card_id=p.card_id,
            source=p.source,
            market_price=p.market_price,
            currency=p.currency,
            condition=p.condition,
            listing_url=None,  # PriceHistory model doesn't have listing_url
            timestamp=p.timestamp,
        )
        for p in prices
    ]
    
    return PriceHistory(
        card_id=card_id,
        prices=price_responses,
        average_price=avg_price,
        min_price=min_price,
        max_price=max_price,
        trend=trend,
    )


@router.post("/update/{card_id}", response_model=PriceResponse)
async def update_card_price(
    card_id: int,
    source: PriceSource = Query(PriceSource.TCGPLAYER),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> PriceHistory:
    """Fetch and update the latest price for a card."""
    # Get card
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()
    
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found"
        )
    
    # Fetch and update price
    new_price = await fetch_and_update_price(card, source, db)
    
    if not new_price:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not fetch price from {source.value}"
        )
    
    return new_price


@router.post("/update/bulk", response_model=List[PriceResponse])
async def bulk_update_prices(
    update_request: BulkPriceUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> List[PriceHistory]:
    """Bulk update prices for multiple cards."""
    # Get cards
    result = await db.execute(
        select(Card).where(Card.id.in_(update_request.card_ids))
    )
    cards = result.scalars().all()
    
    if not cards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cards found"
        )
    
    updated_prices = []
    errors = []
    source = update_request.source or PriceSource.TCGPLAYER
    
    for card in cards:
        try:
            new_price = await fetch_and_update_price(card, source, db)
            if new_price:
                updated_prices.append(new_price)
        except Exception as e:
            logger.error(f"Error updating price for card {card.id}", exc_info=e)
            errors.append({"card_id": card.id, "error": str(e)})
            continue
    
    # Log summary of errors if any occurred
    if errors:
        logger.warning(f"Price update completed with {len(errors)} errors out of {len(cards)} cards")
    
    return updated_prices


@router.get("/trends", response_model=dict)
async def get_price_trends(
    game_type: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get aggregated price trends."""
    from datetime import timezone
    since_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Build query for price changes
    query = select(
        Card.game_type,
        func.avg(PriceHistory.market_price).label("avg_price"),
        func.count(PriceHistory.id).label("price_count"),
    ).select_from(PriceHistory).join(Card).where(
        PriceHistory.timestamp >= since_date
    ).group_by(Card.game_type)
    
    if game_type:
        query = query.where(Card.game_type == game_type)
    
    result = await db.execute(query)
    trends = result.all()
    
    # Format response
    trend_data = {}
    for trend in trends:
        trend_data[trend.game_type] = {
            "average_price": float(trend.avg_price) if trend.avg_price else 0,
            "total_prices": trend.price_count,
        }
    
    return {
        "period_days": days,
        "since_date": since_date.isoformat(),
        "trends": trend_data,
    }