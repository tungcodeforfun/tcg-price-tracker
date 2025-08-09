# JustTCG API Integration Guide

## Overview

JustTCG is integrated as a **fallback pricing source** in the TCG Price Tracker. When PriceCharting fails or is unavailable, the system automatically falls back to JustTCG for pricing data. With an API key, JustTCG provides reliable access to Pokemon, One Piece, Magic, Yu-Gi-Oh!, Lorcana, and Digimon card prices.

## Features

- Real-time card pricing data
- Support for multiple TCG games
- Price history tracking
- Set and card catalog information
- Automatic fallback from PriceCharting
- Rate limiting and circuit breaker protection

## API Key Benefits

### Without API Key (Free Tier)
- **Rate Limit**: 100 requests per day (~4/hour sustainable)
- **Access**: Limited API functionality
- **Reliability**: May experience rate limiting
- **Support**: Community support only

### With API Key (Authenticated)
- **Rate Limit**: 1000 requests per day (~40/minute peak, 30/minute configured)
- **Access**: Full API functionality
- **Reliability**: Priority API access
- **Support**: Developer support available
- **Performance**: 10x higher limits than free tier

## Configuration

### Getting an API Key

1. Visit [JustTCG API Dashboard](https://justtcg.com/api/dashboard)
2. Create a developer account
3. Generate your API key
4. Your key will look like: `tcg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Environment Setup

Add your JustTCG API key to your environment file:

```bash
# .env or .env.sandbox
API_JUSTTCG_API_KEY="tcg_your_api_key_here"
```

### Configuration File Updates

The system automatically configures:
- **Rate Limit**: 30 requests/minute (conservative setting for 1000/day quota)
- **Header Format**: `X-API-Key` (corrected from Bearer token)
- **Timeout**: 30 seconds
- **Retries**: 3 attempts with exponential backoff

## Usage

### Automatic Fallback

The system automatically uses JustTCG when PriceCharting fails:

```python
# In price_tasks.py - automatic fallback mechanism
try:
    # Try PriceCharting first
    price_data = await task.pricecharting_client.get_card_price(...)
except Exception:
    # Fallback to JustTCG
    price_data = await task.justtcg_client.get_card_price(...)
```

### Direct API Usage

```python
from tcgtracker.integrations.justtcg import JustTCGClient

# Initialize client (uses API key from environment)
client = JustTCGClient()

# Search for cards
pokemon_cards = await client.search_cards(
    query="Charizard",
    game="pokemon",
    limit=20
)

# Get card prices
price_data = await client.get_card_price(
    card_identifier="charizard-base-set",
    game="pokemon",
    condition="nm"  # near mint
)

# Get price history
history = await client.get_price_history(
    card_id="12345",
    game="pokemon",
    days=30
)

# Get available sets
sets = await client.get_sets("pokemon")
```

## Supported TCG Games

- `pokemon` - Pokemon Trading Card Game
- `onepiece` - One Piece Card Game
- `magic` - Magic: The Gathering
- `yugioh` - Yu-Gi-Oh!
- `lorcana` - Disney Lorcana
- `digimon` - Digimon Card Game

## API Methods

### Core Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `search_cards()` | Search for cards by name | query, game, set_code, limit |
| `get_card()` | Get detailed card info | card_id, game |
| `get_card_price()` | Get current pricing | card_identifier, game, condition |
| `get_card_prices()` | Batch price retrieval | card_ids[], game, condition |
| `get_price_history()` | Historical price data | card_id, game, days |
| `get_sets()` | List available sets | game |
| `get_cards_in_set()` | Cards in specific set | set_code, game, limit |

### Condition Values

- `nm` - Near Mint
- `lp` - Lightly Played
- `mp` - Moderately Played
- `hp` - Heavily Played
- `dmg` - Damaged

## Testing

### Quick Verification

Run the verification script to test your API key:

```bash
python verify_justtcg.py
```

Expected output:
```
JustTCG API Verification
==================================================
✓ API Key configured: tcg_3a691d...
✓ Rate limit configured: 30 requests/minute

Testing API access...
✓ Successfully searched cards - found 3 results
  1. Charizard - Base Set
  2. Charizard GX - Hidden Fates
  3. Charizard VMAX - Darkness Ablaze

✓ Price data retrieved:
  Market: $425.00
  Low: $350.00
  High: $500.00

==================================================
✓ JustTCG API integration verified successfully!

Configuration Summary:
- API Key: Configured
- Rate Limit: 30 req/min (increased from 4)
- Header Format: X-API-Key (fixed)
- Fallback Role: Secondary source after PriceCharting
```

### Integration Testing

```bash
# Full test suite
python test_justtcg_api.py

# Debug authentication issues
python debug_justtcg.py
```

## Error Handling

The integration includes comprehensive error handling:

```python
try:
    price_data = await client.get_card_price(...)
except RateLimitError:
    # Wait and retry with exponential backoff
except AuthenticationError:
    # Check API key configuration
except NetworkError:
    # Handle network issues
except ValidationError:
    # Check input parameters
```

## Rate Limiting

With API key configured:
- **Configured Rate**: 30 requests/minute (conservative to stay within daily quota)
- **Daily Limit**: 1000 requests (10x more than free tier)
- **Burst Handling**: Automatic rate limiting with sleep
- **Circuit Breaker**: Fails fast after 5 consecutive errors

## Troubleshooting

### Common Issues

1. **"API key is required" error**
   - Ensure API key is in environment file
   - Verify key format: `tcg_xxxxxxxx...`
   - Check header is `X-API-Key` not `Authorization`

2. **Rate limit exceeded**
   - With API key: Check if exceeding 1000 requests/day
   - Without API key: Limited to 100 requests/day
   - Implement caching to reduce API calls

3. **No results found**
   - Verify game parameter matches supported values
   - Check card name spelling
   - Try broader search terms

4. **Authentication failures**
   - Verify API key is valid
   - Check environment variable is loaded
   - Ensure no extra spaces in API key

### Debug Commands

```bash
# Check environment variable
echo $API_JUSTTCG_API_KEY

# Test API directly
curl -H "X-API-Key: your_key" \
  "https://api.justtcg.com/v1/cards/search?q=pikachu&game=pokemon&limit=1"

# Check logs
grep "justtcg" logs/app.log
```

## Best Practices

1. **Always use API key** for production to avoid rate limiting
2. **Cache responses** to minimize API calls
3. **Implement retry logic** with exponential backoff
4. **Monitor rate limits** in application logs
5. **Use batch endpoints** when fetching multiple card prices
6. **Handle fallback gracefully** from PriceCharting

## Security

- **Never commit API keys** to version control
- **Use environment variables** for all credentials
- **Rotate keys periodically** for security
- **Monitor API usage** for unusual patterns
- **Use HTTPS only** for API communications

## Support

- JustTCG API Documentation: https://justtcg.com/api/docs
- API Dashboard: https://justtcg.com/api/dashboard
- Support Email: support@justtcg.com
- TCG Price Tracker Issues: [GitHub Issues](https://github.com/your-repo/issues)