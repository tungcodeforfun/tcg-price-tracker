"""Configuration management for TCG Price Tracker."""

from functools import lru_cache
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

from pydantic import Field, validator
from pydantic_settings import BaseSettings


class DatabaseSettings(BaseSettings):
    """Database configuration."""
    
    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="tcgtracker", description="Database name")
    user: str = Field(default="tcgtracker", description="Database user")
    password: str = Field(default="", description="Database password")
    
    # Read replica configuration
    read_host: Optional[str] = Field(default=None, description="Read replica host")
    read_port: Optional[int] = Field(default=None, description="Read replica port")
    
    # Connection pool settings
    pool_size: int = Field(default=20, description="Connection pool size")
    max_overflow: int = Field(default=0, description="Maximum overflow connections")
    pool_timeout: int = Field(default=30, description="Pool timeout in seconds")
    
    @property
    def url(self) -> str:
        """Get the database URL."""
        encoded_user = quote_plus(self.user)
        encoded_password = quote_plus(self.password) if self.password else ""
        return f"postgresql+asyncpg://{encoded_user}:{encoded_password}@{self.host}:{self.port}/{self.name}"
    
    @property
    def read_url(self) -> Optional[str]:
        """Get the read replica database URL."""
        if self.read_host and self.read_port:
            encoded_user = quote_plus(self.user)
            encoded_password = quote_plus(self.password) if self.password else ""
            return f"postgresql+asyncpg://{encoded_user}:{encoded_password}@{self.read_host}:{self.read_port}/{self.name}"
        return None
    
    class Config:
        env_prefix = "DB_"


class RedisSettings(BaseSettings):
    """Redis configuration."""
    
    host: str = Field(default="localhost", description="Redis host")
    port: int = Field(default=6379, description="Redis port")
    db: int = Field(default=0, description="Redis database number")
    password: Optional[str] = Field(default=None, description="Redis password")
    
    # Connection pool settings
    max_connections: int = Field(default=20, description="Maximum connections in pool")
    socket_timeout: int = Field(default=30, description="Socket timeout in seconds")
    
    # Cache settings
    default_ttl: int = Field(default=300, description="Default cache TTL in seconds")
    
    @property
    def url(self) -> str:
        """Get the Redis URL."""
        auth_part = f":{self.password}@" if self.password else ""
        return f"redis://{auth_part}{self.host}:{self.port}/{self.db}"
    
    class Config:
        env_prefix = "REDIS_"


class CelerySettings(BaseSettings):
    """Celery configuration."""
    
    broker_url: str = Field(default="redis://localhost:6379/1", description="Celery broker URL")
    result_backend: str = Field(default="redis://localhost:6379/2", description="Celery result backend URL")
    
    # Task settings
    task_serializer: str = Field(default="json", description="Task serialization format")
    result_serializer: str = Field(default="json", description="Result serialization format")
    accept_content: list[str] = Field(default=["json"], description="Accepted content types")
    timezone: str = Field(default="UTC", description="Timezone for scheduled tasks")
    enable_utc: bool = Field(default=True, description="Enable UTC")
    
    # Worker settings
    worker_prefetch_multiplier: int = Field(default=1, description="Worker prefetch multiplier")
    task_acks_late: bool = Field(default=True, description="Acknowledge tasks late")
    worker_max_tasks_per_child: int = Field(default=1000, description="Max tasks per worker child")
    
    class Config:
        env_prefix = "CELERY_"


class ExternalAPISettings(BaseSettings):
    """External API configuration."""
    
    # TCGPlayer API
    tcgplayer_client_id: str = Field(default="", description="TCGPlayer Client ID")
    tcgplayer_client_secret: str = Field(default="", description="TCGPlayer Client Secret")
    tcgplayer_auth_code: str = Field(default="", description="TCGPlayer Authorization Code")
    tcgplayer_base_url: str = Field(default="https://api.tcgplayer.com", description="TCGPlayer API base URL")
    
    # eBay API
    ebay_client_id: str = Field(default="", description="eBay Client ID")
    ebay_client_secret: str = Field(default="", description="eBay Client Secret")
    ebay_base_url: str = Field(default="https://api.ebay.com", description="eBay API base URL")
    
    # Rate limiting
    tcgplayer_rate_limit: int = Field(default=300, description="TCGPlayer requests per minute")
    ebay_rate_limit: int = Field(default=1000, description="eBay requests per hour")
    
    class Config:
        env_prefix = "API_"


class SecuritySettings(BaseSettings):
    """Security configuration."""
    
    secret_key: str = Field(default="dev_secret_key_change_in_production_must_be_32_chars_long", description="Secret key for JWT signing")
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(default=60, description="Access token expiration in minutes")
    refresh_token_expire_days: int = Field(default=30, description="Refresh token expiration in days")
    
    # API Key settings
    api_key_length: int = Field(default=32, description="API key length")
    
    # Password hashing
    password_hash_schemes: list[str] = Field(default=["bcrypt"], description="Password hash schemes")
    
    @validator("secret_key")
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters long")
        return v
    
    class Config:
        env_prefix = "SECURITY_"


class AppSettings(BaseSettings):
    """Application configuration."""
    
    title: str = Field(default="TCG Price Tracker", description="Application title")
    description: str = Field(default="Pokemon and One Piece TCG price tracking system", description="Application description")
    version: str = Field(default="0.1.0", description="Application version")
    
    # Server settings
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    debug: bool = Field(default=False, description="Debug mode")
    reload: bool = Field(default=False, description="Auto-reload on changes")
    
    # CORS settings
    allow_origins: list[str] = Field(default=["*"], description="Allowed CORS origins")
    allow_credentials: bool = Field(default=True, description="Allow credentials in CORS")
    allow_methods: list[str] = Field(default=["*"], description="Allowed HTTP methods")
    allow_headers: list[str] = Field(default=["*"], description="Allowed HTTP headers")
    
    # Logging
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Log format: json or text")
    
    class Config:
        env_prefix = "APP_"


class Settings:
    """Main settings class combining all configurations."""
    
    def __init__(self) -> None:
        self.app = AppSettings()
        self.database = DatabaseSettings()
        self.redis = RedisSettings()
        self.celery = CelerySettings()
        self.external_apis = ExternalAPISettings()
        self.security = SecuritySettings()


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


def get_celery_config() -> Dict[str, Any]:
    """Get Celery configuration dictionary."""
    settings = get_settings()
    celery_settings = settings.celery
    
    return {
        "broker_url": celery_settings.broker_url,
        "result_backend": celery_settings.result_backend,
        "task_serializer": celery_settings.task_serializer,
        "result_serializer": celery_settings.result_serializer,
        "accept_content": celery_settings.accept_content,
        "timezone": celery_settings.timezone,
        "enable_utc": celery_settings.enable_utc,
        "worker_prefetch_multiplier": celery_settings.worker_prefetch_multiplier,
        "task_acks_late": celery_settings.task_acks_late,
        "worker_max_tasks_per_child": celery_settings.worker_max_tasks_per_child,
    }