"""Command-line interface for TCG Price Tracker."""

import asyncio
from typing import Optional

import click
import structlog
from sqlalchemy import text

from tcgtracker.database.connection import get_db_manager, create_tables, drop_tables
from tcgtracker.database.migrations_manager import (
    MigrationsManager,
    init_database,
    reset_database,
)

logger = structlog.get_logger(__name__)


@click.group()
def cli():
    """TCG Price Tracker CLI."""
    pass


@cli.group()
def db():
    """Database management commands."""
    pass


@db.command()
@click.option("--message", "-m", required=True, help="Migration message")
@click.option("--autogenerate/--no-autogenerate", default=True, help="Auto-generate migration")
def create_migration(message: str, autogenerate: bool):
    """Create a new database migration."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.create_migration(message, autogenerate)
        click.echo(f"Migration '{message}' created successfully")
    except Exception as e:
        click.echo(f"Failed to create migration: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
@click.option("--revision", "-r", default="head", help="Target revision (default: head)")
def upgrade(revision: str):
    """Upgrade database to specified revision."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.upgrade_database(revision)
        click.echo(f"Database upgraded to revision: {revision}")
    except Exception as e:
        click.echo(f"Failed to upgrade database: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
@click.option("--revision", "-r", required=True, help="Target revision")
def downgrade(revision: str):
    """Downgrade database to specified revision."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.downgrade_database(revision)
        click.echo(f"Database downgraded to revision: {revision}")
    except Exception as e:
        click.echo(f"Failed to downgrade database: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
def current():
    """Show current database revision."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.show_current()
    except Exception as e:
        click.echo(f"Failed to show current revision: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
def history():
    """Show migration history."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.show_history()
    except Exception as e:
        click.echo(f"Failed to show history: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
def init():
    """Initialize database with all tables and migrations."""
    try:
        asyncio.run(init_database())
        click.echo("Database initialized successfully")
    except Exception as e:
        click.echo(f"Failed to initialize database: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
@click.confirmation_option(prompt="Are you sure you want to reset the database? All data will be lost!")
def reset():
    """Reset database by dropping and recreating all tables."""
    try:
        asyncio.run(reset_database())
        click.echo("Database reset successfully")
    except Exception as e:
        click.echo(f"Failed to reset database: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
def create_tables():
    """Create all database tables without migrations."""
    try:
        asyncio.run(create_tables())
        click.echo("Database tables created successfully")
    except Exception as e:
        click.echo(f"Failed to create tables: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
@click.confirmation_option(prompt="Are you sure you want to drop all tables?")
def drop_tables():
    """Drop all database tables."""
    try:
        asyncio.run(drop_tables())
        click.echo("Database tables dropped successfully")
    except Exception as e:
        click.echo(f"Failed to drop tables: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
def test_connection():
    """Test database connection."""
    try:
        asyncio.run(_test_connection_async())
        click.echo("Database connection successful!")
    except Exception as e:
        click.echo(f"Database connection failed: {e}", err=True)
        raise click.ClickException(str(e))


async def _test_connection_async():
    """Internal async function for testing connection."""
    db_manager = get_db_manager()
    await db_manager.initialize()
    
    async with db_manager.get_write_session() as session:
        result = await session.execute(text("SELECT 1 as test"))
        row = result.fetchone()
        if not (row and row.test == 1):
            raise Exception("Unexpected result from test query")
            
    await db_manager.close()


@cli.command()
@click.option("--host", default="0.0.0.0", help="Host to bind to")
@click.option("--port", default=8000, help="Port to bind to")
@click.option("--reload/--no-reload", default=False, help="Enable auto-reload")
@click.option("--debug/--no-debug", default=False, help="Enable debug mode")
def serve(host: str, port: int, reload: bool, debug: bool):
    """Start the TCG Price Tracker server."""
    import uvicorn
    from tcgtracker.main import app
    
    uvicorn.run(
        "tcgtracker.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="debug" if debug else "info",
    )


if __name__ == "__main__":
    cli()