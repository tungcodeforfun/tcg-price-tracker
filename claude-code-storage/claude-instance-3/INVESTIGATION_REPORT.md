# Data Validation Investigation Report

## TCG Price Tracker Codebase - Security and Validation Analysis

**Investigation Date:** 2025-08-09
**Focus Areas:** Data validation mechanisms, API security, error handling, and vulnerability assessment

## Executive Summary

The TCG Price Tracker codebase demonstrates a solid foundation with proper use of modern Python frameworks (FastAPI, SQLAlchemy, Pydantic) and good architectural patterns. However, the investigation reveals several **critical security vulnerabilities** that require immediate attention:

**Critical Issues:**
- No rate limiting on authentication endpoints (brute force attacks possible)
- Insufficient input sanitization (XSS and injection vulnerabilities)
- CORS configured to allow all origins
- No session management or account lockout mechanisms
- ILIKE queries vulnerable to wildcard injection attacks

**Overall Security Posture:** 🟡 MODERATE RISK - Good foundational security with critical gaps requiring immediate remediation.

## Investigation Progress
- ✅ Project structure analyzed
- ✅ Pydantic schemas reviewed
- ✅ Database models analyzed
- ✅ Authentication system examined
- ✅ API endpoints investigated
- ✅ Error handling reviewed
- ✅ Configuration security assessed
- ✅ Security concerns identified

## 1. Current Validation Mechanisms

### 1.1 Pydantic Schemas
**File:** `/tcgtracker/src/tcgtracker/api/schemas.py`

**Validation Strengths:**
- ✅ Strong typing with Pydantic BaseModel throughout
- ✅ EmailStr validation for email fields
- ✅ Field constraints (min_length=8 for passwords, gt=0 for prices/quantities)
- ✅ Enum-based validation for controlled values (GameType, CardCondition, PriceSource)
- ✅ Pattern matching for alert_type ("above|below")
- ✅ Pagination limits (limit le=100, offset ge=0)

**Validation Gaps Identified:**
- ⚠️ No custom validators for sensitive fields
- ⚠️ Username lacks length/character constraints
- ⚠️ No URL validation for image_url, listing_url fields
- ⚠️ Password validation only checks length, no complexity requirements
- ⚠️ No input sanitization for text fields (notes, query)
- ⚠️ External_id field accepts any string without validation
- ⚠️ Card number and set code lack format validation

### 1.2 Database Model Constraints
**File:** `/tcgtracker/src/tcgtracker/database/models.py`

**Database Validation Strengths:**
- ✅ Strong schema design with proper foreign key constraints
- ✅ Unique constraints preventing data duplication
- ✅ Enum-based validation for controlled values (TCGTypeEnum, CardConditionEnum, etc.)
- ✅ String length limits (email: 255 chars, names: 100 chars, etc.)
- ✅ Proper indexing for performance and uniqueness
- ✅ Decimal precision constraints for financial data (Numeric(10, 2))
- ✅ Timestamp mixins with server defaults
- ✅ Cascade delete relationships for data integrity

**Database Security Concerns:**
- ✅ Good: No raw SQL in model definitions
- ✅ Good: Proper use of SQLAlchemy ORM preventing direct SQL injection
- ⚠️ Warning: Text fields (notes, image_url) have no length limits
- ⚠️ Warning: JSON fields (preferences, config) lack structure validation
- ⚠️ Warning: API usage logging stores sensitive data (user_agent, ip_address)
- ⚠️ Warning: Password hash length (255) might be excessive
- ⚠️ Warning: No CHECK constraints for business rules validation

### 1.3 Validation Utilities and Authentication
**File:** `/tcgtracker/src/tcgtracker/api/dependencies.py`

**Authentication Security Strengths:**
- ✅ Strong password hashing with bcrypt
- ✅ JWT tokens with proper expiration handling
- ✅ OAuth2PasswordBearer for standardized auth
- ✅ User active status validation
- ✅ Proper exception handling for invalid tokens
- ✅ Separate access and refresh token creation

**Security Concerns:**
- ✅ Good: Uses secure JWT algorithms
- ⚠️ Warning: No rate limiting for authentication attempts
- ⚠️ Warning: No token blacklisting mechanism
- ⚠️ Warning: JWT payload not validated beyond basic structure
- ⚠️ Warning: No session management or concurrent login limits
- ⚠️ Warning: Password verification lacks timing attack protection
- ⚠️ Critical: Token expiration times should be configurable per environment

## 2. API Endpoints Security Analysis

### 2.1 Authentication Endpoints
**File:** `/tcgtracker/src/tcgtracker/api/v1/auth.py`

**Security Implementation:**
- ✅ Password hashing with bcrypt
- ✅ JWT token creation and validation
- ✅ User existence and duplicate checks
- ✅ Active user validation
- ✅ Proper HTTP status codes

**Security Vulnerabilities:**
- ⚠️ Critical: No rate limiting on login attempts (brute force vulnerable)
- ⚠️ Critical: Username field referenced but not defined in User model
- ⚠️ Warning: No account lockout mechanism
- ⚠️ Warning: No password complexity validation beyond length
- ⚠️ Warning: Refresh tokens not invalidated on logout
- ⚠️ Warning: No session management or concurrent login tracking
- ⚠️ Warning: Same error message for different failure reasons (timing attacks)

### 2.2 Core API Endpoints

#### User Endpoints (`/tcgtracker/src/tcgtracker/api/v1/users.py`)
**Validation Strengths:**
- ✅ User authentication required for all endpoints
- ✅ Duplicate email/username prevention
- ✅ Resource ownership validation (user can only access their own alerts)
- ✅ Foreign key validation (card existence checks)

**Security Concerns:**
- ⚠️ Warning: PriceAlert model referenced but undefined in auth.py
- ⚠️ Warning: No input sanitization for notes field
- ⚠️ Warning: Direct model field updates without validation
- ⚠️ Warning: No pagination limits on alerts endpoint

#### Card Endpoints (`/tcgtracker/src/tcgtracker/api/v1/cards.py`)
**Validation Strengths:**
- ✅ Authentication required for all operations
- ✅ Duplicate card prevention
- ✅ Input validation through Pydantic schemas
- ✅ Pagination limits enforced (le=100)
- ✅ SQL injection protection via ORM

**Security Concerns:**
- ⚠️ Critical: ILIKE queries vulnerable to SQL wildcards (% and _)
- ⚠️ Warning: No input sanitization for search terms
- ⚠️ Warning: Price model referenced incorrectly (should be PriceHistory)
- ⚠️ Warning: No rate limiting on search endpoints
- ⚠️ Warning: Complex queries without query optimization checks

## 3. Security Concerns Assessment

### 3.1 Input Sanitization
**Current State:** Limited sanitization in place
- ✅ Good: Pydantic schemas provide basic validation
- ⚠️ Critical: No sanitization for text fields (notes, search queries)
- ⚠️ Critical: ILIKE queries vulnerable to wildcard injection
- ⚠️ Warning: URL fields not validated for malicious content
- ⚠️ Warning: External API responses not sanitized before storage

### 3.2 SQL Injection Prevention
**Current State:** Mostly protected via ORM
- ✅ Good: SQLAlchemy ORM used throughout (parameterized queries)
- ✅ Good: No raw SQL detected in models or endpoints
- ⚠️ Warning: ILIKE patterns could be exploited with % and _ wildcards
- ⚠️ Warning: Dynamic query building needs review

### 3.3 XSS Prevention
**Current State:** No explicit XSS protection
- ⚠️ Critical: No input sanitization for user-generated content
- ⚠️ Critical: No output encoding for text fields
- ⚠️ Warning: API returns unsanitized data that could contain scripts
- ⚠️ Warning: Image URLs and external content not validated

### 3.4 Rate Limiting
**Current State:** No rate limiting implemented
- ⚠️ Critical: No rate limiting on authentication endpoints (brute force vulnerable)
- ⚠️ Critical: No rate limiting on expensive search/bulk operations
- ⚠️ Critical: No rate limiting on external API calls
- ℹ️ Info: External API rate limits configured but not enforced

### 3.5 Configuration Security
**File:** `/tcgtracker/src/tcgtracker/config.py`

**Security Strengths:**
- ✅ Secret key validation with length requirements
- ✅ Environment variable based configuration
- ✅ Insecure pattern detection in secret keys
- ✅ Proper URL encoding for database credentials

**Security Concerns:**
- ⚠️ Warning: CORS set to allow all origins ("*")
- ⚠️ Warning: Debug mode defaults could be insecure
- ⚠️ Warning: Default credentials in development settings

#### Price and Search Endpoints
**Files:** `/tcgtracker/src/tcgtracker/api/v1/prices.py`, `/tcgtracker/src/tcgtracker/api/v1/search.py`

**Validation Strengths:**
- ✅ Authentication required for all operations
- ✅ Card existence validation before price operations
- ✅ Background task integration for async operations
- ✅ Error handling with proper HTTP status codes
- ✅ Transaction management with rollback on errors

**Security Concerns:**
- ⚠️ Critical: External API calls without input sanitization
- ⚠️ Critical: No rate limiting on expensive operations (bulk updates, external searches)
- ⚠️ Warning: Direct exception message exposure in HTTP responses
- ⚠️ Warning: No timeout controls for external API calls
- ⚠️ Warning: Search query injection via ILIKE without sanitization
- ⚠️ Warning: Price alert logic lacks proper validation

## 4. Error Handling Analysis
**File:** `/tcgtracker/src/tcgtracker/utils/errors.py`

**Error Handling Strengths:**
- ✅ Comprehensive error classification system
- ✅ Exponential backoff with jitter for retries
- ✅ Structured logging with context
- ✅ HTTP status code classification
- ✅ Rate limit handling with retry-after headers
- ✅ Transient vs permanent error distinction

**Areas for Improvement:**
- ⚠️ Warning: Error messages might leak sensitive information
- ⚠️ Warning: No centralized error response formatting
- ⚠️ Info: Could benefit from error monitoring integration

## 5. Security Gaps and Vulnerabilities

### 5.1 Authentication & Session Management
- 🔴 **CRITICAL**: No rate limiting on login attempts (enables brute force attacks)
- 🔴 **CRITICAL**: Username field referenced but not defined in User model
- 🔴 **CRITICAL**: No account lockout or suspicious activity detection
- 🟠 **HIGH**: No session management or concurrent login tracking
- 🟠 **HIGH**: Refresh tokens not invalidated on logout
- 🟡 **MEDIUM**: Same error messages for different failure types (timing attacks)

### 5.2 Input Validation & Sanitization
- 🔴 **CRITICAL**: No input sanitization for user-generated content
- 🔴 **CRITICAL**: ILIKE queries vulnerable to SQL wildcards (% and _)
- 🟠 **HIGH**: Search queries not sanitized before external API calls
- 🟠 **HIGH**: URL fields lack validation (image_url, listing_url)
- 🟡 **MEDIUM**: Password validation only checks length, no complexity

### 5.3 API Security
- 🔴 **CRITICAL**: No rate limiting on expensive operations (search, bulk updates)
- 🔴 **CRITICAL**: CORS allows all origins ("*")
- 🟠 **HIGH**: No timeout controls for external API calls
- 🟠 **HIGH**: Exception messages exposed in HTTP responses
- 🟡 **MEDIUM**: No API versioning or deprecation strategy

### 5.4 Data Security
- 🟠 **HIGH**: API usage logs store sensitive data (IP, user agent)
- 🟠 **HIGH**: JSON fields lack structure validation (preferences, config)
- 🟡 **MEDIUM**: Text fields have no length limits (potential DoS)
- 🟡 **MEDIUM**: No data encryption for sensitive fields

### 5.5 Model Inconsistencies
- 🟠 **HIGH**: Schema/Model mismatches (username field, Price vs PriceHistory)
- 🟡 **MEDIUM**: Enum mismatches between schemas and models
- 🟡 **MEDIUM**: Missing foreign key validations in some endpoints

## 6. Recommendations

### 6.1 Immediate Actions (Critical Priority)
1. **Implement Rate Limiting**
   - Add rate limiting middleware for authentication endpoints
   - Implement per-user rate limits for expensive operations
   - Add IP-based rate limiting for anonymous endpoints

2. **Fix Authentication Vulnerabilities**
   - Add account lockout mechanism after failed attempts
   - Implement session management with concurrent login limits
   - Add refresh token blacklisting on logout
   - Fix username field definition in User model

3. **Secure CORS Configuration**
   - Replace wildcard CORS with specific allowed origins
   - Implement environment-based CORS configuration
   - Add CORS preflight caching

4. **Input Sanitization**
   - Add HTML/XSS sanitization for all text inputs
   - Implement SQL wildcard escaping for ILIKE queries
   - Add URL validation for image and listing URLs
   - Sanitize external API responses before storage

### 6.2 High Priority Actions
1. **Enhanced Validation**
   - Add custom Pydantic validators for complex fields
   - Implement password complexity requirements
   - Add length limits to all text fields
   - Validate JSON structure for preferences/config fields

2. **API Security Enhancements**
   - Add request/response timeout controls
   - Implement centralized error handling (avoid info leakage)
   - Add API versioning strategy
   - Implement request signing for sensitive operations

3. **Database Security**
   - Add CHECK constraints for business rule validation
   - Implement data encryption for sensitive fields
   - Review and minimize API usage logging data
   - Add audit logging for sensitive operations

### 6.3 Medium Priority Actions
1. **Monitoring & Observability**
   - Implement security event monitoring
   - Add suspicious activity detection
   - Integrate error monitoring service
   - Add performance monitoring for expensive operations

2. **Code Quality**
   - Resolve schema/model inconsistencies
   - Add comprehensive input validation tests
   - Implement security-focused code reviews
   - Add dependency vulnerability scanning

### 6.4 Long-term Improvements
1. **Advanced Security**
   - Implement OAuth2/OIDC integration
   - Add multi-factor authentication
   - Implement API key rotation
   - Add content security policies

2. **Performance & Scalability**
   - Implement caching strategies
   - Add database read replicas
   - Optimize expensive queries
   - Implement async task queuing

---
**Investigation completed on:** 2025-08-09  
**Risk Level:** 🟡 MODERATE RISK  
**Immediate Action Required:** Yes - Address critical authentication and input validation vulnerabilities