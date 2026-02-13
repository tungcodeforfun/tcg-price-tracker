"""JustTCG API client for TCG price data."""

from decimal import Decimal
from typing import Any, Dict, List, Optional

import structlog

from tcgtracker.config import get_settings

from .base import BaseAPIClient

logger = structlog.get_logger(__name__)


class JustTCGClient(BaseAPIClient):
    """JustTCG API client for TCG price data."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        """
        Initialize JustTCG API client.

        Args:
            api_key: JustTCG API key
            base_url: API base URL
        """
        settings = get_settings()

        # Use provided values or fall back to config
        self.api_key = api_key or settings.external_apis.justtcg_api_key
        api_base_url = base_url or settings.external_apis.justtcg_base_url

        if not self.api_key:
            logger.warning("JustTCG API key not configured - using free tier limits")

        # Initialize base client with JustTCG rate limits
        # Free tier: 100 requests/day, ~4 requests/hour to be safe
        super().__init__(
            base_url=api_base_url,
            service_name="justtcg",
            requests_per_minute=settings.external_apis.justtcg_rate_limit,
            timeout=30,
            max_retries=3,
            circuit_breaker_enabled=True,
            circuit_breaker_failure_threshold=5,
            circuit_breaker_recovery_timeout=60,
        )

        logger.info(
            "JustTCG client initialized",
            base_url=api_base_url,
        )

    def _prepare_headers(
        self, headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, str]:
        """Prepare request headers with API authentication."""
        prepared_headers = super()._prepare_headers(headers)

        # Add API key if available - JustTCG uses X-API-Key header
        if self.api_key:
            prepared_headers["X-API-Key"] = self.api_key

        return prepared_headers

    # API Methods

    async def search_cards(
        self,
        query: str,
        game: Optional[str] = None,
        set_code: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Search for cards by name.

        Args:
            query: Search query
            game: Game type filter (pokemon, onepiece, magic, yugioh, lorcana, digimon)
            set_code: Set code filter
            limit: Maximum number of results (max 20 per request in free tier)

        Returns:
            List of card objects
        """
        params = {
            "q": query,
            "limit": min(limit, 20),  # Free tier limit
        }

        if game:
            params["game"] = game
        if set_code:
            params["set"] = set_code

        try:
            response = await self.get("/cards/search", params=params)
            cards = response.get("data", [])

            # Transform to consistent format
            return [self._transform_card(c) for c in cards]
        except Exception as e:
            logger.error(f"Error searching cards: {e}")
            return []

    async def get_card(self, card_id: str, game: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed card information with pricing.

        Args:
            card_id: Card ID
            game: Game type (pokemon, onepiece, etc.)

        Returns:
            Card object with price data
        """
        try:
            response = await self.get(f"/cards/{game}/{card_id}")
            if response and response.get("data"):
                return self._transform_card_detail(response["data"])
            return None
        except Exception as e:
            logger.error(f"Error getting card {card_id}: {e}")
            return None

    async def get_card_prices(
        self, card_ids: List[str], game: str, condition: str = "nm"
    ) -> List[Dict[str, Any]]:
        """
        Get current price data for multiple cards (batch).

        Args:
            card_ids: List of card IDs (max 20 in free tier)
            game: Game type
            condition: Card condition (nm, lp, mp, hp, dmg)

        Returns:
            List of price data objects
        """
        # Limit to 20 cards for free tier
        card_ids = card_ids[:20]

        params = {"ids": ",".join(card_ids), "game": game, "condition": condition}

        try:
            response = await self.get("/prices/batch", params=params)
            prices = response.get("data", [])
            return [self._transform_price_data(p) for p in prices]
        except Exception as e:
            logger.error(f"Error getting prices for cards: {e}")
            return []

    async def get_price_history(
        self, card_id: str, game: str, days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get price history for a card.

        Args:
            card_id: Card ID
            game: Game type
            days: Number of days of history

        Returns:
            List of price history entries
        """
        params = {"days": min(days, 90), "game": game}  # Limit history

        try:
            response = await self.get(f"/prices/history/{card_id}", params=params)
            history = response.get("data", [])
            return [self._transform_history_entry(h) for h in history]
        except Exception as e:
            logger.error(f"Error getting price history for {card_id}: {e}")
            return []

    async def get_sets(self, game: str) -> List[Dict[str, Any]]:
        """
        Get available sets for a game.

        Args:
            game: Game type (pokemon, onepiece, etc.)

        Returns:
            List of set objects
        """
        try:
            response = await self.get(f"/sets/{game}")
            sets = response.get("data", [])
            return [self._transform_set(s, game) for s in sets]
        except Exception as e:
            logger.error(f"Error getting sets for {game}: {e}")
            return []

    async def get_cards_in_set(
        self, set_code: str, game: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get all cards in a specific set.

        Args:
            set_code: Set code
            game: Game type
            limit: Maximum number of cards

        Returns:
            List of cards in the set
        """
        params = {"limit": limit, "game": game}

        try:
            response = await self.get(f"/sets/{set_code}/cards", params=params)
            cards = response.get("data", [])
            return [self._transform_card(c) for c in cards]
        except Exception as e:
            logger.error(f"Error getting cards for set {set_code}: {e}")
            return []

    async def get_pokemon_cards(
        self,
        query: Optional[str] = None,
        set_code: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get Pokemon cards.

        Args:
            query: Search query
            set_code: Set code filter
            limit: Maximum number of results

        Returns:
            List of Pokemon cards
        """
        return await self.search_cards(
            query=query or "", game="pokemon", set_code=set_code, limit=limit
        )

    async def get_onepiece_cards(
        self,
        query: Optional[str] = None,
        set_code: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get One Piece cards.

        Args:
            query: Search query
            set_code: Set code filter
            limit: Maximum number of results

        Returns:
            List of One Piece cards
        """
        return await self.search_cards(
            query=query or "", game="onepiece", set_code=set_code, limit=limit
        )

    async def get_card_price(
        self, card_identifier: str, game: str, condition: str = "nm"
    ) -> Optional[Dict[str, Any]]:
        """
        Get price data for a specific card.

        Args:
            card_identifier: Card ID or name
            game: Game type
            condition: Card condition

        Returns:
            Price data for the card
        """
        # First search for the card if identifier is a name
        if not card_identifier.isdigit():
            results = await self.search_cards(card_identifier, game=game, limit=1)
            if not results:
                return None
            card_identifier = results[0].get("id")

        # Get detailed price data
        prices = await self.get_card_prices([card_identifier], game, condition)
        return prices[0] if prices else None

    # Transform methods for consistent data format

    def _transform_card(self, card: Dict[str, Any]) -> Dict[str, Any]:
        """Transform JustTCG card to internal format."""
        tcgplayer_id = card.get("tcgplayerId")
        image_url = (
            f"https://product-images.tcgplayer.com/fit-in/437x437/{tcgplayer_id}.jpg"
            if tcgplayer_id
            else None
        )

        # Extract price from first variant if available
        variants = card.get("variants", [])
        market_price = None
        if variants:
            market_price = self._parse_price(variants[0].get("price"))

        return {
            "id": card.get("id"),
            "name": card.get("name"),
            "set_name": card.get("set_name"),
            "set_code": card.get("set_code"),
            "number": card.get("collector_number"),
            "rarity": card.get("rarity"),
            "image_url": image_url,
            "market_price": market_price,
            "justtcg_id": card.get("id"),
            "game": card.get("game"),
            "tcg_type": self._map_game_to_tcg_type(card.get("game")),
        }

    def _transform_card_detail(self, card: Dict[str, Any]) -> Dict[str, Any]:
        """Transform detailed card data."""
        base = self._transform_card(card)

        # Add price data if available
        prices = card.get("prices", {})
        base.update(
            {
                "market_price": self._parse_price(prices.get("market")),
                "low_price": self._parse_price(prices.get("low")),
                "mid_price": self._parse_price(prices.get("mid")),
                "high_price": self._parse_price(prices.get("high")),
                "foil_market_price": self._parse_price(prices.get("foil_market")),
                "conditions": prices.get("conditions", {}),
            }
        )

        return base

    def _transform_price_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform price data to internal format."""
        return {
            "card_id": data.get("card_id"),
            "market_price": self._parse_price(data.get("market_price")),
            "low_price": self._parse_price(data.get("low_price")),
            "mid_price": self._parse_price(data.get("mid_price")),
            "high_price": self._parse_price(data.get("high_price")),
            "foil_market_price": self._parse_price(data.get("foil_market")),
            "condition": data.get("condition", "nm"),
            "last_updated": data.get("updated_at"),
            "source": "justtcg",
        }

    def _transform_history_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Transform price history entry."""
        return {
            "date": entry.get("date"),
            "market_price": self._parse_price(entry.get("market_price")),
            "low_price": self._parse_price(entry.get("low_price")),
            "mid_price": self._parse_price(entry.get("mid_price")),
            "high_price": self._parse_price(entry.get("high_price")),
            "condition": entry.get("condition", "nm"),
        }

    def _transform_set(self, set_data: Dict[str, Any], game: str) -> Dict[str, Any]:
        """Transform set data to internal format."""
        return {
            "id": set_data.get("id"),
            "name": set_data.get("name"),
            "code": set_data.get("code"),
            "tcg_type": self._map_game_to_tcg_type(game),
            "release_date": set_data.get("release_date"),
            "card_count": set_data.get("total_cards"),
            "justtcg_id": set_data.get("id"),
        }

    def _map_game_to_tcg_type(self, game: str) -> str:
        """Map JustTCG game names to our TCG types."""
        mapping = {
            "pokemon": "pokemon",
            "onepiece": "onepiece",
            "magic": "magic",
            "yugioh": "yugioh",
            "lorcana": "lorcana",
            "digimon": "digimon",
        }
        return mapping.get(game, game)

    def _parse_price(self, price_value: Any) -> Optional[Decimal]:
        """Parse price value to Decimal."""
        if price_value is None:
            return None

        if isinstance(price_value, (int, float)):
            return Decimal(str(price_value))

        if isinstance(price_value, str):
            # Remove currency symbols and convert
            cleaned = price_value.replace("$", "").replace(",", "").strip()
            try:
                return Decimal(cleaned) if cleaned and cleaned != "N/A" else None
            except Exception:
                return None

        return None
