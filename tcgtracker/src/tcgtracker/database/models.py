"""SQLAlchemy database models for TCG Price Tracker."""

import enum
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


class TCGTypeEnum(enum.Enum):
    """Enum for TCG game types."""

    POKEMON = "pokemon"
    ONEPIECE = "onepiece"


class CardConditionEnum(enum.Enum):
    """Enum for card conditions."""

    MINT = "mint"
    NEAR_MINT = "near_mint"
    LIGHTLY_PLAYED = "lightly_played"
    MODERATELY_PLAYED = "moderately_played"
    HEAVILY_PLAYED = "heavily_played"
    DAMAGED = "damaged"
    POOR = "poor"


class AlertTypeEnum(enum.Enum):
    """Enum for alert types."""

    PRICE_DROP = "price_drop"
    PRICE_INCREASE = "price_increase"
    AVAILABILITY = "availability"


class DataSourceEnum(enum.Enum):
    """Enum for data sources."""

    TCGPLAYER = "tcgplayer"
    EBAY = "ebay"
    CARDMARKET = "cardmarket"
    MANUAL = "manual"


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(Base, TimestampMixin):
    """User model for authentication and preferences."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    api_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)

    # Relationships
    alerts: Mapped[List["UserAlert"]] = relationship("UserAlert", back_populates="user")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}')>"


class TCGSet(Base, TimestampMixin):
    """TCG set information model."""

    __tablename__ = "tcg_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tcg_type: Mapped[TCGTypeEnum] = mapped_column(
        Enum(TCGTypeEnum), nullable=False, index=True
    )
    set_code: Mapped[str] = mapped_column(String(50), nullable=False)
    set_name: Mapped[str] = mapped_column(String(255), nullable=False)
    release_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_cards: Mapped[Optional[int]] = mapped_column(Integer)
    series: Mapped[Optional[str]] = mapped_column(String(100))

    # Relationships
    cards: Mapped[List["Card"]] = relationship("Card", back_populates="tcg_set")

    # Constraints
    __table_args__ = (
        UniqueConstraint("tcg_type", "set_code", name="uq_tcg_sets_type_code"),
        Index("idx_tcg_sets_release", "release_date"),
    )

    def __repr__(self) -> str:
        return f"<TCGSet(id={self.id}, tcg_type='{self.tcg_type.value}', set_code='{self.set_code}')>"


class Card(Base, TimestampMixin):
    """Card model for TCG cards."""

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tcg_type: Mapped[TCGTypeEnum] = mapped_column(
        Enum(TCGTypeEnum), nullable=False, index=True
    )
    set_identifier: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    card_number: Mapped[str] = mapped_column(String(20), nullable=False)
    card_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    rarity: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    tcgplayer_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True)
    search_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Foreign Keys
    tcg_set_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tcg_sets.id", ondelete="SET NULL"), index=True
    )

    # Relationships
    tcg_set: Mapped[Optional["TCGSet"]] = relationship("TCGSet", back_populates="cards")
    price_history: Mapped[List["PriceHistory"]] = relationship(
        "PriceHistory", back_populates="card"
    )
    user_alerts: Mapped[List["UserAlert"]] = relationship(
        "UserAlert", back_populates="card"
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "tcg_type", "set_identifier", "card_number", name="uq_cards_type_set_number"
        ),
        Index("idx_cards_tcg_set", "tcg_type", "set_identifier"),
        Index("idx_cards_popularity", "search_count", postgresql_using="btree"),
        Index(
            "idx_cards_name_search",
            "card_name",
            postgresql_using="gin",
            postgresql_ops={"card_name": "gin_trgm_ops"},
        ),
    )

    @hybrid_property
    def full_name(self) -> str:
        """Get the full card name including set information."""
        return f"{self.card_name} ({self.set_identifier} {self.card_number})"

    def __repr__(self) -> str:
        return f"<Card(id={self.id}, name='{self.card_name}', set='{self.set_identifier}')>"


class PriceHistory(Base):
    """Price history model for tracking card prices over time."""

    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[DataSourceEnum] = mapped_column(
        Enum(DataSourceEnum), nullable=False, index=True
    )
    price_low: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    price_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    price_avg: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    market_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    condition: Mapped[CardConditionEnum] = mapped_column(
        Enum(CardConditionEnum), default=CardConditionEnum.NEAR_MINT, nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    sample_size: Mapped[Optional[int]] = mapped_column(Integer)

    # Foreign Keys
    card: Mapped["Card"] = relationship("Card", back_populates="price_history")

    # Constraints and Indexes
    __table_args__ = (
        Index(
            "idx_price_history_card_time",
            "card_id",
            "timestamp",
            postgresql_using="btree",
        ),
        Index(
            "idx_price_history_recent",
            "timestamp",
            postgresql_where="timestamp > (CURRENT_TIMESTAMP - INTERVAL '30 days')",
        ),
        Index("idx_price_history_card_source_time", "card_id", "source", "timestamp"),
        UniqueConstraint(
            "card_id",
            "source",
            "timestamp",
            "condition",
            name="uq_price_history_card_source_time_condition",
        ),
    )

    def __repr__(self) -> str:
        return f"<PriceHistory(id={self.id}, card_id={self.card_id}, market_price={self.market_price})>"


class UserAlert(Base, TimestampMixin):
    """User alert model for price notifications."""

    __tablename__ = "user_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    card_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    price_threshold: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    alert_type: Mapped[AlertTypeEnum] = mapped_column(
        Enum(AlertTypeEnum), nullable=False
    )
    comparison_operator: Mapped[str] = mapped_column(
        String(5), nullable=False
    )  # <=, >=, =, <, >
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    last_triggered: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="alerts")
    card: Mapped["Card"] = relationship("Card", back_populates="user_alerts")

    # Indexes
    __table_args__ = (
        Index(
            "idx_user_alerts_active",
            "card_id",
            "price_threshold",
            "comparison_operator",
            postgresql_where="is_active = true",
        ),
        Index("idx_user_alerts_user_active", "user_id", "is_active"),
    )

    def __repr__(self) -> str:
        return (
            f"<UserAlert(id={self.id}, user_id={self.user_id}, card_id={self.card_id})>"
        )


class DataSource(Base, TimestampMixin):
    """Data source configuration model."""

    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    api_endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    auth_method: Mapped[str] = mapped_column(String(20), nullable=False)
    rate_limit_per_minute: Mapped[Optional[int]] = mapped_column(Integer)
    rate_limit_per_hour: Mapped[Optional[int]] = mapped_column(Integer)
    last_updated: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<DataSource(id={self.id}, name='{self.name}', active={self.is_active})>"
        )


class APIUsageLog(Base):
    """API usage logging for monitoring and rate limiting."""

    __tablename__ = "api_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    api_key: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    # Indexes for performance and monitoring
    __table_args__ = (
        Index("idx_api_usage_user_time", "user_id", "timestamp"),
        Index("idx_api_usage_endpoint_time", "endpoint", "timestamp"),
        Index("idx_api_usage_status_time", "response_status", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<APIUsageLog(id={self.id}, endpoint='{self.endpoint}', status={self.response_status})>"
