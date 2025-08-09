# eBay API Integration Guide

## Overview

The TCG Price Tracker integrates with eBay's Browse API to fetch real-time pricing data for Pokemon and One Piece trading cards. The integration supports both **sandbox** (testing) and **production** (live) environments.

## Features

- OAuth 2.0 authentication with automatic token renewal
- Search for Pokemon and One Piece cards
- Get detailed item information
- Calculate price statistics (min, max, average, median)
- Rate limiting and circuit breaker protection
- Environment-based configuration (sandbox/production)

## Configuration

### Environment Variables

The eBay integration requires the following environment variables:

```bash
# Environment selection
API_EBAY_ENVIRONMENT="sandbox"  # or "production"

# Production credentials (for live data)
API_EBAY_CLIENT_ID="your-production-client-id"
API_EBAY_CLIENT_SECRET="your-production-client-secret"

# Sandbox credentials (for testing)
API_EBAY_SANDBOX_CLIENT_ID="your-sandbox-client-id"
API_EBAY_SANDBOX_CLIENT_SECRET="your-sandbox-client-secret"
```

### Getting eBay API Credentials

#### Sandbox Credentials (Testing)
1. Go to [eBay Developer Portal](https://developer.ebay.com)
2. Create a developer account if you don't have one
3. Navigate to "My Account" → "Application Keys"
4. Select "Sandbox" environment
5. Create a new keyset for your application
6. Copy the App ID (Client ID) and Cert ID (Client Secret)

#### Production Credentials (Live)
1. Go to [eBay Developer Portal](https://developer.ebay.com)
2. Navigate to "My Account" → "Application Keys"
3. Select "Production" environment
4. Create a new keyset for your application
5. Complete eBay's application review process
6. Copy the App ID (Client ID) and Cert ID (Client Secret)

### Setting Up Environment Files

#### Development/Testing (.env.sandbox)
```bash
# eBay Sandbox Configuration
API_EBAY_ENVIRONMENT="sandbox"
API_EBAY_SANDBOX_CLIENT_ID="YourApp-Sandbox-SBX-xxxxxxxxx"
API_EBAY_SANDBOX_CLIENT_SECRET="SBX-xxxxxxxxxxxxx"

# Leave production credentials empty
API_EBAY_CLIENT_ID=""
API_EBAY_CLIENT_SECRET=""
```

#### Production (.env.production)
```bash
# eBay Production Configuration
API_EBAY_ENVIRONMENT="production"
API_EBAY_CLIENT_ID="YourApp-Production-PRD-xxxxxxxxx"
API_EBAY_CLIENT_SECRET="PRD-xxxxxxxxxxxxx"

# Optional: Include sandbox for testing in production environment
API_EBAY_SANDBOX_CLIENT_ID=""
API_EBAY_SANDBOX_CLIENT_SECRET=""
```

## Usage

### Basic Usage

```python
from tcgtracker.integrations.ebay import eBayClient

# Initialize client (will use environment configuration)
client = eBayClient()

# Search for Pokemon cards
pokemon_results = await client.search_pokemon_cards(
    card_name="Charizard",
    condition="near_mint",
    limit=50
)

# Search for One Piece cards
onepiece_results = await client.search_one_piece_cards(
    card_name="Luffy",
    set_name="Romance Dawn",
    limit=50
)

# Get price statistics
price_stats = await client.get_price_statistics(pokemon_results)
print(f"Average price: ${price_stats['avg_price']}")
print(f"Median price: ${price_stats['median_price']}")
```

### Explicit Environment Selection

```python
# Force sandbox environment regardless of configuration
sandbox_client = eBayClient(environment="sandbox")

# Force production environment
production_client = eBayClient(environment="production")
```

### Advanced Search Options

```python
# General item search with filters
results = await client.search_items(
    query="Pokemon Charizard Base Set",
    category_id="183454",  # Pokemon Trading Cards
    condition="near_mint",
    price_min=100.00,
    price_max=500.00,
    sold_items=False,
    limit=100,
    offset=0
)

# Get detailed item information
item_details = await client.get_item(item_id="v1|123456789|0")

# Search and analyze prices in one call
analysis = await client.search_and_analyze_card_prices(
    card_name="Pikachu",
    tcg_type="pokemon",
    set_name="Base Set",
    condition="mint",
    limit=100
)
```

## Testing

### Running the Sandbox Test

A test script is provided to verify your eBay sandbox integration:

```bash
# Create sandbox environment file
cp .env.example .env.sandbox
# Edit .env.sandbox with your sandbox credentials

# Run the test
python test_ebay_sandbox.py
```

Expected output:
```
Testing eBay Sandbox Integration
==================================================
Environment: sandbox
Sandbox Client ID: YourApp-Sandbox...

Test 1: Obtaining OAuth application token...
✓ Successfully obtained OAuth token
Token expires at: 2025-08-09 15:31:55.921456

Test 2: Searching for Pokemon cards...
⚠ No Pokemon cards found (this might be normal for sandbox)

Test 3: Searching for One Piece cards...
⚠ No One Piece cards found (this might be normal for sandbox)

Test 4: General search test...
⚠ No items found in general search

==================================================
✓ All eBay sandbox tests completed successfully!

Notes:
- Sandbox environment may have limited or test data
- Some searches may return empty results
- OAuth token obtained successfully indicates proper setup
```

### Important Notes for Sandbox

- **Limited Data**: The sandbox environment contains minimal test data
- **No Real Transactions**: All data is for testing purposes only
- **OAuth Success**: If the OAuth token is obtained successfully, your configuration is correct
- **Empty Results**: Empty search results are normal in sandbox mode

## API Rate Limits

- **Production**: 5,000 calls per day (default)
- **Sandbox**: Unlimited calls for testing
- **Configured Rate Limiting**: 1,000 requests per hour (configurable)

The integration includes automatic rate limiting to prevent exceeding eBay's limits:
- 16 requests per minute (approximately 1,000/hour)
- Exponential backoff on rate limit errors
- Circuit breaker protection after 5 consecutive failures

## Condition Mapping

The integration automatically maps standard TCG conditions to eBay conditions:

| TCG Condition | eBay Condition |
|--------------|----------------|
| new / mint | NEW |
| near_mint | LIKE_NEW |
| lightly_played | VERY_GOOD |
| moderately_played | GOOD |
| heavily_played | ACCEPTABLE |
| damaged | FOR_PARTS_OR_NOT_WORKING |

## Error Handling

The client includes comprehensive error handling:

```python
from tcgtracker.utils.errors import (
    AuthenticationError,
    RateLimitError,
    ValidationError,
    NetworkError
)

try:
    results = await client.search_pokemon_cards("Charizard")
except AuthenticationError:
    print("Invalid credentials or token expired")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except ValidationError:
    print("Invalid search parameters")
except NetworkError:
    print("Network connectivity issue")
```

## Environment Switching

### Development Workflow

1. Start with sandbox environment for development
2. Test all integration features with sandbox credentials
3. Switch to production when ready to go live

### Docker Configuration

For Docker deployments, add eBay environment variables to `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      - API_EBAY_ENVIRONMENT=${API_EBAY_ENVIRONMENT:-sandbox}
      - API_EBAY_CLIENT_ID=${API_EBAY_CLIENT_ID}
      - API_EBAY_CLIENT_SECRET=${API_EBAY_CLIENT_SECRET}
      - API_EBAY_SANDBOX_CLIENT_ID=${API_EBAY_SANDBOX_CLIENT_ID}
      - API_EBAY_SANDBOX_CLIENT_SECRET=${API_EBAY_SANDBOX_CLIENT_SECRET}
```

## Troubleshooting

### Common Issues

1. **"eBay client ID and secret are required"**
   - Ensure environment variables are set correctly
   - Check that you're loading the correct .env file
   - Verify the environment setting matches your credentials

2. **"Failed to get eBay application token"**
   - Verify your credentials are correct
   - Check network connectivity
   - Ensure you're using the right environment (sandbox vs production)

3. **Empty search results in sandbox**
   - This is normal - sandbox has limited test data
   - OAuth token success confirms proper configuration
   - Switch to production for real data

4. **Rate limit errors**
   - Reduce request frequency
   - Implement exponential backoff
   - Check your daily/hourly limits

### Debug Logging

Enable debug logging to troubleshoot issues:

```python
import structlog
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG),
)
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** regularly
4. **Use sandbox** for all development and testing
5. **Implement proper error handling** to avoid exposing credentials
6. **Monitor API usage** to detect unusual patterns

## Support

For issues or questions:
- eBay Developer Support: https://developer.ebay.com/support
- TCG Price Tracker Issues: [GitHub Issues](https://github.com/your-repo/issues)