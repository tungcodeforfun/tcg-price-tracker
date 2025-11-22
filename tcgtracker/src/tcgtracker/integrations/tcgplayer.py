"""TCGPlayer API client with OAuth implementation."""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import structlog

from tcgtracker.config import get_settings
from tcgtracker.utils.errors import AuthenticationError, ValidationError

from .base import BaseAPIClient

logger = structlog.get_logger(__name__)


class TCGPlayerClient(BaseAPIClient):
    """TCGPlayer API client with OAuth 2.0 authentication."""

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        auth_code: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> None:
        """
        Initialize TCGPlayer API client.

        Args:
            client_id: TCGPlayer client ID
            client_secret: TCGPlayer client secret
            auth_code: TCGPlayer authorization code
            base_url: API base URL
        """
        settings = get_settings()

        # Use provided values or fall back to config
        self.client_id = client_id or settings.external_apis.tcgplayer_client_id
        self.client_secret = (
            client_secret or settings.external_apis.tcgplayer_client_secret
        )
        self.auth_code = auth_code or settings.external_apis.tcgplayer_auth_code
        api_base_url = base_url or settings.external_apis.tcgplayer_base_url

        if not self.client_id or not self.client_secret:
            raise ValueError("TCGPlayer client ID and secret are required")

        # Initialize base client with TCGPlayer rate limits (300 requests per minute)
        super().__init__(
            base_url=api_base_url,
            service_name="tcgplayer",
            requests_per_minute=settings.external_apis.tcgplayer_rate_limit,
            timeout=30,
            max_retries=3,
            circuit_breaker_enabled=True,
            circuit_breaker_failure_threshold=5,
            circuit_breaker_recovery_timeout=60,
        )

        # OAuth tokens
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._token_lock = asyncio.Lock()

        logger.info(
            "TCGPlayer client initialized",
            base_url=api_base_url,
        )

    async def _get_authorization_url(
        self, redirect_uri: str, state: Optional[str] = None
    ) -> str:
        """
        Get OAuth authorization URL for user consent.

        Args:
            redirect_uri: Redirect URI after authorization
            state: Optional state parameter for security

        Returns:
            Authorization URL
        """
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": "read:products read:pricing",
        }

        if state:
            params["state"] = state

        return f"{self.base_url}/oauth/authorize?{urlencode(params)}"

    async def _exchange_auth_code_for_tokens(
        self, auth_code: str, redirect_uri: str
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            auth_code: Authorization code from OAuth flow
            redirect_uri: Redirect URI used in authorization

        Returns:
            Token response

        Raises:
            AuthenticationError: If token exchange fails
        """
        token_data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "redirect_uri": redirect_uri,
        }

        try:
            # Make token request without authentication headers
            response = await self._make_request(
                "POST",
                "/oauth/token",
                json=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            return response.json()
        except Exception as exc:
            raise AuthenticationError(
                f"Failed to exchange authorization code: {str(exc)}"
            )

    async def _refresh_access_token(self) -> None:
        """
        Refresh access token using refresh token.

        Raises:
            AuthenticationError: If token refresh fails
        """
        if not self._refresh_token:
            raise AuthenticationError("No refresh token available")

        token_data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self._refresh_token,
        }

        try:
            response = await self._make_request(
                "POST",
                "/oauth/token",
                json=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            token_response = response.json()
            await self._store_tokens(token_response)

            logger.info("Access token refreshed successfully")

        except Exception as exc:
            logger.error("Failed to refresh access token")
            # Clear stored tokens on refresh failure
            self._access_token = None
            self._refresh_token = None
            self._token_expires_at = None
            raise AuthenticationError(f"Failed to refresh access token: {str(exc)}")

    async def _store_tokens(self, token_response: Dict[str, Any]) -> None:
        """
        Store OAuth tokens from response.

        Args:
            token_response: Token response from OAuth endpoint
        """
        self._access_token = token_response.get("access_token")
        self._refresh_token = token_response.get("refresh_token")

        # Calculate expiration time
        expires_in = token_response.get("expires_in", 3600)  # Default to 1 hour
        self._token_expires_at = datetime.utcnow() + timedelta(
            seconds=expires_in - 60
        )  # 60s buffer

        logger.info("OAuth tokens stored successfully")

    async def _ensure_valid_token(self) -> None:
        """
        Ensure we have a valid access token, refreshing if necessary.

        Raises:
            AuthenticationError: If authentication fails
        """
        async with self._token_lock:
            # Check if we need to refresh the token
            if self._access_token and self._token_expires_at:
                if datetime.utcnow() < self._token_expires_at:
                    return  # Token is still valid

            # Try to refresh if we have a refresh token
            if self._refresh_token:
                await self._refresh_access_token()
                return

            # No valid token or refresh token, need new authorization
            if self.auth_code:
                # Use provided auth code (for initial setup)
                logger.debug("Exchanging auth code for tokens")
                token_response = await self._exchange_auth_code_for_tokens(
                    self.auth_code,
                    "http://localhost:8000/oauth/callback",  # Default callback
                )
                await self._store_tokens(token_response)
                return

            raise AuthenticationError(
                "No valid access token and no way to obtain one. "
                "Please provide an authorization code or refresh token."
            )

    def _prepare_headers(
        self, headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, str]:
        """Prepare request headers with OAuth authentication."""
        prepared_headers = super()._prepare_headers(headers)

        # Add OAuth token if available
        if self._access_token:
            prepared_headers["Authorization"] = f"Bearer {self._access_token}"

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
        # Ensure we have a valid token (except for token endpoints)
        if not endpoint.startswith("/oauth/"):
            await self._ensure_valid_token()

        try:
            return await super()._make_request(
                method, endpoint, params, json, headers, **kwargs
            )
        except AuthenticationError:
            # Token might have expired, try refreshing once
            if not endpoint.startswith("/oauth/") and self._refresh_token:
                logger.info("Authentication failed, attempting token refresh")
                await self._refresh_access_token()
                return await super()._make_request(
                    method, endpoint, params, json, headers, **kwargs
                )
            raise

    # API Methods

    async def get_categories(self) -> List[Dict[str, Any]]:
        """
        Get all TCG categories.

        Returns:
            List of category objects
        """
        response = await self.get("/v1.39.0/catalog/categories")
        return response.get("results", [])

    async def get_category_groups(self, category_id: int) -> List[Dict[str, Any]]:
        """
        Get groups for a specific category.

        Args:
            category_id: Category ID

        Returns:
            List of group objects
        """
        response = await self.get(f"/v1.39.0/catalog/categories/{category_id}/groups")
        return response.get("results", [])

    async def get_sets(
        self,
        category_id: int,
        group_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Get sets for a category/group.

        Args:
            category_id: Category ID
            group_id: Optional group ID for filtering
            offset: Pagination offset
            limit: Number of results per page

        Returns:
            Sets response with results and pagination info
        """
        params = {
            "categoryId": category_id,
            "offset": offset,
            "limit": limit,
        }

        if group_id:
            params["groupId"] = group_id

        return await self.get("/v1.39.0/catalog/sets", params=params)

    async def get_products(
        self,
        category_id: int,
        set_id: Optional[int] = None,
        product_name: Optional[str] = None,
        offset: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Get products (cards) for a category/set.

        Args:
            category_id: Category ID
            set_id: Optional set ID for filtering
            product_name: Optional product name filter
            offset: Pagination offset
            limit: Number of results per page

        Returns:
            Products response with results and pagination info
        """
        params = {
            "categoryId": category_id,
            "offset": offset,
            "limit": limit,
        }

        if set_id:
            params["setId"] = set_id
        if product_name:
            params["productName"] = product_name

        return await self.get("/v1.39.0/catalog/products", params=params)

    async def get_product_pricing(
        self,
        product_ids: List[int],
    ) -> List[Dict[str, Any]]:
        """
        Get pricing information for products.

        Args:
            product_ids: List of product IDs (max 250)

        Returns:
            List of pricing objects

        Raises:
            ValidationError: If too many product IDs provided
        """
        if len(product_ids) > 250:
            raise ValidationError(
                "Cannot request pricing for more than 250 products at once"
            )

        # Convert to comma-separated string
        product_ids_str = ",".join(map(str, product_ids))

        response = await self.get(f"/v1.39.0/pricing/product/{product_ids_str}")
        return response.get("results", [])

    async def get_market_prices(
        self,
        product_ids: List[int],
    ) -> List[Dict[str, Any]]:
        """
        Get market prices for products.

        Args:
            product_ids: List of product IDs (max 250)

        Returns:
            List of market price objects

        Raises:
            ValidationError: If too many product IDs provided
        """
        if len(product_ids) > 250:
            raise ValidationError(
                "Cannot request market prices for more than 250 products at once"
            )

        product_ids_str = ",".join(map(str, product_ids))

        response = await self.get(f"/v1.39.0/pricing/marketprices/{product_ids_str}")
        return response.get("results", [])

    async def search_products(
        self,
        query: str,
        category_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Search for products by name.

        Args:
            query: Search query
            category_id: Optional category filter
            limit: Maximum number of results

        Returns:
            List of product objects
        """
        params = {
            "q": query,
            "limit": limit,
        }

        if category_id:
            params["categoryId"] = category_id

        response = await self.get("/v1.39.0/catalog/products", params=params)
        return response.get("results", [])

    async def get_pokemon_category_id(self) -> Optional[int]:
        """Get Pokemon TCG category ID."""
        categories = await self.get_categories()
        for category in categories:
            if "pokemon" in category.get("name", "").lower():
                return category.get("categoryId")
        return None

    async def get_one_piece_category_id(self) -> Optional[int]:
        """Get One Piece TCG category ID."""
        categories = await self.get_categories()
        for category in categories:
            name = category.get("name", "").lower()
            if "one piece" in name or "onepiece" in name:
                return category.get("categoryId")
        return None
