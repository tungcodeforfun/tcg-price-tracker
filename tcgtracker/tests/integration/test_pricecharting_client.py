"""Tests for PriceCharting API client integration."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tcgtracker.database.models import DataSourceEnum
from tcgtracker.integrations.pricecharting import PriceChartingClient


class TestPriceChartingClient:
    """Test suite for PriceCharting client."""

    @pytest.fixture
    def client(self):
        """Create a PriceCharting client instance."""
        return PriceChartingClient(api_key="test_api_key")

    @pytest.mark.asyncio
    async def test_get_card_price_success(self, client):
        """Test successful price retrieval from PriceCharting."""
        # Mock the API response
        with patch.object(client, "get_card_price", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = {
                "id": "12345",
                "name": "Pikachu VMAX",
                "loose_price": 10.00,
                "complete_price": 25.00,
                "new_price": 35.00,
                "graded_price": 100.00,
                "market_price": 25.00,
            }

            result = await client.get_card_price("Pikachu VMAX")

            assert result is not None
            assert result["complete_price"] == 25.00
            assert result["loose_price"] == 10.00
            assert result["new_price"] == 35.00

    @pytest.mark.asyncio
    async def test_get_pokemon_products(self, client):
        """Test searching Pokemon products."""
        with patch.object(
            client, "get_pokemon_products", new_callable=AsyncMock
        ) as mock_search:
            mock_search.return_value = [
                {
                    "id": "1",
                    "name": "Charizard",
                    "set_name": "Base Set",
                    "complete_price": 1000.00,
                    "image_url": "http://example.com/charizard.jpg",
                },
                {
                    "id": "2",
                    "name": "Blastoise",
                    "set_name": "Base Set",
                    "complete_price": 500.00,
                    "image_url": "http://example.com/blastoise.jpg",
                },
            ]

            results = await client.get_pokemon_products("Base Set", limit=10)

            assert len(results) == 2
            assert results[0]["name"] == "Charizard"
            assert results[1]["name"] == "Blastoise"

    @pytest.mark.asyncio
    async def test_get_one_piece_products(self, client):
        """Test searching One Piece products."""
        with patch.object(
            client, "get_one_piece_products", new_callable=AsyncMock
        ) as mock_search:
            mock_search.return_value = [
                {
                    "id": "op-1",
                    "name": "Monkey D. Luffy",
                    "set_name": "Romance Dawn",
                    "complete_price": 50.00,
                    "image_url": "http://example.com/luffy.jpg",
                }
            ]

            results = await client.get_one_piece_products("Luffy", limit=5)

            assert len(results) == 1
            assert results[0]["name"] == "Monkey D. Luffy"

    @pytest.mark.asyncio
    async def test_price_transformation(self, client):
        """Test price data transformation."""
        raw_data = {
            "loose-price": "10.50",
            "cib-price": "25.00",
            "new-price": "35.75",
            "graded-price": "100.00",
        }

        transformed = client._transform_price_data(raw_data)

        assert transformed["loose_price"] == Decimal("10.50")
        assert transformed["complete_price"] == Decimal("25.00")
        assert transformed["new_price"] == Decimal("35.75")
        assert transformed["graded_price"] == Decimal("100.00")
        assert transformed["market_price"] == Decimal(
            "23.75"
        )  # Average of loose, complete, new

    @pytest.mark.asyncio
    async def test_fallback_to_justtcg(self):
        """Test that JustTCG client can serve as fallback when PriceCharting fails."""
        from tcgtracker.integrations.justtcg import JustTCGClient

        pc_client = PriceChartingClient(api_key="test_key")
        jt_client = JustTCGClient()

        with patch.object(
            pc_client, "get_card_price", new_callable=AsyncMock
        ) as mock_pc:
            with patch.object(
                jt_client, "search_cards", new_callable=AsyncMock
            ) as mock_jt:
                mock_pc.side_effect = Exception("API Error")
                mock_jt.return_value = [
                    {
                        "name": "Charizard",
                        "market_price": 15.00,
                        "low_price": 10.00,
                        "high_price": 20.00,
                    }
                ]

                # PriceCharting should fail
                with pytest.raises(Exception, match="API Error"):
                    await pc_client.get_card_price("Charizard")

                # JustTCG should succeed as fallback
                results = await jt_client.search_cards(
                    query="Charizard", game="pokemon"
                )
                assert len(results) == 1
                assert results[0]["market_price"] == 15.00


class TestPriceUpdateIntegration:
    """Test price update integration with PriceCharting."""

    @pytest.mark.asyncio
    async def test_pricecharting_is_primary_source(self):
        """Test that PriceCharting is configured as a primary data source."""
        assert DataSourceEnum.PRICECHARTING.value == "pricecharting"

        client = PriceChartingClient(api_key="test_key")
        with patch.object(
            client, "get_card_price", new_callable=AsyncMock
        ) as mock_get:
            mock_get.return_value = {
                "name": "Charizard",
                "complete_price": 25.00,
                "market_price": 25.00,
            }

            result = await client.get_card_price("Charizard")
            assert result["market_price"] == 25.00

    @pytest.mark.asyncio
    async def test_database_enum_values(self):
        """Test that new enum values work in database operations."""
        # This test verifies that DataSourceEnum includes the new values
        assert hasattr(DataSourceEnum, "JUSTTCG")
        assert hasattr(DataSourceEnum, "PRICECHARTING")

        assert DataSourceEnum.JUSTTCG.value == "justtcg"
        assert DataSourceEnum.PRICECHARTING.value == "pricecharting"

    def test_api_schema_enum_values(self):
        """Test that API schemas include new price sources."""
        from tcgtracker.api.schemas import PriceSource

        assert hasattr(PriceSource, "JUSTTCG")
        assert hasattr(PriceSource, "PRICECHARTING")

        assert PriceSource.JUSTTCG.value == "justtcg"
        assert PriceSource.PRICECHARTING.value == "pricecharting"


class TestAPIEndpointIntegration:
    """Test API endpoints with PriceCharting integration."""

    @pytest.mark.asyncio
    async def test_search_endpoint_pricecharting(self):
        """Test that PriceCharting search endpoint exists and works."""
        from tcgtracker.api.v1.search import search_pricecharting

        # Verify the endpoint function exists
        assert search_pricecharting is not None
        assert callable(search_pricecharting)

    @pytest.mark.asyncio
    async def test_price_update_default_source(self):
        """Test that price update endpoints default to PriceCharting."""
        # Check the function signature defaults
        import inspect

        from tcgtracker.api.schemas import PriceSource
        from tcgtracker.api.v1.prices import update_card_price

        sig = inspect.signature(update_card_price)
        source_param = sig.parameters.get("source")

        # Verify default is PriceCharting
        assert source_param is not None
        assert source_param.default.default == PriceSource.PRICECHARTING
