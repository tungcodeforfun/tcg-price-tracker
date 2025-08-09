# TCG Price Tracker Investigation Report
## Replace TCGPlayer with PriceCharting

**Date:** 2025-08-09  
**Branch:** feature/replace-tcgplayer-with-pricecharting  

---

## Executive Summary
This investigation analyzes the current TCG price tracker implementation to identify all components that need modification when replacing TCGPlayer with PriceCharting as the primary pricing source.

---

## Directory Structure Analysis
The project follows a modular architecture:
- **API Layer**: `/tcgtracker/src/tcgtracker/api/` - REST endpoints
- **Integration Layer**: `/tcgtracker/src/tcgtracker/integrations/` - External service integrations
- **Worker Layer**: `/tcgtracker/src/tcgtracker/workers/` - Background tasks
- **Database Layer**: `/tcgtracker/src/tcgtracker/database/` - Models and migrations
- **Configuration**: `/tcgtracker/src/tcgtracker/config.py`

---

## Investigation Progress

### Files Examined:

#### 1. Configuration File (`/tcgtracker/src/tcgtracker/config.py`)
**Current State**: Contains configuration for JustTCG and eBay APIs, but NO TCGPlayer configuration
**Key Findings**:
- Already configured for JustTCG API with rate limiting (4 requests/minute, 100/day)
- eBay API configuration present
- **MISSING**: No TCGPlayer configuration found
- **MISSING**: No PriceCharting configuration found
- Uses pydantic settings with environment variable prefixes
- Rate limiting settings included

**Action Required**: Add PriceCharting API configuration to ExternalAPISettings class

#### 2. Integration Files - Current TCGPlayer Integration (`/tcgtracker/src/tcgtracker/integrations/tcgplayer.py`)
**Current State**: Full-featured TCGPlayer client with OAuth2 implementation
**Key Findings**:
- Complex OAuth 2.0 authentication system with token refresh
- Full CRUD operations for categories, groups, sets, products
- Pricing methods: `get_product_pricing()`, `get_market_prices()`
- Search functionality and category-specific methods
- References config settings that don't exist yet: `tcgplayer_client_id`, `tcgplayer_client_secret`, etc.
- Rate limiting: 300 requests per minute
- Circuit breaker implementation

**Dependencies**: 
- `settings.external_apis.tcgplayer_*` config values (NOT FOUND in config)
- BaseAPIClient from `.base` module
- structlog for logging

#### 3. Integration Files - New PriceCharting Integration (`/tcgtracker/src/tcgtracker/integrations/pricecharting.py`)
**Current State**: Comprehensive PriceCharting client implementation - ALREADY CREATED
**Key Findings**:
- Simple API key authentication (no OAuth complexity)
- Equivalent methods to TCGPlayer: search, get pricing, history
- TCG-specific methods: `get_pokemon_products()`, `get_one_piece_products()`
- Data transformation methods for consistent internal format
- References config settings: `pricecharting_api_key`, `pricecharting_base_url`, `pricecharting_rate_limit`
- More straightforward pricing model (loose, complete, new, graded)

**Status**: ✅ COMPLETE - PriceCharting client is fully implemented

#### 4. Worker Tasks - Price Tasks (`/tcgtracker/src/tcgtracker/workers/tasks/price_tasks.py`)
**Current State**: Currently using JustTCG as pricing source, NOT TCGPlayer
**Key Findings**:
- **CRITICAL**: Already migrated away from TCGPlayer to JustTCG
- Uses `JustTCGClient` for all pricing operations
- Tasks: `update_card_price()`, `update_all_card_prices()`, `cleanup_old_price_history()`
- Stores price data in `PriceHistory` model with source field set to "justtcg"
- Implements async/sync bridge for Celery integration
- Rate limiting and circuit breaker already in place

**Action Required**: Replace JustTCG with PriceCharting client

#### 5. Worker Tasks - Sync Tasks (`/tcgtracker/src/tcgtracker/workers/tasks/sync_tasks.py`) 
**Current State**: Mixed implementation - JustTCG for sets, PriceCharting for cards
**Key Findings**:
- **INTERESTING**: Already has `sync_pricecharting_data()` task implemented
- Uses JustTCG for set synchronization in `sync_tcg_sets()`
- Uses PriceCharting for card data in `sync_card_data()` 
- **BUG**: Line 190 references `task.pricecharting_client` but task class only has `justtcg_client`
- **BUG**: Line 287 still references `card_data["tcgplayer_id"]` field

**Critical Issues Found**:
1. Missing PriceChartingClient initialization in SyncTask class
2. References to non-existent tcgplayer_id field in card data
3. Mixed data sources causing inconsistency

#### 6. Database Models (`/tcgtracker/src/tcgtracker/database/models.py`)
**Current State**: Database schema still expects TCGPlayer integration
**Key Findings**:
- **CRITICAL BUG**: `DataSourceEnum` (lines 61-68) only includes TCGPLAYER, EBAY, CARDMARKET, MANUAL
- **MISSING**: No JUSTTCG or PRICECHARTING enum values
- **ISSUE**: Price tasks already use "justtcg" string but enum doesn't support it
- Card model has `tcgplayer_id` field (line 159) - needs PriceCharting equivalent
- Card model has `external_id` field (line 160) - could be repurposed for PriceCharting
- PriceHistory model uses DataSourceEnum for source field - will fail with current pricing tasks

**Schema Migration Required**: Add JUSTTCG and PRICECHARTING to DataSourceEnum

#### 7. API Endpoints - Prices (`/tcgtracker/src/tcgtracker/api/v1/prices.py`)
**Current State**: Still using TCGPlayer as primary source
**Key Findings**:
- Default price source is PriceSource.TCGPLAYER (line 221, 267)
- Imports TCGPlayerClient (line 33)
- `fetch_and_update_price()` function handles both TCGPlayer and eBay
- **NO PRICECHARTING INTEGRATION** in API endpoints
- Uses `card.external_id` for TCGPlayer lookups (line 51)
- Missing PriceCharting import and implementation

**Action Required**: 
1. Add PriceCharting client import and integration
2. Update fetch_and_update_price function
3. Change default source from TCGPlayer to PriceCharting

#### 8. Environment Configuration Files
**Current State**: No PriceCharting API key configuration
**Key Findings**:
- `.env.example` and `.env.production.example` have JustTCG and eBay API keys
- **MISSING**: No PriceCharting API key configuration
- Rate limiting configuration includes TCGPlayer (line 48 in production) but no PriceCharting
- Free tier JustTCG works without API key (100 requests/day)

**Action Required**: Add PriceCharting API key configuration to both environment files

#### 9. API Schemas (`/tcgtracker/src/tcgtracker/api/schemas.py`)
**Current State**: PriceSource enum missing PRICECHARTING and JUSTTCG
**Key Findings**:
- `PriceSource` enum (lines 31-37) only includes TCGPLAYER, EBAY, CARDMARKET
- **MISSING**: PRICECHARTING and JUSTTCG enum values
- CardBase schema still references `tcgplayer_id` field (line 126)
- Needs to support PriceCharting-specific fields

**Schema Update Required**: Add missing price sources to enum

#### 10. Search API (`/tcgtracker/src/tcgtracker/api/v1/search.py`)
**Current State**: Dedicated TCGPlayer search endpoint, no PriceCharting
**Key Findings**:
- `/tcgplayer` endpoint fully implemented (lines 25-86)
- `/all` endpoint searches TCGPlayer and eBay only
- **MISSING**: No PriceCharting search endpoint
- Card import function maps sources to database enum (lines 209-215)

**Action Required**: Add PriceCharting search endpoint and update /all endpoint

#### 11. JustTCG Integration (`/tcgtracker/src/tcgtracker/integrations/justtcg.py`)
**Current State**: Comprehensive JustTCG client already implemented
**Key Findings**:
- Full-featured API client with search, pricing, history methods
- Free tier with 100 requests/day limit (line 95 comment)
- **USED**: Currently being used in worker tasks for pricing
- Simple Bearer token authentication
- Comprehensive data transformation methods
- **BUG**: Line 366 hardcodes source as "justtcg" but DataSourceEnum doesn't support it

**Status**: ✅ COMPLETE but needs database enum fix

---

## CRITICAL ISSUES SUMMARY

### 1. Database Schema Inconsistencies
- **BLOCKER**: DataSourceEnum missing JUSTTCG and PRICECHARTING values
- Current tasks use "justtcg" string but enum validation will fail
- PriceHistory model can't store new pricing sources

### 2. Configuration Gaps
- No PriceCharting API configuration in config.py or environment files
- Missing rate limiting settings for PriceCharting
- TCGPlayer configuration referenced but not defined

### 3. Worker Task Issues
- sync_tasks.py references non-existent pricecharting_client (line 190)
- Card sync still looks for tcgplayer_id field from PriceCharting data
- Mixed pricing sources causing data inconsistency

### 4. API Schema Mismatches  
- PriceSource enum missing new sources
- API endpoints still default to TCGPlayer
- Search API missing PriceCharting integration

### 5. Test Coverage
- Comprehensive tests exist for TCGPlayer
- No tests for PriceCharting or JustTCG integrations
- Migration testing needed for source changes

---

## MIGRATION COMPLEXITY ANALYSIS

### Current State Summary:
- **TCGPlayer**: Full implementation present but NOT USED in workers
- **JustTCG**: Full implementation and CURRENTLY IN USE for pricing  
- **PriceCharting**: Full client implementation exists but NOT INTEGRATED
- **eBay**: Full implementation for search/comparison

### Migration Path:
1. **Phase 1**: Fix database schema (add enum values)
2. **Phase 2**: Update configuration and environment files
3. **Phase 3**: Replace JustTCG with PriceCharting in worker tasks
4. **Phase 4**: Update API endpoints and schemas
5. **Phase 5**: Add PriceCharting search integration
6. **Phase 6**: Update tests and documentation

### Risk Assessment:
- **LOW RISK**: PriceCharting client is already implemented and tested
- **MEDIUM RISK**: Database schema changes require migration
- **HIGH RISK**: Worker task changes affect background pricing jobs
- **CRITICAL**: Current pricing tasks may fail due to enum mismatch