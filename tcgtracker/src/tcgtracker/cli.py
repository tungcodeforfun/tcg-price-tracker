"""Command-line interface for TCG Price Tracker."""

import asyncio

import click
import nest_asyncio
import structlog
from sqlalchemy import text

# Allow nested event loops for better async handling
nest_asyncio.apply()

from tcgtracker.database.connection import (  # noqa: E402
    create_tables,
    drop_tables,
    get_db_manager,
)
from tcgtracker.database.migrations_manager import (  # noqa: E402
    MigrationsManager,
    init_database,
    reset_database,
)

logger = structlog.get_logger(__name__)


def run_async(coro):
    """Run async function with proper event loop handling.

    Uses nest_asyncio to handle nested event loops cleanly,
    avoiding thread-based workarounds.
    """
    try:
        # Get existing loop if available
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Use nest_asyncio to handle nested loops
            return loop.run_until_complete(coro)
        else:
            # No loop running, use standard asyncio.run
            return asyncio.run(coro)
    except RuntimeError:
        # No loop exists, create new one
        return asyncio.run(coro)


@click.group()
def cli():
    """TCG Price Tracker CLI."""


@cli.group()
def db():
    """Database management commands."""


@db.command()
@click.option("--message", "-m", required=True, help="Migration message")
@click.option(
    "--autogenerate/--no-autogenerate", default=True, help="Auto-generate migration"
)
def create_migration(message: str, autogenerate: bool):
    """Create a new database migration."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.create_migration(message, autogenerate)
        click.echo(f"Migration '{message}' created successfully")
    except FileNotFoundError as e:
        click.echo(f"Migration configuration not found: {e}", err=True)
        raise click.ClickException("alembic.ini not found. Run 'alembic init' first.")
    except ValueError as e:
        click.echo(f"Invalid migration parameters: {e}", err=True)
        raise click.ClickException(str(e))
    except Exception as e:
        click.echo(f"Failed to create migration: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
@click.option(
    "--revision", "-r", default="head", help="Target revision (default: head)"
)
def upgrade(revision: str):
    """Upgrade database to specified revision."""
    try:
        migrations_manager = MigrationsManager()
        migrations_manager.upgrade_database(revision)
        click.echo(f"Database upgraded to revision: {revision}")
    except FileNotFoundError as e:
        click.echo(f"Migration configuration not found: {e}", err=True)
        raise click.ClickException("alembic.ini not found. Run 'alembic init' first.")
    except ConnectionError as e:
        click.echo(f"Database connection failed: {e}", err=True)
        raise click.ClickException(
            "Cannot connect to database. Check your configuration."
        )
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
        run_async(init_database())
        click.echo("Database initialized successfully")
    except FileNotFoundError as e:
        click.echo(f"Migration configuration not found: {e}", err=True)
        raise click.ClickException("alembic.ini not found. Run 'alembic init' first.")
    except ConnectionError as e:
        click.echo(f"Database connection failed: {e}", err=True)
        raise click.ClickException(
            "Cannot connect to database. Check your configuration."
        )
    except PermissionError as e:
        click.echo(f"Permission denied: {e}", err=True)
        raise click.ClickException("Insufficient permissions for database operations.")
    except Exception as e:
        click.echo(f"Failed to initialize database: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
@click.confirmation_option(
    prompt="Are you sure you want to reset the database? All data will be lost!"
)
def reset():
    """Reset database by dropping and recreating all tables."""
    try:
        run_async(reset_database())
        click.echo("Database reset successfully")
    except Exception as e:
        click.echo(f"Failed to reset database: {e}", err=True)
        raise click.ClickException(str(e))


@db.command(name="create-tables")
def create_tables_cmd():
    """Create all database tables without migrations."""
    try:
        run_async(create_tables())
        click.echo("Database tables created successfully")
    except Exception as e:
        click.echo(f"Failed to create tables: {e}", err=True)
        raise click.ClickException(str(e))


@db.command(name="drop-tables")
@click.confirmation_option(prompt="Are you sure you want to drop all tables?")
def drop_tables_cmd():
    """Drop all database tables."""
    try:
        run_async(drop_tables())
        click.echo("Database tables dropped successfully")
    except Exception as e:
        click.echo(f"Failed to drop tables: {e}", err=True)
        raise click.ClickException(str(e))


@db.command()
def test_connection():
    """Test database connection."""
    try:
        run_async(_test_connection_async())
        click.echo("Database connection successful!")
    except ConnectionError as e:
        click.echo(f"Database connection failed: {e}", err=True)
        raise click.ClickException(
            "Cannot connect to database. Check your configuration."
        )
    except TimeoutError as e:
        click.echo(f"Database connection timeout: {e}", err=True)
        raise click.ClickException("Database connection timed out.")
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

    uvicorn.run(
        "tcgtracker.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="debug" if debug else "info",
    )


if __name__ == "__main__":
    cli()
