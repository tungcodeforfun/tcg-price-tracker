"""Database connection management for TCG Price Tracker."""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
from sqlalchemy import event, pool
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from tcgtracker.config import get_settings

logger = structlog.get_logger(__name__)


class DatabaseManager:
    """Database connection manager with read/write splitting."""
    
    def __init__(self) -> None:
        self.settings = get_settings()
        self._write_engine: Optional[AsyncEngine] = None
        self._read_engine: Optional[AsyncEngine] = None
        self._write_session_factory: Optional[async_sessionmaker[AsyncSession]] = None
        self._read_session_factory: Optional[async_sessionmaker[AsyncSession]] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize database engines and session factories."""
        if self._initialized:
            return
        
        logger.info("Initializing database connections")
        
        # Create write engine
        self._write_engine = create_async_engine(
            self.settings.database.url,
            echo=self.settings.app.debug,
            pool_size=self.settings.database.pool_size,
            max_overflow=self.settings.database.max_overflow,
            pool_timeout=self.settings.database.pool_timeout,
            pool_pre_ping=True,
            pool_recycle=3600,  # Recycle connections after 1 hour
        )
        
        # Create read engine (use read replica if configured, otherwise use write engine)
        read_url = self.settings.database.read_url or self.settings.database.url
        if read_url != self.settings.database.url:
            logger.info("Using read replica for read operations")
            self._read_engine = create_async_engine(
                read_url,
                echo=self.settings.app.debug,
                pool_size=max(20, self.settings.database.pool_size),
                max_overflow=self.settings.database.max_overflow,
                pool_timeout=self.settings.database.pool_timeout,
                pool_pre_ping=True,
                pool_recycle=3600,
            )
        else:
            logger.info("Using single database for read/write operations")
            self._read_engine = self._write_engine
        
        # Create session factories
        self._write_session_factory = async_sessionmaker(
            self._write_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        
        self._read_session_factory = async_sessionmaker(
            self._read_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        
        # Add connection event listeners for monitoring
        self._add_event_listeners()
        
        self._initialized = True
        logger.info("Database connections initialized successfully")
    
    def _add_event_listeners(self) -> None:
        """Add event listeners for connection monitoring."""
        
        @event.listens_for(self._write_engine.sync_engine, "connect")
        def on_connect(dbapi_connection, connection_record):
            logger.debug("New database connection established")
        
        @event.listens_for(self._write_engine.sync_engine, "checkout")
        def on_checkout(dbapi_connection, connection_record, connection_proxy):
            logger.debug("Connection checked out from pool")
        
        @event.listens_for(self._write_engine.sync_engine, "checkin")
        def on_checkin(dbapi_connection, connection_record):
            logger.debug("Connection returned to pool")
    
    @asynccontextmanager
    async def get_write_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a write session with automatic cleanup."""
        if not self._initialized:
            await self.initialize()
        
        assert self._write_session_factory is not None
        async with self._write_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    @asynccontextmanager
    async def get_read_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a read session with automatic cleanup."""
        if not self._initialized:
            await self.initialize()
        
        assert self._read_session_factory is not None
        async with self._read_session_factory() as session:
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
        
        if self._write_engine:
            await self._write_engine.dispose()
        
        if self._read_engine and self._read_engine != self._write_engine:
            await self._read_engine.dispose()
        
        self._initialized = False
        logger.info("Database connections closed")
    
    @property
    def write_engine(self) -> AsyncEngine:
        """Get the write engine."""
        if not self._write_engine:
            raise RuntimeError("Database manager not initialized")
        return self._write_engine
    
    @property
    def read_engine(self) -> AsyncEngine:
        """Get the read engine."""
        if not self._read_engine:
            raise RuntimeError("Database manager not initialized")
        return self._read_engine


# Global database manager instance
_db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> DatabaseManager:
    """Get the global database manager instance."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


@asynccontextmanager
async def get_session(read_only: bool = False) -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session.
    
    Args:
        read_only: If True, use read replica (if available)
    """
    db_manager = get_db_manager()
    
    if read_only:
        async with db_manager.get_read_session() as session:
            yield session
    else:
        async with db_manager.get_write_session() as session:
            yield session


async def create_tables() -> None:
    """Create all database tables."""
    from tcgtracker.database.models import Base
    
    db_manager = get_db_manager()
    await db_manager.initialize()
    
    async with db_manager.write_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Database tables created successfully")


async def drop_tables() -> None:
    """Drop all database tables."""
    from tcgtracker.database.models import Base
    
    db_manager = get_db_manager()
    await db_manager.initialize()
    
    async with db_manager.write_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    logger.info("Database tables dropped successfully")