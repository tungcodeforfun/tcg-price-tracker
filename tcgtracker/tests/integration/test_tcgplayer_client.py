"""Tests for TCGPlayer API client."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tcgtracker.integrations.tcgplayer import TCGPlayerClient
from tcgtracker.utils.errors import AuthenticationError, ValidationError


class TestTCGPlayerClient:
    """Test cases for TCGPlayer API client."""

    @pytest.fixture
    def mock_token_response(self):
        """Mock OAuth token response."""
        return {
            "access_token": "mock_access_token",
            "refresh_token": "mock_refresh_token",
            "expires_in": 3600,
            "token_type": "Bearer",
        }

    @pytest.fixture
    def mock_categories_response(self):
        """Mock categories API response."""
        return {
            "success": True,
            "errors": [],
            "results": [
                {
                    "categoryId": 3,
                    "name": "Pokemon",
                    "modifiedOn": "2023-01-01T00:00:00Z",
                    "displayName": "Pokémon",
                    "seoCategoryName": "pokemon",
                    "sealedLabel": "Sealed Products",
                    "nonSealedLabel": "Singles",
                    "conditionGuideUrl": "https://help.tcgplayer.com/hc/en-us/articles/221430307-Pokemon-Card-Condition-Guide",
                    "isScannable": True,
                    "popularity": 1,
                },
                {
                    "categoryId": 83,
                    "name": "One Piece Card Game",
                    "modifiedOn": "2023-06-01T00:00:00Z",
                    "displayName": "One Piece Card Game",
                    "seoCategoryName": "one-piece-card-game",
                    "sealedLabel": "Sealed Products",
                    "nonSealedLabel": "Singles",
                    "conditionGuideUrl": "https://help.tcgplayer.com/hc/en-us/articles/360035624674",
                    "isScannable": False,
                    "popularity": 15,
                },
            ],
            "totalItems": 2,
        }

    @pytest.fixture
    def mock_products_response(self):
        """Mock products API response."""
        return {
            "success": True,
            "errors": [],
            "results": [
                {
                    "productId": 12345,
                    "name": "Charizard",
                    "cleanName": "Charizard",
                    "imageUrl": "https://example.com/charizard.jpg",
                    "categoryId": 3,
                    "groupId": 1,
                    "url": "https://www.tcgplayer.com/product/12345/pokemon-base-set-charizard",
                    "modifiedOn": "2023-01-01T00:00:00Z",
                    "productLineId": 1,
                    "productLineName": "Pokemon",
                    "setName": "Base Set",
                    "setUrlName": "base-set",
                }
            ],
            "totalItems": 1,
        }

    @pytest.fixture
    def mock_pricing_response(self):
        """Mock pricing API response."""
        return {
            "success": True,
            "errors": [],
            "results": [
                {
                    "productId": 12345,
                    "lowPrice": 150.00,
                    "midPrice": 200.00,
                    "highPrice": 300.00,
                    "marketPrice": 180.00,
                    "directLowPrice": 160.00,
                    "subTypeName": "Normal",
                }
            ],
        }

    @pytest.fixture
    async def client(self):
        """Create TCGPlayer client for testing."""
        client = TCGPlayerClient(
            client_id="test_client_id",
            client_secret="test_client_secret",
            auth_code="test_auth_code",
            base_url="https://api.tcgplayer.com",
        )
        yield client
        await client.close()

    @pytest.mark.asyncio
    async def test_client_initialization(self, client):
        """Test client initialization."""
        assert client.client_id == "test_client_id"
        assert client.client_secret == "test_client_secret"
        assert client.auth_code == "test_auth_code"
        assert client.base_url == "https://api.tcgplayer.com"
        assert client.service_name == "tcgplayer"

    @pytest.mark.asyncio
    async def test_oauth_token_exchange(self, client, mock_token_response):
        """Test OAuth token exchange."""
        with patch.object(
            client, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_token_response
            mock_request.return_value = mock_response

            result = await client._exchange_auth_code_for_tokens(
                "test_auth_code", "http://localhost:8000/callback"
            )

            assert result == mock_token_response
            mock_request.assert_called_once_with(
                "POST",
                "/oauth/token",
                json={
                    "grant_type": "authorization_code",
                    "client_id": "test_client_id",
                    "client_secret": "test_client_secret",
                    "code": "test_auth_code",
                    "redirect_uri": "http://localhost:8000/callback",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

    @pytest.mark.asyncio
    async def test_token_storage(self, client, mock_token_response):
        """Test token storage and expiration calculation."""
        await client._store_tokens(mock_token_response)

        assert client._access_token == "mock_access_token"
        assert client._refresh_token == "mock_refresh_token"
        assert client._token_expires_at is not None

        # Token should expire in about 1 hour minus 60 seconds buffer
        expected_expiry = datetime.utcnow() + timedelta(seconds=3600 - 60)
        time_diff = abs((client._token_expires_at - expected_expiry).total_seconds())
        assert time_diff < 5  # Allow 5 seconds variance

    @pytest.mark.asyncio
    async def test_token_refresh(self, client, mock_token_response):
        """Test access token refresh."""
        # Set up initial token state
        client._refresh_token = "mock_refresh_token"

        with patch.object(
            client, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_token_response
            mock_request.return_value = mock_response

            await client._refresh_access_token()

            assert client._access_token == "mock_access_token"
            mock_request.assert_called_once_with(
                "POST",
                "/oauth/token",
                json={
                    "grant_type": "refresh_token",
                    "client_id": "test_client_id",
                    "client_secret": "test_client_secret",
                    "refresh_token": "mock_refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

    @pytest.mark.asyncio
    async def test_ensure_valid_token_with_valid_token(self, client):
        """Test token validation when token is still valid."""
        # Set up valid token
        client._access_token = "valid_token"
        client._token_expires_at = datetime.utcnow() + timedelta(minutes=30)

        # Should not make any requests
        with patch.object(
            client, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            await client._ensure_valid_token()
            mock_request.assert_not_called()

    @pytest.mark.asyncio
    async def test_ensure_valid_token_with_expired_token(
        self, client, mock_token_response
    ):
        """Test token validation when token is expired."""
        # Set up expired token with refresh token
        client._access_token = "expired_token"
        client._token_expires_at = datetime.utcnow() - timedelta(minutes=5)
        client._refresh_token = "valid_refresh_token"

        with patch.object(
            client, "_make_request", new_callable=AsyncMock
        ) as mock_request:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_token_response
            mock_request.return_value = mock_response

            await client._ensure_valid_token()

            # Should have called refresh endpoint
            mock_request.assert_called_once()
            assert client._access_token == "mock_access_token"

    @pytest.mark.asyncio
    async def test_get_categories(self, client, mock_categories_response):
        """Test get categories API call."""
        with patch.object(client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_categories_response

            categories = await client.get_categories()

            assert len(categories) == 2
            assert categories[0]["categoryId"] == 3
            assert categories[0]["name"] == "Pokemon"
            assert categories[1]["categoryId"] == 83
            assert categories[1]["name"] == "One Piece Card Game"

            mock_get.assert_called_once_with("/v1.39.0/catalog/categories")

    @pytest.mark.asyncio
    async def test_get_pokemon_category_id(self, client, mock_categories_response):
        """Test getting Pokemon category ID."""
        with patch.object(
            client, "get_categories", new_callable=AsyncMock
        ) as mock_get_categories:
            mock_get_categories.return_value = mock_categories_response["results"]

            category_id = await client.get_pokemon_category_id()

            assert category_id == 3
            mock_get_categories.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_one_piece_category_id(self, client, mock_categories_response):
        """Test getting One Piece category ID."""
        with patch.object(
            client, "get_categories", new_callable=AsyncMock
        ) as mock_get_categories:
            mock_get_categories.return_value = mock_categories_response["results"]

            category_id = await client.get_one_piece_category_id()

            assert category_id == 83
            mock_get_categories.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_products(self, client, mock_products_response):
        """Test get products API call."""
        with patch.object(client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_products_response

            products = await client.get_products(category_id=3, set_id=1)

            assert products == mock_products_response
            mock_get.assert_called_once_with(
                "/v1.39.0/catalog/products",
                params={
                    "categoryId": 3,
                    "setId": 1,
                    "offset": 0,
                    "limit": 100,
                },
            )

    @pytest.mark.asyncio
    async def test_get_product_pricing(self, client, mock_pricing_response):
        """Test get product pricing API call."""
        with patch.object(client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_pricing_response

            pricing = await client.get_product_pricing([12345, 67890])

            assert pricing == mock_pricing_response["results"]
            mock_get.assert_called_once_with("/v1.39.0/pricing/product/12345,67890")

    @pytest.mark.asyncio
    async def test_get_product_pricing_too_many_ids(self, client):
        """Test product pricing with too many IDs."""
        product_ids = list(range(251))  # 251 IDs, exceeds limit of 250

        with pytest.raises(
            ValidationError, match="Cannot request pricing for more than 250 products"
        ):
            await client.get_product_pricing(product_ids)

    @pytest.mark.asyncio
    async def test_search_products(self, client, mock_products_response):
        """Test search products API call."""
        with patch.object(client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_products_response

            products = await client.search_products(
                "Charizard", category_id=3, limit=25
            )

            assert products == mock_products_response["results"]
            mock_get.assert_called_once_with(
                "/v1.39.0/catalog/products",
                params={
                    "q": "Charizard",
                    "categoryId": 3,
                    "limit": 25,
                },
            )

    @pytest.mark.asyncio
    async def test_authentication_error_handling(self, client):
        """Test authentication error handling."""
        # Clear tokens to force authentication
        client._access_token = None
        client._refresh_token = None
        client.auth_code = None

        with pytest.raises(AuthenticationError, match="No valid access token"):
            await client._ensure_valid_token()

    @pytest.mark.asyncio
    async def test_rate_limiting(self, client):
        """Test rate limiting functionality."""
        # Test that rate limiter is properly initialized
        assert client._rate_limiter is not None
        assert client._rate_limiter.requests_per_minute > 0

    @pytest.mark.asyncio
    async def test_circuit_breaker_integration(self, client):
        """Test circuit breaker integration."""
        # Wait a bit for circuit breaker initialization
        import asyncio

        await asyncio.sleep(0.1)

        assert client._circuit_breaker_enabled
        # Circuit breaker should be initialized after async initialization
        if client._circuit_breaker:
            assert client._circuit_breaker.name == "tcgplayer_api"

    @pytest.mark.asyncio
    async def test_request_headers(self, client):
        """Test request header preparation."""
        client._access_token = "test_token"

        headers = client._prepare_headers({"Custom-Header": "value"})

        assert headers["Authorization"] == "Bearer test_token"
        assert headers["Custom-Header"] == "value"
        assert headers["User-Agent"] == "TCGTracker/tcgplayer"
        assert headers["Accept"] == "application/json"
