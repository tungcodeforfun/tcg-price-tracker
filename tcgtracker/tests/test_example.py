"""Example tests for the TCG Price Tracker."""

import pytest
from tcgtracker.config import get_settings


def test_basic_configuration():
    """Test that basic configuration works."""
    settings = get_settings()

    # Test that settings object is created
    assert settings is not None

    # Test that basic settings are available
    assert hasattr(settings, "app")
    assert hasattr(settings, "database")
    assert hasattr(settings, "security")

    # Test some basic values
    assert settings.app.title == "TCG Price Tracker"
    assert len(settings.security.secret_key) >= 32


def test_database_url_generation():
    """Test database URL generation."""
    settings = get_settings()
    db_url = settings.database.url

    # Check basic URL format
    assert "postgresql+asyncpg://" in db_url
    assert settings.database.host in db_url
    assert settings.database.name in db_url


@pytest.mark.asyncio
async def test_imports():
    """Test that critical modules can be imported."""
    # Test core imports
    from tcgtracker.database import models
    from tcgtracker.database.connection import get_db_manager
    from tcgtracker.config import get_settings

    # Basic smoke test - ensure imports work
    assert models is not None
    assert get_db_manager is not None
    assert get_settings is not None
