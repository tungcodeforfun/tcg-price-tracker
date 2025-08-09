"""TCG Price Tracker Validation Module.

This module provides comprehensive input validation, sanitization,
and security measures for the TCG Price Tracker application.
"""

from .validators import BaseValidator, SecurityValidator, BusinessValidator
from .sanitizers import (
    sanitize_user_text,
    sanitize_search_input,
    sanitize_sql_wildcards,
    sanitize_external_api_response,
)
from .exceptions import (
    ValidationError,
    SecurityValidationError,
    BusinessRuleError,
    RateLimitError,
    ValidationErrorCollection,
)

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
