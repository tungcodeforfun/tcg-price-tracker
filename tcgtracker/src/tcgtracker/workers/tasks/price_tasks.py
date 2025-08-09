"""Price update tasks for TCG Price Tracker."""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional

import structlog
from celery import Task
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from tcgtracker.database.connection import get_db_manager
from tcgtracker.database.models import Card, DataSourceEnum, PriceHistory
from tcgtracker.integrations.justtcg import JustTCGClient
from tcgtracker.integrations.pricecharting import PriceChartingClient
from tcgtracker.redis_manager import get_redis_manager
from tcgtracker.utils.exceptions import (
    AuthenticationException,
    NetworkException,
    PriceValidationException,
    RateLimitException,
)
from tcgtracker.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


class PriceUpdateTask(Task):
    """Base task class for price updates with rate limiting."""
    
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3, "countdown": 60}
    
    def __init__(self):
        super().__init__()
        self._justtcg_client = None
        self._pricecharting_client = None
    
    @property
    def justtcg_client(self):
        """Lazy initialization of JustTCG client."""
        if self._justtcg_client is None:
            from tcgtracker.config import get_settings
            settings = get_settings()
            self._justtcg_client = JustTCGClient(
                api_key=settings.external_apis.justtcg_api_key
            )
        return self._justtcg_client
    
    @property
    def pricecharting_client(self):
        """Lazy initialization of PriceCharting client."""
        if self._pricecharting_client is None:
            from tcgtracker.config import get_settings
            settings = get_settings()
            self._pricecharting_client = PriceChartingClient(
                api_key=settings.external_apis.pricecharting_api_key
            )
        return self._pricecharting_client


@celery_app.task(base=PriceUpdateTask, bind=True, name="update_card_price")
def update_card_price(self, card_id: int) -> dict:
    """Update price for a single card.
    
    Args:
        card_id: ID of the card to update
        
    Returns:
        dict: Updated price information
    """
    logger.info(f"Starting price update for card {card_id}")
    
    # Run async code in sync context
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_update_card_price_async(self, card_id))
        return result
    finally:
        loop.close()


async def _update_card_price_async(task: PriceUpdateTask, card_id: int) -> dict:
    """Async implementation of card price update."""
    db_manager = get_db_manager()
    redis_manager = get_redis_manager()
    
    async with db_manager.session() as session:
        # Get card information
        result = await session.execute(
            select(Card).where(Card.id == card_id)
        )
        card = result.scalar_one_or_none()
        
        if not card:
            logger.error(f"Card {card_id} not found")
            return {"error": f"Card {card_id} not found"}
        
        price_data = None
        data_source = None
        
        try:
            # Try PriceCharting first (primary source)
            logger.info(f"Attempting to fetch price from PriceCharting for card {card_id}")
            price_data = await task.pricecharting_client.get_card_price(
                card_identifier=card.name if card.name else str(card.id)
            )
            
            if price_data:
                data_source = DataSourceEnum.PRICECHARTING
                # Transform PriceCharting data format
                transformed_data = {
                    "market_price": price_data.get("complete_price", price_data.get("market_price", 0)),
                    "low_price": price_data.get("loose_price", price_data.get("low_price", 0)),
                    "high_price": price_data.get("new_price", price_data.get("high_price", 0)),
                    "mid_price": price_data.get("market_price", price_data.get("mid_price", 0)),
                }
                
                # Validate prices
                for key, value in transformed_data.items():
                    if value and (value < 0 or value > 100000):
                        raise PriceValidationException(
                            f"Invalid price value for {key}: ${value}",
                            price=value
                        )
                
                price_data = transformed_data
                logger.info(f"Successfully fetched price from PriceCharting for card {card_id}")
            
        except RateLimitException as e:
            logger.warning(f"PriceCharting rate limit exceeded for card {card_id}: {e}")
            # Don't fallback for rate limits - wait and retry later
            if e.retry_after:
                raise  # Re-raise to trigger Celery retry with delay
        except AuthenticationException as e:
            logger.error(f"PriceCharting authentication failed: {e}")
            # Authentication issues should not fallback
            raise
        except PriceValidationException as e:
            logger.error(f"Invalid price data from PriceCharting for card {card_id}: {e}")
            # Invalid data should trigger fallback
        except NetworkException as e:
            logger.warning(f"Network issue with PriceCharting for card {card_id}: {e}")
            # Network issues should trigger fallback
        except Exception as e:
            logger.warning(f"Unexpected PriceCharting error for card {card_id}: {e}")
            
        # Fallback to JustTCG if PriceCharting fails
        if not price_data:
            try:
                logger.info(f"Falling back to JustTCG for card {card_id}")
                # Determine game type from card's tcg_type
                game = "pokemon" if card.tcg_type.value == "POKEMON" else "onepiece"
                price_data = await task.justtcg_client.get_card_price(
                    card_identifier=card.name if card.name else str(card.id),
                    game=game
                )
                
                if price_data:
                    data_source = DataSourceEnum.JUSTTCG
                    
                    # Validate JustTCG prices too
                    for key in ["market_price", "low_price", "high_price", "mid_price"]:
                        value = price_data.get(key, 0)
                        if value and (value < 0 or value > 100000):
                            raise PriceValidationException(
                                f"Invalid price value from JustTCG for {key}: ${value}",
                                price=value
                            )
                    
                    logger.info(f"Successfully fetched price from JustTCG for card {card_id}")
                    
            except RateLimitException as e:
                logger.error(f"JustTCG rate limit exceeded for card {card_id}: {e}")
                raise  # Re-raise for Celery retry
            except PriceValidationException as e:
                logger.error(f"Invalid price data from JustTCG for card {card_id}: {e}")
                # Both sources failed with invalid data
            except Exception as e:
                logger.error(f"JustTCG also failed for card {card_id}: {e}")
        
        if not price_data:
            logger.warning(f"No price data found from any source for card {card_id}")
            return {"warning": f"No price data available for card {card_id}"}
        
        try:
            # Create price history entry
            price_history = PriceHistory(
                card_id=card.id,
                source=data_source,
                market_price=price_data.get("market_price"),
                price_low=price_data.get("low_price", price_data.get("low_price")),
                price_high=price_data.get("high_price", price_data.get("high_price")),
                price_avg=price_data.get("mid_price", price_data.get("mid_price")),
                timestamp=datetime.utcnow(),
            )
            
            session.add(price_history)
            
            # Update card's last price update timestamp
            card.last_price_update = datetime.utcnow()
            
            await session.commit()
            
            # Invalidate cache
            cache_key = f"card:price:{card_id}"
            await redis_manager.delete(cache_key)
            
            logger.info(
                f"Price updated for card {card_id}",
                market_price=price_data.get("market_price"),
            )
            
            return {
                "card_id": card_id,
                "status": "success",
                "market_price": price_data.get("market_price"),
                "updated_at": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error updating price for card {card_id}: {e}")
            raise


@celery_app.task(base=PriceUpdateTask, bind=True, name="update_all_card_prices")
def update_all_card_prices(self) -> dict:
    """Update prices for all cards in the database.
    
    Returns:
        dict: Summary of update results
    """
    logger.info("Starting bulk price update for all cards")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_update_all_card_prices_async(self))
        return result
    finally:
        loop.close()


async def _update_all_card_prices_async(task: PriceUpdateTask) -> dict:
    """Async implementation of bulk price update."""
    db_manager = get_db_manager()
    
    async with db_manager.session() as session:
        # Get cards that need price updates (not updated in last 6 hours)
        cutoff_time = datetime.utcnow() - timedelta(hours=6)
        
        result = await session.execute(
            select(Card).where(
                (Card.last_price_update.is_(None)) |
                (Card.last_price_update < cutoff_time)
            ).limit(100)  # Process in batches
        )
        cards = result.scalars().all()
        
        if not cards:
            logger.info("No cards need price updates")
            return {"status": "no_updates_needed", "count": 0}
        
        logger.info(f"Found {len(cards)} cards needing price updates")
        
        # Queue individual price update tasks
        update_tasks = []
        for card in cards:
            task = update_card_price.delay(card.id)
            update_tasks.append(task.id)
        
        return {
            "status": "queued",
            "count": len(cards),
            "task_ids": update_tasks,
            "timestamp": datetime.utcnow().isoformat(),
        }


@celery_app.task(name="cleanup_old_price_history")
def cleanup_old_price_history(days_to_keep: int = 90) -> dict:
    """Clean up old price history entries.
    
    Args:
        days_to_keep: Number of days of history to keep
        
    Returns:
        dict: Cleanup results
    """
    logger.info(f"Starting price history cleanup (keeping {days_to_keep} days)")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(
            _cleanup_old_price_history_async(days_to_keep)
        )
        return result
    finally:
        loop.close()


async def _cleanup_old_price_history_async(days_to_keep: int) -> dict:
    """Async implementation of price history cleanup."""
    db_manager = get_db_manager()
    
    async with db_manager.session() as session:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Count entries to be deleted
        count_result = await session.execute(
            select(PriceHistory).where(PriceHistory.fetched_at < cutoff_date)
        )
        count = len(count_result.scalars().all())
        
        if count == 0:
            logger.info("No old price history entries to clean up")
            return {"status": "no_cleanup_needed", "deleted_count": 0}
        
        # Delete old entries
        await session.execute(
            PriceHistory.__table__.delete().where(
                PriceHistory.fetched_at < cutoff_date
            )
        )
        await session.commit()
        
        logger.info(f"Deleted {count} old price history entries")
        
        return {
            "status": "success",
            "deleted_count": count,
            "cutoff_date": cutoff_date.isoformat(),
            "timestamp": datetime.utcnow().isoformat(),
        }