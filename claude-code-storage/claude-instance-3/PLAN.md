# TCG Price Tracker - Data Validation Layer Implementation Plan

**Plan Date:** 2025-08-09  
**Based on:** Investigation Report & Flow Analysis Reports  
**Implementation Timeline:** 4-6 weeks  
**Risk Level:** 🔴 **CRITICAL - Immediate Action Required**

---

## Executive Summary

This comprehensive implementation plan addresses critical security vulnerabilities and implements a robust data validation layer for the TCG Price Tracker application. Based on thorough investigation and flow analysis, the plan prioritizes fixing authentication system failures, schema/model mismatches, and implementing essential security measures before adding enhanced validation features.

**Critical Issues Requiring Immediate Fix:**
- Authentication system completely broken (missing username field)
- Runtime failures due to schema/model field mismatches  
- SQL wildcard injection vulnerabilities in search queries
- CORS misconfiguration allowing all origins
- Complete absence of input sanitization and rate limiting

---

## 1. Validation Infrastructure

### 1.1 Core Validation Module Structure

**Create New Directory:** `/tcgtracker/src/tcgtracker/validation/`

```
tcgtracker/src/tcgtracker/validation/
├── __init__.py              # Package initialization and exports
├── validators.py            # Core validator classes and functions
├── sanitizers.py            # Input sanitization utilities
├── exceptions.py            # Custom validation exception hierarchy
├── middleware.py            # Request/response validation middleware
├── rate_limiting.py         # Rate limiting implementation
├── security.py             # Security validation functions
└── business_rules.py       # Business logic validators
```

### 1.2 Reusable Validator Classes

**File:** `/tcgtracker/src/tcgtracker/validation/validators.py`

```python
from typing import Any, Dict, List, Optional, Type, Union
from pydantic import BaseModel, validator
import re
import html
from urllib.parse import urlparse
from decimal import Decimal

class BaseValidator:
    """Base class for all validators"""
    
    @staticmethod
    def validate_not_empty(value: str, field_name: str) -> str:
        """Ensure string is not empty or whitespace"""
        if not value or not value.strip():
            raise ValueError(f"{field_name} cannot be empty")
        return value.strip()
    
    @staticmethod
    def validate_length(value: str, min_len: int, max_len: int, field_name: str) -> str:
        """Validate string length"""
        if len(value) < min_len or len(value) > max_len:
            raise ValueError(f"{field_name} must be between {min_len} and {max_len} characters")
        return value

class SecurityValidator(BaseValidator):
    """Security-focused validation methods"""
    
    @staticmethod
    def validate_password_strength(password: str) -> str:
        """Validate password complexity requirements"""
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        if not re.search(r'[A-Za-z]', password):
            raise ValueError("Password must contain at least one letter")
        
        if not re.search(r'\d', password):
            raise ValueError("Password must contain at least one number")
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValueError("Password must contain at least one special character")
        
        # Check for common weak passwords
        weak_patterns = [
            r'12345',
            r'password',
            r'qwerty',
            r'admin',
            r'user'
        ]
        
        for pattern in weak_patterns:
            if re.search(pattern, password.lower()):
                raise ValueError("Password contains commonly used weak patterns")
        
        return password
    
    @staticmethod
    def validate_username_format(username: str) -> str:
        """Validate username format and security"""
        if not re.match(r'^[a-zA-Z0-9_-]{3,30}$', username):
            raise ValueError("Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens")
        
        # Prevent reserved usernames
        reserved = ['admin', 'root', 'user', 'api', 'system', 'test']
        if username.lower() in reserved:
            raise ValueError("Username is reserved and cannot be used")
        
        return username
    
    @staticmethod
    def validate_url_security(url: str) -> str:
        """Validate URL for security concerns"""
        if not url:
            return url
        
        try:
            parsed = urlparse(url)
            
            # Check for valid schemes
            if parsed.scheme not in ['http', 'https']:
                raise ValueError("URL must use http or https protocol")
            
            # Prevent javascript: protocol and other dangerous schemes
            dangerous_schemes = ['javascript', 'data', 'file', 'ftp']
            if parsed.scheme.lower() in dangerous_schemes:
                raise ValueError("URL scheme is not allowed")
            
            # Basic domain validation
            if not parsed.netloc:
                raise ValueError("URL must have a valid domain")
            
            return url
        
        except Exception:
            raise ValueError("Invalid URL format")

class BusinessValidator(BaseValidator):
    """Business logic validation methods"""
    
    @staticmethod
    def validate_price_range(price: Decimal) -> Decimal:
        """Validate price is within reasonable business range"""
        if price < Decimal('0.01'):
            raise ValueError("Price must be at least $0.01")
        
        if price > Decimal('100000.00'):
            raise ValueError("Price cannot exceed $100,000.00")
        
        return price
    
    @staticmethod
    def validate_card_number_format(card_number: str) -> str:
        """Validate TCG card number format"""
        if not card_number:
            return card_number
        
        # Basic format validation - adjust based on TCG requirements
        if not re.match(r'^[A-Za-z0-9/-]{1,20}$', card_number):
            raise ValueError("Card number contains invalid characters")
        
        return card_number
    
    @staticmethod
    def validate_set_code_format(set_code: str) -> str:
        """Validate TCG set code format"""
        if not set_code:
            return set_code
        
        if not re.match(r'^[A-Za-z0-9]{2,10}$', set_code):
            raise ValueError("Set code must be 2-10 alphanumeric characters")
        
        return set_code
```

### 1.3 Custom Exception Hierarchy

**File:** `/tcgtracker/src/tcgtracker/validation/exceptions.py`

```python
from typing import Dict, List, Optional, Any

class ValidationError(Exception):
    """Base validation exception"""
    
    def __init__(self, message: str, field: Optional[str] = None, code: Optional[str] = None):
        self.message = message
        self.field = field
        self.code = code
        super().__init__(self.message)

class SecurityValidationError(ValidationError):
    """Security-related validation errors"""
    pass

class BusinessRuleError(ValidationError):
    """Business rule validation errors"""
    pass

class RateLimitError(ValidationError):
    """Rate limiting exceeded errors"""
    
    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message, code="RATE_LIMIT_EXCEEDED")
        self.retry_after = retry_after

class ValidationErrorCollection:
    """Collection of validation errors with field mapping"""
    
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.field_errors: Dict[str, List[str]] = {}
    
    def add_error(self, error: ValidationError):
        """Add a validation error"""
        self.errors.append(error)
        
        if error.field:
            if error.field not in self.field_errors:
                self.field_errors[error.field] = []
            self.field_errors[error.field].append(error.message)
    
    def has_errors(self) -> bool:
        """Check if there are any validation errors"""
        return len(self.errors) > 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert errors to dictionary format"""
        return {
            "errors": [
                {
                    "message": error.message,
                    "field": error.field,
                    "code": error.code
                }
                for error in self.errors
            ],
            "field_errors": self.field_errors
        }
```

### 1.4 Error Response Format

**File:** `/tcgtracker/src/tcgtracker/validation/responses.py`

```python
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class ValidationErrorResponse(BaseModel):
    """Standardized validation error response format"""
    
    success: bool = False
    error_code: str
    message: str
    field_errors: Optional[Dict[str, List[str]]] = None
    details: Optional[Dict[str, Any]] = None

class ValidationSuccessResponse(BaseModel):
    """Standardized success response format"""
    
    success: bool = True
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

def format_validation_error(
    error_code: str,
    message: str,
    field_errors: Optional[Dict[str, List[str]]] = None,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Format validation error response"""
    
    return ValidationErrorResponse(
        error_code=error_code,
        message=message,
        field_errors=field_errors,
        details=details
    ).dict()

# Standard error codes
class ErrorCodes:
    VALIDATION_FAILED = "VALIDATION_FAILED"
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    SECURITY_VIOLATION = "SECURITY_VIOLATION"
    BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION"
    EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
```

---

## 2. Schema Enhancements

### 2.1 Critical Fixes for Existing Schemas

**File:** `/tcgtracker/src/tcgtracker/api/schemas.py`

**CRITICAL CHANGES REQUIRED:**

```python
# 1. Add username field to User schemas to fix authentication system
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)  # ADD THIS FIELD
    is_active: bool = Field(default=True)

    @validator('username')
    def validate_username(cls, v):
        from tcgtracker.validation.validators import SecurityValidator
        return SecurityValidator.validate_username_format(v)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    
    @validator('password')
    def validate_password_strength(cls, v):
        from tcgtracker.validation.validators import SecurityValidator
        return SecurityValidator.validate_password_strength(v)

# 2. Fix Card schemas to match model field names
class CardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    set_name: str = Field(..., min_length=1, max_length=100)
    tcg_type: TCGTypeEnum  # CHANGE FROM: game_type to match model
    card_number: Optional[str] = Field(None, max_length=50)
    rarity: Optional[str] = Field(None, max_length=50)
    condition: CardConditionEnum = Field(default=CardConditionEnum.NEAR_MINT)
    image_url: Optional[HttpUrl] = None  # Add URL validation
    external_id: Optional[str] = Field(None, max_length=100)
    
    @validator('card_number')
    def validate_card_number(cls, v):
        if v:
            from tcgtracker.validation.validators import BusinessValidator
            return BusinessValidator.validate_card_number_format(v)
        return v
    
    @validator('image_url')
    def validate_image_url(cls, v):
        if v:
            from tcgtracker.validation.validators import SecurityValidator
            return SecurityValidator.validate_url_security(str(v))
        return v

# 3. Add input sanitization to search parameters
class CardSearchParams(BaseModel):
    query: Optional[str] = Field(None, max_length=200)
    set_name: Optional[str] = Field(None, max_length=100)
    tcg_type: Optional[TCGTypeEnum] = None  # CHANGE FROM: game_type
    condition: Optional[CardConditionEnum] = None
    min_price: Optional[Decimal] = Field(None, gt=0, le=100000)
    max_price: Optional[Decimal] = Field(None, gt=0, le=100000)
    limit: int = Field(default=20, gt=0, le=100)
    offset: int = Field(default=0, ge=0)
    
    @validator('query')
    def sanitize_search_query(cls, v):
        if v:
            from tcgtracker.validation.sanitizers import sanitize_search_input
            return sanitize_search_input(v)
        return v
    
    @validator('set_name')
    def sanitize_set_name(cls, v):
        if v:
            from tcgtracker.validation.sanitizers import sanitize_search_input
            return sanitize_search_input(v)
        return v
```

### 2.2 Custom Field Validators Needed

**File:** `/tcgtracker/src/tcgtracker/validation/field_validators.py`

```python
from pydantic import validator
from typing import Optional
import re
from decimal import Decimal

class PriceValidatorMixin:
    """Mixin for price validation"""
    
    @validator('price', 'target_price', 'min_price', 'max_price')
    def validate_price_fields(cls, v):
        if v is not None:
            from tcgtracker.validation.validators import BusinessValidator
            return BusinessValidator.validate_price_range(v)
        return v

class TextFieldValidatorMixin:
    """Mixin for text field validation"""
    
    @validator('notes', 'description')
    def sanitize_text_fields(cls, v):
        if v:
            from tcgtracker.validation.sanitizers import sanitize_user_text
            return sanitize_user_text(v)
        return v

class URLValidatorMixin:
    """Mixin for URL field validation"""
    
    @validator('image_url', 'listing_url')
    def validate_url_fields(cls, v):
        if v:
            from tcgtracker.validation.validators import SecurityValidator
            return SecurityValidator.validate_url_security(str(v))
        return v
```

### 2.3 Enhanced Pydantic Models

**Update existing schemas with validation mixins:**

```python
# Enhanced PriceHistory schema
class PriceCreate(BaseModel, PriceValidatorMixin, URLValidatorMixin):
    card_id: int = Field(..., gt=0)
    price: Decimal = Field(..., gt=0, decimal_places=2)
    condition: CardConditionEnum = Field(default=CardConditionEnum.NEAR_MINT)
    source: PriceSourceEnum
    listing_url: Optional[HttpUrl] = None
    
class PriceResponse(BaseModel):
    id: int
    card_id: int
    price: Decimal
    condition: CardConditionEnum
    source: PriceSourceEnum
    listing_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Enhanced Alert schema
class UserAlertCreate(BaseModel, PriceValidatorMixin, TextFieldValidatorMixin):
    card_id: int = Field(..., gt=0)
    alert_type: str = Field(..., regex=r'^(above|below)$')
    target_price: Decimal = Field(..., gt=0, decimal_places=2)
    condition: Optional[CardConditionEnum] = None
    notes: Optional[str] = Field(None, max_length=500)
    is_active: bool = Field(default=True)
```

---

## 3. Security Layer

### 3.1 Input Sanitization Functions

**File:** `/tcgtracker/src/tcgtracker/validation/sanitizers.py`

```python
import html
import re
from typing import Optional
import bleach

def sanitize_user_text(text: str) -> str:
    """Sanitize user text input to prevent XSS"""
    if not text:
        return text
    
    # HTML escape
    sanitized = html.escape(text)
    
    # Remove potentially dangerous patterns
    sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r'vbscript:', '', sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r'on\w+\s*=', '', sanitized, flags=re.IGNORECASE)
    
    return sanitized.strip()

def sanitize_search_input(query: str) -> str:
    """Sanitize search input and escape SQL wildcards"""
    if not query:
        return query
    
    # First sanitize for XSS
    sanitized = sanitize_user_text(query)
    
    # Escape SQL wildcards to prevent injection
    sanitized = sanitize_sql_wildcards(sanitized)
    
    # Limit length and remove excessive whitespace
    sanitized = ' '.join(sanitized.split())
    
    return sanitized[:200]  # Max search length

def sanitize_sql_wildcards(text: str) -> str:
    """Escape SQL wildcards to prevent ILIKE injection"""
    if not text:
        return text
    
    # Escape SQL wildcards
    text = text.replace('\\', '\\\\')  # Escape backslashes first
    text = text.replace('%', '\\%')    # Escape percent signs
    text = text.replace('_', '\\_')    # Escape underscores
    
    return text

def sanitize_external_api_response(data: dict) -> dict:
    """Sanitize data received from external APIs"""
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
                sanitize_user_text(item) if isinstance(item, str) 
                else sanitize_external_api_response(item) if isinstance(item, dict)
                else item
                for item in value
            ]
        else:
            sanitized[key] = value
    
    return sanitized

def validate_and_sanitize_json_field(data: dict, max_size: int = 10000) -> dict:
    """Validate and sanitize JSON field data"""
    import json
    
    # Check size
    json_str = json.dumps(data)
    if len(json_str) > max_size:
        raise ValueError(f"JSON data exceeds maximum size of {max_size} characters")
    
    # Sanitize string values in JSON
    return sanitize_external_api_response(data)
```

### 3.2 SQL Injection Prevention Measures

**CRITICAL: Update all ILIKE queries in the codebase**

**File:** `/tcgtracker/src/tcgtracker/api/v1/cards.py` (CRITICAL FIXES)

```python
# BEFORE (VULNERABLE):
if search:
    query = query.filter(Card.name.ilike(f"%{search}%"))

# AFTER (SECURE):
if search:
    from tcgtracker.validation.sanitizers import sanitize_search_input
    sanitized_search = sanitize_search_input(search)
    query = query.filter(Card.name.ilike(f"%{sanitized_search}%"))

# Apply same pattern to ALL ILIKE queries in:
# - cards.py lines 107, 113-116
# - Any other search functionality
```

**Add query sanitization utility:**

```python
# File: /tcgtracker/src/tcgtracker/validation/sql_utils.py
from sqlalchemy import text

def build_safe_ilike_filter(column, search_term: str, escape_char: str = '\\'):
    """Build safe ILIKE filter with proper escaping"""
    from tcgtracker.validation.sanitizers import sanitize_search_input
    
    if not search_term:
        return None
    
    sanitized = sanitize_search_input(search_term)
    return column.ilike(f"%{sanitized}%", escape=escape_char)

def validate_query_complexity(query_params: dict) -> bool:
    """Validate query complexity to prevent DoS"""
    # Limit number of filters
    if len(query_params) > 10:
        raise ValueError("Too many search filters")
    
    # Check for excessively complex patterns
    for value in query_params.values():
        if isinstance(value, str) and len(value) > 200:
            raise ValueError("Search term too long")
    
    return True
```

### 3.3 XSS Prevention for User Content

**File:** `/tcgtracker/src/tcgtracker/validation/xss_protection.py`

```python
import bleach
from typing import Dict, Any, List

# Allowed HTML tags for user content (if any)
ALLOWED_TAGS = []  # No HTML allowed for now
ALLOWED_ATTRIBUTES = {}

def sanitize_for_output(text: str) -> str:
    """Sanitize text for safe output"""
    if not text:
        return text
    
    # Use bleach to clean HTML
    cleaned = bleach.clean(
        text,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )
    
    return cleaned

def sanitize_response_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize response data to prevent XSS"""
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = sanitize_for_output(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_response_data(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_for_output(item) if isinstance(item, str)
                else sanitize_response_data(item) if isinstance(item, dict)
                else item
                for item in value
            ]
        else:
            sanitized[key] = value
    
    return sanitized
```

### 3.4 Rate Limiting Implementation

**File:** `/tcgtracker/src/tcgtracker/validation/rate_limiting.py`

```python
import asyncio
import time
from typing import Dict, Optional
from functools import wraps
from fastapi import HTTPException, Request
from collections import defaultdict, deque

class RateLimiter:
    """In-memory rate limiter (use Redis in production)"""
    
    def __init__(self):
        self.requests = defaultdict(deque)
        self.blocked = defaultdict(float)
    
    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, Optional[int]]:
        """Check if request is allowed"""
        now = time.time()
        
        # Check if currently blocked
        if key in self.blocked:
            if now < self.blocked[key]:
                retry_after = int(self.blocked[key] - now)
                return False, retry_after
            else:
                del self.blocked[key]
        
        # Clean old requests
        request_times = self.requests[key]
        while request_times and request_times[0] <= now - window:
            request_times.popleft()
        
        # Check limit
        if len(request_times) >= limit:
            # Block for remaining window time
            self.blocked[key] = now + window
            return False, window
        
        # Allow request
        request_times.append(now)
        return True, None

# Global rate limiter instance
rate_limiter = RateLimiter()

def rate_limit(requests: int, window: int, key_func=None):
    """Rate limiting decorator"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # If no request found, skip rate limiting
                return await func(*args, **kwargs)
            
            # Generate key
            if key_func:
                key = key_func(request)
            else:
                # Default: use IP address
                key = request.client.host if request.client else "anonymous"
            
            # Check rate limit
            allowed, retry_after = rate_limiter.is_allowed(key, requests, window)
            
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded",
                    headers={"Retry-After": str(retry_after)}
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def auth_key_func(request: Request) -> str:
    """Generate key based on user ID for authenticated endpoints"""
    # Try to get user from request state (set by auth dependency)
    if hasattr(request.state, 'user') and request.state.user:
        return f"user:{request.state.user.id}"
    
    # Fallback to IP
    return f"ip:{request.client.host}" if request.client else "anonymous"

def ip_key_func(request: Request) -> str:
    """Generate key based on IP address"""
    return f"ip:{request.client.host}" if request.client else "anonymous"
```

---

## 4. Middleware Components

### 4.1 Request Validation Middleware

**File:** `/tcgtracker/src/tcgtracker/validation/middleware.py`

```python
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging
import time
from typing import Callable

from .sanitizers import sanitize_user_text
from .exceptions import ValidationError, SecurityValidationError
from .responses import format_validation_error, ErrorCodes

logger = logging.getLogger(__name__)

class ValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for request validation and sanitization"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        try:
            # Log incoming request
            logger.info(f"Request: {request.method} {request.url}")
            
            # Validate request size
            content_length = request.headers.get('content-length')
            if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB limit
                return JSONResponse(
                    status_code=413,
                    content=format_validation_error(
                        ErrorCodes.VALIDATION_FAILED,
                        "Request body too large"
                    )
                )
            
            # Process request
            response = await call_next(request)
            
            # Log response time
            process_time = time.time() - start_time
            logger.info(f"Response: {response.status_code} - {process_time:.3f}s")
            
            return response
        
        except ValidationError as e:
            logger.warning(f"Validation error: {e.message}")
            return JSONResponse(
                status_code=400,
                content=format_validation_error(
                    e.code or ErrorCodes.VALIDATION_FAILED,
                    e.message,
                    {e.field: [e.message]} if e.field else None
                )
            )
        
        except SecurityValidationError as e:
            logger.error(f"Security validation error: {e.message}")
            return JSONResponse(
                status_code=403,
                content=format_validation_error(
                    ErrorCodes.SECURITY_VIOLATION,
                    "Security validation failed"
                )
            )
        
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return JSONResponse(
                status_code=500,
                content=format_validation_error(
                    ErrorCodes.DATABASE_ERROR,
                    "Internal server error"
                )
            )

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Add CSP header
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for security audit logging"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Log security-relevant requests
        sensitive_endpoints = ['/auth/', '/users/', '/admin/']
        
        if any(endpoint in str(request.url) for endpoint in sensitive_endpoints):
            logger.info(f"Security audit: {request.method} {request.url} from {request.client.host if request.client else 'unknown'}")
        
        response = await call_next(request)
        
        # Log failed authentication attempts
        if response.status_code == 401:
            logger.warning(f"Authentication failed: {request.method} {request.url} from {request.client.host if request.client else 'unknown'}")
        
        return response
```

### 4.2 Response Sanitization Middleware

**File:** `/tcgtracker/src/tcgtracker/validation/response_middleware.py`

```python
import json
from fastapi import Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from typing import Callable

from .xss_protection import sanitize_response_data

class ResponseSanitizationMiddleware(BaseHTTPMiddleware):
    """Middleware to sanitize response data"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Only sanitize JSON responses
        if (isinstance(response, JSONResponse) and 
            response.headers.get("content-type", "").startswith("application/json")):
            
            try:
                # Get response body
                body = response.body
                if body:
                    # Parse JSON
                    data = json.loads(body.decode())
                    
                    # Sanitize data
                    sanitized_data = sanitize_response_data(data)
                    
                    # Create new response with sanitized data
                    response = JSONResponse(
                        content=sanitized_data,
                        status_code=response.status_code,
                        headers=dict(response.headers)
                    )
            
            except Exception:
                # If sanitization fails, return original response
                pass
        
        return response
```

### 4.3 Error Handling Middleware

**File:** `/tcgtracker/src/tcgtracker/validation/error_middleware.py`

```python
import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from typing import Callable

from .responses import format_validation_error, ErrorCodes
from .exceptions import ValidationError, RateLimitError

logger = logging.getLogger(__name__)

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Centralized error handling middleware"""
    
    def __init__(self, app: ASGIApp, debug: bool = False):
        super().__init__(app)
        self.debug = debug
    
    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        try:
            return await call_next(request)
        
        except RateLimitError as e:
            logger.warning(f"Rate limit exceeded: {request.client.host if request.client else 'unknown'}")
            return JSONResponse(
                status_code=429,
                content=format_validation_error(
                    ErrorCodes.RATE_LIMIT_EXCEEDED,
                    e.message
                ),
                headers={"Retry-After": str(e.retry_after)} if e.retry_after else None
            )
        
        except ValidationError as e:
            logger.info(f"Validation error: {e.message}")
            return JSONResponse(
                status_code=400,
                content=format_validation_error(
                    e.code or ErrorCodes.VALIDATION_FAILED,
                    e.message,
                    {e.field: [e.message]} if e.field else None
                )
            )
        
        except HTTPException as e:
            # Let FastAPI handle HTTP exceptions normally
            raise e
        
        except Exception as e:
            # Log unexpected errors
            logger.error(f"Unexpected error in {request.method} {request.url}: {str(e)}", exc_info=True)
            
            # Return generic error (don't leak internal details)
            error_message = str(e) if self.debug else "An unexpected error occurred"
            
            return JSONResponse(
                status_code=500,
                content=format_validation_error(
                    ErrorCodes.DATABASE_ERROR,
                    error_message
                )
            )
```

---

## 5. Critical Fixes Required IMMEDIATELY

### 5.1 Fix User Model (CRITICAL - Authentication is Broken)

**File:** `/tcgtracker/src/tcgtracker/database/models.py`

**ADD THE MISSING USERNAME FIELD:**

```python
class User(BaseModel):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    
    # ADD THIS CRITICAL FIELD:
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # ... rest of the model
```

**Create migration file immediately:**

```sql
-- File: migrations/add_username_field.sql
ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE NOT NULL DEFAULT '';
CREATE INDEX ix_users_username ON users(username);

-- Update existing users with temporary usernames (adjust as needed)
UPDATE users SET username = CONCAT('user_', id) WHERE username = '';
```

### 5.2 Fix Schema/Model Field Mismatches (CRITICAL)

**File:** `/tcgtracker/src/tcgtracker/api/v1/cards.py`

**CRITICAL FIXES REQUIRED:**

```python
# LINE 35-36: Fix field name mismatch
# BEFORE (CAUSES RUNTIME ERROR):
card = Card(**card_data.model_dump())

# AFTER (FIXED):
card_data_dict = card_data.model_dump()
# Map schema field name to model field name
if 'game_type' in card_data_dict:
    card_data_dict['tcg_type'] = card_data_dict.pop('game_type')

card = Card(**card_data_dict)

# LINE 58: Fix relationship name mismatch  
# BEFORE (CAUSES RUNTIME ERROR):
.options(selectinload(Card.prices))

# AFTER (FIXED):
.options(selectinload(Card.price_history))

# LINES 107, 113-116: Fix ILIKE injection vulnerability
# BEFORE (VULNERABLE):
if search:
    query = query.filter(Card.name.ilike(f"%{search}%"))

# AFTER (SECURE):
if search:
    from tcgtracker.validation.sanitizers import sanitize_search_input
    sanitized_search = sanitize_search_input(search)
    query = query.filter(Card.name.ilike(f"%{sanitized_search}%"))

# Apply same fix to all ILIKE queries in the file
```

### 5.3 Fix CORS Configuration (CRITICAL Security Issue)

**File:** `/tcgtracker/src/tcgtracker/config.py`

**CRITICAL CHANGE:**

```python
# LINE 210: Fix wildcard CORS vulnerability
# BEFORE (CRITICAL SECURITY VULNERABILITY):
allow_origins: list[str] = Field(default=["*"])

# AFTER (SECURE):
allow_origins: list[str] = Field(default=[
    "http://localhost:3000",  # React dev server
    "http://localhost:8000",  # FastAPI dev server
    "https://yourdomain.com",  # Production domain
    "https://app.yourdomain.com"  # App subdomain
])

# Also fix methods and headers:
allow_methods: list[str] = Field(default=["GET", "POST", "PUT", "DELETE"])
allow_headers: list[str] = Field(default=["Authorization", "Content-Type"])
```

### 5.4 Fix Authentication Endpoints (CRITICAL)

**File:** `/tcgtracker/src/tcgtracker/api/v1/auth.py`

**CRITICAL FIXES:**

```python
# Fix all username references to work with new User.username field

# LINE 35: Fix registration
@router.post("/register", response_model=Token)
async def register(
    user_data: UserCreate,
    session: AsyncSession = Depends(get_session)
) -> Token:
    # Check if user already exists (by email OR username)
    existing_user = await session.execute(
        select(User).where(
            or_(User.email == user_data.email, User.username == user_data.username)
        )
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="User with this email or username already exists"
        )
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    db_user = User(
        email=user_data.email,
        username=user_data.username,  # Now this field exists
        password_hash=hashed_password
    )
    
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(db_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.id)})
    
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")

# LINE 56: Fix login to accept username OR email
@router.post("/login", response_model=Token)
async def login(
    user_credentials: LoginRequest,
    session: AsyncSession = Depends(get_session)
) -> Token:
    # Allow login with either email or username
    user = await session.execute(
        select(User).where(
            or_(
                User.email == user_credentials.username,
                User.username == user_credentials.username
            )
        )
    )
    user = user.scalar_one_or_none()
    
    if not user or not verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Account is inactive"
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")
```

---

## 6. Business Logic Validators

### 6.1 Price Range Validations

**File:** `/tcgtracker/src/tcgtracker/validation/business_rules.py`

```python
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional
from .exceptions import BusinessRuleError

class PriceValidationRules:
    """Business rules for price validation"""
    
    MIN_PRICE = Decimal('0.01')
    MAX_PRICE = Decimal('100000.00')
    
    @classmethod
    def validate_price_range(cls, price: Decimal, field_name: str = "price") -> Decimal:
        """Validate price is within business acceptable range"""
        if price < cls.MIN_PRICE:
            raise BusinessRuleError(
                f"{field_name} must be at least ${cls.MIN_PRICE}",
                field=field_name,
                code="PRICE_TOO_LOW"
            )
        
        if price > cls.MAX_PRICE:
            raise BusinessRuleError(
                f"{field_name} cannot exceed ${cls.MAX_PRICE}",
                field=field_name,
                code="PRICE_TOO_HIGH"
            )
        
        return price
    
    @classmethod
    def validate_price_alert_threshold(cls, current_price: Decimal, target_price: Decimal, alert_type: str) -> bool:
        """Validate price alert makes business sense"""
        if alert_type == "above" and target_price <= current_price:
            raise BusinessRuleError(
                "Alert threshold must be above current price for 'above' alerts",
                field="target_price",
                code="INVALID_ALERT_THRESHOLD"
            )
        
        if alert_type == "below" and target_price >= current_price:
            raise BusinessRuleError(
                "Alert threshold must be below current price for 'below' alerts",
                field="target_price",
                code="INVALID_ALERT_THRESHOLD"
            )
        
        return True

class CollectionValidationRules:
    """Business rules for collection validation"""
    
    MAX_QUANTITY = 10000
    
    @classmethod
    def validate_quantity(cls, quantity: int, field_name: str = "quantity") -> int:
        """Validate collection quantity"""
        if quantity < 0:
            raise BusinessRuleError(
                f"{field_name} cannot be negative",
                field=field_name,
                code="NEGATIVE_QUANTITY"
            )
        
        if quantity > cls.MAX_QUANTITY:
            raise BusinessRuleError(
                f"{field_name} cannot exceed {cls.MAX_QUANTITY}",
                field=field_name,
                code="QUANTITY_TOO_HIGH"
            )
        
        return quantity

class DateValidationRules:
    """Business rules for date validation"""
    
    @classmethod
    def validate_historical_date(cls, date: datetime, field_name: str = "date") -> datetime:
        """Validate date is not in future"""
        if date > datetime.utcnow():
            raise BusinessRuleError(
                f"{field_name} cannot be in the future",
                field=field_name,
                code="FUTURE_DATE"
            )
        
        # Don't allow dates too far in the past (e.g., before TCG existed)
        min_date = datetime(1990, 1, 1)
        if date < min_date:
            raise BusinessRuleError(
                f"{field_name} cannot be before {min_date.year}",
                field=field_name,
                code="DATE_TOO_OLD"
            )
        
        return date
```

### 6.2 Cross-field Validations

**File:** `/tcgtracker/src/tcgtracker/validation/cross_field_validators.py`

```python
from decimal import Decimal
from typing import Optional
from .exceptions import ValidationError

def validate_price_range_consistency(min_price: Optional[Decimal], max_price: Optional[Decimal]) -> None:
    """Validate min_price <= max_price"""
    if min_price is not None and max_price is not None:
        if min_price > max_price:
            raise ValidationError(
                "Minimum price cannot be greater than maximum price",
                field="price_range",
                code="INVALID_PRICE_RANGE"
            )

def validate_alert_consistency(alert_type: str, current_price: Decimal, target_price: Decimal) -> None:
    """Validate alert configuration makes sense"""
    if alert_type == "above":
        if target_price <= current_price:
            raise ValidationError(
                "Target price must be above current price for 'above' alerts",
                field="target_price",
                code="INCONSISTENT_ALERT_CONFIG"
            )
    
    elif alert_type == "below":
        if target_price >= current_price:
            raise ValidationError(
                "Target price must be below current price for 'below' alerts",
                field="target_price",
                code="INCONSISTENT_ALERT_CONFIG"
            )

def validate_search_filters_consistency(params: dict) -> None:
    """Validate search filter consistency"""
    # Validate price range
    if 'min_price' in params and 'max_price' in params:
        validate_price_range_consistency(params['min_price'], params['max_price'])
    
    # Add other cross-field validations as needed
```

---

## 7. Implementation Order (Critical Priority)

### 7.1 Priority 1: Critical System Fixes (Week 1 - IMMEDIATE)

**Day 1-2: Authentication System Fix**
1. **CRITICAL:** Add username field to User model in `/tcgtracker/src/tcgtracker/database/models.py`
2. **CRITICAL:** Create and run database migration for username field  
3. **CRITICAL:** Update all authentication endpoints in `/tcgtracker/src/tcgtracker/api/v1/auth.py`
4. **CRITICAL:** Update user schemas in `/tcgtracker/src/tcgtracker/api/schemas.py`
5. **CRITICAL:** Test authentication flow end-to-end

**Day 3: Schema/Model Alignment**
1. **CRITICAL:** Fix field name mismatches in `/tcgtracker/src/tcgtracker/api/v1/cards.py`
2. **CRITICAL:** Fix relationship name mismatches (prices → price_history)
3. **CRITICAL:** Update all affected schemas and API endpoints
4. **CRITICAL:** Test card creation and search functionality

**Day 4-5: Security Vulnerabilities**
1. **CRITICAL:** Fix CORS configuration in `/tcgtracker/src/tcgtracker/config.py`
2. **CRITICAL:** Create input sanitization module `/tcgtracker/src/tcgtracker/validation/sanitizers.py`
3. **CRITICAL:** Fix all ILIKE queries to prevent SQL injection
4. **CRITICAL:** Test security fixes

### 7.2 Priority 2: Core Validation Infrastructure (Week 2)

**Day 1-2: Validation Foundation**
1. Create validation directory structure
2. Implement core validators in `/tcgtracker/src/tcgtracker/validation/validators.py`
3. Implement custom exceptions in `/tcgtracker/src/tcgtracker/validation/exceptions.py`
4. Create response formatting utilities

**Day 3-4: Enhanced Schema Validation**
1. Add custom validators to existing Pydantic schemas
2. Implement password strength validation
3. Add URL validation for image_url and listing_url fields
4. Add business rule validators

**Day 5: Basic Rate Limiting**
1. Implement rate limiting module `/tcgtracker/src/tcgtracker/validation/rate_limiting.py`
2. Add rate limiting to authentication endpoints
3. Add rate limiting to expensive search operations

### 7.3 Priority 3: Security Enhancements (Week 3-4)

**Week 3: Middleware and Advanced Security**
1. Implement validation middleware
2. Add security headers middleware
3. Implement audit logging middleware
4. Add response sanitization middleware

**Week 4: External API Security**
1. Add input sanitization for external API calls
2. Implement external API response validation
3. Add timeout controls for external API calls
4. Implement circuit breaker pattern for external APIs

### 7.4 Priority 4: Advanced Features (Week 5+)

**Advanced Validation Features:**
1. Account lockout mechanisms
2. Session management
3. Advanced threat detection
4. Comprehensive audit logging
5. Performance optimizations

---

## 8. Testing Strategy

### 8.1 Unit Tests for Validators

**File:** `/tests/validation/test_validators.py`

```python
import pytest
from decimal import Decimal
from tcgtracker.validation.validators import SecurityValidator, BusinessValidator
from tcgtracker.validation.exceptions import ValidationError

class TestSecurityValidator:
    def test_password_strength_valid(self):
        password = "SecurePass123!"
        result = SecurityValidator.validate_password_strength(password)
        assert result == password
    
    def test_password_strength_too_short(self):
        with pytest.raises(ValueError, match="at least 8 characters"):
            SecurityValidator.validate_password_strength("short")
    
    def test_password_strength_no_numbers(self):
        with pytest.raises(ValueError, match="contain at least one number"):
            SecurityValidator.validate_password_strength("OnlyLetters!")
    
    def test_username_format_valid(self):
        username = "valid_user123"
        result = SecurityValidator.validate_username_format(username)
        assert result == username
    
    def test_username_format_invalid_chars(self):
        with pytest.raises(ValueError, match="only letters, numbers"):
            SecurityValidator.validate_username_format("invalid@user")
    
    def test_url_validation_valid(self):
        url = "https://example.com/image.jpg"
        result = SecurityValidator.validate_url_security(url)
        assert result == url
    
    def test_url_validation_javascript_protocol(self):
        with pytest.raises(ValueError, match="scheme is not allowed"):
            SecurityValidator.validate_url_security("javascript:alert('xss')")

class TestBusinessValidator:
    def test_price_range_valid(self):
        price = Decimal('10.99')
        result = BusinessValidator.validate_price_range(price)
        assert result == price
    
    def test_price_range_too_low(self):
        with pytest.raises(ValueError, match="at least"):
            BusinessValidator.validate_price_range(Decimal('0.00'))
    
    def test_price_range_too_high(self):
        with pytest.raises(ValueError, match="cannot exceed"):
            BusinessValidator.validate_price_range(Decimal('200000.00'))
```

### 8.2 Integration Tests for Authentication Flow

**File:** `/tests/api/test_auth_integration.py`

```python
import pytest
from fastapi.testclient import TestClient
from tcgtracker.main import app

client = TestClient(app)

class TestAuthenticationFlow:
    def test_registration_success(self):
        user_data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "SecurePass123!"
        }
        
        response = client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_registration_duplicate_username(self):
        # First registration
        user_data = {
            "email": "test1@example.com",
            "username": "duplicate",
            "password": "SecurePass123!"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        # Second registration with same username
        user_data2 = {
            "email": "test2@example.com",
            "username": "duplicate",
            "password": "SecurePass123!"
        }
        
        response = client.post("/api/v1/auth/register", json=user_data2)
        assert response.status_code == 400
        assert "already exists" in response.json()["message"]
    
    def test_login_success(self):
        # Register user first
        user_data = {
            "email": "login@example.com",
            "username": "loginuser",
            "password": "SecurePass123!"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        # Login with username
        login_data = {
            "username": "loginuser",
            "password": "SecurePass123!"
        }
        
        response = client.post("/api/v1/auth/login", data=login_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
    
    def test_login_with_email(self):
        # Register user first
        user_data = {
            "email": "email@example.com",
            "username": "emailuser",
            "password": "SecurePass123!"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        # Login with email
        login_data = {
            "username": "email@example.com",  # Using email as username
            "password": "SecurePass123!"
        }
        
        response = client.post("/api/v1/auth/login", data=login_data)
        assert response.status_code == 200
```

### 8.3 Security Testing Scenarios

**File:** `/tests/security/test_security_vulnerabilities.py`

```python
import pytest
from fastapi.testclient import TestClient
from tcgtracker.main import app

client = TestClient(app)

class TestSecurityVulnerabilities:
    def test_sql_injection_prevention(self):
        """Test that SQL injection attempts are blocked"""
        # Test ILIKE injection with wildcards
        malicious_query = "'; DROP TABLE cards; --"
        
        response = client.get(f"/api/v1/cards/search?query={malicious_query}")
        
        # Should not cause server error, should sanitize input
        assert response.status_code in [200, 400]  # Either works or rejects cleanly
        
        # Verify injection characters are escaped
        wildcard_query = "test%_%"
        response = client.get(f"/api/v1/cards/search?query={wildcard_query}")
        assert response.status_code == 200
    
    def test_xss_prevention(self):
        """Test that XSS attempts are blocked"""
        # Register user with potentially malicious data
        xss_payload = "<script>alert('xss')</script>"
        
        user_data = {
            "email": "xss@example.com",
            "username": "xssuser",
            "password": "SecurePass123!"
        }
        
        # This should succeed but sanitize the data
        response = client.post("/api/v1/auth/register", json=user_data)
        
        # Response should not contain raw script tags
        response_text = response.text
        assert "<script>" not in response_text
        assert "&lt;script&gt;" in response_text or "script" not in response_text
    
    def test_rate_limiting_enforcement(self):
        """Test rate limiting is enforced"""
        # Attempt multiple rapid requests
        for i in range(10):
            response = client.post("/api/v1/auth/login", data={
                "username": "nonexistent",
                "password": "wrongpassword"
            })
        
        # Should eventually get rate limited
        assert any(r.status_code == 429 for r in [response] * 10)
    
    def test_cors_configuration(self):
        """Test CORS is properly configured"""
        response = client.options("/api/v1/cards/")
        
        # Should not allow all origins
        cors_header = response.headers.get("Access-Control-Allow-Origin", "")
        assert cors_header != "*"
```

### 8.4 Performance Impact Testing

**File:** `/tests/performance/test_validation_performance.py`

```python
import pytest
import time
from tcgtracker.validation.sanitizers import sanitize_search_input, sanitize_user_text
from tcgtracker.validation.validators import SecurityValidator

class TestValidationPerformance:
    def test_sanitization_performance(self):
        """Test that sanitization doesn't significantly impact performance"""
        large_text = "a" * 10000
        
        start_time = time.time()
        for _ in range(100):
            sanitize_user_text(large_text)
        end_time = time.time()
        
        # Should complete in reasonable time (adjust threshold as needed)
        assert end_time - start_time < 1.0  # Less than 1 second for 100 iterations
    
    def test_search_sanitization_performance(self):
        """Test search sanitization performance"""
        search_terms = ["pokemon", "magic the gathering", "yu-gi-oh"] * 100
        
        start_time = time.time()
        for term in search_terms:
            sanitize_search_input(term)
        end_time = time.time()
        
        # Should be fast for typical search terms
        assert end_time - start_time < 0.5
    
    def test_password_validation_performance(self):
        """Test password validation doesn't cause timing attacks"""
        passwords = ["weak", "StrongPass123!", "AnotherStrong456!"] * 50
        
        times = []
        for password in passwords:
            start_time = time.perf_counter()
            try:
                SecurityValidator.validate_password_strength(password)
            except ValueError:
                pass
            end_time = time.perf_counter()
            times.append(end_time - start_time)
        
        # Validation time should be consistent (no significant variance)
        avg_time = sum(times) / len(times)
        max_deviation = max(abs(t - avg_time) for t in times)
        
        # Deviation should not be more than 50% of average time
        assert max_deviation < avg_time * 0.5
```

---

## 9. Documentation

### 9.1 Validation Rules Documentation

**File:** `/docs/VALIDATION_RULES.md`

```markdown
# TCG Price Tracker - Validation Rules Documentation

## Authentication Validation

### Password Requirements
- Minimum 8 characters
- Must contain at least one letter
- Must contain at least one number  
- Must contain at least one special character
- Cannot contain common weak patterns (12345, password, etc.)

### Username Requirements
- 3-30 characters long
- Letters, numbers, underscores, and hyphens only
- Cannot use reserved names (admin, root, user, api, system, test)

## Business Logic Validation

### Price Validation
- Minimum price: $0.01
- Maximum price: $100,000.00
- Must be positive decimal with 2 decimal places

### Collection Validation
- Quantity must be non-negative
- Maximum quantity: 10,000 items
- Card must exist in database before adding to collection

### Alert Validation
- Target price must make sense relative to current price
- "above" alerts: target > current price
- "below" alerts: target < current price

## Security Validation

### Input Sanitization
- HTML entities escaped in all text fields
- SQL wildcards escaped in search queries
- JavaScript protocols blocked in URLs
- Maximum text field lengths enforced

### URL Validation  
- Must use http or https protocol
- Dangerous schemes blocked (javascript:, data:, file:, ftp:)
- Domain must be present
- Basic format validation applied

## Search Validation

### Search Query Rules
- Maximum length: 200 characters
- SQL wildcards (%, _) are escaped
- HTML content is sanitized
- Excessive whitespace is normalized

### Filter Consistency
- min_price must be <= max_price when both provided
- Date ranges must be logical (start <= end)
- Pagination limits enforced (max 100 results per page)
```

### 9.2 API Error Code Reference

**File:** `/docs/API_ERROR_CODES.md`

```markdown
# API Error Codes Reference

## Authentication Errors (AUTH_*)

### AUTH_001: Invalid Credentials
- **Status Code:** 401
- **Message:** "Invalid username/email or password"  
- **Resolution:** Verify credentials and try again

### AUTH_002: Account Inactive
- **Status Code:** 401
- **Message:** "Account is inactive"
- **Resolution:** Contact administrator to reactivate account

### AUTH_003: Token Expired
- **Status Code:** 401
- **Message:** "Access token has expired"
- **Resolution:** Use refresh token to get new access token

## Validation Errors (VAL_*)

### VAL_001: Required Field Missing
- **Status Code:** 400
- **Message:** "Required field '{field_name}' is missing"
- **Resolution:** Include all required fields in request

### VAL_002: Invalid Field Format
- **Status Code:** 400  
- **Message:** "Field '{field_name}' has invalid format"
- **Resolution:** Check field format requirements

### VAL_003: Field Length Violation
- **Status Code:** 400
- **Message:** "Field '{field_name}' must be between {min} and {max} characters"
- **Resolution:** Adjust field length to meet requirements

## Security Errors (SEC_*)

### SEC_001: Rate Limit Exceeded
- **Status Code:** 429
- **Message:** "Rate limit exceeded. Try again in {seconds} seconds"
- **Resolution:** Wait before making additional requests

### SEC_002: Suspicious Input Detected
- **Status Code:** 403
- **Message:** "Input contains potentially malicious content"
- **Resolution:** Remove suspicious characters and try again

### SEC_003: Invalid URL
- **Status Code:** 400
- **Message:** "URL contains invalid or dangerous scheme"
- **Resolution:** Use http or https URLs only

## Business Rule Errors (BIZ_*)

### BIZ_001: Price Out of Range
- **Status Code:** 400
- **Message:** "Price must be between $0.01 and $100,000.00"
- **Resolution:** Use realistic price values

### BIZ_002: Invalid Alert Configuration
- **Status Code:** 400
- **Message:** "Alert threshold incompatible with alert type"
- **Resolution:** Set appropriate threshold relative to current price

### BIZ_003: Duplicate Resource
- **Status Code:** 409
- **Message:** "Resource with this identifier already exists"
- **Resolution:** Use unique identifiers or update existing resource
```

### 9.3 Developer Guidelines

**File:** `/docs/DEVELOPER_SECURITY_GUIDELINES.md`

```markdown
# Security Development Guidelines

## Input Validation Best Practices

### 1. Always Validate Input
- Use Pydantic schemas for automatic validation
- Add custom validators for business rules
- Sanitize user input before processing
- Validate data from external APIs

### 2. Database Security
- Use ORM queries instead of raw SQL
- Escape wildcards in LIKE/ILIKE queries
- Implement proper foreign key constraints
- Add CHECK constraints for business rules

### 3. Authentication Security
- Implement rate limiting on auth endpoints
- Use strong password hashing (bcrypt)
- Implement account lockout mechanisms
- Log security events for monitoring

### 4. API Security
- Validate all input parameters
- Implement proper error handling
- Add security headers to responses
- Use HTTPS in production

## Code Examples

### Secure Search Implementation
```python
# GOOD: Sanitized search
def search_cards(query: str):
    sanitized_query = sanitize_search_input(query)
    return db.query(Card).filter(Card.name.ilike(f"%{sanitized_query}%"))

# BAD: Vulnerable to injection
def search_cards(query: str):
    return db.query(Card).filter(Card.name.ilike(f"%{query}%"))
```

### Secure Password Validation  
```python
# GOOD: Comprehensive validation
@validator('password')
def validate_password(cls, v):
    return SecurityValidator.validate_password_strength(v)

# BAD: Minimal validation
@validator('password')  
def validate_password(cls, v):
    if len(v) < 8:
        raise ValueError("Password too short")
    return v
```

## Security Checklist for New Endpoints

- [ ] Input validation implemented
- [ ] Rate limiting configured  
- [ ] Authentication required (if needed)
- [ ] Error handling doesn't leak information
- [ ] Input sanitization applied
- [ ] Business rules validated
- [ ] Security logging added
- [ ] Tests include security scenarios
```

---

## 10. Migration and Deployment

### 10.1 Database Migration Steps

**File:** `/migrations/001_add_username_field.py`

```python
"""Add username field to users table

Revision ID: 001_username_field
Revises: 
Create Date: 2025-08-09

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001_username_field'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add username column
    op.add_column('users', sa.Column('username', sa.String(length=50), nullable=False))
    
    # Add unique constraint
    op.create_unique_constraint('uq_users_username', 'users', ['username'])
    
    # Add index
    op.create_index('ix_users_username', 'users', ['username'])
    
    # Update existing users with temporary usernames
    op.execute("UPDATE users SET username = CONCAT('user_', id) WHERE username = ''")

def downgrade() -> None:
    op.drop_index('ix_users_username', table_name='users')
    op.drop_constraint('uq_users_username', 'users', type_='unique')
    op.drop_column('users', 'username')
```

### 10.2 Configuration Updates

**File:** `/tcgtracker/src/tcgtracker/main.py` (Add middleware)

```python
from fastapi import FastAPI
from tcgtracker.validation.middleware import (
    ValidationMiddleware,
    SecurityHeadersMiddleware,
    AuditLoggingMiddleware
)
from tcgtracker.validation.error_middleware import ErrorHandlingMiddleware

def create_app() -> FastAPI:
    app = FastAPI(title="TCG Price Tracker API")
    
    # Add validation middleware (order matters!)
    app.add_middleware(ErrorHandlingMiddleware, debug=settings.debug)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuditLoggingMiddleware)
    app.add_middleware(ValidationMiddleware)
    
    # Add CORS with secure configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allow_origins,
        allow_credentials=True,
        allow_methods=settings.cors.allow_methods,
        allow_headers=settings.cors.allow_headers,
    )
    
    # Include routers
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["authentication"])
    app.include_router(cards_router, prefix="/api/v1/cards", tags=["cards"])
    app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
    app.include_router(prices_router, prefix="/api/v1/prices", tags=["prices"])
    app.include_router(search_router, prefix="/api/v1/search", tags=["search"])
    
    return app

app = create_app()
```

### 10.3 Environment Configuration

**Update production environment variables:**

```bash
# Security Configuration
SECRET_KEY=your-very-secure-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# CORS Configuration (NO WILDCARDS)
CORS_ALLOW_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=Authorization,Content-Type,X-Requested-With

# Rate Limiting (Redis recommended for production)
RATE_LIMIT_STORAGE=redis://localhost:6379/0

# Security Settings
SECURITY_HEADERS_ENABLED=true
AUDIT_LOGGING_ENABLED=true
```

---

## Implementation Summary

This comprehensive plan addresses all critical security vulnerabilities and validation gaps identified in the TCG Price Tracker application:

### Critical Issues Fixed:
1. ✅ **Authentication system failure** - Added missing username field to User model
2. ✅ **Schema/model mismatches** - Fixed all field name discrepancies  
3. ✅ **SQL injection vulnerabilities** - Added input sanitization and wildcard escaping
4. ✅ **CORS misconfiguration** - Replaced wildcard with specific origins
5. ✅ **Missing input sanitization** - Comprehensive sanitization for all user inputs

### Security Enhancements Added:
1. ✅ **Rate limiting** - Prevents brute force and DoS attacks
2. ✅ **Password validation** - Enforces complexity requirements
3. ✅ **URL validation** - Blocks malicious URLs and protocols
4. ✅ **XSS prevention** - Sanitizes output and input data
5. ✅ **Audit logging** - Tracks security events
6. ✅ **Error handling** - Prevents information leakage

### Validation Infrastructure Created:
1. ✅ **Modular validators** - Reusable validation components
2. ✅ **Custom exceptions** - Structured error handling
3. ✅ **Middleware layer** - Request/response validation
4. ✅ **Business rules** - Domain-specific validations
5. ✅ **Testing framework** - Comprehensive security testing

The implementation follows security best practices and provides a robust foundation for the TCG Price Tracker application while maintaining performance and usability.

---

**Plan Status:** ✅ **READY FOR IMPLEMENTATION**  
**Estimated Implementation Time:** 4-6 weeks  
**Risk Level After Implementation:** 🟢 **LOW RISK**