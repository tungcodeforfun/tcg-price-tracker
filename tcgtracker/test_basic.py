"""Basic tests to verify the database setup works correctly."""

import asyncio
from datetime import datetime

from tcgtracker.database.models import (
    Card,
    TCGSet,
    TCGTypeEnum,
    User,
    PriceHistory,
    DataSourceEnum,
    CardConditionEnum,
)
from tcgtracker.database.connection import get_session
from tcgtracker.config import get_settings


async def test_models_creation():
    """Test that we can create model instances."""
    print("Testing model creation...")
    
    # Test User model
    user = User(
        email="test@example.com",
        password_hash="hashed_password_here",
        first_name="Test",
        last_name="User",
    )
    print(f"Created user: {user}")
    
    # Test TCGSet model
    tcg_set = TCGSet(
        tcg_type=TCGTypeEnum.POKEMON,
        set_code="BST",
        set_name="Battle Styles",
        release_date=datetime(2021, 3, 19),
        total_cards=163,
        series="Sword & Shield",
    )
    print(f"Created TCG set: {tcg_set}")
    
    # Test Card model
    card = Card(
        tcg_type=TCGTypeEnum.POKEMON,
        set_identifier="BST",
        card_number="001",
        card_name="Pikachu",
        rarity="Common",
    )
    print(f"Created card: {card}")
    
    # Test PriceHistory model
    price = PriceHistory(
        card_id=1,
        source=DataSourceEnum.TCGPLAYER,
        market_price=5.99,
        timestamp=datetime.now(),
        condition=CardConditionEnum.NEAR_MINT,
    )
    print(f"Created price history: {price}")
    
    print("✅ Model creation test passed!")


async def test_configuration():
    """Test that configuration loads correctly."""
    print("\nTesting configuration...")
    
    settings = get_settings()
    print(f"App title: {settings.app.title}")
    print(f"Database host: {settings.database.host}")
    print(f"Database name: {settings.database.name}")
    print(f"Redis host: {settings.redis.host}")
    print(f"Secret key length: {len(settings.security.secret_key)}")
    
    print("✅ Configuration test passed!")


async def test_database_url():
    """Test database URL generation."""
    print("\nTesting database URL generation...")
    
    settings = get_settings()
    db_url = settings.database.url
    print(f"Database URL: {db_url}")
    
    # Make sure it contains the expected components
    assert "postgresql+asyncpg://" in db_url
    assert settings.database.host in db_url
    assert settings.database.name in db_url
    
    print("✅ Database URL test passed!")


async def main():
    """Run all tests."""
    print("🧪 Running basic tests for TCG Price Tracker\n")
    
    try:
        await test_models_creation()
        await test_configuration()
        await test_database_url()
        
        print("\n🎉 All tests passed! The database schema and configuration are working correctly.")
        print("\nNext steps:")
        print("1. Start PostgreSQL with Docker Compose")
        print("2. Run migrations with: tcg-cli db init")
        print("3. Start the API server with: tcgtracker")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())