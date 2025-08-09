# TCG Price Tracker - Code Flow Analysis Report

## Report Overview
Date: 2025-08-09
Analyzer: Claude Code  
Working Directory: /Users/tung/Development/tcg-price-tracker

## Critical Flow Analysis

### 1. Authentication Flow - Password Field Mismatch

#### Flow Analysis: CRITICAL RUNTIME ERROR
**Entry Points:**
- `/tcgtracker/src/tcgtracker/api/v1/auth.py` - Registration and login endpoints
- `/tcgtracker/src/tcgtracker/api/dependencies.py` - Password verification

**Detailed Flow Mappings:**

##### Registration Flow (BROKEN):
```
POST /auth/register → UserCreate schema validation
    ↓
register() function (auth.py:42-77)
    ↓
get_password_hash(user_data.password) → hashed password string
    ↓
User() constructor call (auth.py:61-66):
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,  ← FIELD MISMATCH
        is_active=True,
    )
    ↓
SQLAlchemy attempts to map 'hashed_password' parameter
    ↓
User model only defines 'password_hash' field (models.py:98)
    ↓
RUNTIME ERROR: AttributeError or SQL column not found
```

##### Login Flow (BROKEN):
```
POST /auth/login → OAuth2PasswordRequestForm
    ↓
login() function (auth.py:75-125)
    ↓
Database query for user by username/email (auth.py:80-87)
    ↓
Password verification attempt (auth.py:89):
    verify_password(form_data.password, user.hashed_password)
    ↓
user.hashed_password attribute access ← FIELD MISMATCH
    ↓
User model only has 'password_hash' attribute (models.py:98)
    ↓
RUNTIME ERROR: AttributeError
```

**Critical Issue Details:**
- **Database Model**: `/tcgtracker/src/tcgtracker/database/models.py:98`
  ```python
  password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
  ```
- **Auth Code Issues**:
  - **Line 64**: `hashed_password=hashed_password` (should be `password_hash=hashed_password`)
  - **Line 89**: `user.hashed_password` (should be `user.password_hash`)
- **Dependencies**: `/tcgtracker/src/tcgtracker/api/dependencies.py:99-101`
  - Function signature is correct, issue is in field access

**Impact**: Complete authentication system failure - no users can register or login.

---

### 2. Validation Pipeline

#### Flow Analysis: PROPERLY IMPLEMENTED
**Entry Points:**
- API schemas in `/tcgtracker/src/tcgtracker/api/schemas.py`
- Card operations in `/tcgtracker/src/tcgtracker/api/v1/cards.py`

**Flow Path:**
```
User Input
    ↓
Pydantic Schema Validation (schemas.py)
    ↓
SecurityValidator & BusinessValidator (validation/validators.py)
    ↓
Input Sanitization (validation/sanitizers.py)
    ↓
Database Operations
```

**Validation Module Structure:**
- **Base Module**: `/tcgtracker/src/tcgtracker/validation/__init__.py`
  - Exports: SecurityValidator, BusinessValidator, sanitize functions
- **Validators**: `/tcgtracker/src/tcgtracker/validation/validators.py` (165 lines)
  - SecurityValidator class for auth validation
  - BusinessValidator class for business rules
- **Sanitizers**: `/tcgtracker/src/tcgtracker/validation/sanitizers.py` (142 lines)
  - sanitize_search_input() - removes malicious SQL patterns
  - sanitize_card_name() - cleans card name input
  - sanitize_sql_wildcards() - escapes SQL wildcards

**Status**: ✅ Validation pipeline is properly implemented and available.

---

### 3. Search Query Construction - SQL Injection Risk

#### Flow Analysis: CRITICAL VULNERABILITY IDENTIFIED
**Entry Points:**
- Search suggestions: `/tcgtracker/src/tcgtracker/api/v1/search.py`
- Card search: `/tcgtracker/src/tcgtracker/api/v1/cards.py`

**Detailed Flow Mappings:**

##### Vulnerable Flow Path (search.py):
```
GET /search/suggestions?query=<malicious_input>
    ↓
get_search_suggestions() function (search.py:230-261)
    ↓
Raw query parameter passed directly (no validation layer)
    ↓
SQL Query Construction (search.py:250):
    name_query = select(distinct(Card.name)).where(
        Card.name.ilike(f"%{query}%")  ← DIRECT INTERPOLATION
    )
    ↓
SQLAlchemy executes query with malicious input
    ↓
SQL INJECTION ATTACK SUCCESSFUL
```

**Attack Vector Example:**
```
GET /search/suggestions?query=test%'; DROP TABLE cards; --
    ↓
Becomes: Card.name.ilike("%test'; DROP TABLE cards; --%")
    ↓
Potential database destruction
```

##### Secure Flow Path (cards.py - REFERENCE):
```
GET /cards/search?search=<user_input>
    ↓
Schema validation through Pydantic CardSearchParams
    ↓
get_cards() function (cards.py:85-140)
    ↓
Sanitization Import (cards.py:103, 110):
    from tcgtracker.validation.sanitizers import sanitize_search_input
    ↓
Input Sanitization (cards.py:105, 112):
    sanitized = sanitize_search_input(set_name)
    sanitized_search = sanitize_search_input(search)
    ↓
Safe Query Construction (cards.py:106, 115-117):
    Card.set_name.ilike(f"%{sanitized}%")
    Card.name.ilike(f"%{sanitized_search}%")
    ↓
Protected Database Query Execution
```

**Critical Vulnerability Details:**
- **Vulnerable File**: `/tcgtracker/src/tcgtracker/api/v1/search.py:250`
  ```python
  name_query = select(distinct(Card.name)).where(Card.name.ilike(f"%{query}%"))
  ```
- **Available Sanitization**: `/tcgtracker/src/tcgtracker/validation/sanitizers.py`
  - `sanitize_search_input()` - removes SQL injection patterns
  - `sanitize_sql_wildcards()` - escapes SQL wildcards
- **Secure Reference**: `/tcgtracker/src/tcgtracker/api/v1/cards.py:103-119`

**Data Flow Comparison:**
| Aspect | search.py (VULNERABLE) | cards.py (SECURE) |
|--------|----------------------|------------------|
| Input Validation | None | Pydantic schema |
| Sanitization | None | sanitize_search_input() |
| Query Construction | Direct interpolation | Sanitized interpolation |
| Attack Surface | Full SQL injection | Protected |

**Fix Required**: Import and apply `sanitize_search_input()` in search.py before query construction.

---

### 4. Logging and Credential Flow

#### Flow Analysis: CREDENTIAL EXPOSURE RISK
**Entry Points:**
- TCGPlayer OAuth integration
- Application configuration
- JWT token operations

**Detailed Flow Mappings:**

##### OAuth Token Exposure Flow (tcgplayer.py):
```
OAuth Authentication Request
    ↓
TCGPlayer._authenticate() method
    ↓
Token Response Processing (tcgplayer.py:185-189):
    expires_in = token_response.get("expires_in", 3600)
    self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)
    ↓
Sensitive Logging (tcgplayer.py:190-194):
    logger.info(
        "OAuth tokens stored",
        expires_at=self._token_expires_at.isoformat(),  ← EXPOSES TOKEN TIMING
        has_refresh_token=bool(self._refresh_token),    ← EXPOSES TOKEN PRESENCE
    )
    ↓
Token Information Written to Application Logs
    ↓
POTENTIAL CREDENTIAL EXPOSURE
```

##### Authentication Failure Logging Flow:
```
Token Refresh Failure
    ↓
Exception in _refresh_access_token() (tcgplayer.py:166-167)
    ↓
Error Logging:
    logger.error(f"Failed to refresh access token: {str(exc)}")
    ↓
Authentication Context and Error Details in Logs
    ↓
POTENTIAL SENSITIVE INFORMATION DISCLOSURE
```

##### JWT Token Processing Flow (dependencies.py):
```
HTTP Request with Bearer Token
    ↓
get_current_user() dependency (dependencies.py:28-50)
    ↓
Token Extraction and Decoding (dependencies.py:36-40):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    ↓
Token payload processing with secret key operations
    ↓
Potential for token details in debug logs or error traces
```

**Critical Exposure Points:**

1. **TCGPlayer Token Logging**: `/tcgtracker/src/tcgtracker/integrations/tcgplayer.py:190-194`
   ```python
   logger.info(
       "OAuth tokens stored",
       expires_at=self._token_expires_at.isoformat(),  # Timing attack info
       has_refresh_token=bool(self._refresh_token),    # Token presence
   )
   ```

2. **Authentication Error Context**: `/tcgtracker/src/tcgtracker/integrations/tcgplayer.py:164-167`
   ```python
   logger.info("Access token refreshed successfully")
   # vs
   logger.error(f"Failed to refresh access token: {str(exc)}")
   ```

3. **Configuration Defaults**: `/tcgtracker/src/tcgtracker/config.py:150, 169-187`
   - Default insecure secret keys
   - Development credential patterns

**Data Exposure Risk Matrix:**
| Logging Point | Sensitivity Level | Exposed Information | Risk Level |
|---------------|------------------|-------------------|------------|
| Token Storage | HIGH | Token expiration, refresh token presence | MEDIUM |
| Auth Failures | MEDIUM | Error context, timing | LOW-MEDIUM |
| JWT Operations | HIGH | Token payload in stack traces | HIGH |
| Config Defaults | HIGH | Default secrets in development | HIGH |

**Impact**: OAuth tokens, timing information, and authentication context exposed in application logs.

---

## System Interconnections and Dependencies

### Flow Interaction Matrix
The four critical flows interact and depend on each other in various ways:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Authentication │    │    Validation    │    │  Search Query   │    │ Logging/Creds   │
│      Flow       │◄──►│     Pipeline     │    │  Construction   │    │      Flow        │
│                 │    │                  │    │                 │    │                  │
│ BROKEN: Field   │    │ WORKING: Modules │    │ VULNERABLE:     │    │ EXPOSED: OAuth   │
│ Mismatch Issue  │    │ Exist & Function │    │ SQL Injection   │    │ Token Details    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
         │                        │                        │                        │
         │                        │                        │                        │
         ▼                        ▼                        ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM SECURITY IMPACT                                        │
│                                                                                          │
│ • Authentication failure prevents user access to secure search features                 │
│ • SQL injection in search bypasses authentication (if it worked)                       │
│ • Credential logging exposes tokens used for both auth and external API integration    │
│ • Validation pipeline works but isn't consistently applied across all endpoints         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Dependency Analysis

#### 1. Authentication Dependencies:
- **Direct Dependencies:**
  - `/tcgtracker/src/tcgtracker/database/models.py` (User model)
  - `/tcgtracker/src/tcgtracker/api/dependencies.py` (verify_password)
  - BCrypt library for password hashing
- **Transitive Dependencies:**
  - SQLAlchemy ORM for database operations
  - JWT library for token generation
  - FastAPI security utilities

#### 2. Validation Pipeline Dependencies:
- **Module Structure:**
  ```
  tcgtracker.validation/
  ├── __init__.py (exports all validators)
  ├── validators.py (SecurityValidator, BusinessValidator)
  ├── sanitizers.py (sanitize_search_input, sanitize_card_name)
  ├── business_rules.py (domain-specific validation)
  └── exceptions.py (validation error types)
  ```
- **Used By:**
  - `api/schemas.py` - Pydantic model validation
  - `api/v1/cards.py` - Search input sanitization
  - **NOT used by:** `api/v1/search.py` (causing SQL injection)

#### 3. Search Query Dependencies:
- **Vulnerable Path:**
  - `search.py` → Direct SQLAlchemy query → Database
- **Secure Path:**
  - `cards.py` → Validation sanitizers → SQLAlchemy query → Database
- **Missing Link:**
  - `search.py` should import and use validation sanitizers like `cards.py`

#### 4. Logging Flow Dependencies:
- **Logging Framework:** Python logging module
- **Exposed in:**
  - TCGPlayer OAuth integration
  - JWT token processing
  - Configuration loading
- **Risk Amplification:** Debug logs could expose all token operations

### File Interconnection Map

```
Configuration Layer:
├── config.py (insecure defaults)
│
API Layer:
├── api/__init__.py
├── api/dependencies.py (JWT, password verification)
├── api/schemas.py (Pydantic + validation imports)
└── api/v1/
    ├── auth.py (BROKEN: field mismatch)
    ├── search.py (VULNERABLE: no sanitization)
    ├── cards.py (SECURE: uses validation)
    └── users.py
│
Validation Layer (AVAILABLE but not fully utilized):
├── validation/__init__.py
├── validation/validators.py
├── validation/sanitizers.py
├── validation/business_rules.py
└── validation/exceptions.py
│
Database Layer:
├── database/models.py (defines password_hash field)
└── database/migrations_manager.py
│
Integration Layer:
└── integrations/
    ├── tcgplayer.py (EXPOSED: credential logging)
    └── base.py
```

### Critical Path Analysis

#### Failure Cascade Potential:
1. **Authentication System Down** → All secure endpoints inaccessible
2. **SQL Injection Available** → Database compromise possible even without auth
3. **Credential Logging** → Attack vectors discoverable through log analysis
4. **Validation Inconsistency** → Some endpoints protected, others vulnerable

#### Recovery Dependencies:
- Fix authentication → Enables access to secure card search
- Fix SQL injection → Prevents database attacks
- Fix logging → Reduces attack surface discovery
- Apply validation consistently → Ensures comprehensive protection

---

## Security Implications Summary

### Critical Issues:
1. **Authentication System Failure** - Field mismatch prevents all user operations
2. **SQL Injection Vulnerability** - Direct attack vector through search endpoint
3. **Credential Logging** - Sensitive tokens exposed in application logs

### Required Immediate Actions:

#### Priority 1 - Critical System Failures:
1. **Fix Authentication Field Mismatch** (auth.py)
   - Change `hashed_password=hashed_password` to `password_hash=hashed_password` at line 64
   - Change `user.hashed_password` to `user.password_hash` at line 89
   
2. **Fix SQL Injection Vulnerability** (search.py)
   - Import `sanitize_search_input` from validation.sanitizers
   - Apply sanitization before query construction at line 250

#### Priority 2 - Security Hardening:
3. **Remove Sensitive Credential Logging** (tcgplayer.py)
   - Redact token timing information at lines 190-194
   - Remove detailed error context at lines 163-167
   
4. **Secure Configuration Defaults** (config.py)
   - Remove default insecure secret keys
   - Add production-ready configuration validation

### Detailed Fix Specifications:

#### Auth.py Fixes:
```python
# Line 64: Change from
new_user = User(
    email=user_data.email,
    username=user_data.username,
    hashed_password=hashed_password,  # ← WRONG
    is_active=True,
)
# To:
new_user = User(
    email=user_data.email,
    username=user_data.username,
    password_hash=hashed_password,  # ← CORRECT
    is_active=True,
)

# Line 89: Change from
if not user or not verify_password(form_data.password, user.hashed_password):
# To:
if not user or not verify_password(form_data.password, user.password_hash):
```

#### Search.py Fixes:
```python
# Add at top of get_search_suggestions function:
from tcgtracker.validation.sanitizers import sanitize_search_input

# Line 250: Change from
name_query = select(distinct(Card.name)).where(Card.name.ilike(f"%{query}%"))
# To:
sanitized_query = sanitize_search_input(query)
name_query = select(distinct(Card.name)).where(Card.name.ilike(f"%{sanitized_query}%"))
```

#### TCGPlayer.py Fixes:
```python
# Lines 190-194: Change from
logger.info(
    "OAuth tokens stored",
    expires_at=self._token_expires_at.isoformat(),
    has_refresh_token=bool(self._refresh_token),
)
# To:
logger.info("OAuth tokens stored successfully")

# Line 167: Change from
logger.error(f"Failed to refresh access token: {str(exc)}")
# To:
logger.error("Failed to refresh access token")
```

### Files Requiring Immediate Attention:
- **`/tcgtracker/src/tcgtracker/api/v1/auth.py`** - Lines 64, 89 (field mismatch)
- **`/tcgtracker/src/tcgtracker/api/v1/search.py`** - Line 250 (SQL injection)
- **`/tcgtracker/src/tcgtracker/integrations/tcgplayer.py`** - Lines 190-194, 167 (credential exposure)
- **`/tcgtracker/src/tcgtracker/config.py`** - Lines 150, 169-187 (insecure defaults)

### Validation Status:
✅ **Validation modules exist and are properly implemented**
✅ **Sanitization functions are available and working**
✅ **Security framework is in place**
❌ **Inconsistent application across endpoints**