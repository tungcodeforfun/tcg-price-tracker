"""Custom exception hierarchy for validation errors."""

from typing import Any, Dict, List, Optional


class ValidationError(Exception):
    """Base validation exception."""

    def __init__(
        self, message: str, field: Optional[str] = None, code: Optional[str] = None
    ):
        self.message = message
        self.field = field
        self.code = code
        super().__init__(self.message)


class SecurityValidationError(ValidationError):
    """Security-related validation errors."""


class BusinessRuleError(ValidationError):
    """Business rule validation errors."""


class RateLimitError(ValidationError):
    """Rate limiting exceeded errors."""

    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message, code="RATE_LIMIT_EXCEEDED")
        self.retry_after = retry_after


class ValidationErrorCollection:
    """Collection of validation errors with field mapping."""

    def __init__(self):
        self.errors: List[ValidationError] = []
        self.field_errors: Dict[str, List[str]] = {}

    def add_error(self, error: ValidationError):
        """Add a validation error."""
        self.errors.append(error)

        if error.field:
            if error.field not in self.field_errors:
                self.field_errors[error.field] = []
            self.field_errors[error.field].append(error.message)

    def has_errors(self) -> bool:
        """Check if there are any validation errors."""
        return len(self.errors) > 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert errors to dictionary format."""
        return {
            "errors": [
                {"message": error.message, "field": error.field, "code": error.code}
                for error in self.errors
            ],
            "field_errors": self.field_errors,
        }
