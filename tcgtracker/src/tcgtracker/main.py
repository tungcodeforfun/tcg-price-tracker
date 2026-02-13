"""Main FastAPI application for TCG Price Tracker."""

# Configure structured logging
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from tcgtracker.config import get_settings

# Set up basic logging level
logging.basicConfig(level=logging.INFO)


def configure_logging() -> None:
    """Configure structured logging based on settings."""
    settings = get_settings()

    # Map log levels
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }

    log_level = level_map.get(settings.app.log_level.upper(), logging.INFO)

    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        (
            structlog.processors.JSONRenderer()
            if settings.app.log_format == "json"
            else structlog.dev.ConsoleRenderer()
        ),
    ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Set logging level
    logging.getLogger().setLevel(log_level)


# Configure logging
configure_logging()

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    logger.info("Starting TCG Price Tracker application")

    # Initialize database connection pool
    from tcgtracker.database.connection import get_db_manager

    db_manager = get_db_manager()
    try:
        await db_manager.initialize()
        logger.info("Database connection pool initialized")
    except Exception as e:
        logger.error("Failed to initialize database", exc_info=e)
        # Don't raise here - let the app start even if DB is unavailable

    logger.info("Application startup complete")

    yield

    logger.info("Shutting down TCG Price Tracker application")

    # Clean up database connections
    try:
        await db_manager.close()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error("Error closing database connections", exc_info=e)

    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app.title,
        description=settings.app.description,
        version=settings.app.version,
        debug=settings.app.debug,
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.app.allow_origins,
        allow_credentials=settings.app.allow_credentials,
        allow_methods=settings.app.allow_methods,
        allow_headers=settings.app.allow_headers,
    )

    # Add health check endpoint
    @app.get("/health", tags=["system"])
    async def health_check() -> JSONResponse:
        """Health check endpoint with database connectivity verification."""
        from sqlalchemy import text

        from tcgtracker.database.connection import get_db_manager

        db_status = "unknown"
        try:
            db_manager = get_db_manager()
            async with db_manager.get_session() as session:
                await session.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception:
            db_status = "disconnected"

        overall = "healthy" if db_status == "connected" else "degraded"
        return JSONResponse(
            content={
                "status": overall,
                "service": "tcg-price-tracker",
                "version": settings.app.version,
                "database": db_status,
            },
            status_code=200 if overall == "healthy" else 503,
        )

    # Add root endpoint
    @app.get("/", tags=["system"])
    async def root() -> JSONResponse:
        """Root endpoint with API information."""
        return JSONResponse(
            content={
                "message": "TCG Price Tracker API",
                "version": settings.app.version,
                "docs_url": "/docs",
                "health_url": "/health",
            },
            status_code=200,
        )

    from fastapi import Request

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Global exception handler."""
        logger.error(
            "Unhandled exception occurred",
            exc_info=exc,
            path=request.url.path,
            method=request.method,
        )

        if settings.app.debug:
            # In debug mode, return detailed error information
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "detail": str(exc),
                    "type": type(exc).__name__,
                },
            )
        else:
            # In production, return generic error message
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "message": "An unexpected error occurred. Please try again later.",
                },
            )

    # Add API routers
    from tcgtracker.api import v1_router

    app.include_router(v1_router)

    logger.info("FastAPI application created successfully")
    return app


# Create the application instance
app = create_app()


def main() -> None:
    """Main entry point for running the application."""
    import uvicorn

    settings = get_settings()

    uvicorn.run(
        "tcgtracker.main:app",
        host=settings.app.host,
        port=settings.app.port,
        reload=settings.app.reload,
        log_level=settings.app.log_level.lower(),
    )


if __name__ == "__main__":
    main()
