"""Search input validators for TCG Price Tracker."""

import re
from typing import Optional

from tcgtracker.utils.exceptions import DataValidationException


class SearchValidator:
    """Validator for search input parameters."""
    
    # Patterns for validation
    INVALID_CHARS_PATTERN = re.compile(r'[<>\"\'%;()&+]')  # SQL injection characters
    EXCESSIVE_SPACES_PATTERN = re.compile(r'\s{3,}')  # More than 2 consecutive spaces
    
    # Limits
    MIN_QUERY_LENGTH = 2
    MAX_QUERY_LENGTH = 200
    MAX_LIMIT = 100
    
    @classmethod
    def validate_search_query(cls, query: str) -> str:
        """
        Validate and sanitize search query.
        
        Args:
            query: The search query string
            
        Returns:
            Sanitized query string
            
        Raises:
            DataValidationException: If query is invalid
        """
        if not query:
            raise DataValidationException("Search query cannot be empty", field="query")
        
        # Check length
        query = query.strip()
        if len(query) < cls.MIN_QUERY_LENGTH:
            raise DataValidationException(
                f"Search query must be at least {cls.MIN_QUERY_LENGTH} characters",
                field="query"
            )
        
        if len(query) > cls.MAX_QUERY_LENGTH:
            raise DataValidationException(
                f"Search query cannot exceed {cls.MAX_QUERY_LENGTH} characters",
                field="query"
            )
        
        # Check for SQL injection patterns
        if cls.INVALID_CHARS_PATTERN.search(query):
            raise DataValidationException(
                "Search query contains invalid characters",
                field="query"
            )
        
        # Clean excessive spaces
        query = cls.EXCESSIVE_SPACES_PATTERN.sub(' ', query)
        
        return query
    
    @classmethod
    def validate_tcg_type(cls, tcg_type: Optional[str]) -> Optional[str]:
        """
        Validate TCG type parameter.
        
        Args:
            tcg_type: The TCG type (pokemon, onepiece, etc.)
            
        Returns:
            Validated TCG type or None
            
        Raises:
            DataValidationException: If TCG type is invalid
        """
        if not tcg_type:
            return None
        
        tcg_type = tcg_type.lower().strip()
        
        valid_types = ["pokemon", "onepiece", "magic", "yugioh"]
        if tcg_type not in valid_types:
            raise DataValidationException(
                f"Invalid TCG type. Must be one of: {', '.join(valid_types)}",
                field="tcg_type"
            )
        
        return tcg_type
    
    @classmethod
    def validate_limit(cls, limit: Optional[int]) -> int:
        """
        Validate result limit parameter.
        
        Args:
            limit: The maximum number of results
            
        Returns:
            Validated limit
            
        Raises:
            DataValidationException: If limit is invalid
        """
        if limit is None:
            return 20  # Default limit
        
        if not isinstance(limit, int):
            raise DataValidationException(
                "Limit must be an integer",
                field="limit"
            )
        
        if limit < 1:
            raise DataValidationException(
                "Limit must be at least 1",
                field="limit"
            )
        
        if limit > cls.MAX_LIMIT:
            raise DataValidationException(
                f"Limit cannot exceed {cls.MAX_LIMIT}",
                field="limit"
            )
        
        return limit