"""Custom exceptions for TCG Price Tracker."""

from typing import Optional


class TCGTrackerException(Exception):
    """Base exception for TCG Tracker."""

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.code = code


class ExternalAPIException(TCGTrackerException):
    """Base exception for external API errors."""


class RateLimitException(ExternalAPIException):
    """Raised when API rate limit is exceeded."""

    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message, code="RATE_LIMIT_EXCEEDED")
        self.retry_after = retry_after


class AuthenticationException(ExternalAPIException):
    """Raised when API authentication fails."""

    def __init__(self, message: str):
        super().__init__(message, code="AUTH_FAILED")


class NetworkException(ExternalAPIException):
    """Raised when network issues occur."""

    def __init__(self, message: str):
        super().__init__(message, code="NETWORK_ERROR")


class DataValidationException(TCGTrackerException):
    """Raised when data validation fails."""

    def __init__(self, message: str, field: Optional[str] = None):
        super().__init__(message, code="VALIDATION_ERROR")
        self.field = field


class PriceValidationException(DataValidationException):
    """Raised when price data is invalid."""

    def __init__(self, message: str, price: Optional[float] = None):
        super().__init__(message, field="price")
        self.price = price


class ResourceNotFoundException(TCGTrackerException):
    """Raised when a requested resource is not found."""

    def __init__(self, message: str, resource_type: Optional[str] = None):
        super().__init__(message, code="NOT_FOUND")
        self.resource_type = resource_type
