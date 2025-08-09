"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class TCGType(str, Enum):
    """Supported TCG game types - must match database TCGTypeEnum."""

    POKEMON = "pokemon"
    ONEPIECE = "onepiece"  # Note: no underscore to match database
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
    username: str = Field(..., min_length=3, max_length=30)

    @validator("username")
    def validate_username(cls, v):
        """Validate username format and security."""
        from tcgtracker.validation.validators import SecurityValidator

        return SecurityValidator.validate_username_format(v)


class UserCreate(UserBase):
    """User creation schema."""

    password: str = Field(..., min_length=8, max_length=128)

    @validator("password")
    def validate_password_strength(cls, v):
        """Validate password complexity requirements."""
        from tcgtracker.validation.validators import SecurityValidator

        return SecurityValidator.validate_password_strength(v)


class UserUpdate(BaseModel):
    """User update schema."""

    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=30)

    @validator("username")
    def validate_username(cls, v):
        """Validate username format if provided."""
        if v is not None:
            from tcgtracker.validation.validators import SecurityValidator

            return SecurityValidator.validate_username_format(v)
        return v


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

    tcg_type: TCGType = Field(..., description="TCG game type")
    name: str = Field(..., min_length=1, max_length=200)
    set_name: str = Field(..., min_length=1, max_length=50)
    card_number: Optional[str] = Field(None, max_length=20)
    rarity: Optional[str] = Field(None, max_length=50)
    tcgplayer_id: Optional[int] = None
    external_id: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = None

    @validator("name")
    def sanitize_card_name(cls, v):
        """Sanitize card name for safe storage."""
        from tcgtracker.validation.sanitizers import sanitize_card_name

        return sanitize_card_name(v)

    @validator("image_url")
    def validate_image_url(cls, v):
        """Validate image URL for security."""
        if v:
            from tcgtracker.validation.validators import SecurityValidator

            return SecurityValidator.validate_url_security(v)
        return v


class CardCreate(CardBase):
    """Card creation schema."""

    pass


class CardUpdate(BaseModel):
    """Card update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    set_name: Optional[str] = Field(None, min_length=1, max_length=50)
    rarity: Optional[str] = Field(None, max_length=50)
    image_url: Optional[str] = None

    @validator("name")
    def sanitize_card_name(cls, v):
        """Sanitize card name if provided."""
        if v:
            from tcgtracker.validation.sanitizers import sanitize_card_name

            return sanitize_card_name(v)
        return v

    @validator("image_url")
    def validate_image_url(cls, v):
        """Validate image URL if provided."""
        if v:
            from tcgtracker.validation.validators import SecurityValidator

            return SecurityValidator.validate_url_security(v)
        return v


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

    query: Optional[str] = Field(None, max_length=200)
    tcg_type: Optional[TCGType] = None
    set_name: Optional[str] = Field(None, max_length=50)
    rarity: Optional[str] = Field(None, max_length=50)
    min_price: Optional[Decimal] = Field(None, gt=0, le=100000)
    max_price: Optional[Decimal] = Field(None, gt=0, le=100000)
    limit: int = Field(default=20, gt=0, le=100)
    offset: int = Field(default=0, ge=0)

    @validator("query")
    def sanitize_search_query(cls, v):
        """Sanitize search query to prevent injection."""
        if v:
            from tcgtracker.validation.sanitizers import sanitize_search_input

            return sanitize_search_input(v)
        return v

    @validator("set_name")
    def sanitize_set_name(cls, v):
        """Sanitize set name for search."""
        if v:
            from tcgtracker.validation.sanitizers import sanitize_search_input

            return sanitize_search_input(v)
        return v

    @validator("max_price")
    def validate_price_range(cls, v, values):
        """Ensure max_price >= min_price if both are provided."""
        min_price = values.get("min_price")
        if min_price and v and v < min_price:
            raise ValueError("max_price must be greater than or equal to min_price")
        return v


# Price schemas
class PriceCreate(BaseModel):
    """Price creation schema."""

    card_id: int
    source: PriceSource
    market_price: Decimal = Field(..., gt=0)
    currency: str = "USD"
    condition: CardCondition = CardCondition.NEAR_MINT
    listing_url: Optional[str] = None


class PriceResponse(BaseModel):
    """Price response schema."""

    id: int
    card_id: int
    source: PriceSource
    market_price: Decimal
    currency: str
    condition: CardCondition
    listing_url: Optional[str]
    timestamp: datetime

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
class CollectionItemCreate(BaseModel):
    """Collection item creation schema."""

    card_id: int
    quantity: int = Field(default=1, gt=0)
    condition: CardCondition = CardCondition.NEAR_MINT
    purchase_price: Optional[Decimal] = None
    notes: Optional[str] = None


class CollectionItemUpdate(BaseModel):
    """Collection item update schema."""

    quantity: Optional[int] = Field(None, gt=0)
    condition: Optional[CardCondition] = None
    purchase_price: Optional[Decimal] = None
    notes: Optional[str] = None


class CollectionItemResponse(BaseModel):
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
    tcg_type: Optional[TCGType] = None
    source: Optional[PriceSource] = None
    limit: int = Field(default=20, le=100)


class SearchResult(BaseModel):
    """Search result from external API."""

    external_id: str
    name: str
    set_name: str
    tcg_type: TCGType
    price: Optional[Decimal]
    image_url: Optional[str]
    source: PriceSource
    listing_url: Optional[str]


class BulkPriceUpdate(BaseModel):
    """Bulk price update request."""

    card_ids: List[int]
    source: Optional[PriceSource] = None
