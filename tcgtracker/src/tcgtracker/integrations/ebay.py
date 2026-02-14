"""eBay Browse API client implementation."""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog

from tcgtracker.config import get_settings
from tcgtracker.utils.errors import AuthenticationError, ValidationError

from .base import BaseAPIClient

logger = structlog.get_logger(__name__)


class eBayClient(BaseAPIClient):
    """eBay Browse API client with User Access Token authentication."""

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        base_url: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> None:
        """
        Initialize eBay API client.

        Args:
            client_id: eBay client ID (App ID)
            client_secret: eBay client secret
            base_url: API base URL
            environment: Environment to use ("sandbox" or "production")
        """
        settings = get_settings()

        # Determine environment
        self.environment = environment or settings.external_apis.ebay_environment
        is_sandbox = self.environment.lower() == "sandbox"

        # Use appropriate credentials based on environment
        if is_sandbox:
            # Use sandbox credentials
            self.client_id = client_id or settings.external_apis.ebay_sandbox_client_id
            self.client_secret = (
                client_secret or settings.external_apis.ebay_sandbox_client_secret
            )
            api_base_url = base_url or settings.external_apis.ebay_sandbox_base_url
        else:
            # Use production credentials
            self.client_id = client_id or settings.external_apis.ebay_client_id
            self.client_secret = (
                client_secret or settings.external_apis.ebay_client_secret
            )
            api_base_url = base_url or settings.external_apis.ebay_base_url

        if not self.client_id or not self.client_secret:
            raise ValueError("eBay client ID and secret are required")

        # Initialize base client with eBay rate limits (1000 requests per hour)
        super().__init__(
            base_url=api_base_url,
            service_name="ebay",
            requests_per_minute=16,  # ~1000/hour with some buffer
            requests_per_hour=settings.external_apis.ebay_rate_limit,
            timeout=30,
            max_retries=3,
            circuit_breaker_enabled=True,
            circuit_breaker_failure_threshold=5,
            circuit_breaker_recovery_timeout=60,
        )

        # OAuth tokens for User Access Token flow
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._token_lock = asyncio.Lock()

        logger.info(
            "eBay client initialized",
            environment=self.environment,
            client_id=self.client_id[:8] + "..." if self.client_id else None,
            base_url=api_base_url,
        )

    async def _get_application_token(self) -> str:
        """
        Get application access token using client credentials flow.

        Returns:
            Access token

        Raises:
            AuthenticationError: If token request fails
        """
        import base64

        # Prepare credentials
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()

        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        }

        try:
            # Use appropriate OAuth URL based on environment
            if self.environment.lower() == "sandbox":
                oauth_url = "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
            else:
                oauth_url = "https://api.ebay.com/identity/v1/oauth2/token"

            response = await self._client.post(
                oauth_url,
                headers=headers,
                data=data,
            )
            response.raise_for_status()

            token_response = response.json()
            return token_response["access_token"]

        except Exception as exc:
            logger.warning("Failed to get eBay application token: %s", exc)
            raise AuthenticationError(
                "Failed to get eBay application token: %s" % str(exc)
            )

    async def _ensure_valid_token(self) -> None:
        """
        Ensure we have a valid access token, obtaining one if necessary.

        Raises:
            AuthenticationError: If authentication fails
        """
        async with self._token_lock:
            # Check if current token is still valid
            if self._access_token and self._token_expires_at:
                if datetime.now(timezone.utc) < self._token_expires_at:
                    return  # Token is still valid

            # Get new application token
            try:
                self._access_token = await self._get_application_token()
            except Exception as e:
                if isinstance(e, AuthenticationError):
                    raise
                raise AuthenticationError(f"Failed to ensure valid token: {e}")

            # eBay application tokens typically last 2 hours
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(
                hours=2, minutes=-5
            )  # 5min buffer

            logger.info(
                "eBay application token obtained",
                expires_at=self._token_expires_at.isoformat(),
            )

    def _prepare_headers(
        self, headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, str]:
        """Prepare request headers with authentication."""
        prepared_headers = super()._prepare_headers(headers)

        # Add OAuth token if available
        if self._access_token:
            prepared_headers["Authorization"] = f"Bearer {self._access_token}"

        # eBay-specific headers
        prepared_headers.update(
            {
                "X-EBAY-C-ENDUSERCTX": "contextualLocation=country=US,zip=90210",
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",  # Default to US marketplace
            }
        )

        return prepared_headers

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> Any:
        """Make authenticated request with token refresh handling."""
        # Ensure we have a valid token
        await self._ensure_valid_token()

        try:
            return await super()._make_request(
                method, endpoint, params, json, headers, **kwargs
            )
        except AuthenticationError:
            # Token might have expired, try getting a new one
            logger.info("Authentication failed, attempting to get new token")
            self._access_token = None
            self._token_expires_at = None
            await self._ensure_valid_token()
            return await super()._make_request(
                method, endpoint, params, json, headers, **kwargs
            )

    # API Methods

    async def search_items(
        self,
        query: str,
        category_id: Optional[str] = None,
        condition: Optional[str] = None,
        price_min: Optional[float] = None,
        price_max: Optional[float] = None,
        sold_items: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Search for items using the Browse API.

        Args:
            query: Search query
            category_id: eBay category ID
            condition: Item condition filter
            price_min: Minimum price filter
            price_max: Maximum price filter
            sold_items: Whether to include sold items
            limit: Maximum number of results (max 200)
            offset: Pagination offset

        Returns:
            Search results with items and pagination info

        Raises:
            ValidationError: If parameters are invalid
        """
        if limit > 200:
            raise ValidationError("eBay Browse API limit cannot exceed 200")

        # Build search parameters
        params = {
            "q": query,
            "limit": limit,
            "offset": offset,
        }

        # Add filters
        filters = []

        if category_id:
            filters.append(f"categoryIds:{category_id}")

        if condition:
            # Map common conditions to eBay values
            condition_map = {
                "new": "NEW",
                "mint": "NEW",
                "near_mint": "LIKE_NEW",
                "lightly_played": "VERY_GOOD",
                "moderately_played": "GOOD",
                "heavily_played": "ACCEPTABLE",
                "damaged": "FOR_PARTS_OR_NOT_WORKING",
            }
            ebay_condition = condition_map.get(condition.lower(), condition.upper())
            filters.append(f"conditions:{ebay_condition}")

        if price_min is not None and price_max is not None:
            filters.append(f"price:[{price_min}..{price_max}]")
        elif price_min is not None:
            filters.append(f"price:[{price_min}..]")
        elif price_max is not None:
            filters.append(f"price:[..{price_max}]")

        if sold_items:
            filters.append("buyingOptions:AUCTION")  # Include auctions (sold items)

        if filters:
            params["filter"] = ",".join(filters)

        return await self.get("/buy/browse/v1/item_summary/search", params=params)

    async def get_item(self, item_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific item.

        Args:
            item_id: eBay item ID

        Returns:
            Item details
        """
        return await self.get(f"/buy/browse/v1/item/{item_id}")

    async def get_items_by_item_group(self, item_group_id: str) -> Dict[str, Any]:
        """
        Get items that are part of an item group (variations).

        Args:
            item_group_id: eBay item group ID

        Returns:
            Items in the group
        """
        return await self.get(
            "/buy/browse/v1/item_summary/get_items_by_item_group",
            params={"item_group_id": item_group_id},
        )

    async def search_pokemon_cards(
        self,
        card_name: str,
        set_name: Optional[str] = None,
        condition: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search for Pokemon cards specifically.

        Args:
            card_name: Pokemon card name
            set_name: Optional set name for filtering
            condition: Card condition filter
            limit: Maximum number of results

        Returns:
            List of Pokemon card items
        """
        # Build Pokemon-specific search query
        query_parts = ["Pokemon", card_name]
        if set_name:
            query_parts.append(set_name)

        query = " ".join(query_parts)

        # Use Pokemon cards category (183454)
        result = await self.search_items(
            query=query,
            category_id="183454",  # Pokemon Trading Cards category
            condition=condition,
            limit=limit,
        )

        return result.get("itemSummaries", [])

    async def search_one_piece_cards(
        self,
        card_name: str,
        set_name: Optional[str] = None,
        condition: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search for One Piece cards specifically.

        Args:
            card_name: One Piece card name
            set_name: Optional set name for filtering
            condition: Card condition filter
            limit: Maximum number of results

        Returns:
            List of One Piece card items
        """
        # Build One Piece-specific search query
        query_parts = ["One Piece", "card", card_name]
        if set_name:
            query_parts.append(set_name)

        query = " ".join(query_parts)

        # Use general Trading Cards category since One Piece doesn't have a specific one
        result = await self.search_items(
            query=query,
            category_id="2536",  # Trading Cards category
            condition=condition,
            limit=limit,
        )

        return result.get("itemSummaries", [])

    async def search_cards(
        self,
        query: str,
        tcg_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search for TCG cards by query and game type.

        Args:
            query: Search query
            tcg_type: TCG type (e.g. "pokemon", "onepiece")
            limit: Maximum number of results

        Returns:
            List of card listing dicts with price, itemId, title, imageUrl, viewItemURL
        """
        tcg = (tcg_type or "").lower()
        # Map game types to eBay search prefixes and category IDs
        game_config = {
            "pokemon": ("Pokemon", "183454"),
            "onepiece": ("One Piece card", "2536"),
            "one_piece": ("One Piece card", "2536"),
            "magic": ("MTG Magic the Gathering", "2536"),
            "yugioh": ("Yu-Gi-Oh", "2536"),
            "lorcana": ("Disney Lorcana", "2536"),
            "digimon": ("Digimon card", "2536"),
        }
        prefix, category = game_config.get(tcg, ("Trading card", "2536"))
        result = await self.search_items(
            query=f"{prefix} {query}",
            category_id=category,
            limit=limit,
        )
        items = result.get("itemSummaries", [])

        results = []
        for item in items:
            price_info = item.get("price", {})
            price_val = float(price_info["value"]) if price_info.get("value") else None
            results.append({
                "itemId": item.get("itemId", ""),
                "title": item.get("title", "Unknown"),
                "price": price_val,
                "imageUrl": (item.get("image", {}) or {}).get("imageUrl"),
                "viewItemURL": item.get("itemWebUrl"),
            })
        return results

    async def get_price_statistics(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate price statistics from a list of items.

        Args:
            items: List of item objects from search results

        Returns:
            Price statistics including min, max, average, and median
        """
        if not items:
            return {
                "count": 0,
                "min_price": None,
                "max_price": None,
                "avg_price": None,
                "median_price": None,
                "currency": "USD",
            }

        prices = []
        currency = "USD"  # Default currency

        for item in items:
            price_info = item.get("price", {})
            if price_info and "value" in price_info:
                prices.append(float(price_info["value"]))
                currency = price_info.get("currency", currency)

        if not prices:
            return {
                "count": 0,
                "min_price": None,
                "max_price": None,
                "avg_price": None,
                "median_price": None,
                "currency": currency,
            }

        prices.sort()
        count = len(prices)
        min_price = prices[0]
        max_price = prices[-1]
        avg_price = sum(prices) / count

        # Calculate median
        if count % 2 == 0:
            median_price = (prices[count // 2 - 1] + prices[count // 2]) / 2
        else:
            median_price = prices[count // 2]

        return {
            "count": count,
            "min_price": round(min_price, 2),
            "max_price": round(max_price, 2),
            "avg_price": round(avg_price, 2),
            "median_price": round(median_price, 2),
            "currency": currency,
        }

    async def search_and_analyze_card_prices(
        self,
        card_name: str,
        tcg_type: str = "pokemon",
        set_name: Optional[str] = None,
        condition: Optional[str] = None,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Search for a card and return price analysis.

        Args:
            card_name: Card name to search
            tcg_type: TCG type ("pokemon" or "onepiece")
            set_name: Optional set name for filtering
            condition: Card condition filter
            limit: Maximum number of results to analyze

        Returns:
            Search results with price analysis
        """
        # Search for cards based on TCG type using the generic search_cards method
        items = await self.search_cards(card_name, tcg_type=tcg_type, limit=limit)

        # Calculate price statistics
        price_stats = await self.get_price_statistics(items)

        return {
            "search_query": {
                "card_name": card_name,
                "tcg_type": tcg_type,
                "set_name": set_name,
                "condition": condition,
            },
            "items": items,
            "price_statistics": price_stats,
            "search_timestamp": datetime.now(timezone.utc).isoformat(),
        }
