# TCG Price Tracker - Critical Issues Investigation Report

## Investigation Overview
Date: 2025-08-09
Investigator: Claude Code
Working Directory: /Users/tung/Development/tcg-price-tracker

## Critical Issues Under Investigation
1. Missing validation modules - tcgtracker.validation package is referenced but doesn't exist
2. Database field mismatch - password_hash vs hashed_password inconsistency 
3. SQL injection risk - Incomplete sanitization in card search
4. OAuth credential exposure - Credentials visible in logs

## Directory Structure Analysis
The validation directory DOES exist at: `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/validation/`
Files present:
- `__init__.py`
- `business_rules.py`
- `exceptions.py`
- `sanitizers.py`
- `validators.py`

**Initial Finding**: Issue #1 may be incorrect - validation modules appear to exist.

## File-by-File Investigation

### Files Investigated:

#### 1. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/__init__.py`
- **Lines**: 6 lines total
- **Imports**: Only imports from tcgtracker.api.v1
- **Issues Found**: None - simple module initialization
- **Validation References**: None

#### 2. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/dependencies.py`
- **Lines**: 107 lines total
- **Imports**: Standard auth dependencies (JWT, OAuth2, bcrypt)
- **Issues Found**: 
  - **CRITICAL**: Uses `hashed_password` parameter in `verify_password()` function (line 99-101)
  - **POTENTIAL CREDENTIAL EXPOSURE**: JWT tokens being decoded with secret key (lines 36-40)
- **Database Field References**: References `hashed_password` in function parameters
- **Validation References**: None

#### 3. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/schemas.py`
- **Lines**: 376 lines total
- **Imports**: Pydantic schemas with validators
- **Issues Found**: 
  - **CRITICAL**: Multiple imports from `tcgtracker.validation` package (lines 49, 62, 77, 133, 141, 165, 174, 209, 218)
  - **POTENTIAL SQL INJECTION**: Search sanitization relies on validation modules (lines 209, 218)
- **Database Field References**: None directly
- **Validation References**: **EXTENSIVE** - imports SecurityValidator, sanitize_card_name, sanitize_search_input

#### 4. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/v1/__init__.py`
- **Lines**: 23 lines total  
- **Imports**: Router imports from v1 modules
- **Issues Found**: Collections router is commented out (lines 8, 18) - "TODO: Fix collection models"
- **Database Field References**: None
- **Validation References**: None

#### 5. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/v1/auth.py`
- **Lines**: 161 lines total
- **Imports**: Authentication logic with database operations
- **Issues Found**:
  - **CRITICAL FIELD MISMATCH**: Creates User with `hashed_password` field (line 64)
  - **CRITICAL FIELD MISMATCH**: Accesses `user.hashed_password` (line 89)
  - **POTENTIAL CREDENTIAL EXPOSURE**: JWT token operations with secret key (lines 124-128)
- **Database Field References**: **CRITICAL** - Uses `hashed_password` consistently
- **Validation References**: None - relies on schema validation

#### 6. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/database/models.py`
- **Lines**: 396 lines total
- **Imports**: SQLAlchemy models and database schema
- **Issues Found**: 
  - **CRITICAL FIELD MISMATCH CONFIRMED**: User model defines `password_hash` field (line 98)
  - **INCONSISTENCY**: Auth code uses `hashed_password` but model defines `password_hash`
- **Database Field References**: **CRITICAL** - Model uses `password_hash` NOT `hashed_password`  
- **Validation References**: None

#### 7. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/validation/__init__.py`
- **Lines**: 39 lines total
- **Imports**: Comprehensive validation module exports
- **Issues Found**: None - proper module initialization
- **Database Field References**: None
- **Validation References**: Exports SecurityValidator, BusinessValidator, sanitize functions

#### 8. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/validation/validators.py`
- **Lines**: 165 lines total
- **Imports**: Comprehensive validation logic implementation
- **Issues Found**: None - validation functions properly implemented
- **Database Field References**: None
- **Validation References**: Implements SecurityValidator, BusinessValidator classes

#### 9. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/validation/sanitizers.py`
- **Lines**: 142 lines total
- **Imports**: Input sanitization and SQL injection prevention
- **Issues Found**: None - proper sanitization functions including SQL wildcard escaping
- **Database Field References**: None
- **Validation References**: Implements sanitize_search_input, sanitize_card_name, sanitize_sql_wildcards

#### 10. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/v1/search.py`
- **Lines**: 261 lines total  
- **Imports**: External API search functionality
- **Issues Found**:
  - **CRITICAL SQL INJECTION**: Direct query interpolation in ILIKE (line 250) - `Card.name.ilike(f"%{query}%")`
  - **NO SANITIZATION**: Raw query parameter used without calling sanitization functions
  - **VULNERABILITY**: get_search_suggestions endpoint vulnerable to SQL injection attacks
- **Database Field References**: None
- **Validation References**: None - missing validation/sanitization despite imports being available

#### 11. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/api/v1/cards.py`
- **Lines**: 253 lines total
- **Imports**: Card management with database operations
- **Issues Found**:
  - **GOOD PRACTICE**: Uses sanitize_search_input for search parameters (lines 103-119)
  - **INCONSISTENT**: Schema validation noted but still directly uses parameters in ILIKE queries
  - **POTENTIAL ISSUE**: Relies on schema sanitization but doesn't escape SQL wildcards in backend
- **Database Field References**: None
- **Validation References**: **GOOD** - imports and uses sanitize_search_input functions

#### 12. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/integrations/tcgplayer.py`
- **Lines**: 456 lines total
- **Imports**: TCGPlayer OAuth implementation
- **Issues Found**:
  - **POTENTIAL CREDENTIAL EXPOSURE**: Logs token info (lines 190-194) - "OAuth tokens stored" with expiration details
  - **POTENTIAL CREDENTIAL EXPOSURE**: Client credentials in initialization (lines 40-48)
  - **INFO DISCLOSURE**: Logs authentication failures and token refresh attempts (lines 163-167)
- **Database Field References**: None
- **Validation References**: None directly

#### 13. `/Users/tung/Development/tcg-price-tracker/tcgtracker/src/tcgtracker/config.py`
- **Lines**: 292 lines total
- **Imports**: Application configuration management  
- **Issues Found**: 
  - **POTENTIAL CREDENTIAL EXPOSURE**: Default insecure secret key with warning patterns (lines 150, 169-187)
  - **INFO DISCLOSURE**: Development credentials and URLs in default values
- **Database Field References**: Password hashing schemes configuration
- **Validation References**: Field validators for security settings

---

## CRITICAL ISSUES SUMMARY

### Issue #1: Missing Validation Modules
**Status**: ❌ **FALSE ALARM**
**Finding**: Validation modules exist and are properly implemented at `/tcgtracker/src/tcgtracker/validation/`

### Issue #2: Database Field Mismatch  
**Status**: ✅ **CONFIRMED CRITICAL**
**Finding**: 
- Database model defines `password_hash` field (models.py line 98)
- Auth code uses `hashed_password` field (auth.py lines 64, 89)
- **Impact**: Runtime errors during user registration and login

### Issue #3: SQL Injection Risk
**Status**: ✅ **CONFIRMED CRITICAL** 
**Finding**:
- Critical vulnerability in `/api/v1/search.py` line 250: `Card.name.ilike(f"%{query}%")`
- Raw query parameter directly interpolated without sanitization
- **Impact**: Full SQL injection attack vector through search suggestions endpoint

### Issue #4: OAuth Credential Exposure
**Status**: ✅ **CONFIRMED MEDIUM**
**Finding**:
- TCGPlayer integration logs OAuth token details (tcgplayer.py lines 190-194)
- Authentication failures logged with sensitive context (lines 163-167)
- Default insecure secret key with development patterns (config.py)
- **Impact**: Credentials could be exposed in application logs

## AFFECTED FILES REQUIRING IMMEDIATE ATTENTION

1. **`/tcgtracker/src/tcgtracker/api/v1/auth.py`** - Fix field name from `hashed_password` to `password_hash`
2. **`/tcgtracker/src/tcgtracker/api/v1/search.py`** - Add sanitization to search suggestions endpoint 
3. **`/tcgtracker/src/tcgtracker/integrations/tcgplayer.py`** - Remove or redact sensitive credential logging
4. **`/tcgtracker/src/tcgtracker/config.py`** - Ensure secure defaults for production