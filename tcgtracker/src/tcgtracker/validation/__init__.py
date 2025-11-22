"""TCG Price Tracker Validation Module.

This module provides comprehensive input validation, sanitization,
and security measures for the TCG Price Tracker application.
"""

from .exceptions import (
    BusinessRuleError,
    RateLimitError,
    SecurityValidationError,
    ValidationError,
    ValidationErrorCollection,
)
from .sanitizers import (
    sanitize_external_api_response,
    sanitize_search_input,
    sanitize_sql_wildcards,
    sanitize_user_text,
)
from .validators import BaseValidator, BusinessValidator, SecurityValidator

__all__ = [
    # Validators
    "BaseValidator",
    "SecurityValidator",
    "BusinessValidator",
    # Sanitizers
    "sanitize_user_text",
    "sanitize_search_input",
    "sanitize_sql_wildcards",
    "sanitize_external_api_response",
    # Exceptions
    "ValidationError",
    "SecurityValidationError",
    "BusinessRuleError",
    "RateLimitError",
    "ValidationErrorCollection",
]
