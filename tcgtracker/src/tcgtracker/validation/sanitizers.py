"""Input sanitization functions for security and data integrity."""

import html
import re


def sanitize_user_text(text: str) -> str:
    """Sanitize user text input to prevent XSS."""
    if not text:
        return text

    sanitized = html.escape(text)
    sanitized = re.sub(r"javascript:", "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"vbscript:", "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"on\w+\s*=", "", sanitized, flags=re.IGNORECASE)
    sanitized = sanitized.replace("\x00", "")

    return sanitized.strip()


def sanitize_search_input(query: str) -> str:
    """Sanitize search input and escape SQL wildcards."""
    if not query:
        return query

    sanitized = sanitize_user_text(query)
    sanitized = sanitize_sql_wildcards(sanitized)
    sanitized = " ".join(sanitized.split())

    return sanitized[:200]


def sanitize_sql_wildcards(text: str) -> str:
    """Escape SQL wildcards to prevent ILIKE injection."""
    if not text:
        return text

    text = text.replace("\\", "\\\\")
    text = text.replace("%", "\\%")
    text = text.replace("_", "\\_")

    return text


def sanitize_card_name(name: str) -> str:
    """Sanitize card name for safe storage and display."""
    if not name:
        return name

    sanitized = sanitize_user_text(name)
    sanitized = re.sub(r"'+", "'", sanitized)
    sanitized = re.sub(r"-+", "-", sanitized)

    return sanitized[:200]
