"""Core validation classes and functions for TCG Price Tracker."""

from typing import Any, Dict, List, Optional, Type, Union
from pydantic import BaseModel, validator
import re
import html
from urllib.parse import urlparse
from decimal import Decimal


class BaseValidator:
    """Base class for all validators."""

    @staticmethod
    def validate_not_empty(value: str, field_name: str) -> str:
        """Ensure string is not empty or whitespace."""
        if not value or not value.strip():
            raise ValueError(f"{field_name} cannot be empty")
        return value.strip()

    @staticmethod
    def validate_length(value: str, min_len: int, max_len: int, field_name: str) -> str:
        """Validate string length."""
        if len(value) < min_len or len(value) > max_len:
            raise ValueError(
                f"{field_name} must be between {min_len} and {max_len} characters"
            )
        return value


class SecurityValidator(BaseValidator):
    """Security-focused validation methods."""

    @staticmethod
    def validate_password_strength(password: str) -> str:
        """Validate password complexity requirements."""
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Za-z]", password):
            raise ValueError("Password must contain at least one letter")

        if not re.search(r"\d", password):
            raise ValueError("Password must contain at least one number")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValueError("Password must contain at least one special character")

        # Check for common weak passwords
        weak_patterns = [r"12345", r"password", r"qwerty", r"admin", r"user"]

        for pattern in weak_patterns:
            if re.search(pattern, password.lower()):
                raise ValueError("Password contains commonly used weak patterns")

        return password

    @staticmethod
    def validate_username_format(username: str) -> str:
        """Validate username format and security."""
        if not re.match(r"^[a-zA-Z0-9_-]{3,30}$", username):
            raise ValueError(
                "Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens"
            )

        # Prevent reserved usernames
        reserved = ["admin", "root", "user", "api", "system", "test"]
        if username.lower() in reserved:
            raise ValueError("Username is reserved and cannot be used")

        return username

    @staticmethod
    def validate_email_format(email: str) -> str:
        """Validate email format."""
        # Basic email regex pattern
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, email):
            raise ValueError("Invalid email format")

        # Additional checks
        if ".." in email:
            raise ValueError("Email cannot contain consecutive dots")

        if email.startswith(".") or email.startswith("@"):
            raise ValueError("Email cannot start with dot or @")

        return email.lower()

    @staticmethod
    def validate_url_security(url: str) -> str:
        """Validate URL for security concerns."""
        if not url:
            return url

        try:
            parsed = urlparse(url)

            # Check for valid schemes
            if parsed.scheme not in ["http", "https"]:
                raise ValueError("URL must use http or https protocol")

            # Prevent javascript: protocol and other dangerous schemes
            dangerous_schemes = ["javascript", "data", "file", "ftp"]
            if parsed.scheme.lower() in dangerous_schemes:
                raise ValueError("URL scheme is not allowed")

            # Basic domain validation
            if not parsed.netloc:
                raise ValueError("URL must have a valid domain")

            return url

        except Exception:
            raise ValueError("Invalid URL format")


class BusinessValidator(BaseValidator):
    """Business logic validation methods."""

    @staticmethod
    def validate_price_range(price: Decimal) -> Decimal:
        """Validate price is within reasonable business range."""
        if price < Decimal("0.01"):
            raise ValueError("Price must be at least $0.01")

        if price > Decimal("100000.00"):
            raise ValueError("Price cannot exceed $100,000.00")

        return price

    @staticmethod
    def validate_quantity(quantity: int, field_name: str = "quantity") -> int:
        """Validate collection quantity."""
        if quantity < 0:
            raise ValueError(f"{field_name} cannot be negative")

        if quantity > 10000:
            raise ValueError(f"{field_name} cannot exceed 10,000")

        return quantity

    @staticmethod
    def validate_card_number_format(card_number: str) -> str:
        """Validate TCG card number format."""
        if not card_number:
            return card_number

        # Basic format validation - adjust based on TCG requirements
        if not re.match(r"^[A-Za-z0-9/-]{1,20}$", card_number):
            raise ValueError("Card number contains invalid characters")

        return card_number

    @staticmethod
    def validate_set_code_format(set_code: str) -> str:
        """Validate TCG set code format."""
        if not set_code:
            return set_code

        if not re.match(r"^[A-Za-z0-9]{2,10}$", set_code):
            raise ValueError("Set code must be 2-10 alphanumeric characters")

        return set_code.upper()
