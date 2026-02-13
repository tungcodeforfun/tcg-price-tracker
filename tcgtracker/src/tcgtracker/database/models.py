"""SQLAlchemy database models for TCG Price Tracker."""

import enum
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

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
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all database models."""


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
    JUSTTCG = "justtcg"
    PRICECHARTING = "pricecharting"


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
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
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
    collection_items: Mapped[List["CollectionItem"]] = relationship(
        "CollectionItem", back_populates="user"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


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

    __allow_unmapped__ = True

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tcg_type: Mapped[TCGTypeEnum] = mapped_column(
        Enum(TCGTypeEnum), nullable=False, index=True
    )
    set_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    card_number: Mapped[Optional[str]] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    rarity: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
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
    collection_items: Mapped[List["CollectionItem"]] = relationship(
        "CollectionItem", back_populates="card"
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "tcg_type", "set_name", "card_number", name="uq_cards_type_set_number"
        ),
        Index("idx_cards_tcg_set", "tcg_type", "set_name"),
        Index("idx_cards_popularity", "search_count", postgresql_using="btree"),
        Index(
            "idx_cards_name_search",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    @hybrid_property
    def full_name(self) -> str:
        """Get the full card name including set information."""
        return f"{self.name} ({self.set_name} {self.card_number})"

    def __repr__(self) -> str:
        return f"<Card(id={self.id}, name='{self.name}', set='{self.set_name}')>"

    # Runtime attributes for API responses
    latest_price: Optional[Decimal] = None
    price_trend: Optional[str] = None


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


class CollectionItem(Base, TimestampMixin):
    """Collection item model for user's card collections."""

    __allow_unmapped__ = True

    __tablename__ = "collection_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    card_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    condition: Mapped[CardConditionEnum] = mapped_column(
        Enum(CardConditionEnum), default=CardConditionEnum.NEAR_MINT, nullable=False
    )
    purchase_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="collection_items")
    card: Mapped["Card"] = relationship("Card", back_populates="collection_items")

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "card_id",
            "condition",
            name="uq_collection_items_user_card_condition",
        ),
        Index("idx_collection_items_user", "user_id"),
        Index("idx_collection_items_card", "card_id"),
    )

    def __repr__(self) -> str:
        return f"<CollectionItem(id={self.id}, user_id={self.user_id}, card_id={self.card_id}, quantity={self.quantity})>"

    # Runtime attributes for API responses
    current_value: Optional[Decimal] = None


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
