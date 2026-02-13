"""Tests for eBay API client."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tcgtracker.integrations.ebay import eBayClient
from tcgtracker.utils.errors import AuthenticationError, ValidationError


class TesteBayClient:
    """Test cases for eBay API client."""

    @pytest.fixture
    def mock_token_response(self):
        """Mock OAuth token response."""
        return {
            "access_token": "mock_access_token",
            "token_type": "Application Access Token",
            "expires_in": 7200,
        }

    @pytest.fixture
    def mock_search_response(self):
        """Mock search API response."""
        return {
            "href": "https://api.ebay.com/buy/browse/v1/item_summary/search?q=Charizard&limit=50",
            "total": 1500,
            "next": "https://api.ebay.com/buy/browse/v1/item_summary/search?q=Charizard&limit=50&offset=50",
            "limit": 50,
            "offset": 0,
            "itemSummaries": [
                {
                    "itemId": "123456789012",
                    "title": "Pokemon Charizard Base Set Holo Rare 4/102 PSA 9",
                    "leafCategoryIds": ["183454"],
                    "categories": [
                        {
                            "categoryId": "183454",
                            "categoryName": "Pokémon Trading Cards",
                        }
                    ],
                    "image": {
                        "imageUrl": "https://i.ebayimg.com/thumbs/images/g/abc123/s-l225.jpg"
                    },
                    "price": {"value": "299.99", "currency": "USD"},
                    "itemHref": "https://api.ebay.com/buy/browse/v1/item/v1%7C123456789012%7C0",
                    "seller": {
                        "username": "card_seller_123",
                        "feedbackPercentage": "99.5",
                        "feedbackScore": 1500,
                    },
                    "condition": "Used",
                    "conditionId": "3000",
                    "thumbnailImages": [
                        {
                            "imageUrl": "https://i.ebayimg.com/thumbs/images/g/abc123/s-l64.jpg"
                        }
                    ],
                    "shippingOptions": [
                        {
                            "shippingCostType": "FIXED",
                            "shippingCost": {"value": "4.99", "currency": "USD"},
                        }
                    ],
                    "buyingOptions": ["FIXED_PRICE"],
                    "itemLocation": {"postalCode": "90210", "country": "US"},
                    "additionalImages": [],
                    "adultOnly": False,
                    "legacyItemId": "123456789012",
                    "availableCoupons": False,
                    "itemCreationDate": "2023-01-01T00:00:00.000Z",
                    "topRatedBuyingExperience": True,
                    "priorityListing": False,
                    "listingMarketplaceId": "EBAY_US",
                    "itemAffiliateWebUrl": "https://www.ebay.com/itm/123456789012",
                    "itemWebUrl": "https://www.ebay.com/itm/123456789012",
                }
            ],
        }

    @pytest.fixture
    def mock_item_response(self):
        """Mock get item API response."""
        return {
            "itemId": "123456789012",
            "title": "Pokemon Charizard Base Set Holo Rare 4/102 PSA 9",
            "shortDescription": "Authentic Pokemon Charizard card from Base Set",
            "price": {"value": "299.99", "currency": "USD"},
            "categoryPath": "Collectibles|Trading Cards|Pokémon Trading Cards",
            "categoryIdPath": "1|2536|183454",
            "condition": "Used",
            "conditionId": "3000",
            "conditionDescription": "Shows some wear but still in good condition",
            "itemLocation": {
                "postalCode": "90210",
                "country": "US",
                "city": "Beverly Hills",
                "stateOrProvince": "CA",
            },
            "image": {"imageUrl": "https://i.ebayimg.com/images/g/abc123/s-l500.jpg"},
            "additionalImages": [
                {"imageUrl": "https://i.ebayimg.com/images/g/abc123/s-l500.jpg"}
            ],
            "seller": {
                "username": "card_seller_123",
                "feedbackPercentage": "99.5",
                "feedbackScore": 1500,
                "sellerAccountType": "INDIVIDUAL",
            },
            "marketingPrice": {
                "originalPrice": {"value": "350.00", "currency": "USD"},
                "discountPercentage": "14",
                "discountAmount": {"value": "50.01", "currency": "USD"},
            },
            "shippingOptions": [
                {
                    "shippingServiceCode": "ShippingMethodStandard",
                    "shippingCost": {"value": "4.99", "currency": "USD"},
                    "minEstimatedDeliveryDate": "2023-12-01T00:00:00.000Z",
                    "maxEstimatedDeliveryDate": "2023-12-05T00:00:00.000Z",
                }
            ],
            "returnTerms": {
                "returnsAccepted": True,
                "refundMethod": "MONEY_BACK",
                "returnPeriod": {"value": 30, "unit": "DAY"},
                "returnShippingCostPayer": "BUYER",
            },
            "taxes": [
                {
                    "taxJurisdiction": {
                        "region": {
                            "regionName": "California",
                            "regionType": "STATE_OR_PROVINCE",
                        },
                        "taxJurisdictionId": "US_CA",
                    },
                    "taxType": "STATE_SALES_TAX",
                    "shippingAndHandlingTaxed": False,
                    "includedInPrice": False,
                }
            ],
            "buyingOptions": ["FIXED_PRICE"],
            "itemAffiliateWebUrl": "https://www.ebay.com/itm/123456789012",
            "itemWebUrl": "https://www.ebay.com/itm/123456789012",
        }

    @pytest.fixture
    async def client(self):
        """Create eBay client for testing."""
        client = eBayClient(
            client_id="test_client_id",
            client_secret="test_client_secret",
            base_url="https://api.ebay.com",
            environment="production",
        )
        yield client
        await client.close()

    @pytest.mark.asyncio
    async def test_client_initialization(self, client):
        """Test client initialization."""
        assert client.client_id == "test_client_id"
        assert client.client_secret == "test_client_secret"
        assert client.base_url == "https://api.ebay.com"
        assert client.service_name == "ebay"

    @pytest.mark.asyncio
    async def test_get_application_token(self, client, mock_token_response):
        """Test OAuth application token retrieval."""
        mock_response = MagicMock()
        mock_response.json.return_value = mock_token_response
        mock_response.raise_for_status.return_value = None

        with patch.object(client._client, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            token = await client._get_application_token()

            assert token == "mock_access_token"
            mock_post.assert_called_once()

            # Verify the request was made correctly
            call_args = mock_post.call_args
            assert call_args[0][0] == "https://api.ebay.com/identity/v1/oauth2/token"
            assert "Authorization" in call_args[1]["headers"]
            assert call_args[1]["data"]["grant_type"] == "client_credentials"

    @pytest.mark.asyncio
    async def test_ensure_valid_token_new_token(self, client, mock_token_response):
        """Test ensuring valid token when no token exists."""
        with patch.object(
            client, "_get_application_token", new_callable=AsyncMock
        ) as mock_get_token:
            mock_get_token.return_value = "mock_access_token"

            await client._ensure_valid_token()

            assert client._access_token == "mock_access_token"
            assert client._token_expires_at is not None
            mock_get_token.assert_called_once()

    @pytest.mark.asyncio
    async def test_ensure_valid_token_existing_valid_token(self, client):
        """Test ensuring valid token when valid token exists."""
        # Set up valid token
        client._access_token = "valid_token"
        client._token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        with patch.object(
            client, "_get_application_token", new_callable=AsyncMock
        ) as mock_get_token:
            await client._ensure_valid_token()

            # Should not request new token
            mock_get_token.assert_not_called()

    @pytest.mark.asyncio
    async def test_ensure_valid_token_expired_token(self, client):
        """Test ensuring valid token when token is expired."""
        # Set up expired token
        client._access_token = "expired_token"
        client._token_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)

        with patch.object(
            client, "_get_application_token", new_callable=AsyncMock
        ) as mock_get_token:
            mock_get_token.return_value = "new_access_token"

            await client._ensure_valid_token()

            assert client._access_token == "new_access_token"
            mock_get_token.assert_called_once()

    @pytest.mark.asyncio
    async def test_prepare_headers(self, client):
        """Test request header preparation."""
        client._access_token = "test_token"

        headers = client._prepare_headers({"Custom-Header": "value"})

        assert headers["Authorization"] == "Bearer test_token"
        assert headers["Custom-Header"] == "value"
        assert (
            headers["X-EBAY-C-ENDUSERCTX"] == "contextualLocation=country=US,zip=90210"
        )
        assert headers["X-EBAY-C-MARKETPLACE-ID"] == "EBAY_US"
        assert headers["User-Agent"] == "TCGTracker/ebay"

    @pytest.mark.asyncio
    async def test_search_items(self, client, mock_search_response):
        """Test search items API call."""
        with patch.object(client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_search_response

            result = await client.search_items(
                query="Charizard",
                category_id="183454",
                condition="near_mint",
                price_min=100.0,
                price_max=500.0,
                limit=50,
            )

            assert result == mock_search_response
            mock_get.assert_called_once()

            # Check that parameters were passed correctly
            call_args = mock_get.call_args
            params = call_args[1]["params"]
            assert params["q"] == "Charizard"
            assert params["limit"] == 50
            assert "categoryIds:183454" in params["filter"]
            assert "conditions:LIKE_NEW" in params["filter"]
            assert "price:[100.0..500.0]" in params["filter"]

    @pytest.mark.asyncio
    async def test_search_items_limit_validation(self, client):
        """Test search items with invalid limit."""
        with pytest.raises(
            ValidationError, match="eBay Browse API limit cannot exceed 200"
        ):
            await client.search_items("test", limit=250)

    @pytest.mark.asyncio
    async def test_get_item(self, client, mock_item_response):
        """Test get item API call."""
        with patch.object(client, "get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_item_response

            result = await client.get_item("123456789012")

            assert result == mock_item_response
            mock_get.assert_called_once_with("/buy/browse/v1/item/123456789012")

    @pytest.mark.asyncio
    async def test_search_pokemon_cards(self, client, mock_search_response):
        """Test Pokemon card search."""
        with patch.object(
            client, "search_items", new_callable=AsyncMock
        ) as mock_search:
            mock_search.return_value = mock_search_response

            result = await client.search_pokemon_cards(
                card_name="Charizard",
                set_name="Base Set",
                condition="near_mint",
                limit=50,
            )

            assert result == mock_search_response["itemSummaries"]
            mock_search.assert_called_once_with(
                query="Pokemon Charizard Base Set",
                category_id="183454",
                condition="near_mint",
                limit=50,
            )

    @pytest.mark.asyncio
    async def test_search_one_piece_cards(self, client, mock_search_response):
        """Test One Piece card search."""
        with patch.object(
            client, "search_items", new_callable=AsyncMock
        ) as mock_search:
            mock_search.return_value = mock_search_response

            result = await client.search_one_piece_cards(
                card_name="Luffy", set_name="Starter Deck", condition="mint", limit=25
            )

            assert result == mock_search_response["itemSummaries"]
            mock_search.assert_called_once_with(
                query="One Piece card Luffy Starter Deck",
                category_id="2536",
                condition="mint",
                limit=25,
            )

    @pytest.mark.asyncio
    async def test_get_price_statistics_empty_list(self, client):
        """Test price statistics with empty item list."""
        result = await client.get_price_statistics([])

        expected = {
            "count": 0,
            "min_price": None,
            "max_price": None,
            "avg_price": None,
            "median_price": None,
            "currency": "USD",
        }
        assert result == expected

    @pytest.mark.asyncio
    async def test_get_price_statistics_with_prices(self, client):
        """Test price statistics calculation."""
        items = [
            {"price": {"value": "100.00", "currency": "USD"}},
            {"price": {"value": "150.00", "currency": "USD"}},
            {"price": {"value": "200.00", "currency": "USD"}},
            {"price": {"value": "250.00", "currency": "USD"}},
            {"price": {"value": "300.00", "currency": "USD"}},
        ]

        result = await client.get_price_statistics(items)

        assert result["count"] == 5
        assert result["min_price"] == 100.00
        assert result["max_price"] == 300.00
        assert result["avg_price"] == 200.00
        assert result["median_price"] == 200.00
        assert result["currency"] == "USD"

    @pytest.mark.asyncio
    async def test_get_price_statistics_even_count(self, client):
        """Test price statistics calculation with even number of items."""
        items = [
            {"price": {"value": "100.00", "currency": "USD"}},
            {"price": {"value": "200.00", "currency": "USD"}},
            {"price": {"value": "300.00", "currency": "USD"}},
            {"price": {"value": "400.00", "currency": "USD"}},
        ]

        result = await client.get_price_statistics(items)

        assert result["count"] == 4
        assert result["min_price"] == 100.00
        assert result["max_price"] == 400.00
        assert result["avg_price"] == 250.00
        assert result["median_price"] == 250.00  # (200 + 300) / 2

    @pytest.mark.asyncio
    async def test_search_and_analyze_card_prices_pokemon(
        self, client, mock_search_response
    ):
        """Test card price analysis for Pokemon."""
        with patch.object(
            client, "search_pokemon_cards", new_callable=AsyncMock
        ) as mock_search:
            mock_search.return_value = mock_search_response["itemSummaries"]

            with patch.object(
                client, "get_price_statistics", new_callable=AsyncMock
            ) as mock_stats:
                mock_stats.return_value = {
                    "count": 1,
                    "min_price": 299.99,
                    "max_price": 299.99,
                    "avg_price": 299.99,
                    "median_price": 299.99,
                    "currency": "USD",
                }

                result = await client.search_and_analyze_card_prices(
                    card_name="Charizard",
                    tcg_type="pokemon",
                    set_name="Base Set",
                    condition="near_mint",
                    limit=50,
                )

                assert result["search_query"]["card_name"] == "Charizard"
                assert result["search_query"]["tcg_type"] == "pokemon"
                assert result["items"] == mock_search_response["itemSummaries"]
                assert "price_statistics" in result
                assert "search_timestamp" in result

                mock_search.assert_called_once_with(
                    "Charizard", "Base Set", "near_mint", 50
                )
                mock_stats.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_and_analyze_card_prices_onepiece(
        self, client, mock_search_response
    ):
        """Test card price analysis for One Piece."""
        with patch.object(
            client, "search_one_piece_cards", new_callable=AsyncMock
        ) as mock_search:
            mock_search.return_value = mock_search_response["itemSummaries"]

            with patch.object(
                client, "get_price_statistics", new_callable=AsyncMock
            ) as mock_stats:
                mock_stats.return_value = {"count": 1, "avg_price": 299.99}

                result = await client.search_and_analyze_card_prices(
                    card_name="Luffy", tcg_type="onepiece", limit=25
                )

                assert result["search_query"]["card_name"] == "Luffy"
                assert result["search_query"]["tcg_type"] == "onepiece"

                mock_search.assert_called_once_with("Luffy", None, None, 25)

    @pytest.mark.asyncio
    async def test_search_and_analyze_card_prices_invalid_tcg_type(self, client):
        """Test card price analysis with invalid TCG type."""
        with pytest.raises(ValidationError, match="Unsupported TCG type: invalid"):
            await client.search_and_analyze_card_prices(
                card_name="Test", tcg_type="invalid"
            )

    @pytest.mark.asyncio
    async def test_authentication_error_handling(self, client):
        """Test authentication error handling."""
        with patch.object(
            client, "_get_application_token", new_callable=AsyncMock
        ) as mock_get_token:
            mock_get_token.side_effect = Exception("Authentication failed")

            with pytest.raises(
                AuthenticationError, match="Failed to ensure valid token"
            ):
                await client._ensure_valid_token()

    @pytest.mark.asyncio
    async def test_rate_limiting(self, client):
        """Test rate limiting functionality."""
        assert client._rate_limiter is not None
        assert client._rate_limiter.requests_per_minute == 16
        assert client._rate_limiter.requests_per_hour > 0

    @pytest.mark.asyncio
    async def test_circuit_breaker_integration(self, client):
        """Test circuit breaker integration."""
        # Wait a bit for circuit breaker initialization
        import asyncio

        await asyncio.sleep(0.1)

        assert client._circuit_breaker_enabled
        # Circuit breaker should be initialized after async initialization
        if client._circuit_breaker:
            assert client._circuit_breaker.name == "ebay_api"
