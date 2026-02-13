"""Search endpoints for external APIs."""

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from tcgtracker.api.dependencies import get_current_user, get_session
from tcgtracker.api.schemas import (
    CardCreate,
    CardResponse,
    PriceSource,
    SearchRequest,
    SearchResult,
)
from tcgtracker.database.models import Card, User
from tcgtracker.integrations.ebay import eBayClient
from tcgtracker.integrations.justtcg import JustTCGClient
from tcgtracker.integrations.pricecharting import PriceChartingClient
from tcgtracker.integrations.tcgplayer import TCGPlayerClient
from tcgtracker.validation.sanitizers import sanitize_search_input

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/tcgplayer", response_model=List[SearchResult])
async def search_tcgplayer(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> List[SearchResult]:
    """Search TCGPlayer for cards."""
    client = TCGPlayerClient()

    try:
        async with client:
            # Map game type to TCGPlayer category
            category_map = {
                "pokemon": 3,  # Pokemon category ID
                "onepiece": 70,  # One Piece category ID
                "magic": 1,  # Magic category ID
                "yugioh": 2,  # Yu-Gi-Oh category ID
            }

            category_id = None
            if search_request.tcg_type:
                category_id = category_map.get(search_request.tcg_type.lower())

            # Search products
            products = await client.search_products(
                query=search_request.query,
                category_id=category_id,
                limit=search_request.limit,
            )

            if not products:
                return []

            # Get prices for found products
            product_ids = [p["productId"] for p in products]
            prices = await client.get_product_prices(product_ids)

            # Format results
            results = []
            for product in products:
                product_id = str(product["productId"])
                price_data = prices.get(product_id, {})

                result = SearchResult(
                    external_id=product_id,
                    name=product.get("name", "Unknown"),
                    set_name=product.get("groupName", "Unknown Set"),
                    tcg_type=search_request.tcg_type or "pokemon",
                    price=price_data.get("market"),
                    image_url=product.get("imageUrl"),
                    source=PriceSource.TCGPLAYER,
                    listing_url=product.get("url"),
                )
                results.append(result)

            return results

    except Exception:
        logger.error("TCGPlayer search failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TCGPlayer search is currently unavailable",
        )


@router.post("/pricecharting", response_model=List[SearchResult])
async def search_pricecharting(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> List[SearchResult]:
    """Search PriceCharting for cards."""
    async with PriceChartingClient() as client:
        try:
            # Determine which method to use based on TCG type
            if search_request.tcg_type == "onepiece":
                products = await client.get_one_piece_products(
                    search_term=search_request.query,
                    limit=search_request.limit,
                )
            else:
                products = await client.get_pokemon_products(
                    search_term=search_request.query,
                    limit=search_request.limit,
                )

            if not products:
                return []

            # Format results
            results = []
            for product in products:
                # Transform PriceCharting data to SearchResult
                result = SearchResult(
                    external_id=str(
                        product.get("pricecharting_id") or product.get("id", "")
                    ),
                    name=product.get("name", "Unknown"),
                    set_name=product.get("set_name", "Unknown Set"),
                    tcg_type=search_request.tcg_type or "pokemon",
                    price=product.get("complete_price") or product.get("market_price"),
                    image_url=product.get("image_url"),
                    source=PriceSource.PRICECHARTING,
                    listing_url=product.get("url"),
                )
                results.append(result)

            return results

        except Exception:
            logger.error("PriceCharting search failed", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PriceCharting search is currently unavailable",
            )


@router.post("/justtcg", response_model=List[SearchResult])
async def search_justtcg(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> List[SearchResult]:
    """Search JustTCG for cards."""
    async with JustTCGClient() as client:
        try:
            game = "pokemon" if search_request.tcg_type != "onepiece" else "onepiece"

            products = await client.search_cards(
                query=search_request.query,
                game=game,
                limit=search_request.limit,
            )

            if not products:
                return []

            # Format results
            results = []
            for product in products:
                result = SearchResult(
                    external_id=str(product.get("id", "")),
                    name=product.get("name", "Unknown"),
                    set_name=product.get("set_name", "Unknown Set"),
                    tcg_type=search_request.tcg_type or "pokemon",
                    price=product.get("market_price"),
                    image_url=product.get("image_url"),
                    source=PriceSource.JUSTTCG,
                    listing_url=product.get("url"),
                )
                results.append(result)

            return results

        except Exception:
            logger.error("JustTCG search failed", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="JustTCG search is currently unavailable",
            )


@router.post("/ebay", response_model=List[SearchResult])
async def search_ebay(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> List[SearchResult]:
    """Search eBay for cards."""
    client = eBayClient()

    try:
        async with client:
            # Search eBay
            listings = await client.search_cards(
                query=search_request.query,
                tcg_type=search_request.tcg_type,
                limit=search_request.limit,
            )

            if not listings:
                return []

            # Format results
            results = []
            for listing in listings:
                result = SearchResult(
                    external_id=listing.get("itemId", ""),
                    name=listing.get("title", "Unknown"),
                    set_name="",  # eBay doesn't provide set info directly
                    tcg_type=search_request.tcg_type or "pokemon",
                    price=listing.get("price"),
                    image_url=listing.get("imageUrl"),
                    source=PriceSource.EBAY,
                    listing_url=listing.get("viewItemURL"),
                )
                results.append(result)

            return results

    except Exception:
        logger.error("eBay search failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="eBay search is currently unavailable",
        )


@router.post("/all", response_model=dict)
async def search_all_sources(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Search all available sources for cards."""
    results: dict = {
        "tcgplayer": [],
        "ebay": [],
        "pricecharting": [],
        "justtcg": [],
        "errors": [],
    }

    # Run all source searches concurrently with a timeout
    tasks = {
        "tcgplayer": search_tcgplayer(search_request, current_user),
        "ebay": search_ebay(search_request, current_user),
        "pricecharting": search_pricecharting(search_request, current_user),
        "justtcg": search_justtcg(search_request, current_user),
    }

    try:
        gathered = await asyncio.wait_for(
            asyncio.gather(*tasks.values(), return_exceptions=True),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        logger.error("Search all sources timed out after 30s")
        results["errors"].append("Search timed out — partial results may be available")
        return results

    for source_name, result in zip(tasks.keys(), gathered):
        if isinstance(result, Exception):
            logger.error(
                "%s search failed in all-sources", source_name, exc_info=result
            )
            results["errors"].append(f"{source_name} search is currently unavailable")
        else:
            results[source_name] = result

    return results


@router.post(
    "/import", response_model=CardResponse, status_code=status.HTTP_201_CREATED
)
async def import_card_from_search(
    search_result: SearchResult,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Import a card from search results into the database."""
    # Check if card already exists
    from sqlalchemy import and_, select

    result = await db.execute(
        select(Card).where(
            and_(
                Card.external_id == search_result.external_id,
                Card.tcg_type == search_result.tcg_type,
            )
        )
    )
    existing_card = result.scalar_one_or_none()

    if existing_card:
        existing_card.latest_price = existing_card.latest_market_price
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=CardResponse.model_validate(existing_card).model_dump(mode="json"),
        )

    # Create new card
    card_data = CardCreate(
        tcg_type=search_result.tcg_type,
        name=search_result.name,
        set_name=search_result.set_name or "Unknown Set",
        external_id=search_result.external_id,
        image_url=search_result.image_url,
    )

    new_card = Card(**card_data.model_dump())
    db.add(new_card)

    try:
        # Commit the card first to get its ID
        await db.commit()
        await db.refresh(new_card)

        # Add initial price if available (after card is committed)
        if search_result.price:
            from datetime import datetime, timezone

            from tcgtracker.database.models import CardConditionEnum, PriceHistory

            # Map source from API enum to database enum
            from tcgtracker.utils.enum_mappings import map_price_source_to_db

            db_source = map_price_source_to_db(search_result.source)
            now = datetime.now(timezone.utc)

            price = PriceHistory(
                card_id=new_card.id,
                source=db_source,
                market_price=search_result.price,
                currency="USD",
                condition=CardConditionEnum.NEAR_MINT,
                timestamp=now,
            )
            db.add(price)

            # Update denormalized price columns on card
            new_card.latest_market_price = search_result.price
            new_card.latest_price_updated_at = now

            await db.commit()
            await db.refresh(new_card)

        new_card.latest_price = new_card.latest_market_price
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content=CardResponse.model_validate(new_card).model_dump(mode="json"),
        )

    except Exception:
        # Rollback the transaction on any error
        await db.rollback()
        logger.error("Failed to import card", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to import card",
        )


@router.get("/suggestions", response_model=List[str])
async def get_search_suggestions(
    query: str,
    tcg_type: Optional[str] = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> List[str]:
    """Get search suggestions based on existing cards."""
    from sqlalchemy import distinct, select

    # Build query for card names
    sanitized_query = sanitize_search_input(query)
    name_query = select(distinct(Card.name)).where(
        Card.name.ilike(f"%{sanitized_query}%", escape="\\")
    )

    if tcg_type:
        name_query = name_query.where(Card.tcg_type == tcg_type)

    name_query = name_query.limit(limit)

    result = await db.execute(name_query)
    suggestions = [name for (name,) in result.all()]

    return suggestions
