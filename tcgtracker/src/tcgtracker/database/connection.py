"""Database connection management for TCG Price Tracker."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from tcgtracker.config import get_settings

logger = structlog.get_logger(__name__)


class DatabaseManager:
    """Database connection manager."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker[AsyncSession]] = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize database engine and session factory."""
        if self._initialized:
            return

        logger.info("Initializing database connection")

        self._engine = create_async_engine(
            self.settings.database.url,
            echo=self.settings.app.debug,
            pool_size=self.settings.database.pool_size,
            max_overflow=self.settings.database.max_overflow,
            pool_timeout=self.settings.database.pool_timeout,
            pool_pre_ping=True,
            pool_recycle=3600,
        )

        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        self._initialized = True
        logger.info("Database connection initialized successfully")

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session with automatic cleanup."""
        if not self._initialized:
            await self.initialize()

        assert self._session_factory is not None
        async with self._session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def close(self) -> None:
        """Close all database connections."""
        if not self._initialized:
            return

        logger.info("Closing database connections")

        if self._engine:
            await self._engine.dispose()

        self._initialized = False
        logger.info("Database connections closed")

    @property
    def engine(self) -> AsyncEngine:
        """Get the database engine."""
        if not self._engine:
            raise RuntimeError("Database manager not initialized")
        return self._engine


# Global database manager instance
_db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> DatabaseManager:
    """Get the global database manager instance."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session."""
    db_manager = get_db_manager()
    async with db_manager.get_session() as session:
        yield session


async def create_tables() -> None:
    """Create all database tables."""
    from tcgtracker.database.models import Base

    db_manager = get_db_manager()
    await db_manager.initialize()

    try:
        async with db_manager.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database tables created successfully")
    finally:
        await db_manager.close()


async def drop_tables() -> None:
    """Drop all database tables."""
    from tcgtracker.database.models import Base

    db_manager = get_db_manager()
    await db_manager.initialize()

    try:
        async with db_manager.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

        logger.info("Database tables dropped successfully")
    finally:
        await db_manager.close()
