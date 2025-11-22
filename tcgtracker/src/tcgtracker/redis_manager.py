"""Redis connection and cache management for TCG Price Tracker."""

import json
from typing import Any, Optional

import redis.asyncio as redis
import structlog
from redis.asyncio import ConnectionPool

from tcgtracker.config import get_settings

logger = structlog.get_logger(__name__)


class RedisManager:
    """Manages Redis connections and provides caching functionality."""

    def __init__(self):
        """Initialize Redis manager."""
        self.settings = get_settings().redis
        self._pool: Optional[ConnectionPool] = None
        self._client: Optional[redis.Redis] = None

    async def initialize(self) -> None:
        """Initialize Redis connection pool."""
        try:
            # Create connection pool
            self._pool = redis.ConnectionPool(
                host=self.settings.host,
                port=self.settings.port,
                db=self.settings.db,
                password=self.settings.password,
                max_connections=self.settings.max_connections,
                socket_connect_timeout=self.settings.socket_timeout,
                socket_timeout=self.settings.socket_timeout,
                decode_responses=True,
            )

            # Create Redis client
            self._client = redis.Redis(connection_pool=self._pool)

            # Test the connection
            await self._client.ping()

            logger.info(
                "Redis connection pool initialized",
                host=self.settings.host,
                port=self.settings.port,
                db=self.settings.db,
                max_connections=self.settings.max_connections,
            )
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error initializing Redis: {e}")
            raise

    async def close(self) -> None:
        """Close Redis connections."""
        if self._client:
            await self._client.close()
            logger.info("Redis client closed")

        if self._pool:
            await self._pool.disconnect()
            logger.info("Redis connection pool closed")

    @property
    def client(self) -> redis.Redis:
        """Get Redis client instance."""
        if not self._client:
            raise RuntimeError("Redis client not initialized. Call initialize() first.")
        return self._client

    # Cache operations
    async def get(self, key: str) -> Optional[str]:
        """Get value from cache."""
        try:
            value = await self.client.get(key)
            if value:
                logger.debug(f"Cache hit for key: {key}")
            else:
                logger.debug(f"Cache miss for key: {key}")
            return value
        except Exception as e:
            logger.error(f"Error getting key {key} from cache: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL."""
        try:
            ttl = ttl or self.settings.default_ttl

            # Convert complex objects to JSON
            if not isinstance(value, str):
                value = json.dumps(value)

            await self.client.set(key, value, ex=ttl)
            logger.debug(f"Cache set for key: {key} with TTL: {ttl}")
            return True
        except Exception as e:
            logger.error(f"Error setting key {key} in cache: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            result = await self.client.delete(key)
            logger.debug(f"Cache delete for key: {key}, result: {result}")
            return bool(result)
        except Exception as e:
            logger.error(f"Error deleting key {key} from cache: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        try:
            return bool(await self.client.exists(key))
        except Exception as e:
            logger.error(f"Error checking existence of key {key}: {e}")
            return False

    async def expire(self, key: str, ttl: int) -> bool:
        """Set expiration time for a key."""
        try:
            return bool(await self.client.expire(key, ttl))
        except Exception as e:
            logger.error(f"Error setting expiration for key {key}: {e}")
            return False

    async def get_json(self, key: str) -> Optional[dict]:
        """Get JSON value from cache."""
        value = await self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON for key {key}: {e}")
        return None

    async def set_json(self, key: str, value: dict, ttl: Optional[int] = None) -> bool:
        """Set JSON value in cache."""
        return await self.set(key, value, ttl)

    # Pattern operations
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        try:
            keys = []
            async for key in self.client.scan_iter(pattern):
                keys.append(key)

            if keys:
                deleted = await self.client.delete(*keys)
                logger.info(f"Deleted {deleted} keys matching pattern: {pattern}")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"Error deleting keys with pattern {pattern}: {e}")
            return 0

    async def get_keys(self, pattern: str = "*") -> list[str]:
        """Get all keys matching a pattern."""
        try:
            keys = []
            async for key in self.client.scan_iter(pattern):
                keys.append(key)
            return keys
        except Exception as e:
            logger.error(f"Error getting keys with pattern {pattern}: {e}")
            return []

    # Health check
    async def health_check(self) -> bool:
        """Check if Redis is healthy."""
        try:
            await self.client.ping()
            return True
        except Exception:
            return False


# Singleton instance
_redis_manager: Optional[RedisManager] = None


def get_redis_manager() -> RedisManager:
    """Get the singleton Redis manager instance."""
    global _redis_manager
    if _redis_manager is None:
        _redis_manager = RedisManager()
    return _redis_manager


async def get_redis_client() -> redis.Redis:
    """Get Redis client for dependency injection."""
    manager = get_redis_manager()
    return manager.client
