"""Core validation classes for TCG Price Tracker."""

import re
from urllib.parse import urlparse


class SecurityValidator:
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

        reserved = ["admin", "root", "user", "api", "system", "test"]
        if username.lower() in reserved:
            raise ValueError("Username is reserved and cannot be used")

        return username

    @staticmethod
    def validate_url_security(url: str) -> str:
        """Validate URL for security concerns."""
        if not url:
            return url

        try:
            parsed = urlparse(url)

            if parsed.scheme not in ["http", "https"]:
                raise ValueError("URL must use http or https protocol")

            if not parsed.netloc:
                raise ValueError("URL must have a valid domain")

            return url

        except Exception:
            raise ValueError("Invalid URL format")
