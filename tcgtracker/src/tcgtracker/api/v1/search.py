"""Search endpoints for external APIs."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from tcgtracker.api.dependencies import get_current_active_user
from tcgtracker.api.schemas import (
    CardCreate,
    CardResponse,
    PriceSource,
    SearchRequest,
    SearchResult,
)
from tcgtracker.database.connection import get_db_session
from tcgtracker.database.models import Card, User
from tcgtracker.integrations.ebay import EbayClient
from tcgtracker.integrations.tcgplayer import TCGPlayerClient

router = APIRouter()


@router.post("/tcgplayer", response_model=List[SearchResult])
async def search_tcgplayer(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> List[SearchResult]:
    """Search TCGPlayer for cards."""
    client = TCGPlayerClient()
    
    try:
        async with client:
            # Map game type to TCGPlayer category
            category_map = {
                "pokemon": 3,  # Pokemon category ID
                "one_piece": 70,  # One Piece category ID
                "magic": 1,  # Magic category ID
                "yugioh": 2,  # Yu-Gi-Oh category ID
            }
            
            category_id = None
            if search_request.game_type:
                category_id = category_map.get(search_request.game_type.lower())
            
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
                    game_type=search_request.game_type or "pokemon",
                    price=price_data.get("market"),
                    image_url=product.get("imageUrl"),
                    source=PriceSource.TCGPLAYER,
                    listing_url=product.get("url"),
                )
                results.append(result)
            
            return results
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"TCGPlayer search failed: {str(e)}"
        )


@router.post("/ebay", response_model=List[SearchResult])
async def search_ebay(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> List[SearchResult]:
    """Search eBay for cards."""
    client = EbayClient()
    
    try:
        async with client:
            # Search eBay
            listings = await client.search_cards(
                query=search_request.query,
                game_type=search_request.game_type,
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
                    game_type=search_request.game_type or "pokemon",
                    price=listing.get("price"),
                    image_url=listing.get("imageUrl"),
                    source=PriceSource.EBAY,
                    listing_url=listing.get("viewItemURL"),
                )
                results.append(result)
            
            return results
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"eBay search failed: {str(e)}"
        )


@router.post("/all", response_model=dict)
async def search_all_sources(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Search all available sources for cards."""
    results = {
        "tcgplayer": [],
        "ebay": [],
        "errors": []
    }
    
    # Search TCGPlayer
    try:
        tcg_results = await search_tcgplayer(search_request, current_user)
        results["tcgplayer"] = tcg_results
    except Exception as e:
        results["errors"].append(f"TCGPlayer: {str(e)}")
    
    # Search eBay
    try:
        ebay_results = await search_ebay(search_request, current_user)
        results["ebay"] = ebay_results
    except Exception as e:
        results["errors"].append(f"eBay: {str(e)}")
    
    return results


@router.post("/import", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def import_card_from_search(
    search_result: SearchResult,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> Card:
    """Import a card from search results into the database."""
    # Check if card already exists
    from sqlalchemy import and_, select
    
    result = await db.execute(
        select(Card).where(
            and_(
                Card.external_id == search_result.external_id,
                Card.game_type == search_result.game_type,
            )
        )
    )
    existing_card = result.scalar_one_or_none()
    
    if existing_card:
        return existing_card
    
    # Create new card
    card_data = CardCreate(
        game_type=search_result.game_type,
        name=search_result.name,
        set_name=search_result.set_name or "Unknown Set",
        external_id=search_result.external_id,
        image_url=search_result.image_url,
    )
    
    new_card = Card(**card_data.model_dump())
    db.add(new_card)
    
    # Add initial price if available
    if search_result.price:
        from tcgtracker.database.models import Price
        
        price = Price(
            card=new_card,
            source=search_result.source,
            price=search_result.price,
            currency="USD",
            condition="near_mint",
            listing_url=search_result.listing_url,
        )
        db.add(price)
    
    await db.commit()
    await db.refresh(new_card)
    
    return new_card


@router.get("/suggestions", response_model=List[str])
async def get_search_suggestions(
    query: str,
    game_type: str = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
) -> List[str]:
    """Get search suggestions based on existing cards."""
    from sqlalchemy import distinct, or_, select
    
    # Build query for card names
    name_query = select(distinct(Card.name)).where(
        Card.name.ilike(f"%{query}%")
    )
    
    if game_type:
        name_query = name_query.where(Card.game_type == game_type)
    
    name_query = name_query.limit(limit)
    
    result = await db.execute(name_query)
    suggestions = [name for (name,) in result.all()]
    
    return suggestions