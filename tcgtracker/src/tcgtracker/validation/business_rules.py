"""Business rule validation for TCG Price Tracker."""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from .exceptions import BusinessRuleError


class PriceValidationRules:
    """Business rules for price validation."""

    MIN_PRICE = Decimal("0.01")
    MAX_PRICE = Decimal("100000.00")
    MAX_PRICE_CHANGE_PERCENT = Decimal("500.00")  # 500% max change

    @classmethod
    def validate_price_range(cls, price: Decimal, field_name: str = "price") -> Decimal:
        """Validate price is within business acceptable range."""
        if price < cls.MIN_PRICE:
            raise BusinessRuleError(
                f"{field_name} must be at least ${cls.MIN_PRICE}",
                field=field_name,
                code="PRICE_TOO_LOW",
            )

        if price > cls.MAX_PRICE:
            raise BusinessRuleError(
                f"{field_name} cannot exceed ${cls.MAX_PRICE}",
                field=field_name,
                code="PRICE_TOO_HIGH",
            )

        return price

    @classmethod
    def validate_price_alert_threshold(
        cls, current_price: Decimal, target_price: Decimal, alert_type: str
    ) -> bool:
        """Validate price alert makes business sense."""
        if alert_type == "above" and target_price <= current_price:
            raise BusinessRuleError(
                "Alert threshold must be above current price for 'above' alerts",
                field="target_price",
                code="INVALID_ALERT_THRESHOLD",
            )

        if alert_type == "below" and target_price >= current_price:
            raise BusinessRuleError(
                "Alert threshold must be below current price for 'below' alerts",
                field="target_price",
                code="INVALID_ALERT_THRESHOLD",
            )

        # Check for reasonable alert thresholds (not more than 500% change)
        price_diff = abs(target_price - current_price)
        percent_change = (price_diff / current_price) * 100

        if percent_change > cls.MAX_PRICE_CHANGE_PERCENT:
            raise BusinessRuleError(
                f"Alert threshold represents more than {cls.MAX_PRICE_CHANGE_PERCENT}% change",
                field="target_price",
                code="UNREALISTIC_ALERT_THRESHOLD",
            )

        return True

    @classmethod
    def validate_price_update_frequency(
        cls, card_id: int, last_update: Optional[datetime]
    ) -> bool:
        """Validate that price updates aren't too frequent."""
        if last_update:
            min_interval = timedelta(minutes=1)  # Minimum 1 minute between updates
            time_since_update = datetime.utcnow() - last_update

            if time_since_update < min_interval:
                seconds_to_wait = (min_interval - time_since_update).total_seconds()
                raise BusinessRuleError(
                    f"Price was updated recently. Please wait {int(seconds_to_wait)} seconds",
                    field="price",
                    code="UPDATE_TOO_FREQUENT",
                )

        return True


class CollectionValidationRules:
    """Business rules for collection validation."""

    MIN_QUANTITY = 0
    MAX_QUANTITY = 10000
    MAX_COLLECTION_SIZE = 100000  # Max total cards in collection
    MAX_PURCHASE_PRICE = Decimal("50000.00")

    @classmethod
    def validate_quantity(cls, quantity: int, field_name: str = "quantity") -> int:
        """Validate collection quantity."""
        if quantity < cls.MIN_QUANTITY:
            raise BusinessRuleError(
                f"{field_name} cannot be negative",
                field=field_name,
                code="NEGATIVE_QUANTITY",
            )

        if quantity > cls.MAX_QUANTITY:
            raise BusinessRuleError(
                f"{field_name} cannot exceed {cls.MAX_QUANTITY}",
                field=field_name,
                code="QUANTITY_TOO_HIGH",
            )

        return quantity

    @classmethod
    def validate_collection_size(cls, current_total: int, adding_quantity: int) -> bool:
        """Validate total collection size doesn't exceed limits."""
        new_total = current_total + adding_quantity

        if new_total > cls.MAX_COLLECTION_SIZE:
            raise BusinessRuleError(
                f"Collection cannot exceed {cls.MAX_COLLECTION_SIZE} total cards",
                field="quantity",
                code="COLLECTION_SIZE_EXCEEDED",
            )

        return True

    @classmethod
    def validate_purchase_price(cls, price: Optional[Decimal]) -> Optional[Decimal]:
        """Validate purchase price is reasonable."""
        if price is None:
            return price

        if price < Decimal("0"):
            raise BusinessRuleError(
                "Purchase price cannot be negative",
                field="purchase_price",
                code="NEGATIVE_PURCHASE_PRICE",
            )

        if price > cls.MAX_PURCHASE_PRICE:
            raise BusinessRuleError(
                f"Purchase price cannot exceed ${cls.MAX_PURCHASE_PRICE}",
                field="purchase_price",
                code="PURCHASE_PRICE_TOO_HIGH",
            )

        return price


class DateValidationRules:
    """Business rules for date validation."""

    @classmethod
    def validate_historical_date(
        cls, date: datetime, field_name: str = "date"
    ) -> datetime:
        """Validate date is not in future and not too old."""
        if date > datetime.utcnow():
            raise BusinessRuleError(
                f"{field_name} cannot be in the future",
                field=field_name,
                code="FUTURE_DATE",
            )

        # TCG games didn't exist before 1993 (Magic: The Gathering)
        min_date = datetime(1993, 1, 1)
        if date < min_date:
            raise BusinessRuleError(
                f"{field_name} cannot be before {min_date.year}",
                field=field_name,
                code="DATE_TOO_OLD",
            )

        return date

    @classmethod
    def validate_date_range(cls, start_date: datetime, end_date: datetime) -> bool:
        """Validate date range is valid."""
        if start_date > end_date:
            raise BusinessRuleError(
                "Start date must be before end date",
                field="date_range",
                code="INVALID_DATE_RANGE",
            )

        # Maximum range of 5 years for performance
        max_range = timedelta(days=365 * 5)
        if end_date - start_date > max_range:
            raise BusinessRuleError(
                "Date range cannot exceed 5 years",
                field="date_range",
                code="DATE_RANGE_TOO_LARGE",
            )

        return True


class SearchValidationRules:
    """Business rules for search validation."""

    MIN_SEARCH_LENGTH = 2
    MAX_SEARCH_LENGTH = 200
    MAX_RESULTS = 1000

    @classmethod
    def validate_search_term(cls, term: str) -> str:
        """Validate search term meets requirements."""
        if len(term) < cls.MIN_SEARCH_LENGTH:
            raise BusinessRuleError(
                f"Search term must be at least {cls.MIN_SEARCH_LENGTH} characters",
                field="query",
                code="SEARCH_TOO_SHORT",
            )

        if len(term) > cls.MAX_SEARCH_LENGTH:
            raise BusinessRuleError(
                f"Search term cannot exceed {cls.MAX_SEARCH_LENGTH} characters",
                field="query",
                code="SEARCH_TOO_LONG",
            )

        return term

    @classmethod
    def validate_pagination(cls, limit: int, offset: int) -> bool:
        """Validate pagination parameters."""
        if limit < 1 or limit > cls.MAX_RESULTS:
            raise BusinessRuleError(
                f"Limit must be between 1 and {cls.MAX_RESULTS}",
                field="limit",
                code="INVALID_LIMIT",
            )

        if offset < 0:
            raise BusinessRuleError(
                "Offset cannot be negative", field="offset", code="NEGATIVE_OFFSET"
            )

        # Prevent deep pagination for performance
        max_offset = 10000
        if offset > max_offset:
            raise BusinessRuleError(
                f"Offset cannot exceed {max_offset}. Use filters to narrow results",
                field="offset",
                code="OFFSET_TOO_LARGE",
            )

        return True
