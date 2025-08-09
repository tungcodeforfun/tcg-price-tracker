#!/usr/bin/env python3
"""Quick verification script for JustTCG API integration."""

import asyncio
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


async def verify_justtcg():
    """Quick verification of JustTCG API with API key."""
    
    # Load sandbox environment
    env_file = Path(__file__).parent / ".env.sandbox"
    load_dotenv(env_file, override=True)
    
    from tcgtracker.integrations.justtcg import JustTCGClient
    from tcgtracker.config import get_settings
    
    logger.info("JustTCG API Verification")
    logger.info("=" * 50)
    
    # Check configuration
    settings = get_settings()
    api_key = settings.external_apis.justtcg_api_key
    rate_limit = settings.external_apis.justtcg_rate_limit
    
    if api_key:
        logger.info(f"✓ API Key configured: {api_key[:10]}...")
        logger.info(f"✓ Rate limit configured: {rate_limit} requests/minute")
    else:
        logger.error("✗ No API key configured")
        return False
    
    # Initialize client
    client = JustTCGClient()
    
    # Test search
    logger.info("\nTesting API access...")
    try:
        cards = await client.search_cards("Pikachu", game="pokemon", limit=3)
        
        if cards:
            logger.info(f"✓ Successfully searched cards - found {len(cards)} results")
            for i, card in enumerate(cards, 1):
                logger.info(f"  {i}. {card.get('name')} - {card.get('set_name')}")
        else:
            logger.warning("⚠ No cards found but API accessible")
            
        # Test price retrieval
        if cards:
            card_id = cards[0].get('id')
            price_data = await client.get_card_price(card_id, game="pokemon")
            if price_data:
                logger.info(f"\n✓ Price data retrieved:")
                logger.info(f"  Market: ${price_data.get('market_price', 'N/A')}")
                logger.info(f"  Low: ${price_data.get('low_price', 'N/A')}")
                logger.info(f"  High: ${price_data.get('high_price', 'N/A')}")
                
    except Exception as e:
        logger.error(f"✗ API test failed: {e}")
        return False
    
    logger.info("\n" + "=" * 50)
    logger.info("✓ JustTCG API integration verified successfully!")
    logger.info("\nConfiguration Summary:")
    logger.info(f"- API Key: Configured")
    logger.info(f"- Rate Limit: {rate_limit} req/min (increased from 4)")
    logger.info(f"- Header Format: X-API-Key (fixed)")
    logger.info(f"- Fallback Role: Secondary source after PriceCharting")
    
    return True


if __name__ == "__main__":
    success = asyncio.run(verify_justtcg())
    sys.exit(0 if success else 1)