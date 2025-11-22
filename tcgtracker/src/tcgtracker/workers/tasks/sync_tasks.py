"""Data synchronization tasks for TCG Price Tracker."""

import asyncio
from datetime import datetime

import structlog
from celery import Task
from sqlalchemy import select

from tcgtracker.database.connection import get_db_manager
from tcgtracker.database.models import Card, TCGSet
from tcgtracker.integrations.justtcg import JustTCGClient
from tcgtracker.redis_manager import get_redis_manager
from tcgtracker.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


class SyncTask(Task):
    """Base task class for synchronization tasks."""

    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3, "countdown": 300}  # 5 minute retry delay

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
            from tcgtracker.integrations.pricecharting import PriceChartingClient

            settings = get_settings()
            self._pricecharting_client = PriceChartingClient(
                api_key=settings.external_apis.pricecharting_api_key
            )
        return self._pricecharting_client


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
            # Fetch sets from JustTCG
            # Map tcg_type to JustTCG game names
            game = "pokemon" if current_tcg_type == "pokemon" else "onepiece"
            sets_data = await task.justtcg_client.get_sets(game)

            if not sets_data:
                logger.warning(f"No sets data received for {current_tcg_type}")
                results[current_tcg_type] = {"status": "no_data"}
                continue

            async with db_manager.session() as session:
                new_sets = 0
                updated_sets = 0

                for set_data in sets_data:
                    # Check if set already exists by name and code
                    result = await session.execute(
                        select(TCGSet).where(
                            TCGSet.set_name == set_data["name"],
                            TCGSet.set_code == set_data.get("code", ""),
                        )
                    )
                    existing_set = result.scalar_one_or_none()

                    if existing_set:
                        # Update existing set
                        existing_set.set_name = set_data["name"]
                        existing_set.set_code = set_data.get("code", "")
                        existing_set.release_date = set_data.get("release_date")
                        existing_set.total_cards = set_data.get("card_count")
                        existing_set.updated_at = datetime.utcnow()
                        updated_sets += 1
                    else:
                        # Create new set
                        new_set = TCGSet(
                            tcg_type=current_tcg_type,
                            set_name=set_data["name"],
                            set_code=set_data.get("code", ""),
                            release_date=set_data.get("release_date"),
                            total_cards=set_data.get("card_count"),
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


@celery_app.task(base=SyncTask, bind=True, name="sync_pricecharting_data")
def sync_pricecharting_data(self) -> dict:
    """Sync PriceCharting product data.

    Returns:
        dict: Sync results
    """
    logger.info("Starting PriceCharting data sync")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(_sync_pricecharting_data_async(self))
        return result
    finally:
        loop.close()


async def _sync_pricecharting_data_async(task: SyncTask) -> dict:
    """Async implementation of PriceCharting data synchronization."""
    try:
        # Get basic product data for Pokemon and One Piece
        pokemon_count = 0
        onepiece_count = 0

        # Sync Pokemon products
        pokemon_products = await task.pricecharting_client.get_pokemon_products(
            limit=50
        )
        if pokemon_products:
            pokemon_count = len(pokemon_products)

        # Sync One Piece products
        onepiece_products = await task.pricecharting_client.get_one_piece_products(
            limit=50
        )
        if onepiece_products:
            onepiece_count = len(onepiece_products)

        # Store in cache for quick access
        redis_manager = get_redis_manager()
        if pokemon_products:
            await redis_manager.set_json(
                "pricecharting:pokemon:products",
                pokemon_products,
                ttl=86400,  # Cache for 24 hours
            )

        if onepiece_products:
            await redis_manager.set_json(
                "pricecharting:onepiece:products",
                onepiece_products,
                ttl=86400,  # Cache for 24 hours
            )

        logger.info(
            f"Synced {pokemon_count} Pokemon and {onepiece_count} One Piece products"
        )

        return {
            "status": "success",
            "pokemon_count": pokemon_count,
            "onepiece_count": onepiece_count,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error syncing PriceCharting data: {e}")
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
        result = await session.execute(select(TCGSet).where(TCGSet.id == set_id))
        tcg_set = result.scalar_one_or_none()

        if not tcg_set:
            logger.error(f"Set {set_id} not found")
            return {"error": f"Set {set_id} not found"}

        try:
            # Fetch cards from PriceCharting
            # Use set code or name for lookup
            cards_data = await task.pricecharting_client.get_cards_in_set(
                tcg_set.set_code if tcg_set.set_code else tcg_set.set_name
            )

            if not cards_data:
                logger.warning(f"No cards data received for set {set_id}")
                return {"status": "no_data", "set_id": set_id}

            new_cards = 0
            updated_cards = 0

            for card_data in cards_data:
                # Check if card already exists
                # PriceCharting returns 'pricecharting_id' or 'id'
                external_id = card_data.get("pricecharting_id") or card_data.get("id")
                if not external_id:
                    logger.warning(
                        f"Card data missing ID: {card_data.get('name', 'Unknown')}"
                    )
                    continue

                # Try to find by external_id first
                result = await session.execute(
                    select(Card).where(Card.external_id == str(external_id))
                )
                existing_card = result.scalar_one_or_none()

                # If not found by external_id and it's numeric, try tcgplayer_id for backward compatibility
                if not existing_card and external_id.isdigit():
                    result = await session.execute(
                        select(Card).where(Card.tcgplayer_id == int(external_id))
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
                        external_id=str(
                            external_id
                        ),  # Use external_id field for new cards
                        tcgplayer_id=(
                            int(external_id) if external_id.isdigit() else None
                        ),  # Keep for compatibility
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
