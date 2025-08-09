#!/usr/bin/env python3
"""Test script to verify eBay sandbox integration."""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent / "tcgtracker" / "src"))

from dotenv import load_dotenv
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.dev.ConsoleRenderer(colors=True)
    ]
)
logger = structlog.get_logger()


async def test_ebay_sandbox():
    """Test eBay sandbox API connection and basic functionality."""
    
    # Load sandbox environment variables
    env_file = Path(__file__).parent / ".env.sandbox"
    if not env_file.exists():
        logger.error(f"Sandbox environment file not found: {env_file}")
        logger.info("Please create .env.sandbox with your eBay sandbox credentials")
        return False
    
    load_dotenv(env_file)
    
    # Import after loading environment
    from tcgtracker.integrations.ebay import eBayClient
    from tcgtracker.config import get_settings
    
    logger.info("Testing eBay Sandbox Integration")
    logger.info("=" * 50)
    
    try:
        # Get settings and verify environment
        settings = get_settings()
        environment = settings.external_apis.ebay_environment
        
        logger.info(f"Environment: {environment}")
        
        if environment.lower() != "sandbox":
            logger.warning("Environment is not set to 'sandbox'. Switching to sandbox mode.")
            environment = "sandbox"
        
        # Check credentials
        sandbox_client_id = settings.external_apis.ebay_sandbox_client_id
        if not sandbox_client_id or sandbox_client_id.startswith("PLACEHOLDER"):
            logger.error("eBay sandbox client ID not configured properly")
            return False
        
        logger.info(f"Sandbox Client ID: {sandbox_client_id[:15]}...")
        
        # Initialize eBay client
        logger.info("\nInitializing eBay sandbox client...")
        client = eBayClient(environment="sandbox")
        
        # Test 1: Get OAuth token
        logger.info("\nTest 1: Obtaining OAuth application token...")
        await client._ensure_valid_token()
        
        if client._access_token:
            logger.info("✓ Successfully obtained OAuth token")
            logger.info(f"Token expires at: {client._token_expires_at}")
        else:
            logger.error("✗ Failed to obtain OAuth token")
            return False
        
        # Test 2: Search for Pokemon cards
        logger.info("\nTest 2: Searching for Pokemon cards...")
        search_results = await client.search_pokemon_cards(
            card_name="Pikachu",
            limit=5
        )
        
        if search_results:
            logger.info(f"✓ Found {len(search_results)} Pokemon cards")
            for i, item in enumerate(search_results[:3], 1):
                title = item.get("title", "Unknown")[:60]
                price = item.get("price", {})
                logger.info(f"  {i}. {title}... - ${price.get('value', 'N/A')}")
        else:
            logger.warning("⚠ No Pokemon cards found (this might be normal for sandbox)")
        
        # Test 3: Search for One Piece cards
        logger.info("\nTest 3: Searching for One Piece cards...")
        search_results = await client.search_one_piece_cards(
            card_name="Luffy",
            limit=5
        )
        
        if search_results:
            logger.info(f"✓ Found {len(search_results)} One Piece cards")
            for i, item in enumerate(search_results[:3], 1):
                title = item.get("title", "Unknown")[:60]
                price = item.get("price", {})
                logger.info(f"  {i}. {title}... - ${price.get('value', 'N/A')}")
        else:
            logger.warning("⚠ No One Piece cards found (this might be normal for sandbox)")
        
        # Test 4: General search
        logger.info("\nTest 4: General search test...")
        general_results = await client.search_items(
            query="trading cards",
            limit=5
        )
        
        items = general_results.get("itemSummaries", [])
        if items:
            logger.info(f"✓ Found {len(items)} items in general search")
            logger.info(f"Total items available: {general_results.get('total', 'Unknown')}")
        else:
            logger.warning("⚠ No items found in general search")
        
        # Test 5: Price statistics
        if items:
            logger.info("\nTest 5: Calculating price statistics...")
            price_stats = await client.get_price_statistics(items)
            
            logger.info("✓ Price statistics calculated:")
            logger.info(f"  Count: {price_stats.get('count', 0)}")
            logger.info(f"  Min Price: ${price_stats.get('min_price', 'N/A')}")
            logger.info(f"  Max Price: ${price_stats.get('max_price', 'N/A')}")
            logger.info(f"  Avg Price: ${price_stats.get('avg_price', 'N/A')}")
            logger.info(f"  Median Price: ${price_stats.get('median_price', 'N/A')}")
        
        logger.info("\n" + "=" * 50)
        logger.info("✓ All eBay sandbox tests completed successfully!")
        logger.info("\nNotes:")
        logger.info("- Sandbox environment may have limited or test data")
        logger.info("- Some searches may return empty results")
        logger.info("- OAuth token obtained successfully indicates proper setup")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Test failed with error: {str(e)}", exc_info=True)
        return False


async def main():
    """Main entry point."""
    success = await test_ebay_sandbox()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())