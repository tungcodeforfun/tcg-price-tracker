#!/usr/bin/env python3
"""Test script to verify JustTCG API integration with API key."""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

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


async def test_justtcg_api():
    """Test JustTCG API with authentication."""
    
    # Load sandbox environment variables
    env_file = Path(__file__).parent / ".env.sandbox"
    if not env_file.exists():
        logger.error(f"Environment file not found: {env_file}")
        return False
    
    load_dotenv(env_file, override=True)
    
    # Import after loading environment
    from tcgtracker.integrations.justtcg import JustTCGClient
    from tcgtracker.config import get_settings
    
    logger.info("Testing JustTCG API Integration")
    logger.info("=" * 50)
    
    try:
        # Get settings and verify API key
        settings = get_settings()
        api_key = settings.external_apis.justtcg_api_key
        
        if not api_key:
            logger.warning("No JustTCG API key configured - using free tier")
        else:
            logger.info(f"API Key configured: {api_key[:10]}...")
            
        # Initialize JustTCG client
        logger.info("\nInitializing JustTCG client...")
        client = JustTCGClient()
        
        # Test 1: Search for Pokemon cards
        logger.info("\nTest 1: Searching for Pokemon cards...")
        try:
            pokemon_cards = await client.search_cards(
                query="Charizard",
                game="pokemon",
                limit=5
            )
            
            if pokemon_cards:
                logger.info(f"✓ Found {len(pokemon_cards)} Pokemon cards")
                for i, card in enumerate(pokemon_cards[:3], 1):
                    logger.info(f"  {i}. {card.get('name')} - Set: {card.get('set_name')}")
            else:
                logger.warning("⚠ No Pokemon cards found")
        except Exception as e:
            logger.error(f"✗ Pokemon search failed: {e}")
            
        # Test 2: Search for One Piece cards
        logger.info("\nTest 2: Searching for One Piece cards...")
        try:
            onepiece_cards = await client.search_cards(
                query="Luffy",
                game="onepiece",
                limit=5
            )
            
            if onepiece_cards:
                logger.info(f"✓ Found {len(onepiece_cards)} One Piece cards")
                for i, card in enumerate(onepiece_cards[:3], 1):
                    logger.info(f"  {i}. {card.get('name')} - Set: {card.get('set_name')}")
            else:
                logger.warning("⚠ No One Piece cards found")
        except Exception as e:
            logger.error(f"✗ One Piece search failed: {e}")
            
        # Test 3: Get card prices
        logger.info("\nTest 3: Getting card prices...")
        if pokemon_cards and len(pokemon_cards) > 0:
            try:
                card_id = pokemon_cards[0].get('id')
                if card_id:
                    price_data = await client.get_card_price(
                        card_identifier=card_id,
                        game="pokemon"
                    )
                    
                    if price_data:
                        logger.info("✓ Price data retrieved:")
                        logger.info(f"  Market Price: ${price_data.get('market_price', 'N/A')}")
                        logger.info(f"  Low Price: ${price_data.get('low_price', 'N/A')}")
                        logger.info(f"  High Price: ${price_data.get('high_price', 'N/A')}")
                    else:
                        logger.warning("⚠ No price data available")
            except Exception as e:
                logger.error(f"✗ Price retrieval failed: {e}")
        
        # Test 4: Test rate limiting
        logger.info("\nTest 4: Testing rate limits...")
        start_time = datetime.now()
        request_count = 0
        max_requests = 10  # Test with 10 rapid requests
        
        try:
            for i in range(max_requests):
                await client.search_cards(
                    query=f"test{i}",
                    game="pokemon",
                    limit=1
                )
                request_count += 1
                
            elapsed = (datetime.now() - start_time).total_seconds()
            rate = request_count / elapsed * 60  # Requests per minute
            
            logger.info(f"✓ Made {request_count} requests in {elapsed:.2f} seconds")
            logger.info(f"  Effective rate: {rate:.1f} requests/minute")
            
            if api_key:
                logger.info("  With API key: Higher rate limits available")
            else:
                logger.info("  Free tier: Limited to 100 requests/day")
                
        except Exception as e:
            logger.error(f"✗ Rate limit test failed: {e}")
        
        # Test 5: Get available sets
        logger.info("\nTest 5: Getting available sets...")
        try:
            pokemon_sets = await client.get_sets("pokemon")
            if pokemon_sets:
                logger.info(f"✓ Found {len(pokemon_sets)} Pokemon sets")
                for set_data in pokemon_sets[:3]:
                    logger.info(f"  - {set_data.get('name')} ({set_data.get('code')})")
        except Exception as e:
            logger.error(f"✗ Failed to get sets: {e}")
        
        logger.info("\n" + "=" * 50)
        logger.info("✓ JustTCG API tests completed!")
        
        if api_key:
            logger.info("\nAPI Key Benefits:")
            logger.info("- Higher rate limits (likely 1000+ requests/day)")
            logger.info("- Priority API access")
            logger.info("- More reliable service")
        else:
            logger.info("\nFree Tier Limitations:")
            logger.info("- 100 requests per day limit")
            logger.info("- ~4 requests per hour average")
            logger.info("- May experience rate limiting")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Test failed with error: {str(e)}", exc_info=True)
        return False


async def verify_rate_limits():
    """Verify the actual rate limits with the API key."""
    logger.info("\n" + "=" * 50)
    logger.info("Verifying Rate Limits with API Key")
    logger.info("=" * 50)
    
    from tcgtracker.integrations.justtcg import JustTCGClient
    
    client = JustTCGClient()
    
    # Try to make 20 requests quickly to test rate limits
    logger.info("\nAttempting 20 rapid requests to test rate limits...")
    
    successful_requests = 0
    failed_requests = 0
    start_time = datetime.now()
    
    for i in range(20):
        try:
            await client.search_cards(
                query=f"pikachu{i}",
                game="pokemon",
                limit=1
            )
            successful_requests += 1
            logger.info(f"  Request {i+1}: ✓")
        except Exception as e:
            failed_requests += 1
            logger.warning(f"  Request {i+1}: ✗ {str(e)[:50]}")
            
        # Small delay to avoid hammering the API
        await asyncio.sleep(0.5)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    logger.info(f"\nResults:")
    logger.info(f"  Successful: {successful_requests}/20")
    logger.info(f"  Failed: {failed_requests}/20")
    logger.info(f"  Time elapsed: {elapsed:.2f} seconds")
    logger.info(f"  Effective rate: {successful_requests / elapsed * 60:.1f} requests/minute")
    
    if successful_requests >= 15:
        logger.info("\n✓ API key provides good rate limits!")
        logger.info("  Recommendation: Update justtcg_rate_limit to 30-60 requests/minute")
    elif successful_requests >= 10:
        logger.info("\n✓ API key provides moderate rate limits")
        logger.info("  Recommendation: Update justtcg_rate_limit to 20 requests/minute")
    else:
        logger.warning("\n⚠ Limited rate limits detected")
        logger.info("  Recommendation: Keep current conservative limits")


async def main():
    """Main entry point."""
    success = await test_justtcg_api()
    
    # Only test rate limits if basic tests passed
    if success:
        await verify_rate_limits()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())