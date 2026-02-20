"""Configuration management for TCG Price Tracker."""

import os
from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database configuration."""

    model_config = SettingsConfigDict(env_prefix="DB_")

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="tcgtracker", description="Database name")
    user: str = Field(default="tcgtracker", description="Database user")
    password: str = Field(default="", description="Database password")

    # Connection pool settings
    pool_size: int = Field(default=5, description="Connection pool size")
    max_overflow: int = Field(default=10, description="Maximum overflow connections")
    pool_timeout: int = Field(default=30, description="Pool timeout in seconds")

    @property
    def url(self) -> str:
        """Get the database URL."""
        encoded_user = quote_plus(self.user)
        encoded_password = quote_plus(self.password) if self.password else ""
        return f"postgresql+asyncpg://{encoded_user}:{encoded_password}@{self.host}:{self.port}/{self.name}"


class ExternalAPISettings(BaseSettings):
    """External API configuration."""

    model_config = SettingsConfigDict(env_prefix="API_")

    # JustTCG API
    justtcg_api_key: str = Field(default="", description="JustTCG API Key")
    justtcg_base_url: str = Field(
        default="https://api.justtcg.com/v1", description="JustTCG API base URL"
    )

    # TCGPlayer API
    tcgplayer_client_id: str = Field(default="", description="TCGPlayer Client ID")
    tcgplayer_client_secret: str = Field(
        default="", description="TCGPlayer Client Secret"
    )
    tcgplayer_base_url: str = Field(
        default="https://api.tcgplayer.com", description="TCGPlayer API base URL"
    )
    tcgplayer_auth_code: str = Field(default="", description="TCGPlayer Auth Code")

    # eBay API
    ebay_environment: str = Field(
        default="production", description="eBay environment (sandbox or production)"
    )

    @field_validator("ebay_environment")
    @classmethod
    def validate_ebay_environment(cls, v: str) -> str:
        """Validate that eBay environment is either sandbox or production."""
        if v.lower() not in ["sandbox", "production"]:
            raise ValueError('eBay environment must be "sandbox" or "production"')
        return v.lower()

    # Production credentials
    ebay_client_id: str = Field(default="", description="eBay Production Client ID")
    ebay_client_secret: str = Field(
        default="", description="eBay Production Client Secret"
    )
    # Sandbox credentials
    ebay_sandbox_client_id: str = Field(
        default="", description="eBay Sandbox Client ID"
    )
    ebay_sandbox_client_secret: str = Field(
        default="", description="eBay Sandbox Client Secret"
    )
    # Base URLs (automatically set based on environment)
    ebay_base_url: str = Field(
        default="https://api.ebay.com", description="eBay API base URL"
    )
    ebay_sandbox_base_url: str = Field(
        default="https://api.sandbox.ebay.com", description="eBay Sandbox API base URL"
    )
    # eBay Marketplace Account Deletion
    ebay_verification_token: str = Field(
        default="", description="eBay verification token (32-80 chars, set in eBay portal)"
    )
    ebay_deletion_endpoint: str = Field(
        default="", description="Full public URL of the account deletion endpoint"
    )

    # PriceCharting API
    pricecharting_api_key: str = Field(default="", description="PriceCharting API Key")
    pricecharting_base_url: str = Field(
        default="https://www.pricecharting.com/api",
        description="PriceCharting API base URL",
    )

    # Rate limiting
    justtcg_rate_limit: int = Field(
        default=30,
        description="JustTCG requests per minute (API key: ~40/min, free tier: ~4/hour)",
    )
    tcgplayer_rate_limit: int = Field(
        default=300, description="TCGPlayer requests per minute"
    )
    ebay_rate_limit: int = Field(default=1000, description="eBay requests per hour")
    pricecharting_rate_limit: int = Field(
        default=60, description="PriceCharting requests per minute"
    )


class SecuritySettings(BaseSettings):
    """Security configuration."""

    model_config = SettingsConfigDict(env_prefix="SECURITY_")

    secret_key: str = Field(
        default_factory=lambda: os.getenv(
            "SECRET_KEY",
            os.getenv("SECURITY_SECRET_KEY", ""),
        ),
        description="Secret key for JWT signing (must be at least 32 characters)",
        min_length=32,
    )

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Validate that secret key is properly configured."""
        app_env = os.getenv("APP_ENVIRONMENT", "development")

        if not v:
            if app_env == "production":
                raise ValueError(
                    "SECURITY_SECRET_KEY must be set in production. "
                    "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
            return "development-only-key-not-for-production-use-" + "x" * 20

        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters long")

        return v

    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=60, description="Access token expiration in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=30, description="Refresh token expiration in days"
    )


class AppSettings(BaseSettings):
    """Application configuration."""

    model_config = SettingsConfigDict(env_prefix="APP_")

    title: str = Field(default="TCG Price Tracker", description="Application title")
    description: str = Field(
        default="Pokemon and One Piece TCG price tracking system",
        description="Application description",
    )
    version: str = Field(default="0.1.0", description="Application version")

    # Environment
    environment: str = Field(
        default="development",
        description="Application environment (development, staging, production)",
    )

    # Server settings
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    debug: bool = Field(default=False, description="Debug mode")
    reload: bool = Field(default=False, description="Auto-reload on changes")

    # CORS settings - SECURITY: Never use wildcards in production!
    allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",  # React dev server
            "http://localhost:5173",  # Vite dev server
            "http://localhost:8000",  # FastAPI dev server
            # Add your production domains here:
            # "https://yourdomain.com",
            # "https://app.yourdomain.com"
        ],
        description="Allowed CORS origins - NEVER use wildcard (*) in production!",
    )
    allow_credentials: bool = Field(
        default=True, description="Allow credentials in CORS"
    )
    allow_methods: list[str] = Field(
        default=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        description="Allowed HTTP methods",
    )
    allow_headers: list[str] = Field(
        default=["Authorization", "Content-Type", "X-Requested-With"],
        description="Allowed HTTP headers",
    )

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Log format: json or text")


class Settings:
    """Main settings class combining all configurations."""

    def __init__(self) -> None:
        self.app = AppSettings()
        self.database = DatabaseSettings()
        self.external_apis = ExternalAPISettings()
        self.security = SecuritySettings()


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
