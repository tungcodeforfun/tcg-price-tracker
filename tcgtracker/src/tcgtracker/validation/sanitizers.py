"""Input sanitization functions for security and data integrity."""

import html
import re
from typing import Optional, Dict, Any, List
import json


def sanitize_user_text(text: str) -> str:
    """Sanitize user text input to prevent XSS."""
    if not text:
        return text

    # HTML escape
    sanitized = html.escape(text)

    # Remove potentially dangerous patterns
    sanitized = re.sub(r"javascript:", "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"vbscript:", "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"on\w+\s*=", "", sanitized, flags=re.IGNORECASE)

    # Remove null bytes
    sanitized = sanitized.replace("\x00", "")

    return sanitized.strip()


def sanitize_search_input(query: str) -> str:
    """Sanitize search input and escape SQL wildcards."""
    if not query:
        return query

    # First sanitize for XSS
    sanitized = sanitize_user_text(query)

    # Escape SQL wildcards to prevent injection
    sanitized = sanitize_sql_wildcards(sanitized)

    # Limit length and remove excessive whitespace
    sanitized = " ".join(sanitized.split())

    return sanitized[:200]  # Max search length


def sanitize_sql_wildcards(text: str) -> str:
    """Escape SQL wildcards to prevent ILIKE injection.

    This is CRITICAL for preventing SQL injection attacks in PostgreSQL ILIKE queries.
    """
    if not text:
        return text

    # Escape SQL wildcards - ORDER MATTERS!
    text = text.replace("\\", "\\\\")  # Escape backslashes first
    text = text.replace("%", "\\%")  # Escape percent signs
    text = text.replace("_", "\\_")  # Escape underscores

    return text


def sanitize_external_api_response(data: dict) -> dict:
    """Sanitize data received from external APIs."""
    if not isinstance(data, dict):
        return data

    sanitized = {}

    for key, value in data.items():
        if isinstance(value, str):
            # Sanitize string values
            sanitized[key] = sanitize_user_text(value)
        elif isinstance(value, dict):
            # Recursively sanitize nested dictionaries
            sanitized[key] = sanitize_external_api_response(value)
        elif isinstance(value, list):
            # Sanitize list items
            sanitized[key] = [
                sanitize_user_text(item)
                if isinstance(item, str)
                else sanitize_external_api_response(item)
                if isinstance(item, dict)
                else item
                for item in value
            ]
        else:
            sanitized[key] = value

    return sanitized


def validate_and_sanitize_json_field(data: dict, max_size: int = 10000) -> dict:
    """Validate and sanitize JSON field data."""
    # Check size
    json_str = json.dumps(data)
    if len(json_str) > max_size:
        raise ValueError(f"JSON data exceeds maximum size of {max_size} characters")

    # Sanitize string values in JSON
    return sanitize_external_api_response(data)


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal attacks."""
    if not filename:
        return filename

    # Remove any path components
    filename = filename.replace("/", "").replace("\\", "")

    # Remove special characters that could be problematic
    filename = re.sub(r"[^a-zA-Z0-9._-]", "", filename)

    # Prevent hidden files
    if filename.startswith("."):
        filename = filename[1:]

    # Limit length
    name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "")
    if len(name) > 100:
        name = name[:100]

    return f"{name}.{ext}" if ext else name


def sanitize_card_name(name: str) -> str:
    """Sanitize card name for safe storage and display."""
    if not name:
        return name

    # Allow more characters for card names (including special characters common in TCG)
    # But still sanitize for XSS
    sanitized = sanitize_user_text(name)

    # Allow apostrophes and hyphens which are common in card names
    # but ensure they're not used maliciously
    sanitized = re.sub(
        r"'+", "'", sanitized
    )  # Replace multiple apostrophes with single
    sanitized = re.sub(r"-+", "-", sanitized)  # Replace multiple hyphens with single

    return sanitized[:200]  # Max card name length
