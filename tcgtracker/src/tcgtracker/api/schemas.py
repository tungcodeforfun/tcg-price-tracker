"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class GameType(str, Enum):
    """Supported TCG game types."""
    POKEMON = "pokemon"
    ONE_PIECE = "one_piece"
    MAGIC = "magic"
    YUGIOH = "yugioh"


class CardCondition(str, Enum):
    """Card condition grades."""
    MINT = "mint"
    NEAR_MINT = "near_mint"
    LIGHTLY_PLAYED = "lightly_played"
    MODERATELY_PLAYED = "moderately_played"
    HEAVILY_PLAYED = "heavily_played"
    DAMAGED = "damaged"


class PriceSource(str, Enum):
    """Price data sources."""
    TCGPLAYER = "tcgplayer"
    EBAY = "ebay"
    CARDMARKET = "cardmarket"


# User schemas
class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    username: str


class UserCreate(UserBase):
    """User creation schema."""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """User update schema."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None


class UserResponse(UserBase):
    """User response schema."""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Auth schemas
class Token(BaseModel):
    """Token response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Token refresh request schema."""
    refresh_token: str


class LoginRequest(BaseModel):
    """Login request schema."""
    username: str
    password: str


# Card schemas
class CardBase(BaseModel):
    """Base card schema."""
    game_type: GameType
    name: str
    set_name: str
    set_code: Optional[str] = None
    card_number: Optional[str] = None
    rarity: Optional[str] = None
    foil: bool = False
    language: str = "English"
    external_id: Optional[str] = None
    image_url: Optional[str] = None


class CardCreate(CardBase):
    """Card creation schema."""
    pass


class CardUpdate(BaseModel):
    """Card update schema."""
    name: Optional[str] = None
    set_name: Optional[str] = None
    rarity: Optional[str] = None
    image_url: Optional[str] = None


class CardResponse(CardBase):
    """Card response schema."""
    id: int
    created_at: datetime
    updated_at: datetime
    latest_price: Optional[Decimal] = None
    price_trend: Optional[str] = None

    class Config:
        from_attributes = True


class CardSearchParams(BaseModel):
    """Card search parameters."""
    query: Optional[str] = None
    game_type: Optional[GameType] = None
    set_name: Optional[str] = None
    rarity: Optional[str] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    limit: int = Field(default=20, le=100)
    offset: int = Field(default=0, ge=0)


# Price schemas
class PriceCreate(BaseModel):
    """Price creation schema."""
    card_id: int
    source: PriceSource
    price: Decimal = Field(..., gt=0)
    currency: str = "USD"
    condition: CardCondition = CardCondition.NEAR_MINT
    listing_url: Optional[str] = None


class PriceResponse(BaseModel):
    """Price response schema."""
    id: int
    card_id: int
    source: PriceSource
    price: Decimal
    currency: str
    condition: CardCondition
    listing_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PriceHistory(BaseModel):
    """Price history response."""
    card_id: int
    prices: List[PriceResponse]
    average_price: Optional[Decimal]
    min_price: Optional[Decimal]
    max_price: Optional[Decimal]
    trend: Optional[str]


# Collection schemas
class CardCreate(BaseModel):
    """Collection item creation schema."""
    card_id: int
    quantity: int = Field(default=1, gt=0)
    condition: CardCondition = CardCondition.NEAR_MINT
    purchase_price: Optional[Decimal] = None
    notes: Optional[str] = None


class CardUpdate(BaseModel):
    """Collection item update schema."""
    quantity: Optional[int] = Field(None, gt=0)
    condition: Optional[CardCondition] = None
    purchase_price: Optional[Decimal] = None
    notes: Optional[str] = None


class CardResponse(BaseModel):
    """Collection item response schema."""
    id: int
    user_id: int
    card_id: int
    quantity: int
    condition: CardCondition
    purchase_price: Optional[Decimal]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    card: Optional[CardResponse] = None
    current_value: Optional[Decimal] = None

    class Config:
        from_attributes = True


class CollectionStats(BaseModel):
    """Collection statistics."""
    total_cards: int
    unique_cards: int
    total_value: Decimal
    total_invested: Decimal
    profit_loss: Decimal
    profit_loss_percentage: float


# Price alert schemas
class PriceAlertCreate(BaseModel):
    """Price alert creation schema."""
    card_id: int
    target_price: Decimal = Field(..., gt=0)
    alert_type: str = Field(..., pattern="^(above|below)$")
    is_active: bool = True


class PriceAlertResponse(BaseModel):
    """Price alert response schema."""
    id: int
    user_id: int
    card_id: int
    target_price: Decimal
    alert_type: str
    is_active: bool
    triggered_at: Optional[datetime]
    created_at: datetime
    card: Optional[CardResponse] = None

    class Config:
        from_attributes = True


# Search schemas
class SearchRequest(BaseModel):
    """General search request."""
    query: str = Field(..., min_length=1)
    game_type: Optional[GameType] = None
    source: Optional[PriceSource] = None
    limit: int = Field(default=20, le=100)


class SearchResult(BaseModel):
    """Search result from external API."""
    external_id: str
    name: str
    set_name: str
    game_type: GameType
    price: Optional[Decimal]
    image_url: Optional[str]
    source: PriceSource
    listing_url: Optional[str]


class BulkPriceUpdate(BaseModel):
    """Bulk price update request."""
    card_ids: List[int]
    source: Optional[PriceSource] = None