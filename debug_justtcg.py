#!/usr/bin/env python3
"""Debug script to check JustTCG API key configuration."""

import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent / "tcgtracker" / "src"))

from dotenv import load_dotenv

# Load sandbox environment
env_file = Path(__file__).parent / ".env.sandbox"
load_dotenv(env_file, override=True)

# Check what's loaded
api_key = os.getenv("API_JUSTTCG_API_KEY")
print(f"Environment variable API_JUSTTCG_API_KEY: {api_key}")

# Now check through config
from tcgtracker.config import get_settings

settings = get_settings()
print(f"Settings API key: {settings.external_apis.justtcg_api_key}")

# Check the client initialization
from tcgtracker.integrations.justtcg import JustTCGClient

client = JustTCGClient()
print(f"Client API key: {client.api_key}")

# Check headers
headers = client._prepare_headers()
print(f"Headers prepared: {headers}")

# Try a different header format
import httpx
import asyncio

async def test_api():
    """Test API with different header formats."""
    
    # Test 1: Bearer token
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.justtcg.com/v1/cards/search",
            params={"q": "Charizard", "limit": 1, "game": "pokemon"},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        print(f"\nBearer token response: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
    
    # Test 2: API-Key header
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.justtcg.com/v1/cards/search",
            params={"q": "Charizard", "limit": 1, "game": "pokemon"},
            headers={"API-Key": api_key}
        )
        print(f"\nAPI-Key header response: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
    
    # Test 3: X-API-Key header
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.justtcg.com/v1/cards/search",
            params={"q": "Charizard", "limit": 1, "game": "pokemon"},
            headers={"X-API-Key": api_key}
        )
        print(f"\nX-API-Key header response: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
    
    # Test 4: apikey query parameter
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.justtcg.com/v1/cards/search",
            params={"q": "Charizard", "limit": 1, "game": "pokemon", "apikey": api_key}
        )
        print(f"\nQuery parameter apikey response: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")

asyncio.run(test_api())