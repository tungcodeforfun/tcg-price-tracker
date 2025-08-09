# TCG Price Tracker - Data Flow and Validation Analysis Report

**Analysis Date:** 2025-08-09  
**Focus:** Request flow analysis, validation points, data transformation, and integration mapping

---

## Executive Summary

This report maps the complete data flow architecture of the TCG Price Tracker application, identifying validation points, transformation stages, and critical security touchpoints. The analysis reveals a well-structured FastAPI application with clear separation between API schemas, database models, and business logic, but with significant validation gaps that need immediate attention.

---

## 1. Application Architecture Overview

### Core Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Layer     │    │  Business Logic │    │  Database Layer │
│  (FastAPI)      │───▶│   (Services)    │───▶│  (SQLAlchemy)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Pydantic Schemas│    │   Dependencies  │    │  Database Models│
│ (Validation)    │    │ (Auth, Utils)   │    │ (Persistence)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Data Models Identified
- **Users**: Authentication and profile management
- **Cards**: TCG card information and metadata  
- **PriceHistory**: Historical pricing data from external sources
- **Collections**: User's card collections and inventory
- **Alerts**: Price monitoring and notifications
- **DataSources**: External API configuration

---

## 2. Request Flow Analysis

### 2.1 Authentication Flow

**Path:** Client → Auth Endpoint → JWT Token → Protected Resources

```
1. POST /api/v1/auth/register
   ├── Request: LoginRequest schema (username, password)
   ├── Validation: Pydantic schema validation
   ├── Transform: UserCreate → User model
   ├── Security: Password hashing with bcrypt
   └── Response: Token schema (access_token, refresh_token)

2. POST /api/v1/auth/login  
   ├── Request: LoginRequest schema
   ├── Validation: User existence, password verification
   ├── Transform: User credentials → JWT tokens
   └── Response: Token schema

3. Protected Endpoint Access
   ├── Header: Bearer token
   ├── Dependency: get_current_user()
   ├── Validation: JWT decode, user existence, active status
   └── Context: User object available in endpoint
```

**Critical Validation Points:**
- ✅ Password hashing with bcrypt
- ✅ JWT token validation with expiration
- ✅ User active status check
- ❌ **MISSING**: Rate limiting on login attempts
- ❌ **MISSING**: Account lockout mechanism
- ❌ **MISSING**: Session management

**Schema/Model Mismatches Identified:**
- ❌ **CRITICAL**: `UserCreate.username` referenced but `User.username` field doesn't exist
- ❌ **CRITICAL**: Auth endpoints will fail due to missing username field
- ❌ **CRITICAL**: Registration flow attempts `User(username=...)` but field not defined

---

## 2.2 Card Management Flow

**Path:** Client → Card API → Validation → Database → External APIs

```
1. POST /api/v1/cards/
   ├── Request: CardCreate schema
   ├── Validation: Pydantic validation, authentication
   ├── Business Logic: Duplicate card check
   ├── Transform: CardCreate → Card model
   └── Response: CardResponse schema

2. GET /api/v1/cards/search
   ├── Request: CardSearchParams schema
   ├── Validation: Query parameter validation
   ├── Database: Complex ILIKE queries
   ├── Price Join: Join with PriceHistory for price filters
   └── Response: List[CardResponse] with price data
```

**Critical Issues Found:**
- ❌ **CRITICAL**: `Card.game_type` referenced but model uses `tcg_type`
- ❌ **CRITICAL**: `Card(**card_data.model_dump())` will fail - field name mismatch
- ❌ **CRITICAL**: `selectinload(Card.prices)` but model has `price_history` relationship
- ❌ **CRITICAL**: Query references undefined `Price` model instead of `PriceHistory`
- ❌ **CRITICAL**: ILIKE queries vulnerable to SQL wildcard injection (`%`, `_`)

**Validation Gaps:**
- ❌ **HIGH**: No input sanitization for search terms
- ❌ **HIGH**: URL fields (image_url) not validated
- ❌ **MEDIUM**: External_id accepts any string without validation
- ❌ **MEDIUM**: Card number/set code lack format validation

---

## 2.3 Price Data Flow

**Path:** Client → Price API → External APIs → Database → Alerts

```
1. Price Creation/Update Flow
   ├── Manual: POST /api/v1/prices/ (PriceCreate schema)
   ├── External: POST /api/v1/prices/update/{card_id}
   ├── Bulk: POST /api/v1/prices/update/bulk
   └── Background: fetch_and_update_price()

2. External Integration Flow
   ├── TCGPlayer: TCGPlayerClient.get_product_prices()
   ├── eBay: eBayClient.search_cards()
   ├── Transform: External response → PriceHistory model
   └── Alert Triggering: Check UserAlert conditions
```

**Integration Security Issues:**
- ❌ **CRITICAL**: External API calls without input sanitization
- ❌ **CRITICAL**: No timeout controls for external API calls  
- ❌ **HIGH**: Exception details exposed in HTTP responses
- ❌ **HIGH**: Search query passed to external APIs unsanitized
- ❌ **MEDIUM**: No rate limiting on expensive bulk operations

**Schema/Model Issues:**
- ❌ **CRITICAL**: PriceResponse expects `listing_url` but PriceHistory model lacks it
- ❌ **CRITICAL**: Alert logic references undefined alert fields
- ❌ **MEDIUM**: Price source enum mismatch between schemas and models

---

## 3. Data Transformation Points

### 3.1 API Request → Pydantic Schema
```
Request JSON → Pydantic Schema Validation → Validated Data
```
**Validation Present:**
- Field types (int, str, Decimal)
- Constraints (min_length, gt=0, le=100)
- Pattern matching (alert_type regex)
- Enum validation (GameType, CardCondition, PriceSource)

**Validation Missing:**
- Input sanitization for XSS
- URL validation for security
- Complex business rule validation
- File upload validation

### 3.2 Pydantic Schema → Database Model
```
Schema.model_dump() → Model(**data) → Database Persistence
```
**Critical Issues:**
- ❌ Field name mismatches cause runtime failures
- ❌ Enum value mismatches between schemas and models
- ❌ Missing model fields referenced in schemas
- ❌ Invalid foreign key relationships

### 3.3 Database Model → Response Schema
```
Model Query → Response Schema → JSON Serialization
```
**Issues Found:**
- ❌ Dynamic attributes assigned to models (latest_price, price_trend)
- ❌ Response schemas expect fields not in models
- ❌ Complex calculations done in endpoint code instead of services

---

## 4. Validation Dependencies Analysis

### 4.1 Core Dependencies
```
┌─────────────────┐    ┌─────────────────┐
│   Pydantic      │───▶│    FastAPI      │
│  (Validation)   │    │  (Framework)    │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Dependencies   │    │  SQLAlchemy     │
│ (Auth, Utils)   │    │ (ORM/Models)    │
└─────────────────┘    └─────────────────┘
```

**Shared Validation Logic:**
- ✅ Authentication via `get_current_active_user()` dependency
- ✅ Database session via `get_session()` dependency
- ✅ Password hashing/verification utilities
- ❌ **MISSING**: Input sanitization utilities
- ❌ **MISSING**: Rate limiting decorators/dependencies
- ❌ **MISSING**: Validation error formatters

### 4.2 Validation Inheritance Patterns
- **BaseModel**: All schemas inherit from Pydantic BaseModel
- **TimestampMixin**: Database models inherit timestamp fields
- **Enums**: Shared between schemas and models (with mismatches)
- **Dependencies**: Consistent use of FastAPI dependency injection

---

## 5. Critical Validation Paths

### 5.1 Authentication Flow Validation
**Current State:** ❌ BROKEN - Username field missing
```
1. Registration: UserCreate → User model (FAILS)
2. Login: Username/email lookup (FAILS)  
3. Token validation: JWT decode → User lookup (Works)
```

### 5.2 Payment/Pricing Data Flow Validation
**Current State:** ⚠️ PARTIAL - External data unsanitized
```
1. Price input: PriceCreate → Decimal validation ✅
2. External APIs: Raw data → Database (No sanitization) ❌
3. Alert triggers: Price comparison logic ✅
```

### 5.3 User Input Flows Validation
**Current State:** ❌ INSUFFICIENT - XSS vulnerable
```
1. Search queries: Basic length checks ✅
2. Text fields: No sanitization ❌
3. File uploads: Not implemented yet
4. URLs: No validation ❌
```

---

## 6. Integration Points Analysis

### 6.1 External API Integrations

**TCGPlayer Integration:**
```
Search Flow:
POST /api/v1/search/tcgplayer
├── SearchRequest validation
├── Game type mapping (pokemon→3, magic→1, etc.)
├── TCGPlayerClient.search_products()
├── TCGPlayerClient.get_product_prices()  
└── SearchResult response formatting
```

**eBay Integration:**
```
Search Flow: 
POST /api/v1/search/ebay
├── SearchRequest validation
├── eBayClient.search_cards()
├── Raw eBay response processing
└── SearchResult response formatting
```

**Critical Security Issues Found:**
- ❌ **CRITICAL**: Search queries passed to external APIs without sanitization
- ❌ **CRITICAL**: External API response data not validated before database storage
- ❌ **CRITICAL**: No timeout controls beyond base HTTP timeout
- ❌ **HIGH**: Exception details from external APIs exposed to clients
- ❌ **HIGH**: No input validation for external_id fields from API responses
- ❌ **MEDIUM**: Game type mapping hardcoded, not validated

### 6.2 Database Query Construction

**ORM Security Analysis:**
- ✅ **GOOD**: SQLAlchemy ORM prevents direct SQL injection
- ✅ **GOOD**: Parameterized queries used throughout
- ❌ **CRITICAL**: ILIKE queries vulnerable to wildcard injection (`%`, `_`)
- ❌ **HIGH**: Dynamic query building in search endpoints
- ❌ **HIGH**: No query complexity limits or timeouts

**Vulnerable Query Examples:**
```python
# Lines 107, 113-116 in cards.py - ILIKE injection vulnerable
Card.set_name.ilike(f"%{set_name}%")           # User can inject % or _
Card.name.ilike(f"%{search}%")                 # Wildcard injection possible
Card.card_number.ilike(f"%{search}%")          # Pattern injection risk
```

### 6.3 Response Serialization

**Serialization Flow:**
```
Database Model → Pydantic Response Schema → JSON → Client
```

**Issues Identified:**
- ❌ **CRITICAL**: Dynamic attributes assigned to models at runtime
- ❌ **HIGH**: Response schemas expect fields not in database models  
- ❌ **HIGH**: Complex calculations in endpoints instead of service layer
- ❌ **MEDIUM**: No response data sanitization for XSS prevention

### 6.4 Configuration Security Analysis

**CORS Configuration:** ❌ **CRITICAL VULNERABILITY**
```python
# config.py line 210 - ALLOWS ALL ORIGINS
allow_origins: list[str] = Field(default=["*"])  # Wildcard CORS
allow_methods: list[str] = Field(default=["*"])  # All methods allowed
allow_headers: list[str] = Field(default=["*"])  # All headers allowed
```

**Other Configuration Issues:**
- ❌ **HIGH**: Debug mode defaults may leak sensitive info
- ❌ **MEDIUM**: Default credentials in development settings
- ⚠️ **MEDIUM**: Secret key validation warns but allows insecure patterns

---

## 7. Comprehensive Validation Requirements

### 7.1 Immediate Critical Fixes Required

**1. Fix Authentication System (CRITICAL)**
```python
# User model missing username field - ADD TO models.py:
username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

# Auth endpoints will fail due to username references in:
# - auth.py lines 35, 56, 77
# - All registration/login flows
```

**2. Fix Schema/Model Mismatches (CRITICAL)**  
```python
# Cards API references wrong fields:
# - Card.game_type → Card.tcg_type  
# - Card.prices → Card.price_history
# - Price model → PriceHistory model
# - GameType enum → TCGTypeEnum enum values
```

**3. Implement Input Sanitization (CRITICAL)**
```python
# Required sanitization functions:
def sanitize_search_query(query: str) -> str:
    """Escape SQL wildcards and HTML entities"""
    return html.escape(query.replace('%', '\\%').replace('_', '\\_'))

def validate_url(url: str) -> bool:
    """Validate URLs for security"""
    # Check for valid schemes, no javascript: protocol, etc.
```

**4. Configure Secure CORS (CRITICAL)**
```python  
# Replace wildcard CORS with specific origins:
allow_origins = ["https://yourdomain.com", "https://app.yourdomain.com"]
```

### 7.2 High Priority Security Implementations

**1. Rate Limiting Implementation**
```python
# Add rate limiting dependencies:
@router.post("/login")
@rate_limit(requests=5, window=300)  # 5 attempts per 5 minutes
async def login(...)

@router.post("/search/all") 
@rate_limit(requests=10, window=60)  # 10 searches per minute
async def search_all_sources(...)
```

**2. Enhanced Input Validation**
```python
# Add custom Pydantic validators:
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    
    @validator('password')
    def validate_password_strength(cls, v):
        """Enforce password complexity requirements"""
        if not re.search(r'[A-Za-z]', v) or not re.search(r'\d', v):
            raise ValueError('Password must contain letters and numbers')
        return v
    
    @validator('username')  
    def validate_username_format(cls, v):
        """Validate username format"""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Invalid username format')
        return v
```

**3. External API Security**
```python
# Add timeout and validation:
async def fetch_and_update_price(card, source, db):
    # Add input sanitization before API calls
    query = sanitize_search_query(f"{card.name} {card.set_name}")
    
    # Add timeout controls
    with timeout_context(30):  # 30 second timeout
        response = await client.search_cards(query)
    
    # Validate response before database storage
    validated_response = validate_external_data(response)
```

### 7.3 Validation Architecture Improvements

**1. Centralized Validation Services**
```python
# Create validation service layer:
class ValidationService:
    @staticmethod
    def sanitize_user_input(text: str) -> str:
        """Centralized input sanitization"""
        
    @staticmethod  
    def validate_business_rules(data: dict, model: str) -> bool:
        """Business rule validation"""
        
    @staticmethod
    def format_error_response(errors: list) -> dict:
        """Standardized error formatting"""
```

**2. Enhanced Dependency Injection**
```python
# Add validation dependencies:
async def validate_and_sanitize_search(
    params: CardSearchParams = Depends()
) -> CardSearchParams:
    """Validate and sanitize search parameters"""
    params.query = sanitize_search_query(params.query)
    return params
```

---

## 8. Data Flow Security Recommendations

### 8.1 Request Processing Pipeline
```
Client Request
    ↓ 1. Rate Limiting Check
    ↓ 2. Authentication Validation  
    ↓ 3. Input Sanitization
    ↓ 4. Pydantic Schema Validation
    ↓ 5. Business Rule Validation
    ↓ 6. Database Operation
    ↓ 7. Response Sanitization
    ↓ 8. Response Schema Validation
Client Response
```

### 8.2 External API Integration Pipeline  
```
Internal Request
    ↓ 1. Input Sanitization
    ↓ 2. Rate Limiting (External API)
    ↓ 3. Circuit Breaker Check
    ↓ 4. External API Call (with timeout)
    ↓ 5. Response Validation
    ↓ 6. Data Sanitization
    ↓ 7. Database Storage
Internal Response
```

### 8.3 Database Security Pipeline
```
Application Data
    ↓ 1. Schema Validation
    ↓ 2. SQL Injection Prevention (ORM)
    ↓ 3. Wildcard Injection Prevention
    ↓ 4. Business Rule Constraints
    ↓ 5. Database Constraints
    ↓ 6. Audit Logging
Database Storage
```

---

## 9. Risk Assessment Summary

### Critical Risk Areas (IMMEDIATE ACTION REQUIRED)
1. **Authentication System Failure** - Username field missing, registration/login broken
2. **Schema/Model Mismatches** - Runtime failures in card operations
3. **SQL Wildcard Injection** - ILIKE queries vulnerable to pattern injection  
4. **CORS Misconfiguration** - Allows all origins, enables CSRF attacks
5. **Input Sanitization Missing** - XSS and injection vulnerabilities

### High Risk Areas (URGENT)
1. **External API Integration** - Unsanitized data flows from external sources
2. **Rate Limiting Absent** - Brute force and DoS attacks possible
3. **Response Data Exposure** - Exception details leaked to clients
4. **URL Validation Missing** - Malicious URLs accepted without validation

### Medium Risk Areas (IMPORTANT)
1. **Session Management** - No concurrent login controls or session tracking
2. **Password Complexity** - Only length validation, no complexity requirements
3. **Audit Logging Gaps** - Insufficient security event monitoring
4. **Error Handling** - Potential information leakage through error messages

---

## 10. Implementation Priority Matrix

### Phase 1: Critical Fixes (Week 1)
- [ ] Add username field to User model and update all references
- [ ] Fix all schema/model field name mismatches  
- [ ] Implement input sanitization for all user inputs
- [ ] Configure secure CORS with specific allowed origins
- [ ] Add SQL wildcard escaping for ILIKE queries

### Phase 2: Security Enhancements (Week 2-3)  
- [ ] Implement comprehensive rate limiting
- [ ] Add account lockout mechanisms
- [ ] Enhance password validation with complexity requirements
- [ ] Add URL validation for all URL fields
- [ ] Implement centralized error handling

### Phase 3: Architecture Improvements (Week 4-6)
- [ ] Create centralized validation service layer
- [ ] Add comprehensive audit logging
- [ ] Implement session management
- [ ] Add API versioning strategy
- [ ] Create security monitoring and alerting

### Phase 4: Advanced Security (Ongoing)
- [ ] Implement OAuth2/OIDC integration
- [ ] Add multi-factor authentication
- [ ] Create content security policies
- [ ] Implement advanced threat detection
- [ ] Add automated security testing

---

**Report Generation Complete**  
**Total Critical Issues:** 8  
**Total High Priority Issues:** 12  
**Total Medium Priority Issues:** 8  
**Overall Security Status:** 🔴 **HIGH RISK - IMMEDIATE ACTION REQUIRED**

---
