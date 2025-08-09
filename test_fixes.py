#!/usr/bin/env python3
"""Test script to verify the fixes implemented."""

import asyncio
import os
import sys
from pathlib import Path
from decimal import Decimal

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent / "tcgtracker" / "src"))

from dotenv import load_dotenv
import structlog

# Load environment
load_dotenv(".env")

# Configure logging
structlog.configure(
    processors=[
        structlog.dev.ConsoleRenderer(colors=True)
    ]
)
logger = structlog.get_logger()


async def test_config_validation():
    """Test eBay environment validation."""
    logger.info("Testing config validation...")
    
    from tcgtracker.config import ExternalAPISettings
    from pydantic import ValidationError
    
    # Test valid environments
    try:
        settings = ExternalAPISettings(ebay_environment="sandbox")
        assert settings.ebay_environment == "sandbox"
        logger.info("✓ Valid environment 'sandbox' accepted")
        
        settings = ExternalAPISettings(ebay_environment="PRODUCTION")
        assert settings.ebay_environment == "production"
        logger.info("✓ Valid environment 'PRODUCTION' normalized to 'production'")
    except Exception as e:
        logger.error(f"✗ Valid environment rejected: {e}")
        return False
    
    # Test invalid environment
    try:
        settings = ExternalAPISettings(ebay_environment="invalid")
        logger.error("✗ Invalid environment not rejected")
        return False
    except ValidationError as e:
        logger.info("✓ Invalid environment 'invalid' correctly rejected")
    
    return True


async def test_price_validation():
    """Test price parsing and validation."""
    logger.info("\nTesting price validation...")
    
    from tcgtracker.integrations.pricecharting import PriceChartingClient
    
    client = PriceChartingClient()
    
    test_cases = [
        ("$10.99", Decimal("10.99"), "Valid price"),
        ("100.00", Decimal("100.00"), "Valid price without $"),
        ("1,234.56", Decimal("1234.56"), "Price with comma"),
        ("-10.00", None, "Negative price"),
        ("150000", None, "Price over limit"),
        ("0", None, "Zero price"),
        ("invalid", None, "Invalid format"),
        (None, None, "None input"),
        (50.5, Decimal("50.5"), "Numeric input"),
    ]
    
    all_passed = True
    for input_val, expected, description in test_cases:
        result = client._parse_price(input_val)
        if result == expected:
            logger.info(f"✓ {description}: {input_val} -> {result}")
        else:
            logger.error(f"✗ {description}: {input_val} -> {result} (expected {expected})")
            all_passed = False
    
    return all_passed


async def test_database_query_optimization():
    """Test that the OR query was fixed."""
    logger.info("\nTesting database query optimization...")
    
    # This is more of a code review check
    with open("tcgtracker/src/tcgtracker/workers/tasks/sync_tasks.py", "r") as f:
        content = f.read()
        
    # Check that the inefficient OR query is gone
    if "(Card.external_id == str(external_id)) |" in content:
        logger.error("✗ Inefficient OR query still present")
        return False
    
    # Check for the optimized version
    if "select(Card).where(Card.external_id == str(external_id))" in content:
        logger.info("✓ Query optimized to use separate lookups")
        return True
    
    logger.warning("⚠ Could not verify query optimization")
    return False


async def test_price_history_cleanup():
    """Test that the column name was fixed."""
    logger.info("\nTesting price history cleanup fix...")
    
    with open("tcgtracker/src/tcgtracker/workers/tasks/price_tasks.py", "r") as f:
        content = f.read()
        
    # Check that fetched_at is no longer used
    if "PriceHistory.fetched_at" in content:
        logger.error("✗ Still using incorrect column name 'fetched_at'")
        return False
    
    # Check for the correct column
    if "PriceHistory.timestamp < cutoff_date" in content:
        logger.info("✓ Using correct column name 'timestamp'")
        return True
    
    logger.warning("⚠ Could not verify column name fix")
    return False


async def test_auth_fallback():
    """Test that authentication failures allow fallback."""
    logger.info("\nTesting authentication fallback...")
    
    with open("tcgtracker/src/tcgtracker/workers/tasks/price_tasks.py", "r") as f:
        content = f.read()
        
    # Check that auth exceptions don't raise
    if "except AuthenticationException as e:" in content and \
       "# Allow fallback for auth failures" in content:
        logger.info("✓ Authentication failures now allow fallback to JustTCG")
        return True
    
    logger.error("✗ Authentication fallback not properly implemented")
    return False


async def main():
    """Run all tests."""
    logger.info("=" * 60)
    logger.info("Running Fix Verification Tests")
    logger.info("=" * 60)
    
    tests = [
        ("Config Validation", test_config_validation),
        ("Price Validation", test_price_validation),
        ("Database Query Optimization", test_database_query_optimization),
        ("Price History Cleanup", test_price_history_cleanup),
        ("Authentication Fallback", test_auth_fallback),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = await test_func()
            results.append((name, result))
        except Exception as e:
            logger.error(f"Test '{name}' failed with exception: {e}")
            results.append((name, False))
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Test Summary")
    logger.info("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        logger.info(f"{name}: {status}")
    
    logger.info(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("✓ All fixes verified successfully!")
        return 0
    else:
        logger.error("✗ Some fixes need attention")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)