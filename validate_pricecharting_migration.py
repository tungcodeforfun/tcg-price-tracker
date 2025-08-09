#!/usr/bin/env python3
"""Validation script for PriceCharting migration."""

import sys
import asyncio
from datetime import datetime

# Add the source directory to path
sys.path.insert(0, '/Users/tung/Development/tcg-price-tracker/tcgtracker/src')

from tcgtracker.config import get_settings
from tcgtracker.database.models import DataSourceEnum, PriceHistory
from tcgtracker.integrations.pricecharting import PriceChartingClient
from tcgtracker.api.schemas import PriceSource


def validate_database_enums():
    """Validate database enum values."""
    print("🔍 Validating Database Enums...")
    
    try:
        # Check if new enum values exist
        assert hasattr(DataSourceEnum, 'JUSTTCG'), "JUSTTCG missing from DataSourceEnum"
        assert hasattr(DataSourceEnum, 'PRICECHARTING'), "PRICECHARTING missing from DataSourceEnum"
        
        # Check values
        assert DataSourceEnum.JUSTTCG.value == "justtcg"
        assert DataSourceEnum.PRICECHARTING.value == "pricecharting"
        
        print("✅ Database enums validated successfully")
        return True
    except AssertionError as e:
        print(f"❌ Database enum validation failed: {e}")
        return False


def validate_api_schemas():
    """Validate API schema enums."""
    print("\n🔍 Validating API Schemas...")
    
    try:
        # Check if new enum values exist
        assert hasattr(PriceSource, 'JUSTTCG'), "JUSTTCG missing from PriceSource"
        assert hasattr(PriceSource, 'PRICECHARTING'), "PRICECHARTING missing from PriceSource"
        
        # Check values
        assert PriceSource.JUSTTCG == "justtcg"
        assert PriceSource.PRICECHARTING == "pricecharting"
        
        print("✅ API schemas validated successfully")
        return True
    except AssertionError as e:
        print(f"❌ API schema validation failed: {e}")
        return False


def validate_configuration():
    """Validate PriceCharting configuration."""
    print("\n🔍 Validating Configuration...")
    
    try:
        settings = get_settings()
        
        # Check if PriceCharting settings exist
        assert hasattr(settings.external_apis, 'pricecharting_api_key'), "pricecharting_api_key missing"
        assert hasattr(settings.external_apis, 'pricecharting_base_url'), "pricecharting_base_url missing"
        assert hasattr(settings.external_apis, 'pricecharting_rate_limit'), "pricecharting_rate_limit missing"
        
        # Check default values
        assert settings.external_apis.pricecharting_base_url == "https://www.pricecharting.com/api"
        assert settings.external_apis.pricecharting_rate_limit == 60
        
        print(f"✅ Configuration validated successfully")
        print(f"   - API Key: {'Set' if settings.external_apis.pricecharting_api_key else 'Not Set'}")
        print(f"   - Base URL: {settings.external_apis.pricecharting_base_url}")
        print(f"   - Rate Limit: {settings.external_apis.pricecharting_rate_limit} req/min")
        return True
    except Exception as e:
        print(f"❌ Configuration validation failed: {e}")
        return False


async def validate_pricecharting_client():
    """Validate PriceCharting client initialization."""
    print("\n🔍 Validating PriceCharting Client...")
    
    try:
        client = PriceChartingClient()
        
        # Check client properties
        assert hasattr(client, 'api_key'), "api_key attribute missing"
        assert hasattr(client, 'get_card_price'), "get_card_price method missing"
        assert hasattr(client, 'get_pokemon_products'), "get_pokemon_products method missing"
        assert hasattr(client, 'get_one_piece_products'), "get_one_piece_products method missing"
        
        print("✅ PriceCharting client validated successfully")
        
        # Test a simple operation if API key is configured
        settings = get_settings()
        if settings.external_apis.pricecharting_api_key:
            print("   Testing API connection...")
            try:
                # Try a simple search
                results = await client.get_pokemon_products("Pikachu", limit=1)
                if results:
                    print(f"   ✅ API connection successful - Found {len(results)} result(s)")
                else:
                    print("   ⚠️ API returned no results (may be normal)")
            except Exception as e:
                print(f"   ⚠️ API test failed: {e}")
        else:
            print("   ⚠️ API key not configured - skipping connection test")
        
        return True
    except Exception as e:
        print(f"❌ PriceCharting client validation failed: {e}")
        return False


def validate_worker_tasks():
    """Validate worker task updates."""
    print("\n🔍 Validating Worker Tasks...")
    
    try:
        # Import worker tasks
        from tcgtracker.workers.tasks.sync_tasks import SyncTask
        from tcgtracker.workers.tasks.price_tasks import PriceUpdateTask
        
        # Check SyncTask has pricecharting_client
        sync_task = SyncTask()
        assert hasattr(sync_task, 'pricecharting_client'), "pricecharting_client missing from SyncTask"
        
        # Check PriceUpdateTask has pricecharting_client
        price_task = PriceUpdateTask()
        assert hasattr(price_task, 'pricecharting_client'), "pricecharting_client missing from PriceUpdateTask"
        
        print("✅ Worker tasks validated successfully")
        return True
    except Exception as e:
        print(f"❌ Worker task validation failed: {e}")
        return False


def validate_api_endpoints():
    """Validate API endpoint updates."""
    print("\n🔍 Validating API Endpoints...")
    
    try:
        # Import API endpoints
        from tcgtracker.api.v1.search import search_pricecharting, search_justtcg
        from tcgtracker.api.v1.prices import fetch_and_update_price
        
        # Check new search endpoints exist
        assert search_pricecharting is not None, "search_pricecharting endpoint missing"
        assert search_justtcg is not None, "search_justtcg endpoint missing"
        
        # Check fetch_and_update_price handles new sources
        import inspect
        source = inspect.getsource(fetch_and_update_price)
        assert "PriceSource.PRICECHARTING" in source, "PriceCharting not handled in fetch_and_update_price"
        assert "PriceSource.JUSTTCG" in source, "JustTCG not handled in fetch_and_update_price"
        
        print("✅ API endpoints validated successfully")
        return True
    except Exception as e:
        print(f"❌ API endpoint validation failed: {e}")
        return False


async def main():
    """Run all validation checks."""
    print("=" * 60)
    print("TCG Price Tracker - PriceCharting Migration Validation")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = []
    
    # Run validations
    results.append(("Database Enums", validate_database_enums()))
    results.append(("API Schemas", validate_api_schemas()))
    results.append(("Configuration", validate_configuration()))
    results.append(("PriceCharting Client", await validate_pricecharting_client()))
    results.append(("Worker Tasks", validate_worker_tasks()))
    results.append(("API Endpoints", validate_api_endpoints()))
    
    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name:.<30} {status}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    
    if all_passed:
        print("\n🎉 All validations passed! Migration is complete.")
        print("\nNext Steps:")
        print("1. Add your PriceCharting API key to .env file")
        print("2. Restart the application and workers")
        print("3. Test price updates with a sample card")
        print("4. Monitor logs for any errors")
        return 0
    else:
        print("\n⚠️ Some validations failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)