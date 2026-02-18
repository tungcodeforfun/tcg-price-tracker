"""Tests for collection endpoints and helpers."""

from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from tcgtracker.api.v1.collections import _populate_item_runtime_fields


# ---------------------------------------------------------------------------
# Unit tests for _populate_item_runtime_fields
# ---------------------------------------------------------------------------


class TestPopulateItemRuntimeFields:
    """Tests for the runtime field population helper."""

    def _make_card(self, latest_market_price=None):
        card = MagicMock()
        card.latest_market_price = latest_market_price
        card.latest_price = None
        return card

    def _make_item(self, card=None, quantity=1):
        item = MagicMock()
        item.card = card
        item.quantity = quantity
        item.current_value = None
        return item

    def test_sets_latest_price_from_market_price(self):
        """latest_price should be copied from latest_market_price."""
        card = self._make_card(latest_market_price=Decimal("25.50"))
        item = self._make_item(card=card, quantity=2)

        _populate_item_runtime_fields(item)

        assert card.latest_price == Decimal("25.50")

    def test_sets_current_value_quantity_times_price(self):
        """current_value = latest_market_price * quantity."""
        card = self._make_card(latest_market_price=Decimal("10.00"))
        item = self._make_item(card=card, quantity=3)

        _populate_item_runtime_fields(item)

        assert item.current_value == Decimal("30.00")

    def test_sets_current_value_zero_when_no_market_price(self):
        """current_value should be 0 when latest_market_price is None."""
        card = self._make_card(latest_market_price=None)
        item = self._make_item(card=card, quantity=5)

        _populate_item_runtime_fields(item)

        assert item.current_value == Decimal(0)

    def test_sets_current_value_zero_when_no_card(self):
        """current_value should be 0 when card relationship is None."""
        item = self._make_item(card=None, quantity=1)

        _populate_item_runtime_fields(item)

        assert item.current_value == Decimal(0)

    def test_single_quantity(self):
        """current_value equals price when quantity is 1."""
        card = self._make_card(latest_market_price=Decimal("3096.14"))
        item = self._make_item(card=card, quantity=1)

        _populate_item_runtime_fields(item)

        assert item.current_value == Decimal("3096.14")
        assert card.latest_price == Decimal("3096.14")

    def test_large_quantity(self):
        """Handles large quantities correctly."""
        card = self._make_card(latest_market_price=Decimal("0.77"))
        item = self._make_item(card=card, quantity=123)

        _populate_item_runtime_fields(item)

        assert item.current_value == Decimal("0.77") * 123


# ---------------------------------------------------------------------------
# Integration tests for collection endpoints
# ---------------------------------------------------------------------------


def _make_fake_card(card_id=1, name="Test Card", set_name="Test Set", price=Decimal("10.00")):
    """Create a fake Card-like object."""
    card = MagicMock()
    card.id = card_id
    card.tcg_type = "pokemon"
    card.name = name
    card.set_name = set_name
    card.card_number = None
    card.rarity = None
    card.external_id = "test-ext-id"
    card.image_url = None
    card.search_count = 0
    card.tcg_set_id = None
    card.latest_market_price = price
    card.latest_price = None
    card.latest_price_updated_at = None
    card.price_trend = None
    card.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    card.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return card


def _make_fake_collection_item(
    item_id=1, user_id=1, card_id=1, quantity=1, card=None,
    condition="near_mint", purchase_price=Decimal("5.00"),
):
    """Create a fake CollectionItem-like object."""
    item = MagicMock()
    item.id = item_id
    item.user_id = user_id
    item.card_id = card_id
    item.quantity = quantity
    item.condition = condition
    item.purchase_price = purchase_price
    item.notes = None
    item.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    item.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    item.card = card
    item.current_value = None
    return item


class TestCollectionEndpoints:
    """Integration tests for collection API endpoints using dependency overrides."""

    @pytest.fixture
    def fake_user(self):
        user = MagicMock()
        user.id = 1
        user.is_active = True
        return user

    @pytest.fixture
    def fake_card(self):
        return _make_fake_card()

    @pytest.fixture
    def app(self, fake_user):
        """Create app with overridden dependencies."""
        from tcgtracker.main import create_app
        from tcgtracker.api.dependencies import get_current_user, get_session

        app = create_app()

        async def override_user():
            return fake_user

        async def override_session():
            yield AsyncMock()

        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_session] = override_session
        return app

    @pytest.fixture
    async def client(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

    @pytest.mark.asyncio
    async def test_add_item_new(self, app, client, fake_card):
        """POST /collections/items creates a new item when card not in collection."""
        fake_item = _make_fake_collection_item(card=fake_card, card_id=fake_card.id)
        fake_item.card.latest_price = fake_item.card.latest_market_price

        mock_session = AsyncMock()

        # First execute: card lookup -> returns card
        # Second execute: existing item check -> returns None
        # Third execute (after commit): re-fetch item with card
        card_result = MagicMock()
        card_result.scalar_one_or_none.return_value = fake_card

        no_existing_result = MagicMock()
        no_existing_result.scalar_one_or_none.return_value = None

        refetch_result = MagicMock()
        refetch_result.scalar_one.return_value = fake_item

        mock_session.execute = AsyncMock(
            side_effect=[card_result, no_existing_result, refetch_result]
        )
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.post(
            "/api/v1/collections/items",
            json={"card_id": 1, "quantity": 1, "condition": "near_mint", "purchase_price": 5.0},
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["card"]["name"] == "Test Card"
        assert data["current_value"] is not None

    @pytest.mark.asyncio
    async def test_add_item_duplicate_increments_quantity(self, app, client, fake_card):
        """POST /collections/items increments quantity when item already exists."""
        existing = _make_fake_collection_item(card=fake_card, card_id=fake_card.id, quantity=2)
        # After increment, quantity should be 3
        updated = _make_fake_collection_item(
            card=fake_card, card_id=fake_card.id, quantity=3
        )
        updated.card.latest_price = updated.card.latest_market_price

        mock_session = AsyncMock()

        card_result = MagicMock()
        card_result.scalar_one_or_none.return_value = fake_card

        existing_result = MagicMock()
        existing_result.scalar_one_or_none.return_value = existing

        refetch_result = MagicMock()
        refetch_result.scalar_one.return_value = updated

        mock_session.execute = AsyncMock(
            side_effect=[card_result, existing_result, refetch_result]
        )
        mock_session.commit = AsyncMock()

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.post(
            "/api/v1/collections/items",
            json={"card_id": 1, "quantity": 1, "condition": "near_mint"},
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["quantity"] == 3

    @pytest.mark.asyncio
    async def test_update_item(self, app, client, fake_card):
        """PUT /collections/items/{id} updates and returns full item with card."""
        item = _make_fake_collection_item(card=fake_card, card_id=fake_card.id, quantity=1)
        updated_item = _make_fake_collection_item(
            card=fake_card, card_id=fake_card.id, quantity=5
        )
        updated_item.card.latest_price = updated_item.card.latest_market_price

        mock_session = AsyncMock()

        # First execute: find item
        find_result = MagicMock()
        find_result.scalar_one_or_none.return_value = item

        # Second execute: re-fetch after commit
        refetch_result = MagicMock()
        refetch_result.scalar_one.return_value = updated_item

        mock_session.execute = AsyncMock(side_effect=[find_result, refetch_result])
        mock_session.commit = AsyncMock()

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.put(
            "/api/v1/collections/items/1",
            json={"quantity": 5},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["quantity"] == 5
        assert data["card"] is not None
        assert data["current_value"] is not None

    @pytest.mark.asyncio
    async def test_update_item_not_found(self, app, client):
        """PUT /collections/items/{id} returns 404 for non-existent item."""
        mock_session = AsyncMock()
        find_result = MagicMock()
        find_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=find_result)

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.put(
            "/api/v1/collections/items/999",
            json={"quantity": 5},
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_add_item_card_not_found(self, app, client):
        """POST /collections/items returns 404 when card doesn't exist."""
        mock_session = AsyncMock()
        card_result = MagicMock()
        card_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=card_result)

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.post(
            "/api/v1/collections/items",
            json={"card_id": 999, "quantity": 1, "condition": "near_mint"},
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_item(self, app, client):
        """DELETE /collections/items/{id} removes the item."""
        item = _make_fake_collection_item()

        mock_session = AsyncMock()
        find_result = MagicMock()
        find_result.scalar_one_or_none.return_value = item
        mock_session.execute = AsyncMock(return_value=find_result)
        mock_session.delete = AsyncMock()
        mock_session.commit = AsyncMock()

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.delete("/api/v1/collections/items/1")

        assert resp.status_code == 204
        mock_session.delete.assert_called_once_with(item)

    @pytest.mark.asyncio
    async def test_delete_item_not_found(self, app, client):
        """DELETE /collections/items/{id} returns 404 for non-existent item."""
        mock_session = AsyncMock()
        find_result = MagicMock()
        find_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=find_result)

        from tcgtracker.api.dependencies import get_session

        async def override_session():
            yield mock_session

        app.dependency_overrides[get_session] = override_session

        resp = await client.delete("/api/v1/collections/items/999")

        assert resp.status_code == 404
