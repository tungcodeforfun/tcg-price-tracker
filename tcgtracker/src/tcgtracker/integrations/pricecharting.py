"""PriceCharting API client for price data."""

import asyncio
from decimal import Decimal
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import structlog

from tcgtracker.config import get_settings
from tcgtracker.utils.errors import APIError, ValidationError

from .base import BaseAPIClient

logger = structlog.get_logger(__name__)


class PriceChartingClient(BaseAPIClient):
    """PriceCharting API client for TCG price data."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        """
        Initialize PriceCharting API client.

        Args:
            api_key: PriceCharting API key
            base_url: API base URL
        """
        settings = get_settings()

        # Use provided values or fall back to config
        self.api_key = api_key or settings.external_apis.pricecharting_api_key
        api_base_url = base_url or settings.external_apis.pricecharting_base_url

        if not self.api_key:
            logger.warning("PriceCharting API key not configured")

        # Initialize base client with PriceCharting rate limits
        super().__init__(
            base_url=api_base_url,
            service_name="pricecharting",
            requests_per_minute=settings.external_apis.pricecharting_rate_limit,
            timeout=30,
            max_retries=3,
            circuit_breaker_enabled=True,
            circuit_breaker_failure_threshold=5,
            circuit_breaker_recovery_timeout=60,
        )

        logger.info(
            "PriceCharting client initialized",
            base_url=api_base_url,
        )

    def _prepare_headers(
        self, headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, str]:
        """Prepare request headers with API authentication."""
        prepared_headers = super()._prepare_headers(headers)

        # Add API key if available
        if self.api_key:
            prepared_headers["X-API-Key"] = self.api_key

        return prepared_headers

    # API Methods

    async def search_products(
        self,
        query: str,
        console: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search for products by name.

        Args:
            query: Search query
            console: Console/game type filter (e.g., "pokemon-cards", "one-piece-cards")
            limit: Maximum number of results

        Returns:
            List of product objects
        """
        params = {
            "q": query,
            "limit": limit,
        }

        if console:
            params["console"] = console

        try:
            response = await self.get("/products", params=params)
            products = response.get("products", [])
            
            # Transform to consistent format
            return [self._transform_product(p) for p in products]
        except Exception as e:
            logger.error(f"Error searching products: {e}")
            return []

    async def get_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed product information.

        Args:
            product_id: Product ID or URL slug

        Returns:
            Product object with price data
        """
        try:
            response = await self.get(f"/product/{product_id}")
            if response:
                return self._transform_product_detail(response)
            return None
        except Exception as e:
            logger.error(f"Error getting product {product_id}: {e}")
            return None

    async def get_product_prices(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current price data for a product.

        Args:
            product_id: Product ID or URL slug

        Returns:
            Price data object
        """
        try:
            response = await self.get(f"/product/{product_id}/prices")
            if response:
                return self._transform_price_data(response)
            return None
        except Exception as e:
            logger.error(f"Error getting prices for {product_id}: {e}")
            return None

    async def get_price_history(
        self, product_id: str, days: int = 90
    ) -> List[Dict[str, Any]]:
        """
        Get price history for a product.

        Args:
            product_id: Product ID or URL slug
            days: Number of days of history (default 90)

        Returns:
            List of price history entries
        """
        params = {"days": days}
        
        try:
            response = await self.get(f"/product/{product_id}/history", params=params)
            history = response.get("price_history", [])
            return [self._transform_history_entry(h) for h in history]
        except Exception as e:
            logger.error(f"Error getting price history for {product_id}: {e}")
            return []

    async def get_pokemon_products(
        self, 
        set_name: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get Pokemon card products.

        Args:
            set_name: Optional set name filter
            limit: Maximum number of results

        Returns:
            List of Pokemon card products
        """
        query = set_name if set_name else ""
        return await self.search_products(
            query=query, 
            console="pokemon-cards",
            limit=limit
        )

    async def get_one_piece_products(
        self, 
        set_name: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get One Piece card products.

        Args:
            set_name: Optional set name filter
            limit: Maximum number of results

        Returns:
            List of One Piece card products
        """
        query = set_name if set_name else ""
        return await self.search_products(
            query=query,
            console="one-piece-cards", 
            limit=limit
        )

    async def get_card_price(self, card_identifier: str) -> Optional[Dict[str, Any]]:
        """
        Get price data for a specific card.

        Args:
            card_identifier: Card ID, name, or identifier

        Returns:
            Price data for the card
        """
        # First search for the card
        results = await self.search_products(card_identifier, limit=1)
        
        if not results:
            return None
            
        # Get detailed price data for the first result
        product_id = results[0].get("id")
        if product_id:
            return await self.get_product_prices(product_id)
        
        return None

    async def get_sets(self, tcg_type: str) -> List[Dict[str, Any]]:
        """
        Get available sets for a TCG type.

        Args:
            tcg_type: TCG type ("pokemon" or "one_piece")

        Returns:
            List of set objects
        """
        console = f"{tcg_type.replace('_', '-')}-cards"
        
        try:
            response = await self.get(f"/consoles/{console}/sets")
            sets = response.get("sets", [])
            return [self._transform_set(s, tcg_type) for s in sets]
        except Exception as e:
            logger.error(f"Error getting sets for {tcg_type}: {e}")
            return []

    async def get_cards_in_set(self, set_id: str) -> List[Dict[str, Any]]:
        """
        Get all cards in a specific set.

        Args:
            set_id: Set identifier

        Returns:
            List of cards in the set
        """
        try:
            response = await self.get(f"/set/{set_id}/products")
            products = response.get("products", [])
            return [self._transform_product(p) for p in products]
        except Exception as e:
            logger.error(f"Error getting cards for set {set_id}: {e}")
            return []

    # Transform methods for consistent data format

    def _transform_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """Transform PriceCharting product to internal format."""
        return {
            "id": product.get("id"),
            "name": product.get("product-name", product.get("name")),
            "set_name": product.get("set-name"),
            "number": product.get("number"),
            "rarity": product.get("rarity"),
            "image_url": product.get("image"),
            "pricecharting_id": product.get("id"),
            "console": product.get("console-name"),
            "url": product.get("url"),
        }

    def _transform_product_detail(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """Transform detailed product data."""
        return {
            "id": product.get("id"),
            "name": product.get("product-name", product.get("name")),
            "set_name": product.get("set-name"),
            "number": product.get("number"),
            "rarity": product.get("rarity"),
            "image_url": product.get("image"),
            "pricecharting_id": product.get("id"),
            "console": product.get("console-name"),
            "url": product.get("url"),
            # Price data
            "loose_price": self._parse_price(product.get("loose-price")),
            "complete_price": self._parse_price(product.get("cib-price")),
            "new_price": self._parse_price(product.get("new-price")),
            "graded_price": self._parse_price(product.get("graded-price")),
            "market_price": self._parse_price(product.get("price")),
        }

    def _transform_price_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform price data to internal format."""
        # Calculate market price (average of available prices)
        prices = []
        
        loose = self._parse_price(data.get("loose-price"))
        complete = self._parse_price(data.get("cib-price"))
        new = self._parse_price(data.get("new-price"))
        
        if loose:
            prices.append(loose)
        if complete:
            prices.append(complete)
        if new:
            prices.append(new)
            
        market_price = sum(prices) / len(prices) if prices else Decimal("0")
        
        return {
            "market_price": market_price,
            "low_price": min(prices) if prices else Decimal("0"),
            "high_price": max(prices) if prices else Decimal("0"),
            "mid_price": market_price,
            "loose_price": loose,
            "complete_price": complete,
            "new_price": new,
            "graded_price": self._parse_price(data.get("graded-price")),
            "last_updated": data.get("last-updated"),
        }

    def _transform_history_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Transform price history entry."""
        return {
            "date": entry.get("date"),
            "loose_price": self._parse_price(entry.get("loose-price")),
            "complete_price": self._parse_price(entry.get("cib-price")),
            "new_price": self._parse_price(entry.get("new-price")),
            "graded_price": self._parse_price(entry.get("graded-price")),
        }

    def _transform_set(self, set_data: Dict[str, Any], tcg_type: str) -> Dict[str, Any]:
        """Transform set data to internal format."""
        return {
            "id": set_data.get("id"),
            "name": set_data.get("name"),
            "code": set_data.get("code"),
            "tcg_type": tcg_type,
            "release_date": set_data.get("release-date"),
            "card_count": set_data.get("total-products"),
            "pricecharting_id": set_data.get("id"),
        }

    def _parse_price(self, price_str: Any) -> Optional[Decimal]:
        """Parse price string to Decimal with validation."""
        if price_str is None:
            return None
        
        try:
            if isinstance(price_str, (int, float)):
                price = Decimal(str(price_str))
            elif isinstance(price_str, str):
                # Remove currency symbols and convert
                cleaned = price_str.replace("$", "").replace(",", "").strip()
                if not cleaned:
                    return None
                price = Decimal(cleaned)
            else:
                return None
            
            # Validate price range (sanity check)
            if price < 0:
                logger.warning(f"Negative price detected: {price}")
                return None
            elif price > 100000:  # $100,000 max for a single card
                logger.warning(f"Unreasonably high price detected: {price}")
                return None
            elif price == 0:
                return None  # Zero prices are not useful
                
            return price
        except Exception as e:
            logger.warning(f"Could not parse price '{price_str}': {e}")
            return None
                
        return None