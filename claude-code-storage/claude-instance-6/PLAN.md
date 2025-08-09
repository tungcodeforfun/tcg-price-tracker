# TCG Price Tracker - PriceCharting Migration Implementation Plan

**Date:** 2025-08-09  
**Branch:** feature/replace-tcgplayer-with-pricecharting  
**Migration Type:** JustTCG → PriceCharting  

---

## Executive Summary

This plan outlines the complete migration from JustTCG to PriceCharting as the primary pricing source for the TCG Price Tracker system. Based on the investigation findings, the current system is using JustTCG (not TCGPlayer) for pricing operations, with PriceCharting client already implemented but not integrated.

### Current System State
- **Active Pricing Source**: JustTCG (100 requests/day, free tier)
- **Target Pricing Source**: PriceCharting (API key required, rate limits TBD)
- **Critical Issue**: Database enum validation failures causing all pricing tasks to fail silently
- **PriceCharting Status**: Client implemented but not integrated into worker tasks

### Migration Complexity: MEDIUM
- PriceCharting client exists and is feature-complete
- Main work involves configuration setup and integration fixes
- Database schema updates required for enum support
- Worker task bugs need immediate attention

---

## Phase 1: Critical System Fixes (Database Schema) 🔴 BLOCKER

**Priority**: CRITICAL - Must complete first  
**Estimated Time**: 2-4 hours  
**Risk Level**: HIGH - Impacts all pricing operations  

### 1.1 Database Schema Updates

#### File: `/tcgtracker/src/tcgtracker/database/models.py`

**Current State**: DataSourceEnum missing JUSTTCG and PRICECHARTING (lines 61-68)
```python
# Current enum (BROKEN)
class DataSourceEnum(str, Enum):
    TCGPLAYER = "tcgplayer"
    EBAY = "ebay"  
    CARDMARKET = "cardmarket"
    MANUAL = "manual"
    # MISSING: JUSTTCG, PRICECHARTING
```

**Required Changes**:
```python
class DataSourceEnum(str, Enum):
    TCGPLAYER = "tcgplayer"
    EBAY = "ebay"
    CARDMARKET = "cardmarket" 
    MANUAL = "manual"
    JUSTTCG = "justtcg"           # Add for current pricing tasks
    PRICECHARTING = "pricecharting"  # Add for new integration
```

#### Database Migration

Create migration file: `/tcgtracker/src/tcgtracker/database/migrations/add_pricing_sources.py`

```python
"""Add JUSTTCG and PRICECHARTING to DataSourceEnum

Revision ID: add_pricing_sources
Revises: [previous_revision]
Create Date: 2025-08-09
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # PostgreSQL enum modification
    op.execute("ALTER TYPE datasourceenum ADD VALUE IF NOT EXISTS 'justtcg'")
    op.execute("ALTER TYPE datasourceenum ADD VALUE IF NOT EXISTS 'pricecharting'")

def downgrade():
    # Note: PostgreSQL doesn't support removing enum values directly
    # Would require recreating enum and updating all references
    pass
```

### 1.2 Validation and Testing

**Success Criteria**:
- [ ] Database migration runs without errors
- [ ] Existing PriceHistory records remain intact
- [ ] New enum values can be used in INSERT operations
- [ ] JustTCG pricing tasks complete without validation errors

**Validation Commands**:
```bash
# Apply migration
alembic upgrade head

# Test enum values
psql -d tcgtracker -c "SELECT unnest(enum_range(NULL::datasourceenum));"

# Verify existing data
psql -d tcgtracker -c "SELECT source, COUNT(*) FROM pricehistory GROUP BY source;"
```

**Post-Migration Actions**:
- [ ] Restart all Celery workers to clear cached enum definitions
- [ ] Monitor worker logs for enum validation errors
- [ ] Verify pricing task success rates return to normal

---

## Phase 2: Configuration Setup 🟡 HIGH PRIORITY

**Priority**: HIGH - Required for PriceCharting integration  
**Estimated Time**: 1-2 hours  
**Risk Level**: LOW - Configuration changes only  

### 2.1 Core Configuration

#### File: `/tcgtracker/src/tcgtracker/config.py`

**Current State**: Missing PriceCharting configuration in ExternalAPISettings

**Required Changes**: Add to ExternalAPISettings class (around line 45):
```python
class ExternalAPISettings(BaseSettings):
    # Existing JustTCG config...
    justtcg_api_key: Optional[str] = None
    justtcg_base_url: str = "https://api.justtcg.com/v1"
    justtcg_rate_limit: int = 4  # requests per minute
    
    # Existing eBay config...
    ebay_app_id: Optional[str] = None
    ebay_base_url: str = "https://svcs.ebay.com"
    
    # ADD: PriceCharting configuration
    pricecharting_api_key: Optional[str] = None
    pricecharting_base_url: str = "https://www.pricecharting.com/api"
    pricecharting_rate_limit: int = 60  # requests per minute (adjust based on API limits)
```

### 2.2 Environment Configuration

#### File: `.env.example`

**Add PriceCharting API configuration**:
```bash
# Add after existing API configurations
# PriceCharting API Configuration
API_PRICECHARTING_API_KEY=your_pricecharting_api_key_here
API_PRICECHARTING_RATE_LIMIT=60
```

#### File: `.env.production.example`

**Add same configuration**:
```bash
# PriceCharting API Configuration
API_PRICECHARTING_API_KEY=${PRICECHARTING_API_KEY}
API_PRICECHARTING_RATE_LIMIT=60
```

### 2.3 Validation and Testing

**Success Criteria**:
- [ ] Configuration loads without errors
- [ ] PriceCharting client can initialize with new settings
- [ ] Environment variables are properly parsed

**Validation Commands**:
```python
# Test configuration loading
from tcgtracker.config import settings
print(f"PriceCharting API Key: {settings.external_apis.pricecharting_api_key}")
print(f"PriceCharting Rate Limit: {settings.external_apis.pricecharting_rate_limit}")

# Test client initialization
from tcgtracker.integrations.pricecharting import PriceChartingClient
client = PriceChartingClient()
print("PriceCharting client initialized successfully")
```

---

## Phase 3: Worker Task Integration 🟡 HIGH PRIORITY

**Priority**: HIGH - Core functionality  
**Estimated Time**: 3-4 hours  
**Risk Level**: MEDIUM - Affects background pricing operations  

### 3.1 Fix SyncTask PriceCharting Client

#### File: `/tcgtracker/src/tcgtracker/workers/tasks/sync_tasks.py`

**Issue**: Line 190 references `task.pricecharting_client` but it's not defined

**Current State**: Only has `_justtcg_client` property (line 28)

**Required Changes**: Add PriceCharting client property around line 35:
```python
class SyncTask(Task):
    def __init__(self):
        self._justtcg_client = None
        self._pricecharting_client = None  # ADD THIS

    @property 
    def justtcg_client(self):
        if self._justtcg_client is None:
            self._justtcg_client = JustTCGClient()
        return self._justtcg_client
    
    # ADD: PriceCharting client property
    @property
    def pricecharting_client(self):
        if self._pricecharting_client is None:
            from tcgtracker.integrations.pricecharting import PriceChartingClient
            self._pricecharting_client = PriceChartingClient()
        return self._pricecharting_client
```

### 3.2 Fix Card Data Sync TCGPlayer ID References

**Issue**: Line 287 looks for `card_data["tcgplayer_id"]` from PriceCharting API response

**Current Problem**:
```python
# Line 287 - BROKEN
external_id = card_data.get("tcgplayer_id")  # PriceCharting doesn't return this
```

**Fix**: Update to use PriceCharting-specific ID field:
```python
# Replace line 287 with appropriate PriceCharting ID field
external_id = card_data.get("id") or card_data.get("pricecharting_id")
```

**Note**: Requires investigation of actual PriceCharting API response format to determine correct field name.

### 3.3 Replace JustTCG with PriceCharting in Price Tasks

#### File: `/tcgtracker/src/tcgtracker/workers/tasks/price_tasks.py`

**Current State**: Uses JustTCGClient for all pricing operations

**Required Changes**:

1. **Update imports** (around line 10):
```python
# Replace JustTCGClient import
from tcgtracker.integrations.pricecharting import PriceChartingClient
# Keep JustTCGClient as fallback for now
from tcgtracker.integrations.justtcg import JustTCGClient
```

2. **Update PriceUpdateTask client** (around line 25):
```python
class PriceUpdateTask(Task):
    def __init__(self):
        self._pricecharting_client = None
        self._justtcg_client = None  # Keep as fallback

    @property
    def pricecharting_client(self):
        if self._pricecharting_client is None:
            self._pricecharting_client = PriceChartingClient()
        return self._pricecharting_client
```

3. **Update price fetching logic** (around lines 85-105):
```python
@celery.task(base=PriceUpdateTask, bind=True)
def update_card_price(self, card_id: int) -> dict:
    """Update price for a single card using PriceCharting"""
    
    with get_db_session() as db:
        card = db.query(Card).filter(Card.id == card_id).first()
        if not card:
            return {"success": False, "error": "Card not found"}

        try:
            # Replace JustTCG with PriceCharting
            price_data = self.pricecharting_client.get_card_price(
                card_name=card.name, 
                tcg_type=card.tcg_set.tcg_type if card.tcg_set else "pokemon"
            )

            if price_data and price_data.get("loose_price"):
                # Transform PriceCharting data format
                history = PriceHistory(
                    card_id=card.id,
                    source=DataSourceEnum.PRICECHARTING,  # Updated source
                    market_price=price_data.get("complete_price", 0),  # Use complete as market
                    price_low=price_data.get("loose_price", 0),
                    price_high=price_data.get("new_price", 0),
                    price_avg=self._calculate_average_price(price_data),
                    timestamp=datetime.utcnow()
                )
                
                db.add(history)
                card.last_price_update = datetime.utcnow()
                db.commit()

                # Invalidate cache
                redis_client.delete(f"card:price:{card_id}")

                return {"success": True, "price": price_data}
            
        except Exception as e:
            logger.error(f"PriceCharting price update failed for card {card_id}: {e}")
            # Fallback to JustTCG if PriceCharting fails
            return self._fallback_to_justtcg(card_id, db)

    def _calculate_average_price(self, price_data: dict) -> float:
        """Calculate average from PriceCharting price data"""
        prices = [
            price_data.get("loose_price", 0),
            price_data.get("complete_price", 0),
            price_data.get("new_price", 0)
        ]
        valid_prices = [p for p in prices if p and p > 0]
        return sum(valid_prices) / len(valid_prices) if valid_prices else 0

    def _fallback_to_justtcg(self, card_id: int, db) -> dict:
        """Fallback to JustTCG if PriceCharting fails"""
        # Implementation for graceful fallback
        # ... (keep existing JustTCG logic as fallback)
```

### 3.4 Validation and Testing

**Success Criteria**:
- [ ] sync_pricecharting_data task runs without AttributeError
- [ ] Card sync properly handles PriceCharting ID fields
- [ ] Price update tasks use PriceCharting successfully
- [ ] Data transformation works correctly
- [ ] Fallback to JustTCG works when PriceCharting fails

**Test Commands**:
```python
# Test individual components
from tcgtracker.workers.tasks.price_tasks import update_card_price
from tcgtracker.workers.tasks.sync_tasks import sync_pricecharting_data

# Test single price update
result = update_card_price.delay(card_id=1)
print(f"Price update result: {result.get()}")

# Test PriceCharting sync
result = sync_pricecharting_data.delay()
print(f"Sync result: {result.get()}")
```

---

## Phase 4: API Layer Updates 🟢 MEDIUM PRIORITY

**Priority**: MEDIUM - User-facing API changes  
**Estimated Time**: 2-3 hours  
**Risk Level**: MEDIUM - Changes default behavior  

### 4.1 Update API Schemas

#### File: `/tcgtracker/src/tcgtracker/api/schemas.py`

**Issue**: PriceSource enum missing PRICECHARTING and JUSTTCG (lines 31-37)

**Current State**:
```python
class PriceSource(str, Enum):
    TCGPLAYER = "tcgplayer"
    EBAY = "ebay"
    CARDMARKET = "cardmarket"
    # MISSING: PRICECHARTING, JUSTTCG
```

**Required Changes**:
```python
class PriceSource(str, Enum):
    TCGPLAYER = "tcgplayer"
    EBAY = "ebay"
    CARDMARKET = "cardmarket"
    JUSTTCG = "justtcg"
    PRICECHARTING = "pricecharting"  # Add new primary source
```

### 4.2 Update Price API Endpoints

#### File: `/tcgtracker/src/tcgtracker/api/v1/prices.py`

**Current Issues**:
- Default price source is PriceSource.TCGPLAYER (lines 221, 267)
- Missing PriceCharting client import (line 33)
- `fetch_and_update_price()` doesn't handle PriceCharting

**Required Changes**:

1. **Add imports** (around line 33):
```python
from tcgtracker.integrations.pricecharting import PriceChartingClient
```

2. **Update default source** (lines 221, 267):
```python
# Change from:
source: PriceSource = PriceSource.TCGPLAYER

# To:
source: PriceSource = PriceSource.PRICECHARTING
```

3. **Update fetch_and_update_price function** (around line 45):
```python
async def fetch_and_update_price(
    card: Card, 
    source: PriceSource, 
    db: Session
) -> PriceResponse:
    """Fetch and update price from specified source"""
    
    try:
        if source == PriceSource.PRICECHARTING:
            client = PriceChartingClient()
            price_data = await client.get_card_price(
                card_name=card.name,
                tcg_type=card.tcg_set.tcg_type if card.tcg_set else "pokemon"
            )
            
            if price_data:
                # Transform and store data
                history = PriceHistory(
                    card_id=card.id,
                    source=DataSourceEnum.PRICECHARTING,
                    market_price=price_data.get("complete_price", 0),
                    price_low=price_data.get("loose_price", 0),
                    price_high=price_data.get("new_price", 0),
                    price_avg=calculate_average(price_data),
                    timestamp=datetime.utcnow()
                )
                db.add(history)
                
        elif source == PriceSource.TCGPLAYER:
            # Keep existing TCGPlayer logic
            # ... existing code ...
            
        elif source == PriceSource.JUSTTCG:
            # Add JustTCG support for backward compatibility
            # ... implementation ...

        db.commit()
        return PriceResponse(
            card_id=card.id,
            source=source.value,
            market_price=history.market_price,
            # ... other fields
        )
        
    except Exception as e:
        logger.error(f"Price update failed: {e}")
        raise HTTPException(status_code=500, detail="Price update failed")
```

### 4.3 Update Search API

#### File: `/tcgtracker/src/tcgtracker/api/v1/search.py`

**Current State**: No PriceCharting search endpoint, `/all` searches TCGPlayer + eBay only

**Required Changes**:

1. **Add PriceCharting search endpoint** (around line 87):
```python
@router.get("/pricecharting", response_model=SearchResponse)
async def search_pricecharting(
    query: str = Query(..., min_length=3, max_length=100),
    game: str = Query("pokemon", regex="^(pokemon|onepiece)$"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db_session)
):
    """Search PriceCharting for cards"""
    
    try:
        client = PriceChartingClient()
        
        if game == "pokemon":
            results = await client.get_pokemon_products(search_term=query, limit=limit)
        else:
            results = await client.get_one_piece_products(search_term=query, limit=limit)
            
        # Transform results to internal format
        cards = []
        for item in results:
            card_data = {
                "name": item.get("name"),
                "set_name": item.get("set_name", "Unknown"),
                "tcg_type": game,
                "source": "pricecharting",
                "external_id": item.get("id"),
                "market_price": item.get("complete_price", 0),
                "image_url": item.get("image_url")
            }
            cards.append(card_data)
            
        return SearchResponse(
            results=cards,
            total_count=len(cards),
            source="pricecharting"
        )
        
    except Exception as e:
        logger.error(f"PriceCharting search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")
```

2. **Update `/all` endpoint** to include PriceCharting (around line 150):
```python
@router.get("/all", response_model=SearchResponse) 
async def search_all_sources(
    query: str = Query(..., min_length=3, max_length=100),
    include_sources: List[str] = Query(["pricecharting", "tcgplayer", "ebay"]),
    # ... other parameters
):
    """Search across all configured sources"""
    
    all_results = []
    
    # Add PriceCharting to search sources
    if "pricecharting" in include_sources:
        try:
            pc_results = await search_pricecharting(query, game, limit//3, db)
            all_results.extend(pc_results.results)
        except Exception as e:
            logger.warning(f"PriceCharting search failed: {e}")
    
    # Keep existing TCGPlayer and eBay search logic
    # ... existing code ...
```

### 4.4 Validation and Testing

**Success Criteria**:
- [ ] API endpoints accept PRICECHARTING as source parameter
- [ ] Default source changed to PriceCharting  
- [ ] Search endpoints return PriceCharting results
- [ ] Error handling works properly
- [ ] Response schemas validate correctly

**Test Commands**:
```bash
# Test price update with PriceCharting
curl -X POST "http://localhost:8000/api/v1/prices/update/1?source=pricecharting" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Test PriceCharting search
curl "http://localhost:8000/api/v1/search/pricecharting?query=pikachu&game=pokemon"

# Test bulk update with new default
curl -X POST "http://localhost:8000/api/v1/prices/update/bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"card_ids": [1,2,3]}'
```

---

## Phase 5: Comprehensive Testing & Validation 🟢 LOW PRIORITY

**Priority**: LOW - Quality assurance  
**Estimated Time**: 4-6 hours  
**Risk Level**: LOW - Testing and documentation  

### 5.1 Unit Test Development

Create comprehensive tests for PriceCharting integration:

#### File: `/tcgtracker/tests/test_pricecharting_integration.py`

```python
import pytest
from unittest.mock import Mock, patch
from tcgtracker.integrations.pricecharting import PriceChartingClient
from tcgtracker.workers.tasks.price_tasks import update_card_price
from tcgtracker.database.models import Card, PriceHistory, DataSourceEnum

class TestPriceChartingIntegration:
    
    @patch('tcgtracker.integrations.pricecharting.PriceChartingClient.get_card_price')
    def test_price_update_success(self, mock_get_price, db_session, sample_card):
        """Test successful price update from PriceCharting"""
        # Mock PriceCharting response
        mock_get_price.return_value = {
            "loose_price": 10.00,
            "complete_price": 25.00, 
            "new_price": 35.00,
            "graded_price": 100.00
        }
        
        # Execute price update
        result = update_card_price(sample_card.id)
        
        # Verify results
        assert result["success"] is True
        
        # Check database record
        history = db_session.query(PriceHistory).filter_by(card_id=sample_card.id).first()
        assert history.source == DataSourceEnum.PRICECHARTING
        assert history.market_price == 25.00
        assert history.price_low == 10.00
        assert history.price_high == 35.00
    
    @patch('tcgtracker.integrations.pricecharting.PriceChartingClient.get_card_price')
    def test_price_update_fallback(self, mock_get_price, db_session, sample_card):
        """Test fallback to JustTCG when PriceCharting fails"""
        # Mock PriceCharting failure
        mock_get_price.side_effect = Exception("API Error")
        
        # Execute price update
        result = update_card_price(sample_card.id)
        
        # Should fall back to JustTCG
        assert result["success"] is True
        
        # Verify fallback was used
        history = db_session.query(PriceHistory).filter_by(card_id=sample_card.id).first()
        assert history.source == DataSourceEnum.JUSTTCG

    def test_api_endpoint_pricecharting_default(self, client, auth_headers):
        """Test that API endpoints use PriceCharting as default"""
        response = client.post(
            "/api/v1/prices/update/1",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        # Should use PriceCharting by default (no source parameter)
    
    def test_search_pricecharting(self, client):
        """Test PriceCharting search endpoint"""
        response = client.get("/api/v1/search/pricecharting?query=pikachu&game=pokemon")
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert data["source"] == "pricecharting"
```

### 5.2 Integration Test Suite

#### File: `/tcgtracker/tests/test_migration_integration.py`

```python
import pytest
from tcgtracker.database.models import DataSourceEnum, PriceHistory
from tcgtracker.workers.tasks.sync_tasks import sync_pricecharting_data

class TestMigrationIntegration:
    
    def test_database_enum_migration(self, db_session):
        """Test that new enum values work in database"""
        # Test JUSTTCG enum value
        history_justtcg = PriceHistory(
            card_id=1,
            source=DataSourceEnum.JUSTTCG,
            market_price=15.00,
            price_low=10.00,
            price_high=20.00,
            price_avg=15.00
        )
        db_session.add(history_justtcg)
        
        # Test PRICECHARTING enum value
        history_pc = PriceHistory(
            card_id=1,
            source=DataSourceEnum.PRICECHARTING,
            market_price=25.00,
            price_low=15.00,
            price_high=30.00,
            price_avg=23.33
        )
        db_session.add(history_pc)
        
        # Should commit without errors
        db_session.commit()
        
        # Verify records exist
        assert db_session.query(PriceHistory).filter_by(source=DataSourceEnum.JUSTTCG).count() == 1
        assert db_session.query(PriceHistory).filter_by(source=DataSourceEnum.PRICECHARTING).count() == 1

    @pytest.mark.integration
    def test_end_to_end_price_flow(self, db_session, sample_card):
        """Test complete price update flow"""
        # This test requires actual API credentials
        # Should be run in staging environment
        pass

    def test_sync_task_pricecharting_client(self):
        """Test that sync task can initialize PriceCharting client"""
        from tcgtracker.workers.tasks.sync_tasks import SyncTask
        
        task = SyncTask()
        client = task.pricecharting_client
        
        assert client is not None
        assert hasattr(client, 'get_pokemon_products')
        assert hasattr(client, 'get_one_piece_products')
```

### 5.3 Performance Testing

#### File: `/tcgtracker/tests/test_performance.py`

```python
import pytest
import time
from unittest.mock import patch
from tcgtracker.workers.tasks.price_tasks import update_all_card_prices

class TestPerformance:
    
    @patch('tcgtracker.integrations.pricecharting.PriceChartingClient.get_card_price')
    def test_bulk_update_performance(self, mock_get_price, db_session, multiple_cards):
        """Test performance of bulk price updates"""
        # Mock quick responses
        mock_get_price.return_value = {
            "loose_price": 10.00,
            "complete_price": 25.00,
            "new_price": 35.00
        }
        
        start_time = time.time()
        
        # Update 100 cards
        result = update_all_card_prices.delay()
        task_result = result.get(timeout=120)  # 2 minute timeout
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Should complete within reasonable time
        assert duration < 60  # 1 minute for 100 cards
        assert task_result["success"] is True
        
    def test_rate_limiting_compliance(self):
        """Test that rate limiting prevents API abuse"""
        from tcgtracker.integrations.pricecharting import PriceChartingClient
        
        client = PriceChartingClient()
        
        # Make requests up to limit
        for i in range(client.rate_limit):
            response = client.get_pokemon_products(search_term=f"test{i}", limit=1)
            # Should succeed
            
        # Next request should be rate limited
        with pytest.raises(Exception):  # Rate limit exception
            client.get_pokemon_products(search_term="over_limit", limit=1)
```

### 5.4 Validation Checklist

**Database Migration Validation**:
- [ ] Enum migration applied successfully
- [ ] Existing data integrity maintained
- [ ] New enum values work in queries
- [ ] PriceHistory records can use new sources

**Configuration Validation**:
- [ ] PriceCharting API key loads correctly
- [ ] Rate limiting configuration works
- [ ] Client initialization succeeds
- [ ] Environment variables parsed properly

**Worker Task Validation**:
- [ ] Price update tasks use PriceCharting successfully
- [ ] Bulk updates complete without errors  
- [ ] Sync tasks have working PriceCharting client
- [ ] Data transformation produces correct format
- [ ] Fallback to JustTCG works when needed

**API Validation**:
- [ ] Endpoints accept PriceCharting source parameter
- [ ] Default source changed to PriceCharting
- [ ] Search endpoints return PriceCharting results
- [ ] Response schemas validate correctly
- [ ] Error handling works properly

**Performance Validation**:
- [ ] Response times within acceptable limits
- [ ] Rate limiting prevents API abuse
- [ ] Bulk operations complete successfully
- [ ] Memory usage remains stable
- [ ] Database queries optimized

---

## Edge Cases & Error Handling

### 6.1 API Failure Scenarios

**PriceCharting API Unavailable**:
- **Scenario**: PriceCharting API returns 500 errors
- **Handling**: Circuit breaker trips, fallback to JustTCG
- **Recovery**: Automatic retry after circuit breaker recovery period

**Rate Limit Exceeded**:
- **Scenario**: API key hits rate limit
- **Handling**: Exponential backoff, queue requests
- **Recovery**: Resume processing after rate limit window resets

**Invalid API Key**:
- **Scenario**: API key is invalid or expired
- **Handling**: Log authentication error, use fallback source
- **Recovery**: Manual API key rotation required

### 6.2 Data Consistency Issues

**Price Data Format Differences**:
- **Issue**: PriceCharting and JustTCG have different price structures
- **Solution**: Data transformation layer standardizes internal format
- **Validation**: Compare price ranges for reasonableness

**Missing Card Data**:
- **Issue**: Card not found in PriceCharting database
- **Solution**: Graceful fallback to JustTCG or manual pricing
- **Logging**: Track missing cards for potential manual addition

**Duplicate Price Records**:
- **Issue**: Multiple sources update same card simultaneously
- **Solution**: Database constraints prevent duplicates per timestamp
- **Cleanup**: Periodic task removes duplicate records

### 6.3 Migration Edge Cases

**Partial Migration State**:
- **Issue**: Some components use PriceCharting, others use JustTCG
- **Solution**: Feature flags enable gradual migration
- **Monitoring**: Track success rates by component

**Database Migration Failures**:
- **Issue**: Enum migration fails partway through
- **Solution**: Rollback procedures restore previous state
- **Prevention**: Test migrations on staging environment first

**Configuration Conflicts**:
- **Issue**: Old configuration conflicts with new settings
- **Solution**: Validation checks for configuration consistency
- **Documentation**: Clear migration guide for deployment

---

## Security Considerations

### 7.1 API Key Management

**Storage Security**:
- Store PriceCharting API key in secure environment variables
- Use different keys for development, staging, and production
- Implement key rotation procedures

**Usage Monitoring**:
- Log all API requests for audit purposes
- Monitor for unusual usage patterns
- Set up alerts for API key abuse

**Access Control**:
- Limit API key access to necessary components only
- Use least-privilege principle for service accounts
- Regular security reviews of key usage

### 7.2 Data Validation

**Input Sanitization**:
- Validate all data received from PriceCharting API
- Sanitize card names and descriptions
- Check price values for reasonableness

**SQL Injection Prevention**:
- Use parameterized queries for all database operations
- Validate enum values before database insertion
- Escape special characters in search queries

**Rate Limiting Security**:
- Implement client-side rate limiting to prevent abuse
- Monitor for suspicious request patterns
- Block clients that exceed reasonable usage

---

## Performance Optimization

### 8.1 Caching Strategy

**Price Data Caching**:
- Cache PriceCharting responses for 1 hour
- Use Redis for distributed caching
- Implement cache warming for popular cards

**Database Query Optimization**:
- Add indexes for frequently queried price data
- Optimize bulk update queries
- Use connection pooling for database efficiency

**API Response Optimization**:
- Compress API responses where possible
- Use pagination for large result sets
- Implement response caching for search results

### 8.2 Resource Management

**Memory Usage**:
- Monitor worker memory consumption
- Implement garbage collection for long-running tasks
- Use streaming for large data operations

**Database Connections**:
- Properly close database sessions
- Use connection pooling for efficiency
- Monitor connection pool usage

**Background Task Optimization**:
- Batch small operations for efficiency
- Use priority queues for critical tasks
- Implement task deduplication

---

## Rollback Plan

### 9.1 Immediate Rollback (Emergency)

**Quick Revert to JustTCG**:
1. Update environment variables to disable PriceCharting
2. Deploy configuration change to switch default source back to JustTCG
3. Restart workers to pick up new configuration
4. Monitor price update success rates

**Configuration Rollback**:
```bash
# Emergency rollback script
export API_PRICECHARTING_API_KEY=""  # Disable PriceCharting
kubectl rollout undo deployment/tcg-worker  # Revert worker deployment
kubectl rollout undo deployment/tcg-api     # Revert API deployment
```

### 9.2 Staged Rollback (Planned)

**Phase-by-Phase Revert**:
1. **Phase 4 Rollback**: Revert API endpoints to TCGPlayer default
2. **Phase 3 Rollback**: Switch worker tasks back to JustTCG
3. **Phase 2 Rollback**: Remove PriceCharting configuration
4. **Phase 1 Rollback**: Keep database enum changes (safe to leave)

**Data Preservation**:
- Keep all price history records from PriceCharting
- Mark PriceCharting data source as inactive
- Maintain ability to query historical PriceCharting data

### 9.3 Rollback Validation

**Success Criteria for Rollback**:
- [ ] Price update tasks complete successfully with previous source
- [ ] API endpoints respond normally
- [ ] No critical errors in application logs
- [ ] Database queries function normally
- [ ] Worker tasks process without failures

---

## Deployment Strategy

### 10.1 Pre-Deployment Checklist

**Infrastructure Preparation**:
- [ ] PriceCharting API key obtained and tested
- [ ] Staging environment configured with new settings
- [ ] Database migration tested on staging
- [ ] Monitoring alerts configured
- [ ] Rollback procedures documented and tested

**Code Preparation**:
- [ ] All code changes reviewed and approved
- [ ] Unit tests passing with >90% coverage
- [ ] Integration tests passing on staging
- [ ] Performance tests show acceptable metrics
- [ ] Security scan shows no new vulnerabilities

### 10.2 Deployment Sequence

**Production Deployment**:
1. **Off-hours deployment** to minimize user impact
2. **Database migration first** (can be done separately)
3. **Configuration deployment** (environment variables)
4. **Application deployment** (API and worker services)
5. **Validation testing** (automated and manual)
6. **Monitoring verification** (metrics and alerts)

**Deployment Commands**:
```bash
# 1. Database migration
alembic upgrade head

# 2. Deploy configuration
kubectl apply -f k8s/configmap.yaml

# 3. Deploy applications  
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml

# 4. Verify deployment
kubectl get pods -l app=tcg-tracker
kubectl logs -l app=tcg-worker --tail=100
```

### 10.3 Post-Deployment Monitoring

**Key Metrics to Monitor**:
- Price update task success rate (should be >95%)
- API response times (should be <2 seconds)
- Database connection pool usage (should be <80%)
- Error rates (should be <1%)
- PriceCharting API usage (should be within limits)

**Monitoring Duration**:
- **First 2 hours**: Intensive monitoring with team on standby
- **First 24 hours**: Regular monitoring with automated alerts
- **First week**: Daily check of key metrics and error logs
- **Ongoing**: Normal monitoring with weekly reviews

---

## Success Criteria & Validation

### 11.1 Phase-Specific Success Criteria

**Phase 1 (Database Schema)**:
- [ ] Migration executes without errors
- [ ] Existing price tasks complete successfully
- [ ] No enum validation errors in logs
- [ ] Database constraints remain functional

**Phase 2 (Configuration)**:
- [ ] PriceCharting client initializes successfully
- [ ] Configuration values load correctly
- [ ] Rate limiting works as expected
- [ ] No configuration-related errors

**Phase 3 (Worker Integration)**:
- [ ] Price update tasks use PriceCharting successfully
- [ ] Bulk updates complete within acceptable time
- [ ] Sync tasks no longer throw AttributeError
- [ ] Data transformation produces correct format
- [ ] Fallback mechanisms work when tested

**Phase 4 (API Updates)**:
- [ ] API endpoints default to PriceCharting
- [ ] Search functionality returns PriceCharting results
- [ ] Response schemas validate correctly
- [ ] Error handling provides meaningful messages
- [ ] Performance remains within acceptable limits

**Phase 5 (Testing)**:
- [ ] All unit tests pass
- [ ] Integration tests pass on staging
- [ ] Performance tests meet benchmarks
- [ ] Security scans show no new vulnerabilities
- [ ] Manual testing confirms expected behavior

### 11.2 Overall System Success Criteria

**Functional Requirements**:
- [ ] Price updates use PriceCharting as primary source
- [ ] Historical price data remains accessible
- [ ] Search functionality includes PriceCharting results
- [ ] Bulk operations complete successfully
- [ ] Error handling gracefully manages failures

**Performance Requirements**:
- [ ] Individual price updates complete in <5 seconds
- [ ] Bulk updates (100 cards) complete in <2 minutes
- [ ] API response times remain <2 seconds median
- [ ] Database queries execute within normal parameters
- [ ] Memory usage remains stable over time

**Reliability Requirements**:
- [ ] System maintains >99% uptime during migration
- [ ] Price update success rate >95%
- [ ] Fallback mechanisms prevent total failures
- [ ] Error recovery works automatically
- [ ] Data consistency maintained throughout

### 11.3 Final Validation Tests

**End-to-End Testing**:
```bash
# Test complete price update flow
curl -X POST "https://api.tcgtracker.com/v1/prices/update/bulk" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"card_ids": [1,2,3,4,5]}'

# Verify PriceCharting data in database
psql -d tcgtracker -c "
  SELECT source, COUNT(*) as count, AVG(market_price) as avg_price
  FROM pricehistory 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY source;"

# Test search functionality
curl "https://api.tcgtracker.com/v1/search/pricecharting?query=charizard&game=pokemon"
```

**Data Validation**:
```sql
-- Verify no orphaned records
SELECT COUNT(*) FROM pricehistory WHERE source NOT IN (
  SELECT unnest(enum_range(NULL::datasourceenum))
);

-- Check price data reasonableness
SELECT source, MIN(market_price), MAX(market_price), AVG(market_price)
FROM pricehistory
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY source;

-- Verify rate limiting compliance
SELECT COUNT(*) as requests_last_hour
FROM api_logs
WHERE endpoint LIKE '%pricecharting%'
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Risk Mitigation Strategies

### 12.1 Technical Risks

**Database Migration Failures**:
- **Risk**: Enum migration fails, breaking existing functionality
- **Mitigation**: Test migration on staging, have rollback ready
- **Detection**: Monitor database health during migration
- **Response**: Immediate rollback if migration fails

**API Integration Issues**:
- **Risk**: PriceCharting API behaves differently than expected
- **Mitigation**: Thorough testing with actual API, fallback mechanisms
- **Detection**: Monitor API response patterns and error rates
- **Response**: Adjust integration code or fall back to JustTCG

**Performance Degradation**:
- **Risk**: PriceCharting API slower than JustTCG, impacting user experience
- **Mitigation**: Performance testing, caching strategy, optimization
- **Detection**: Monitor response times and system metrics
- **Response**: Implement additional caching or optimization

### 12.2 Operational Risks

**API Key Issues**:
- **Risk**: PriceCharting API key invalid or rate limited
- **Mitigation**: Validate key before deployment, monitor usage
- **Detection**: API authentication error monitoring
- **Response**: Key rotation procedures, fallback to JustTCG

**Configuration Errors**:
- **Risk**: Wrong configuration deployed, breaking functionality
- **Mitigation**: Configuration validation, staging environment testing
- **Detection**: Automated configuration validation checks
- **Response**: Rapid configuration rollback procedures

**Team Knowledge Gaps**:
- **Risk**: Team unfamiliar with PriceCharting integration
- **Mitigation**: Documentation, training sessions, knowledge transfer
- **Detection**: Post-deployment issues requiring extended resolution time
- **Response**: Enhanced support during transition period

### 12.3 Business Risks

**Data Quality Issues**:
- **Risk**: PriceCharting data quality lower than current source
- **Mitigation**: Data quality validation, comparison testing
- **Detection**: Monitor price variance and user feedback
- **Response**: Data cleaning procedures, source evaluation

**Cost Overruns**:
- **Risk**: PriceCharting API costs higher than expected
- **Mitigation**: Usage projection, cost monitoring, rate limiting
- **Detection**: Monthly cost reviews, usage alerts
- **Response**: Usage optimization, renegotiation, alternative sources

**User Experience Impact**:
- **Risk**: Migration causes user-facing issues or confusion
- **Mitigation**: Gradual rollout, user communication, support preparation
- **Detection**: User feedback monitoring, support ticket analysis
- **Response**: Rapid issue resolution, clear communication

---

## Timeline & Dependencies

### 13.1 Estimated Timeline

**Phase 1: Database Schema (Day 1)**
- Duration: 2-4 hours
- Dependencies: None
- Critical path: Yes

**Phase 2: Configuration (Day 1-2)**
- Duration: 1-2 hours  
- Dependencies: API key procurement
- Critical path: Yes

**Phase 3: Worker Integration (Day 2-3)**
- Duration: 3-4 hours
- Dependencies: Phases 1 & 2 complete
- Critical path: Yes

**Phase 4: API Updates (Day 3-4)**
- Duration: 2-3 hours
- Dependencies: Phases 1, 2 & 3 complete
- Critical path: Yes

**Phase 5: Testing (Day 4-5)**
- Duration: 4-6 hours
- Dependencies: All previous phases complete
- Critical path: No (can be parallel with some deployment prep)

**Total Estimated Time: 3-5 working days**

### 13.2 Dependency Map

```
Phase 1 (Database) → Phase 3 (Workers) → Phase 5 (Testing)
      ↓                    ↓                    ↓
Phase 2 (Config) → Phase 4 (API) → Deployment → Monitoring
```

**External Dependencies**:
- PriceCharting API key approval and provisioning
- Database migration window availability  
- Staging environment availability for testing
- Team availability for deployment and monitoring

### 13.3 Milestone Schedule

**Milestone 1**: Database schema updated (End of Day 1)
- Success criteria: Enum migration complete, existing tasks working

**Milestone 2**: PriceCharting integration working (End of Day 2)
- Success criteria: Price updates using PriceCharting successfully

**Milestone 3**: API layer updated (End of Day 3)
- Success criteria: All endpoints use PriceCharting as default

**Milestone 4**: Testing complete (End of Day 4)
- Success criteria: All tests passing, performance validated

**Milestone 5**: Production deployment (Day 5)
- Success criteria: System running with PriceCharting in production

---

## Communication Plan

### 14.1 Stakeholder Updates

**Development Team**:
- Daily standup updates during migration phases
- Technical documentation shared via team wiki
- Code review sessions for critical changes
- Post-deployment retrospective meeting

**Product/Business Team**:
- Pre-migration briefing on expected changes
- Daily status updates during active migration
- Post-deployment summary with metrics
- Weekly performance reports for first month

**Operations Team**:
- Migration timeline and deployment procedures
- Monitoring requirements and alert configurations
- Rollback procedures and escalation contacts
- Post-deployment monitoring responsibilities

### 14.2 User Communication

**Internal Users**:
- Advance notice of any planned downtime
- Documentation updates for API changes
- New feature announcements (improved pricing data)
- Support team briefing on potential issues

**External Users** (if applicable):
- API changelog updates for breaking changes
- Migration timeline for any service interruptions
- Benefits of improved pricing data accuracy
- Support contact for migration-related issues

### 14.3 Documentation Updates

**Technical Documentation**:
- API documentation updates for new endpoints
- Database schema documentation updates
- Architecture diagrams with new integration
- Troubleshooting guides for common issues

**Operational Documentation**:
- Deployment procedures updated
- Monitoring runbooks updated
- Incident response procedures updated
- Configuration management documentation

---

## Conclusion

This comprehensive implementation plan provides a structured approach to migrating from JustTCG to PriceCharting as the primary pricing source. The phased approach minimizes risk while ensuring thorough testing and validation at each step.

### Key Success Factors

1. **Database schema fixes first** - Critical for all subsequent phases
2. **Comprehensive testing** - Each phase validated before proceeding
3. **Fallback mechanisms** - Graceful degradation if issues occur
4. **Monitoring and alerting** - Early detection of problems
5. **Team coordination** - Clear communication and responsibilities

### Expected Benefits

- **Improved data quality** from dedicated TCG pricing service
- **Better API performance** with more straightforward authentication
- **Enhanced reliability** with fallback mechanisms
- **Scalable architecture** supporting multiple pricing sources
- **Maintainable codebase** with clear separation of concerns

The migration represents a significant improvement to the system's pricing capabilities while maintaining backward compatibility and system reliability.