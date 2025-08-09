"""Data synchronization tasks for TCG Price Tracker."""

import asyncio
from datetime import datetime
from typing import Dict, List

import structlog
from celery import Task
from sqlalchemy import select

from tcgtracker.database.connection import get_db_manager
from tcgtracker.database.models import Card, TCGSet
from tcgtracker.integrations.tcgplayer import TCGPlayerClient
from tcgtracker.redis_manager import get_redis_manager
from tcgtracker.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


class SyncTask(Task):
    """Base task class for synchronization tasks."""
    
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3, "countdown": 300}  # 5 minute retry delay
    
    def __init__(self):
        super().__init__()
        self._tcgplayer_client = None
    
    @property
    def tcgplayer_client(self):
        """Lazy initialization of TCGPlayer client."""
        if self._tcgplayer_client is None:
            from tcgtracker.config import get_settings
            settings = get_settings()
            self._tcgplayer_client = TCGPlayerClient(settings.external_apis)
        return self._tcgplayer_client


@celery_app.task(base=SyncTask, bind=True, name="sync_tcg_sets")
def sync_tcg_sets(self, tcg_type: str = "all") -> dict:
    """Sync TCG sets from external sources.
    
    Args:
        tcg_type: Type of TCG to sync ("pokemon", "one_piece", or "all")
        
    Returns:
        dict: Sync results
    """
    logger.info(f"Starting TCG sets sync for type: {tcg_type}")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_sync_tcg_sets_async(self, tcg_type))
        return result
    finally:
        loop.close()


async def _sync_tcg_sets_async(task: SyncTask, tcg_type: str) -> dict:
    """Async implementation of TCG sets synchronization."""
    db_manager = get_db_manager()
    redis_manager = get_redis_manager()
    
    # Determine which TCG types to sync
    tcg_types = []
    if tcg_type == "all":
        tcg_types = ["pokemon", "one_piece"]
    elif tcg_type in ["pokemon", "one_piece"]:
        tcg_types = [tcg_type]
    else:
        logger.error(f"Invalid TCG type: {tcg_type}")
        return {"error": f"Invalid TCG type: {tcg_type}"}
    
    results = {}
    total_new_sets = 0
    total_updated_sets = 0
    
    for current_tcg_type in tcg_types:
        logger.info(f"Syncing sets for {current_tcg_type}")
        
        try:
            # Fetch sets from TCGPlayer
            sets_data = await task.tcgplayer_client.get_sets(current_tcg_type)
            
            if not sets_data:
                logger.warning(f"No sets data received for {current_tcg_type}")
                results[current_tcg_type] = {"status": "no_data"}
                continue
            
            async with db_manager.session() as session:
                new_sets = 0
                updated_sets = 0
                
                for set_data in sets_data:
                    # Check if set already exists
                    result = await session.execute(
                        select(TCGSet).where(
                            TCGSet.tcgplayer_id == set_data["tcgplayer_id"]
                        )
                    )
                    existing_set = result.scalar_one_or_none()
                    
                    if existing_set:
                        # Update existing set
                        existing_set.name = set_data["name"]
                        existing_set.code = set_data.get("code")
                        existing_set.release_date = set_data.get("release_date")
                        existing_set.card_count = set_data.get("card_count")
                        existing_set.is_active = set_data.get("is_active", True)
                        existing_set.updated_at = datetime.utcnow()
                        updated_sets += 1
                    else:
                        # Create new set
                        new_set = TCGSet(
                            tcg_type=current_tcg_type,
                            name=set_data["name"],
                            code=set_data.get("code"),
                            tcgplayer_id=set_data["tcgplayer_id"],
                            release_date=set_data.get("release_date"),
                            card_count=set_data.get("card_count"),
                            is_active=set_data.get("is_active", True),
                        )
                        session.add(new_set)
                        new_sets += 1
                
                await session.commit()
                
                # Invalidate cache for sets
                cache_pattern = f"sets:{current_tcg_type}:*"
                await redis_manager.delete_pattern(cache_pattern)
                
                logger.info(
                    f"Synced {current_tcg_type} sets",
                    new_sets=new_sets,
                    updated_sets=updated_sets,
                )
                
                results[current_tcg_type] = {
                    "status": "success",
                    "new_sets": new_sets,
                    "updated_sets": updated_sets,
                }
                
                total_new_sets += new_sets
                total_updated_sets += updated_sets
                
        except Exception as e:
            logger.error(f"Error syncing {current_tcg_type} sets: {e}")
            results[current_tcg_type] = {"status": "error", "error": str(e)}
    
    return {
        "status": "completed",
        "results": results,
        "total_new_sets": total_new_sets,
        "total_updated_sets": total_updated_sets,
        "timestamp": datetime.utcnow().isoformat(),
    }


@celery_app.task(base=SyncTask, bind=True, name="sync_tcgplayer_categories")
def sync_tcgplayer_categories(self) -> dict:
    """Sync TCGPlayer categories and groups.
    
    Returns:
        dict: Sync results
    """
    logger.info("Starting TCGPlayer categories sync")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_sync_tcgplayer_categories_async(self))
        return result
    finally:
        loop.close()


async def _sync_tcgplayer_categories_async(task: SyncTask) -> dict:
    """Async implementation of TCGPlayer categories synchronization."""
    try:
        # Fetch categories from TCGPlayer
        categories_data = await task.tcgplayer_client.get_categories()
        
        if not categories_data:
            logger.warning("No categories data received from TCGPlayer")
            return {"status": "no_data"}
        
        # Store categories in cache for quick access
        redis_manager = get_redis_manager()
        await redis_manager.set_json(
            "tcgplayer:categories",
            categories_data,
            ttl=86400  # Cache for 24 hours
        )
        
        logger.info(f"Synced {len(categories_data)} TCGPlayer categories")
        
        return {
            "status": "success",
            "categories_count": len(categories_data),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Error syncing TCGPlayer categories: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@celery_app.task(base=SyncTask, bind=True, name="sync_card_data")
def sync_card_data(self, set_id: int) -> dict:
    """Sync card data for a specific set.
    
    Args:
        set_id: ID of the set to sync cards for
        
    Returns:
        dict: Sync results
    """
    logger.info(f"Starting card data sync for set {set_id}")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_sync_card_data_async(self, set_id))
        return result
    finally:
        loop.close()


async def _sync_card_data_async(task: SyncTask, set_id: int) -> dict:
    """Async implementation of card data synchronization."""
    db_manager = get_db_manager()
    
    async with db_manager.session() as session:
        # Get set information
        result = await session.execute(
            select(TCGSet).where(TCGSet.id == set_id)
        )
        tcg_set = result.scalar_one_or_none()
        
        if not tcg_set:
            logger.error(f"Set {set_id} not found")
            return {"error": f"Set {set_id} not found"}
        
        try:
            # Fetch cards from TCGPlayer
            cards_data = await task.tcgplayer_client.get_cards_in_set(
                tcg_set.tcgplayer_id
            )
            
            if not cards_data:
                logger.warning(f"No cards data received for set {set_id}")
                return {"status": "no_data", "set_id": set_id}
            
            new_cards = 0
            updated_cards = 0
            
            for card_data in cards_data:
                # Check if card already exists
                result = await session.execute(
                    select(Card).where(
                        Card.tcgplayer_id == card_data["tcgplayer_id"]
                    )
                )
                existing_card = result.scalar_one_or_none()
                
                if existing_card:
                    # Update existing card
                    existing_card.name = card_data["name"]
                    existing_card.number = card_data.get("number")
                    existing_card.rarity = card_data.get("rarity")
                    existing_card.image_url = card_data.get("image_url")
                    existing_card.updated_at = datetime.utcnow()
                    updated_cards += 1
                else:
                    # Create new card
                    new_card = Card(
                        tcg_type=tcg_set.tcg_type,
                        set_id=tcg_set.id,
                        name=card_data["name"],
                        number=card_data.get("number"),
                        rarity=card_data.get("rarity"),
                        tcgplayer_id=card_data["tcgplayer_id"],
                        image_url=card_data.get("image_url"),
                    )
                    session.add(new_card)
                    new_cards += 1
            
            await session.commit()
            
            logger.info(
                f"Synced cards for set {set_id}",
                new_cards=new_cards,
                updated_cards=updated_cards,
            )
            
            return {
                "status": "success",
                "set_id": set_id,
                "new_cards": new_cards,
                "updated_cards": updated_cards,
                "timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error syncing cards for set {set_id}: {e}")
            return {
                "status": "error",
                "set_id": set_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }