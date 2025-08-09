"""Database migrations management utilities."""

import asyncio
import re
from pathlib import Path
from typing import Optional

import structlog
from alembic import command
from alembic.config import Config
from sqlalchemy.pool import NullPool

from tcgtracker.config import get_settings
from tcgtracker.database.connection import get_db_manager

logger = structlog.get_logger(__name__)


class MigrationsManager:
    """Manager for database migrations using Alembic."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.alembic_cfg = self._get_alembic_config()

    def _get_alembic_config(self) -> Config:
        """Get Alembic configuration."""
        # Search for alembic.ini starting from current directory and moving up
        current = Path(__file__).parent
        for parent in [current] + list(current.parents):
            alembic_ini = parent / "alembic.ini"
            if alembic_ini.exists():
                logger.info(f"Found alembic.ini at {alembic_ini}")
                break
        else:
            raise FileNotFoundError("alembic.ini not found in project hierarchy")

        cfg = Config(str(alembic_ini))
        cfg.set_main_option("sqlalchemy.url", self.settings.database.url)
        return cfg

    def create_migration(self, message: str, autogenerate: bool = True) -> None:
        """Create a new migration."""
        # Validate migration message
        if not message or not message.strip():
            raise ValueError("Migration message cannot be empty")

        # Sanitize message to prevent SQL injection and command injection
        # Allow alphanumeric, spaces, hyphens, underscores, periods (for versions), and colons (for namespacing)
        sanitized_message = re.sub(r"[^a-zA-Z0-9\s\-_:.]", "", message.strip())
        # Limit message length to prevent buffer overflow
        sanitized_message = sanitized_message[:100]

        try:
            logger.info(f"Creating migration: {sanitized_message}")
            command.revision(
                self.alembic_cfg, message=sanitized_message, autogenerate=autogenerate
            )
            logger.info("Migration created successfully")
        except Exception as e:
            logger.error(f"Failed to create migration: {e}")
            raise

    def upgrade_database(self, revision: str = "head") -> None:
        """Upgrade database to specified revision."""
        try:
            logger.info(f"Upgrading database to revision: {revision}")
            command.upgrade(self.alembic_cfg, revision)
            logger.info("Database upgrade completed successfully")
        except Exception as e:
            logger.error(f"Failed to upgrade database: {e}")
            raise

    def downgrade_database(self, revision: str) -> None:
        """Downgrade database to specified revision."""
        try:
            logger.info(f"Downgrading database to revision: {revision}")
            command.downgrade(self.alembic_cfg, revision)
            logger.info("Database downgrade completed successfully")
        except Exception as e:
            logger.error(f"Failed to downgrade database: {e}")
            raise

    def get_current_revision(self) -> Optional[str]:
        """Get current database revision."""
        try:
            from alembic.runtime.migration import MigrationContext
            from sqlalchemy import create_engine

            # Create a dedicated engine with restricted pooling for migration context
            # This prevents connection exposure and limits resource usage
            engine = create_engine(
                self.settings.database.url,
                poolclass=NullPool,  # No connection pooling for one-off operations
                connect_args={"connect_timeout": 10},
            )

            try:
                with engine.connect() as connection:
                    context = MigrationContext.configure(connection)
                    return context.get_current_revision()
            finally:
                engine.dispose()
        except Exception as e:
            logger.warning(f"Failed to get current revision: {e}")
            return None

    def show_history(self) -> None:
        """Show migration history."""
        try:
            command.history(self.alembic_cfg)
        except Exception as e:
            logger.error(f"Failed to show history: {e}")
            raise

    def show_current(self) -> None:
        """Show current revision."""
        try:
            command.current(self.alembic_cfg)
        except Exception as e:
            logger.error(f"Failed to show current revision: {e}")
            raise


async def init_database() -> None:
    """Initialize database with all tables and initial data."""
    logger.info("Initializing database")

    db_manager = get_db_manager()
    await db_manager.initialize()

    migrations_manager = MigrationsManager()

    try:
        # Check if this is a fresh database
        current_revision = migrations_manager.get_current_revision()

        if current_revision is None:
            logger.info("Fresh database detected, running migrations")
            migrations_manager.upgrade_database("head")
        else:
            logger.info(f"Database exists at revision: {current_revision}")
            # Optionally upgrade to latest
            migrations_manager.upgrade_database("head")

        logger.info("Database initialization completed")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    finally:
        await db_manager.close()


async def reset_database() -> None:
    """Reset database by dropping and recreating all tables."""
    logger.warning("Resetting database - all data will be lost!")

    from tcgtracker.database.connection import drop_tables, create_tables

    try:
        await drop_tables()
        await create_tables()
        logger.info("Database reset completed")
    except Exception as e:
        logger.error(f"Database reset failed: {e}")
        raise


def get_migrations_manager() -> MigrationsManager:
    """Get migrations manager instance."""
    return MigrationsManager()
