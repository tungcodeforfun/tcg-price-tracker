# TCG Price Tracker - System Architecture & Flow Analysis Report

## 1. System Overview

The TCG Price Tracker is designed as a comprehensive platform for monitoring Pokemon and One Piece trading card prices across multiple data sources. The system follows a microservices architecture with clear separation of concerns and scalable data processing pipelines.

### Core Objectives
- Real-time price monitoring from multiple sources (TCGPlayer, eBay)
- Historical price data analysis and trend tracking
- Support for different TCG card identification systems
- Scalable data ingestion and processing
- User authentication and personalized alerts
- API-first architecture for extensibility

## 2. High-Level System Architecture

### 2.1 Architecture Overview
The system employs a layered microservices architecture with the following components:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Authentication  │  Rate Limiting  │  Request Routing      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Application Services                       │
├─────────────────────────────────────────────────────────────┤
│  Price Service  │  Card Service  │  User Service  │ Alert  │
│                 │                 │                │Service │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Data Processing Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Data Collectors │  Price Analyzer │  Trend Calculator     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Data Storage Layer                      │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL     │   Redis Cache   │   Time Series DB      │
│  (Core Data)    │   (Sessions)    │   (Price History)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 External Integrations
- TCGPlayer API (OAuth authentication)
- eBay Browse API (User Access Tokens)
- Notification services (email, push notifications)

## 3. Data Flow Architecture

### 3.1 Price Data Ingestion Flow

```
External APIs → Data Collectors → Message Queue → Price Processor → Database
     │               │               │              │               │
TCGPlayer API    Collector Service  RabbitMQ    Price Service   PostgreSQL
eBay API         (Scheduled)        (Buffer)    (Validation)    (Storage)
                                                                      │
                                                               Time Series DB
                                                              (Price History)
```

### 3.2 Real-time Price Monitoring Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Scheduler     │───→│  Data Collector  │───→│  Message Queue  │
│ (Cron/Celery)   │    │    Services      │    │   (RabbitMQ)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Alert Engine │←───│  Price Processor │←───│  Queue Consumer │
│                 │    │   (Validation,   │    │                 │
└─────────────────┘    │   Normalization) │    └─────────────────┘
         │              └──────────────────┘              │
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Notification   │    │    Database      │    │   Cache Layer   │
│    Service      │    │   (PostgreSQL +  │    │    (Redis)      │
└─────────────────┘    │  Time Series)    │    └─────────────────┘
                       └──────────────────┘
```

### 3.3 Card Data Normalization Flow

The system handles different card identification schemas:

#### Pokemon TCG Flow:
```
TCGPlayer/eBay → Card Parser → Schema Normalizer → Unified Card Model
Raw Data         Extracts:     Creates:           Stores:
                - Set Code     - Standard ID      - card_id
                - Card #       - Normalized Name  - tcg_type: 'pokemon'
                - Rarity       - Rarity Level     - set_identifier
                - Name         - Price Points     - card_number
```

#### One Piece TCG Flow:
```
TCGPlayer/eBay → Card Parser → Schema Normalizer → Unified Card Model
Raw Data         Extracts:     Creates:           Stores:
                - Set Prefix   - Standard ID      - card_id
                - Set Number   - Normalized Name  - tcg_type: 'onepiece'
                - Card #       - Rarity Level     - set_identifier
                - Rarity       - Price Points     - card_number
```

## 4. Database Schema Design

### 4.1 Core Entity Relationship Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Users      │    │      Cards      │    │   Price_History │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ email           │◄──┐│ tcg_type        │◄──┐│ card_id (FK)    │
│ password_hash   │   ││ set_identifier  │   ││ source          │
│ created_at      │   ││ card_number     │   ││ price_low       │
│ is_active       │   ││ card_name       │   ││ price_high      │
│ preferences     │   ││ rarity          │   ││ price_avg       │
└─────────────────┘   ││ image_url       │   ││ market_price    │
         │            ││ created_at      │   ││ timestamp       │
         │            ││ updated_at      │   ││ condition       │
         │            └─────────────────┘   │└─────────────────┘
         │                     │            │
         │                     │            │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User_Alerts   │    │   TCG_Sets      │    │   Data_Sources  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ user_id (FK)    ├───┘│ tcg_type        │    │ name            │
│ card_id (FK)    ├────┤ set_code        │    │ api_endpoint    │
│ price_threshold │     │ set_name        │    │ auth_method     │
│ alert_type      │     │ release_date    │    │ rate_limit      │
│ is_active       │     │ total_cards     │    │ last_updated    │
│ created_at      │     └─────────────────┘    │ is_active       │
└─────────────────┘                            └─────────────────┘
```

### 4.2 Detailed Table Specifications

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    api_key VARCHAR(64) UNIQUE
);
```

#### Cards Table
```sql
CREATE TABLE cards (
    id SERIAL PRIMARY KEY,
    tcg_type VARCHAR(20) NOT NULL CHECK (tcg_type IN ('pokemon', 'onepiece')),
    set_identifier VARCHAR(50) NOT NULL, -- e.g., 'ZSV10PT5', 'ST-22', 'OP-12'
    card_number VARCHAR(20) NOT NULL,
    card_name VARCHAR(255) NOT NULL,
    rarity VARCHAR(50),
    image_url TEXT,
    tcgplayer_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tcg_type, set_identifier, card_number),
    INDEX idx_cards_tcg_set (tcg_type, set_identifier),
    INDEX idx_cards_name (card_name),
    INDEX idx_cards_rarity (rarity)
);
```

#### Price_History Table (Optimized for Time Series)
```sql
CREATE TABLE price_history (
    id BIGSERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id),
    source VARCHAR(50) NOT NULL, -- 'tcgplayer', 'ebay'
    price_low DECIMAL(10,2),
    price_high DECIMAL(10,2),
    price_avg DECIMAL(10,2),
    market_price DECIMAL(10,2),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    condition VARCHAR(20) DEFAULT 'near_mint',
    currency VARCHAR(3) DEFAULT 'USD',
    sample_size INTEGER,
    
    INDEX idx_price_history_card_time (card_id, timestamp DESC),
    INDEX idx_price_history_source (source),
    PARTITION BY RANGE (timestamp)
);

-- Create monthly partitions for better performance
CREATE TABLE price_history_y2024m01 PARTITION OF price_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- (Additional partitions would be created dynamically)
```

#### User_Alerts Table
```sql
CREATE TABLE user_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    card_id INTEGER NOT NULL REFERENCES cards(id),
    price_threshold DECIMAL(10,2) NOT NULL,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('price_drop', 'price_increase', 'availability')),
    comparison_operator VARCHAR(5) NOT NULL CHECK (comparison_operator IN ('<=', '>=', '=', '<', '>')),
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_alerts_user (user_id),
    INDEX idx_user_alerts_card (card_id),
    INDEX idx_user_alerts_active (is_active)
);
```

#### TCG_Sets Table
```sql
CREATE TABLE tcg_sets (
    id SERIAL PRIMARY KEY,
    tcg_type VARCHAR(20) NOT NULL CHECK (tcg_type IN ('pokemon', 'onepiece')),
    set_code VARCHAR(50) NOT NULL,
    set_name VARCHAR(255) NOT NULL,
    release_date DATE,
    total_cards INTEGER,
    series VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tcg_type, set_code),
    INDEX idx_tcg_sets_type (tcg_type),
    INDEX idx_tcg_sets_release (release_date)
);
```

#### Data_Sources Table
```sql
CREATE TABLE data_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    api_endpoint TEXT NOT NULL,
    auth_method VARCHAR(20) NOT NULL,
    rate_limit_per_minute INTEGER,
    rate_limit_per_hour INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',
    
    INDEX idx_data_sources_active (is_active)
);
```

### 4.3 Database Relationships Summary
- **Users** ↔ **User_Alerts** (One-to-Many)
- **Cards** ↔ **Price_History** (One-to-Many)
- **Cards** ↔ **User_Alerts** (One-to-Many)
- **TCG_Sets** ↔ **Cards** (One-to-Many via set_identifier)

## 5. API Endpoint Specifications

### 5.1 API Architecture Overview

The system provides a RESTful API with the following base structure:
- **Base URL**: `https://api.tcgpricetracker.com/v1`
- **Authentication**: JWT tokens + API keys
- **Response Format**: JSON with consistent error handling
- **Rate Limiting**: 1000 requests/hour per user, 100/minute burst

### 5.2 Authentication Endpoints

#### POST /auth/register
```json
Request:
{
    "email": "user@example.com",
    "password": "securePassword123",
    "first_name": "John",
    "last_name": "Doe"
}

Response (201):
{
    "user_id": 123,
    "email": "user@example.com",
    "api_key": "tk_1234567890abcdef",
    "email_verification_sent": true
}
```

#### POST /auth/login
```json
Request:
{
    "email": "user@example.com",
    "password": "securePassword123"
}

Response (200):
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600,
    "user": {
        "id": 123,
        "email": "user@example.com",
        "first_name": "John",
        "api_key": "tk_1234567890abcdef"
    }
}
```

### 5.3 Card Management Endpoints

#### GET /cards/search
```json
Query Parameters:
- q: Search query (card name)
- tcg_type: 'pokemon' | 'onepiece'
- set_identifier: Filter by set
- rarity: Filter by rarity
- limit: Max results (default: 20, max: 100)
- offset: Pagination offset

Response (200):
{
    "cards": [
        {
            "id": 1,
            "tcg_type": "pokemon",
            "set_identifier": "ZSV10PT5",
            "card_number": "001",
            "card_name": "Pikachu ex",
            "rarity": "Rare Holo ex",
            "image_url": "https://images.tcgplayer.com/...",
            "current_price": {
                "market_price": 45.99,
                "low_price": 39.99,
                "high_price": 52.99,
                "last_updated": "2024-01-15T10:30:00Z"
            }
        }
    ],
    "pagination": {
        "total": 150,
        "limit": 20,
        "offset": 0,
        "has_more": true
    }
}
```

#### GET /cards/{card_id}
```json
Response (200):
{
    "id": 1,
    "tcg_type": "pokemon",
    "set_identifier": "ZSV10PT5",
    "card_number": "001",
    "card_name": "Pikachu ex",
    "rarity": "Rare Holo ex",
    "image_url": "https://images.tcgplayer.com/...",
    "set_info": {
        "set_name": "Scarlet & Violet Black Bolt",
        "release_date": "2024-01-12",
        "total_cards": 200
    },
    "price_stats": {
        "current_market_price": 45.99,
        "price_range": {
            "low": 39.99,
            "high": 52.99
        },
        "30_day_change": {
            "amount": -2.50,
            "percentage": -5.1
        },
        "all_time_high": 65.00,
        "all_time_low": 35.00
    }
}
```

### 5.4 Price Data Endpoints

#### GET /cards/{card_id}/prices/history
```json
Query Parameters:
- period: '7d' | '30d' | '3m' | '1y' | 'all'
- source: 'tcgplayer' | 'ebay' | 'all'
- condition: 'near_mint' | 'lightly_played' | etc.

Response (200):
{
    "card_id": 1,
    "period": "30d",
    "data_points": [
        {
            "timestamp": "2024-01-15T00:00:00Z",
            "market_price": 45.99,
            "low_price": 39.99,
            "high_price": 52.99,
            "source": "tcgplayer",
            "sample_size": 25
        }
    ],
    "summary": {
        "avg_price": 47.25,
        "volatility": 0.12,
        "trend": "decreasing",
        "change_percentage": -5.1
    }
}
```

#### GET /prices/trending
```json
Query Parameters:
- tcg_type: 'pokemon' | 'onepiece'
- trend_type: 'gainers' | 'losers' | 'most_watched'
- period: '24h' | '7d' | '30d'
- limit: Max results (default: 10, max: 50)

Response (200):
{
    "trending_cards": [
        {
            "card": {
                "id": 1,
                "card_name": "Pikachu ex",
                "set_identifier": "ZSV10PT5",
                "image_url": "https://images.tcgplayer.com/..."
            },
            "price_change": {
                "current_price": 45.99,
                "previous_price": 38.50,
                "change_amount": 7.49,
                "change_percentage": 19.5
            },
            "volume": 142
        }
    ]
}
```

### 5.5 Alert Management Endpoints

#### POST /alerts
```json
Request:
{
    "card_id": 1,
    "price_threshold": 40.00,
    "alert_type": "price_drop",
    "comparison_operator": "<="
}

Response (201):
{
    "alert_id": 456,
    "card_id": 1,
    "price_threshold": 40.00,
    "alert_type": "price_drop",
    "comparison_operator": "<=",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### GET /alerts
```json
Response (200):
{
    "alerts": [
        {
            "id": 456,
            "card": {
                "id": 1,
                "card_name": "Pikachu ex",
                "current_price": 45.99
            },
            "price_threshold": 40.00,
            "alert_type": "price_drop",
            "is_active": true,
            "last_triggered": null,
            "created_at": "2024-01-15T10:30:00Z"
        }
    ]
}
```

### 5.6 TCG Sets Endpoints

#### GET /sets
```json
Query Parameters:
- tcg_type: 'pokemon' | 'onepiece'
- limit: Max results (default: 20)
- offset: Pagination offset

Response (200):
{
    "sets": [
        {
            "id": 1,
            "tcg_type": "pokemon",
            "set_code": "ZSV10PT5",
            "set_name": "Scarlet & Violet Black Bolt",
            "release_date": "2024-01-12",
            "total_cards": 200,
            "series": "Scarlet & Violet"
        }
    ]
}
```

### 5.7 Error Response Format
```json
{
    "error": {
        "code": "CARD_NOT_FOUND",
        "message": "The requested card could not be found",
        "details": {
            "card_id": 999
        },
        "timestamp": "2024-01-15T10:30:00Z"
    }
}
```

### 5.8 Authentication Flow

```
Client Registration Flow:
1. POST /auth/register → User created, email verification sent
2. GET /auth/verify/{token} → Email verified
3. POST /auth/login → JWT tokens returned

API Usage Flow:
1. Include JWT token in Authorization header: "Bearer {token}"
2. Or use API key in header: "X-API-Key: {api_key}"
3. Token expires in 1 hour, refresh with refresh_token

Rate Limiting Headers:
- X-RateLimit-Limit: 1000
- X-RateLimit-Remaining: 999
- X-RateLimit-Reset: 1642248600
```

## 6. Microservices Architecture & Service Boundaries

### 6.1 Service Decomposition Strategy

The system is organized into domain-driven microservices with clear responsibilities:

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Rate Limit  │ │    Auth     │ │   Routing   │ │   Logging   ││
│  │   Module    │ │   Module    │ │   Module    │ │   Module    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│User Service │ │Card Service │ │Price Service│ │Alert Service│
│             │ │             │ │             │ │             │
│ - Auth      │ │ - Catalog   │ │ - History   │ │ - Rules     │
│ - Profile   │ │ - Search    │ │ - Analytics │ │ - Triggers  │
│ - Sessions  │ │ - Metadata  │ │ - Trends    │ │ - Delivery  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│PostgreSQL   │ │PostgreSQL   │ │TimeSeriesDB │ │PostgreSQL   │
│(Users)      │ │(Cards/Sets) │ │(Prices)     │ │(Alerts)     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Background Services                          │
├─────────────┬─────────────┬─────────────┬─────────────────────────┤
│Data Collect │ Notification│ Analytics   │       Message Queue     │
│  Service    │   Service   │  Service    │       (RabbitMQ)        │
│             │             │             │                         │
│- TCGPlayer  │- Email      │- Trends     │- Price Updates          │
│- eBay API   │- Push       │- Volatility │- Alert Events           │
│- Scheduling │- SMS        │- Forecasts  │- User Events            │
└─────────────┴─────────────┴─────────────┴─────────────────────────┘
```

### 6.2 Individual Service Specifications

#### 6.2.1 User Service
**Responsibilities:**
- User registration, authentication, and profile management
- JWT token generation and validation
- API key management
- User preferences and settings

**Technology Stack:**
- **Language**: Python (FastAPI)
- **Database**: PostgreSQL
- **Cache**: Redis (sessions, JWT blacklist)
- **External**: Email service integration

**API Endpoints:**
- `/auth/*` - Authentication endpoints
- `/users/*` - User profile management
- `/preferences/*` - User preferences

**Database Tables:**
- `users`
- `user_sessions`
- `password_resets`

#### 6.2.2 Card Service
**Responsibilities:**
- Card catalog management
- TCG set information
- Card search and metadata
- Image and card data normalization

**Technology Stack:**
- **Language**: Python (FastAPI)
- **Database**: PostgreSQL with full-text search
- **Cache**: Redis (search results, popular cards)
- **External**: Image storage (S3/CloudFlare)

**API Endpoints:**
- `/cards/*` - Card operations
- `/sets/*` - TCG set management
- `/search/*` - Advanced search functionality

**Database Tables:**
- `cards`
- `tcg_sets`
- `card_images`

#### 6.2.3 Price Service
**Responsibilities:**
- Price data storage and retrieval
- Historical price analysis
- Trend calculations and analytics
- Price statistics computation

**Technology Stack:**
- **Language**: Python (FastAPI + NumPy/Pandas)
- **Database**: InfluxDB (time series) + PostgreSQL (metadata)
- **Cache**: Redis (recent prices, calculated stats)
- **Processing**: Celery for analytics tasks

**API Endpoints:**
- `/prices/*` - Price data access
- `/analytics/*` - Price analytics and trends
- `/history/*` - Historical data queries

**Database Tables:**
- `price_history` (partitioned)
- `price_statistics`
- `trend_calculations`

#### 6.2.4 Alert Service
**Responsibilities:**
- User alert management
- Price threshold monitoring
- Alert trigger evaluation
- Notification dispatching

**Technology Stack:**
- **Language**: Python (FastAPI)
- **Database**: PostgreSQL
- **Queue**: RabbitMQ (alert events)
- **Scheduler**: Celery Beat

**API Endpoints:**
- `/alerts/*` - Alert management
- `/notifications/*` - Notification history

**Database Tables:**
- `user_alerts`
- `alert_history`
- `notification_log`

### 6.3 Inter-Service Communication Patterns

#### 6.3.1 Synchronous Communication (REST API)
```
User Service ←→ Card Service (user preferences for card recommendations)
Card Service ←→ Price Service (card metadata for price displays)
Alert Service ←→ Price Service (current prices for threshold checking)
```

#### 6.3.2 Asynchronous Communication (Message Queue)
```
Data Collector → Price Service: New price data events
Price Service → Alert Service: Price change notifications  
Alert Service → Notification Service: Alert trigger events
User Service → Alert Service: User preference changes
```

#### 6.3.3 Event Schema Examples

**Price Update Event:**
```json
{
    "event_type": "price_updated",
    "card_id": 123,
    "source": "tcgplayer",
    "old_price": 45.99,
    "new_price": 42.50,
    "timestamp": "2024-01-15T10:30:00Z",
    "metadata": {
        "condition": "near_mint",
        "sample_size": 25
    }
}
```

**Alert Triggered Event:**
```json
{
    "event_type": "alert_triggered",
    "alert_id": 456,
    "user_id": 123,
    "card_id": 789,
    "threshold": 40.00,
    "current_price": 39.99,
    "alert_type": "price_drop",
    "timestamp": "2024-01-15T10:35:00Z"
}
```

### 6.4 Data Consistency Strategy

#### 6.4.1 Eventual Consistency
- Price updates propagate asynchronously to all services
- User preference changes eventually affect recommendations
- Alert evaluations use eventually consistent price data

#### 6.4.2 Strong Consistency (Where Required)
- User authentication and authorization
- Financial transactions (if implemented)
- Critical alert configurations

#### 6.4.3 Saga Pattern for Distributed Transactions
```
User Alert Creation Saga:
1. Alert Service: Create alert record
2. Price Service: Subscribe to price updates for card
3. Notification Service: Setup notification preferences
4. Rollback: If any step fails, compensate previous steps
```

## 7. External Integration Patterns

### 7.1 TCGPlayer API Integration

#### 7.1.1 Authentication Flow
```
TCGPlayer OAuth Implementation:

1. Application Registration:
   - Register app with TCGPlayer Developer Portal
   - Obtain Client ID and Client Secret
   - Configure redirect URLs

2. Authorization Code Flow:
   POST https://api.tcgplayer.com/app/authorize/{authCode}
   Headers: {
       "Authorization": "Bearer {clientId}:{clientSecret}",
       "Content-Type": "application/json"
   }
   
3. Token Management:
   - Store access tokens securely (encrypted)
   - Implement automatic token refresh
   - Handle token expiration gracefully
```

#### 7.1.2 Data Collection Integration
```python
# TCGPlayer Service Implementation Pattern
class TCGPlayerService:
    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        self.token_expires = None
    
    async def authenticate(self):
        """Obtain access token using authorization code"""
        # Implementation for OAuth flow
        
    async def get_product_prices(self, product_ids):
        """Fetch current pricing for products"""
        endpoint = f"/pricing/product/{','.join(product_ids)}"
        return await self._make_request('GET', endpoint)
    
    async def search_products(self, query, category_id=None):
        """Search for products in catalog"""
        params = {"q": query}
        if category_id:
            params["categoryId"] = category_id
        return await self._make_request('GET', "/catalog/products", params=params)
```

### 7.2 eBay Browse API Integration

#### 7.2.1 Authentication Pattern
```
eBay User Access Token Flow:

1. Application Registration:
   - Create app in eBay Developer Program
   - Configure OAuth redirect URI
   - Obtain App ID (Client ID) and Client Secret

2. Token Acquisition:
   POST https://api.ebay.com/identity/v1/oauth2/token
   Headers: {
       "Content-Type": "application/x-www-form-urlencoded",
       "Authorization": "Basic {base64(clientId:clientSecret)}"
   }
   Body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"

3. Token Refresh Strategy:
   - Tokens valid for 7200 seconds (2 hours)
   - Implement proactive refresh 15 minutes before expiry
   - Cache tokens in Redis with TTL
```

#### 7.2.2 Price Data Collection
```python
# eBay Service Implementation Pattern
class EBayService:
    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        
    async def search_items(self, query, category_id=None, price_range=None):
        """Search for items using Browse API"""
        params = {
            "q": query,
            "limit": 200,  # Max allowed
            "sort": "price"
        }
        
        if category_id:
            params["category_ids"] = category_id
            
        if price_range:
            params["filter"] = f"price:[{price_range['min']}..{price_range['max']}]"
            
        endpoint = "/buy/browse/v1/item_summary/search"
        return await self._make_request('GET', endpoint, params=params)
    
    async def get_item_details(self, item_ids):
        """Get detailed item information"""
        endpoint = f"/buy/browse/v1/item/{','.join(item_ids)}"
        return await self._make_request('GET', endpoint)
```

### 7.3 Data Integration Pipeline

#### 7.3.1 Unified Data Collection Architecture
```
Scheduled Data Collection Flow:

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Scheduler     │───→│ Data Collector  │───→│  Message Queue  │
│  (Celery Beat)  │    │   Orchestrator  │    │   (RabbitMQ)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│TCGPlayer Client │    │  eBay Client    │    │ Price Processor │
│                 │    │                 │    │                 │
│- Rate limited   │    │- Rate limited   │    │- Data validation│
│- Retry logic    │    │- Retry logic    │    │- Normalization  │
│- Error handling │    │- Error handling │    │- Deduplication  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### 7.3.2 Rate Limiting and Resilience
```python
# Rate Limiting Implementation
class RateLimitedClient:
    def __init__(self, requests_per_minute=60):
        self.rate_limit = requests_per_minute
        self.request_times = []
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            reset_timeout=300
        )
    
    async def make_request(self, method, url, **kwargs):
        # Rate limiting logic
        await self._enforce_rate_limit()
        
        # Circuit breaker pattern
        try:
            async with self.circuit_breaker:
                response = await self._execute_request(method, url, **kwargs)
                return response
        except CircuitBreakerOpenError:
            logger.warning("Circuit breaker open, request rejected")
            raise
```

### 7.4 Authentication & Security Architecture

#### 7.4.1 Multi-Layer Security Model
```
Security Layers:

┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                             │
├─────────────────────────────────────────────────────────────┤
│ • Rate Limiting (IP + User based)                          │
│ • DDoS Protection                                           │ 
│ • Request Validation                                        │
│ • SSL/TLS Termination                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Authentication Layer                         │
├─────────────────────────────────────────────────────────────┤
│ • JWT Token Validation                                      │
│ • API Key Authentication                                    │
│ • Session Management                                        │
│ • Multi-Factor Authentication (Future)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Authorization Layer                          │
├─────────────────────────────────────────────────────────────┤
│ • Role-Based Access Control (RBAC)                         │
│ • Resource-Level Permissions                               │
│ • User Context Validation                                  │
└─────────────────────────────────────────────────────────────┘
```

#### 7.4.2 JWT Token Security Implementation
```python
# JWT Security Configuration
JWT_SETTINGS = {
    "algorithm": "RS256",  # RSA with SHA-256
    "access_token_expire": 3600,  # 1 hour
    "refresh_token_expire": 2592000,  # 30 days
    "issuer": "tcg-price-tracker",
    "audience": "api-users"
}

class JWTManager:
    def __init__(self, private_key, public_key):
        self.private_key = private_key
        self.public_key = public_key
        self.blacklist = RedisTokenBlacklist()
    
    def create_access_token(self, user_id, scopes=[]):
        payload = {
            "sub": str(user_id),
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(seconds=JWT_SETTINGS["access_token_expire"]),
            "iss": JWT_SETTINGS["issuer"],
            "aud": JWT_SETTINGS["audience"],
            "scopes": scopes,
            "jti": str(uuid4())  # JWT ID for blacklisting
        }
        return jwt.encode(payload, self.private_key, algorithm=JWT_SETTINGS["algorithm"])
    
    async def validate_token(self, token):
        try:
            # Check blacklist first
            if await self.blacklist.is_blacklisted(token):
                raise InvalidTokenError("Token has been revoked")
            
            payload = jwt.decode(
                token, 
                self.public_key, 
                algorithms=[JWT_SETTINGS["algorithm"]],
                issuer=JWT_SETTINGS["issuer"],
                audience=JWT_SETTINGS["audience"]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise InvalidTokenError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise InvalidTokenError(f"Invalid token: {str(e)}")
```

#### 7.4.3 API Key Management
```python
class APIKeyManager:
    def __init__(self):
        self.redis_client = Redis()
        
    def generate_api_key(self, user_id, name="default"):
        """Generate a new API key for user"""
        key_id = str(uuid4())
        api_key = f"tk_{secrets.token_urlsafe(32)}"
        
        key_data = {
            "user_id": user_id,
            "name": name,
            "created_at": datetime.utcnow().isoformat(),
            "last_used": None,
            "is_active": True,
            "rate_limit": 1000  # requests per hour
        }
        
        # Store in Redis with user mapping
        self.redis_client.hset(f"api_key:{api_key}", mapping=key_data)
        self.redis_client.sadd(f"user_keys:{user_id}", api_key)
        
        return api_key
    
    async def validate_api_key(self, api_key):
        """Validate and return user context for API key"""
        key_data = self.redis_client.hgetall(f"api_key:{api_key}")
        
        if not key_data or not key_data.get("is_active"):
            raise InvalidAPIKeyError("Invalid or inactive API key")
        
        # Update last used timestamp
        self.redis_client.hset(f"api_key:{api_key}", "last_used", datetime.utcnow().isoformat())
        
        return {
            "user_id": int(key_data["user_id"]),
            "rate_limit": int(key_data["rate_limit"])
        }
```

### 7.5 Data Security and Privacy

#### 7.5.1 Data Encryption Strategy
- **At Rest**: AES-256 encryption for sensitive data (passwords, tokens)
- **In Transit**: TLS 1.3 for all communications
- **Database**: Transparent data encryption for PostgreSQL
- **Secrets**: HashiCorp Vault for API keys and credentials

#### 7.5.2 Privacy Compliance
- **GDPR Compliance**: Right to deletion, data portability
- **User Consent**: Explicit consent for data collection and processing
- **Data Minimization**: Only collect necessary user data
- **Audit Logging**: Track all access to personal data

## 8. Caching & Performance Optimization

### 8.1 Multi-Tier Caching Architecture

```
Caching Strategy Layers:

┌─────────────────────────────────────────────────────────────┐
│                        CDN Layer                            │
├─────────────────────────────────────────────────────────────┤
│ • Static content (images, CSS, JS)                         │
│ • API response caching for anonymous users                 │
│ • Geographic distribution                                   │
│ TTL: 24 hours for static, 5 minutes for API               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Cache                          │
├─────────────────────────────────────────────────────────────┤
│ • Redis Cluster (3 master nodes, 3 replica)              │
│ • API response caching                                     │
│ • Session storage                                          │
│ • Hot price data                                           │
│ TTL: 1-60 minutes depending on data type                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Cache                             │
├─────────────────────────────────────────────────────────────┤
│ • PostgreSQL query cache                                   │
│ • Connection pooling                                       │
│ • Read replicas for query distribution                    │
│ • Materialized views for complex queries                  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Redis Caching Implementation

#### 8.2.1 Cache Key Strategy
```python
class CacheKeyBuilder:
    """Standardized cache key generation"""
    
    @staticmethod
    def card_price_history(card_id: int, period: str, source: str = "all"):
        """Generate key for price history data"""
        return f"price_history:{card_id}:{period}:{source}"
    
    @staticmethod
    def card_search_results(query: str, tcg_type: str, filters: dict):
        """Generate key for search results"""
        filter_hash = hashlib.md5(json.dumps(filters, sort_keys=True).encode()).hexdigest()
        return f"search:{tcg_type}:{hashlib.md5(query.encode()).hexdigest()}:{filter_hash}"
    
    @staticmethod
    def trending_cards(tcg_type: str, period: str, trend_type: str):
        """Generate key for trending cards"""
        return f"trending:{tcg_type}:{period}:{trend_type}"
    
    @staticmethod
    def user_alerts(user_id: int):
        """Generate key for user alerts"""
        return f"user_alerts:{user_id}"
```

#### 8.2.2 Cache Management Service
```python
class CacheManager:
    def __init__(self, redis_cluster):
        self.redis = redis_cluster
        self.default_ttl = 300  # 5 minutes
        
    async def get_or_compute(self, key: str, compute_func, ttl: int = None):
        """Get from cache or compute and store"""
        try:
            # Try to get from cache first
            cached_data = await self.redis.get(key)
            if cached_data:
                return json.loads(cached_data)
            
            # Compute the data
            data = await compute_func()
            
            # Store in cache
            ttl = ttl or self.default_ttl
            await self.redis.setex(key, ttl, json.dumps(data, default=str))
            
            return data
            
        except Exception as e:
            logger.error(f"Cache error for key {key}: {e}")
            # Fallback to direct computation
            return await compute_func()
    
    async def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern"""
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)
            logger.info(f"Invalidated {len(keys)} keys matching {pattern}")
```

#### 8.2.3 Smart Cache Warming
```python
class CacheWarmer:
    """Pre-populate cache with frequently accessed data"""
    
    def __init__(self, cache_manager, price_service, card_service):
        self.cache = cache_manager
        self.price_service = price_service
        self.card_service = card_service
    
    async def warm_popular_cards(self):
        """Pre-cache data for most popular cards"""
        # Get top 100 most searched cards
        popular_cards = await self.card_service.get_popular_cards(limit=100)
        
        for card in popular_cards:
            # Warm price history for common periods
            for period in ['7d', '30d', '3m']:
                key = CacheKeyBuilder.card_price_history(card['id'], period)
                await self.cache.get_or_compute(
                    key,
                    lambda: self.price_service.get_price_history(card['id'], period),
                    ttl=1800  # 30 minutes
                )
    
    async def warm_trending_data(self):
        """Pre-cache trending cards data"""
        for tcg_type in ['pokemon', 'onepiece']:
            for trend_type in ['gainers', 'losers']:
                for period in ['24h', '7d']:
                    key = CacheKeyBuilder.trending_cards(tcg_type, period, trend_type)
                    await self.cache.get_or_compute(
                        key,
                        lambda: self.price_service.get_trending_cards(
                            tcg_type, trend_type, period
                        ),
                        ttl=900  # 15 minutes
                    )
```

### 8.3 Database Performance Optimization

#### 8.3.1 Indexing Strategy
```sql
-- Primary indexes for core tables
CREATE INDEX CONCURRENTLY idx_cards_search ON cards USING GIN(
    to_tsvector('english', card_name || ' ' || COALESCE(rarity, ''))
);

CREATE INDEX CONCURRENTLY idx_cards_tcg_type_set ON cards(tcg_type, set_identifier);
CREATE INDEX CONCURRENTLY idx_cards_popularity ON cards(search_count DESC) WHERE search_count > 0;

-- Price history optimization
CREATE INDEX CONCURRENTLY idx_price_history_card_recent ON price_history(
    card_id, timestamp DESC
) WHERE timestamp > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY idx_price_history_trending ON price_history(
    timestamp DESC, 
    CASE WHEN price_low > 0 THEN (market_price - price_low) / price_low ELSE 0 END DESC
) WHERE timestamp > NOW() - INTERVAL '7 days';

-- Alert processing optimization
CREATE INDEX CONCURRENTLY idx_user_alerts_active ON user_alerts(
    card_id, price_threshold, comparison_operator
) WHERE is_active = true;

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_cards_type_rarity_price ON cards(tcg_type, rarity)
INCLUDE (card_name, set_identifier);
```

#### 8.3.2 Database Connection Management
```python
class DatabaseManager:
    def __init__(self, config):
        self.write_pool = self._create_pool(config['write_db'], pool_size=20)
        self.read_pool = self._create_pool(config['read_db'], pool_size=50)
        
    async def _create_pool(self, db_config, pool_size):
        return await asyncpg.create_pool(
            host=db_config['host'],
            port=db_config['port'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            min_size=pool_size // 4,
            max_size=pool_size,
            command_timeout=30,
            server_settings={
                'application_name': 'tcg_price_tracker',
                'tcp_keepalives_idle': '600',
                'tcp_keepalives_interval': '30',
                'tcp_keepalives_count': '3',
            }
        )
    
    async def execute_read(self, query, *args):
        """Execute read-only query on read replica"""
        async with self.read_pool.acquire() as conn:
            return await conn.fetch(query, *args)
    
    async def execute_write(self, query, *args):
        """Execute write query on master"""
        async with self.write_pool.acquire() as conn:
            return await conn.execute(query, *args)
```

#### 8.3.3 Query Optimization Patterns
```python
class OptimizedQueries:
    """Pre-compiled and optimized database queries"""
    
    # Prepared statements for frequent queries
    GET_CARD_WITH_PRICE = """
        SELECT c.*, 
               ph.market_price,
               ph.timestamp as price_updated_at
        FROM cards c
        LEFT JOIN LATERAL (
            SELECT market_price, timestamp
            FROM price_history ph2 
            WHERE ph2.card_id = c.id 
            ORDER BY timestamp DESC 
            LIMIT 1
        ) ph ON true
        WHERE c.id = $1
    """
    
    SEARCH_CARDS_OPTIMIZED = """
        SELECT c.id, c.card_name, c.set_identifier, c.rarity,
               ts_rank(search_vector, plainto_tsquery($1)) as rank,
               ph.market_price
        FROM cards c
        LEFT JOIN LATERAL (
            SELECT market_price 
            FROM price_history ph2 
            WHERE ph2.card_id = c.id 
            ORDER BY timestamp DESC 
            LIMIT 1
        ) ph ON true
        WHERE ($2::text IS NULL OR c.tcg_type = $2)
        AND ($3::text IS NULL OR c.set_identifier = $3)
        AND search_vector @@ plainto_tsquery($1)
        ORDER BY rank DESC, c.search_count DESC
        LIMIT $4 OFFSET $5
    """
    
    GET_TRENDING_CARDS = """
        WITH price_changes AS (
            SELECT ph.card_id,
                   ph.market_price as current_price,
                   LAG(ph.market_price, 1) OVER (
                       PARTITION BY ph.card_id 
                       ORDER BY ph.timestamp
                   ) as previous_price,
                   ph.timestamp
            FROM price_history ph
            WHERE ph.timestamp > NOW() - INTERVAL '24 hours'
        ),
        trending_data AS (
            SELECT pc.card_id,
                   pc.current_price,
                   pc.previous_price,
                   CASE 
                       WHEN pc.previous_price > 0 
                       THEN ((pc.current_price - pc.previous_price) / pc.previous_price) * 100
                       ELSE 0
                   END as price_change_percent
            FROM price_changes pc
            WHERE pc.previous_price IS NOT NULL
        )
        SELECT c.id, c.card_name, c.set_identifier, c.image_url,
               td.current_price, td.previous_price, td.price_change_percent
        FROM trending_data td
        JOIN cards c ON c.id = td.card_id
        WHERE c.tcg_type = $1
        ORDER BY ABS(td.price_change_percent) DESC
        LIMIT $2
    """
```

### 8.4 Performance Monitoring & Metrics

#### 8.4.1 Application Performance Monitoring
```python
class PerformanceMonitor:
    def __init__(self, metrics_client):
        self.metrics = metrics_client
        
    def track_api_performance(self, endpoint: str):
        """Decorator to track API endpoint performance"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    self.metrics.histogram(
                        'api_request_duration',
                        time.time() - start_time,
                        tags={'endpoint': endpoint, 'status': 'success'}
                    )
                    return result
                except Exception as e:
                    self.metrics.histogram(
                        'api_request_duration',
                        time.time() - start_time,
                        tags={'endpoint': endpoint, 'status': 'error'}
                    )
                    self.metrics.increment(
                        'api_request_errors',
                        tags={'endpoint': endpoint, 'error_type': type(e).__name__}
                    )
                    raise
            return wrapper
        return decorator
    
    def track_cache_performance(self, operation: str):
        """Track cache hit/miss ratios and performance"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    # Determine if it was a cache hit or miss based on function behavior
                    cache_status = 'hit' if hasattr(result, '_from_cache') else 'miss'
                    
                    self.metrics.histogram(
                        'cache_operation_duration',
                        time.time() - start_time,
                        tags={'operation': operation, 'status': cache_status}
                    )
                    self.metrics.increment(
                        'cache_operations',
                        tags={'operation': operation, 'status': cache_status}
                    )
                    return result
                except Exception as e:
                    self.metrics.increment(
                        'cache_operation_errors',
                        tags={'operation': operation, 'error_type': type(e).__name__}
                    )
                    raise
            return wrapper
        return decorator
```

#### 8.4.2 Database Performance Tracking
```sql
-- Create monitoring views for database performance
CREATE VIEW db_performance_summary AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_tup_hot_upd as hot_updates,
    seq_scan as sequential_scans,
    idx_scan as index_scans,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN ROUND((idx_scan::float / (seq_scan + idx_scan)) * 100, 2)
        ELSE 0 
    END as index_usage_percent
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- Query performance tracking
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100  -- queries taking more than 100ms on average
ORDER BY mean_time DESC;
```

### 8.5 Performance Optimization Checklist

#### 8.5.1 API Level Optimizations
- **Response Compression**: GZIP compression for all API responses
- **Pagination**: Implement cursor-based pagination for large datasets
- **Field Selection**: Allow clients to specify which fields to return
- **Batch Operations**: Support bulk operations for alerts, card lookups
- **Connection Keep-Alive**: Use HTTP/2 and connection pooling

#### 8.5.2 Database Level Optimizations
- **Query Analysis**: Regular EXPLAIN ANALYZE for slow queries
- **Index Maintenance**: Automated index usage monitoring and cleanup
- **Partitioning**: Time-based partitioning for price_history table
- **Vacuum Strategy**: Optimized VACUUM and ANALYZE schedules
- **Read Replicas**: Geographic distribution of read replicas

#### 8.5.3 Caching Level Optimizations
- **Cache Hit Ratio**: Target 85%+ cache hit ratio for API endpoints
- **TTL Optimization**: Dynamic TTL based on data freshness requirements
- **Cache Warming**: Proactive cache warming for popular content
- **Memory Management**: Redis memory optimization and eviction policies

## 9. Error Handling & Retry Mechanisms

### 9.1 Error Classification & Response Strategy

#### 9.1.1 Error Taxonomy
```
Error Categories:

┌─────────────────────────────────────────────────────────────┐
│                 Transient Errors                           │
├─────────────────────────────────────────────────────────────┤
│ • Network timeouts                                         │
│ • Rate limiting (429)                                      │
│ • Service temporarily unavailable (503)                   │
│ • Database connection timeout                              │
│ • Temporary external API failures                         │
│ Strategy: Retry with exponential backoff                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Permanent Errors                           │
├─────────────────────────────────────────────────────────────┤
│ • Authentication failures (401, 403)                      │
│ • Data validation errors (400)                            │
│ • Resource not found (404)                                │
│ • Business logic violations                               │
│ Strategy: Fail fast, log, alert                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 System Errors                              │
├─────────────────────────────────────────────────────────────┤
│ • Memory exhaustion                                        │
│ • Disk space issues                                        │
│ • Service crashes                                          │
│ • Database constraint violations                          │
│ Strategy: Circuit breaker, graceful degradation           │
└─────────────────────────────────────────────────────────────┘
```

#### 9.1.2 Retry Strategy Implementation
```python
import asyncio
import random
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Callable, Any

class ErrorType(Enum):
    TRANSIENT = "transient"
    PERMANENT = "permanent" 
    SYSTEM = "system"

class RetryPolicy(Enum):
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    FIXED_INTERVAL = "fixed_interval"
    NO_RETRY = "no_retry"

@dataclass
class RetryConfig:
    max_attempts: int = 3
    initial_delay: float = 1.0
    max_delay: float = 60.0
    backoff_multiplier: float = 2.0
    jitter: bool = True
    policy: RetryPolicy = RetryPolicy.EXPONENTIAL_BACKOFF

class RetryableError(Exception):
    def __init__(self, message: str, error_type: ErrorType, retry_after: Optional[int] = None):
        self.message = message
        self.error_type = error_type
        self.retry_after = retry_after
        super().__init__(message)

class RetryHandler:
    def __init__(self, config: RetryConfig):
        self.config = config
    
    async def execute_with_retry(
        self,
        operation: Callable,
        *args,
        error_classifier: Callable[[Exception], ErrorType] = None,
        **kwargs
    ) -> Any:
        """Execute operation with retry logic"""
        
        last_exception = None
        
        for attempt in range(1, self.config.max_attempts + 1):
            try:
                result = await operation(*args, **kwargs)
                if attempt > 1:
                    logger.info(f"Operation succeeded on attempt {attempt}")
                return result
                
            except Exception as e:
                last_exception = e
                error_type = self._classify_error(e, error_classifier)
                
                logger.warning(
                    f"Operation failed on attempt {attempt}/{self.config.max_attempts}: {e}",
                    extra={'error_type': error_type.value, 'attempt': attempt}
                )
                
                # Don't retry permanent errors
                if error_type == ErrorType.PERMANENT:
                    raise e
                
                # Don't retry on final attempt
                if attempt == self.config.max_attempts:
                    break
                
                # Calculate delay and wait
                delay = self._calculate_delay(attempt, e)
                await asyncio.sleep(delay)
        
        # All retries exhausted
        raise RetryableError(
            f"Operation failed after {self.config.max_attempts} attempts. Last error: {last_exception}",
            ErrorType.SYSTEM
        ) from last_exception
    
    def _classify_error(self, error: Exception, classifier: Optional[Callable] = None) -> ErrorType:
        """Classify error type for retry decision"""
        if classifier:
            return classifier(error)
        
        # Default classification logic
        if isinstance(error, (ConnectionError, asyncio.TimeoutError)):
            return ErrorType.TRANSIENT
        elif isinstance(error, (ValueError, KeyError, TypeError)):
            return ErrorType.PERMANENT
        elif hasattr(error, 'status_code'):
            if error.status_code in [429, 500, 502, 503, 504]:
                return ErrorType.TRANSIENT
            elif error.status_code in [400, 401, 403, 404]:
                return ErrorType.PERMANENT
        
        return ErrorType.SYSTEM
    
    def _calculate_delay(self, attempt: int, error: Exception) -> float:
        """Calculate delay before next retry attempt"""
        
        # Honor rate limit headers if available
        if hasattr(error, 'retry_after') and error.retry_after:
            return min(error.retry_after, self.config.max_delay)
        
        if self.config.policy == RetryPolicy.EXPONENTIAL_BACKOFF:
            delay = self.config.initial_delay * (self.config.backoff_multiplier ** (attempt - 1))
        elif self.config.policy == RetryPolicy.LINEAR_BACKOFF:
            delay = self.config.initial_delay * attempt
        else:  # FIXED_INTERVAL
            delay = self.config.initial_delay
        
        # Apply maximum delay limit
        delay = min(delay, self.config.max_delay)
        
        # Add jitter to prevent thundering herd
        if self.config.jitter:
            delay = delay * (0.5 + random.random() * 0.5)
        
        return delay
```

### 9.2 Circuit Breaker Pattern

#### 9.2.1 Circuit Breaker Implementation
```python
import time
from enum import Enum
from dataclasses import dataclass
from typing import Callable, Any, Optional

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing fast
    HALF_OPEN = "half_open"  # Testing recovery

@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    success_threshold: int = 2  # Successes needed to close from half-open
    timeout: float = 30.0

class CircuitBreakerOpenError(Exception):
    pass

class CircuitBreaker:
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        
    async def __aenter__(self):
        await self._check_state()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            await self._on_success()
        else:
            await self._on_failure(exc_val)
        return False
    
    async def _check_state(self):
        """Check and potentially update circuit state"""
        now = time.time()
        
        if self.state == CircuitState.OPEN:
            if (self.last_failure_time and 
                now - self.last_failure_time >= self.config.recovery_timeout):
                logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
            else:
                raise CircuitBreakerOpenError(
                    f"Circuit breaker {self.name} is OPEN"
                )
        
        elif self.state == CircuitState.HALF_OPEN:
            # Allow limited requests through
            pass
    
    async def _on_success(self):
        """Handle successful operation"""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.config.success_threshold:
                logger.info(f"Circuit breaker {self.name} closing after recovery")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
        
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            self.failure_count = 0
    
    async def _on_failure(self, error: Exception):
        """Handle failed operation"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        logger.warning(
            f"Circuit breaker {self.name} failure {self.failure_count}/{self.config.failure_threshold}: {error}"
        )
        
        if (self.state == CircuitState.CLOSED and 
            self.failure_count >= self.config.failure_threshold):
            logger.error(f"Circuit breaker {self.name} opening due to failures")
            self.state = CircuitState.OPEN
        
        elif self.state == CircuitState.HALF_OPEN:
            logger.warning(f"Circuit breaker {self.name} reopening after failed recovery")
            self.state = CircuitState.OPEN
            self.success_count = 0
```

### 9.3 Service-Specific Error Handling

#### 9.3.1 External API Error Handling
```python
class ExternalAPIErrorHandler:
    def __init__(self):
        self.tcgplayer_circuit = CircuitBreaker(
            "tcgplayer_api",
            CircuitBreakerConfig(failure_threshold=3, recovery_timeout=120)
        )
        self.ebay_circuit = CircuitBreaker(
            "ebay_api", 
            CircuitBreakerConfig(failure_threshold=5, recovery_timeout=60)
        )
        
    def classify_api_error(self, error: Exception, source: str) -> ErrorType:
        """Classify API errors for appropriate handling"""
        if hasattr(error, 'status_code'):
            status = error.status_code
            
            # Rate limiting - retry with backoff
            if status == 429:
                return ErrorType.TRANSIENT
            
            # Server errors - retry
            if status in [500, 502, 503, 504]:
                return ErrorType.TRANSIENT
            
            # Authentication errors - don't retry
            if status in [401, 403]:
                logger.error(f"{source} API authentication error: {error}")
                # Send alert to ops team
                return ErrorType.PERMANENT
                
            # Client errors - don't retry
            if status in [400, 404, 422]:
                return ErrorType.PERMANENT
        
        # Network-level errors
        if isinstance(error, (ConnectionError, asyncio.TimeoutError)):
            return ErrorType.TRANSIENT
            
        return ErrorType.SYSTEM

class TCGPlayerService:
    def __init__(self, error_handler: ExternalAPIErrorHandler):
        self.error_handler = error_handler
        self.retry_handler = RetryHandler(
            RetryConfig(
                max_attempts=3,
                initial_delay=1.0,
                max_delay=30.0,
                policy=RetryPolicy.EXPONENTIAL_BACKOFF
            )
        )
    
    async def get_product_prices(self, product_ids):
        """Fetch prices with comprehensive error handling"""
        
        async def _fetch_prices():
            async with self.error_handler.tcgplayer_circuit:
                try:
                    response = await self._make_api_request('GET', f'/pricing/product/{product_ids}')
                    return self._validate_price_response(response)
                except Exception as e:
                    # Log error with context
                    logger.error(
                        f"TCGPlayer API error fetching prices for {product_ids}: {e}",
                        extra={'product_ids': product_ids, 'error_type': type(e).__name__}
                    )
                    raise
        
        return await self.retry_handler.execute_with_retry(
            _fetch_prices,
            error_classifier=lambda e: self.error_handler.classify_api_error(e, 'TCGPlayer')
        )
    
    def _validate_price_response(self, response):
        """Validate API response structure and data"""
        if not response or 'results' not in response:
            raise ValueError("Invalid response structure from TCGPlayer API")
        
        results = response['results']
        if not isinstance(results, list):
            raise ValueError("Expected list in results field")
        
        # Validate each price record
        validated_results = []
        for result in results:
            if not all(key in result for key in ['productId', 'lowPrice', 'marketPrice']):
                logger.warning(f"Skipping invalid price record: {result}")
                continue
            
            # Ensure prices are numeric and positive
            try:
                result['lowPrice'] = max(0.0, float(result['lowPrice'] or 0))
                result['marketPrice'] = max(0.0, float(result['marketPrice'] or 0))
                validated_results.append(result)
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid price data: {result}, error: {e}")
                continue
        
        return {'results': validated_results}
```

### 9.4 Database Error Handling

#### 9.4.1 Database-Specific Error Patterns
```python
import asyncpg
from contextlib import asynccontextmanager

class DatabaseErrorHandler:
    def __init__(self, db_manager):
        self.db_manager = db_manager
        self.retry_handler = RetryHandler(
            RetryConfig(
                max_attempts=3,
                initial_delay=0.5,
                max_delay=10.0,
                backoff_multiplier=2.0
            )
        )
    
    def classify_db_error(self, error: Exception) -> ErrorType:
        """Classify database errors"""
        if isinstance(error, asyncpg.ConnectionFailureError):
            return ErrorType.TRANSIENT
        elif isinstance(error, asyncpg.TooManyConnectionsError):
            return ErrorType.TRANSIENT
        elif isinstance(error, asyncpg.DeadlockDetectedError):
            return ErrorType.TRANSIENT
        elif isinstance(error, asyncpg.UniqueViolationError):
            return ErrorType.PERMANENT
        elif isinstance(error, asyncpg.ForeignKeyViolationError):
            return ErrorType.PERMANENT
        elif isinstance(error, asyncpg.CheckViolationError):
            return ErrorType.PERMANENT
        elif isinstance(error, asyncpg.NotNullViolationError):
            return ErrorType.PERMANENT
        else:
            return ErrorType.SYSTEM
    
    @asynccontextmanager
    async def transaction(self, read_only=False):
        """Database transaction with automatic retry and rollback"""
        pool = self.db_manager.read_pool if read_only else self.db_manager.write_pool
        
        async def _execute_transaction():
            async with pool.acquire() as conn:
                async with conn.transaction():
                    yield conn
        
        try:
            async with self.retry_handler.execute_with_retry(
                _execute_transaction,
                error_classifier=self.classify_db_error
            ) as result:
                yield result
        except Exception as e:
            logger.error(f"Database transaction failed: {e}")
            raise

class PriceService:
    def __init__(self, db_error_handler: DatabaseErrorHandler):
        self.db_handler = db_error_handler
    
    async def store_price_data(self, price_records):
        """Store price data with comprehensive error handling"""
        try:
            async with self.db_handler.transaction() as conn:
                # Batch insert with conflict resolution
                insert_query = """
                    INSERT INTO price_history 
                    (card_id, source, market_price, price_low, price_high, timestamp, condition)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (card_id, source, timestamp, condition)
                    DO UPDATE SET
                        market_price = EXCLUDED.market_price,
                        price_low = EXCLUDED.price_low,
                        price_high = EXCLUDED.price_high,
                        updated_at = CURRENT_TIMESTAMP
                """
                
                # Process in batches to avoid memory issues
                batch_size = 1000
                for i in range(0, len(price_records), batch_size):
                    batch = price_records[i:i + batch_size]
                    
                    # Validate batch data
                    validated_batch = []
                    for record in batch:
                        try:
                            validated_record = self._validate_price_record(record)
                            validated_batch.append(validated_record)
                        except ValueError as e:
                            logger.warning(f"Skipping invalid price record: {record}, error: {e}")
                            continue
                    
                    if validated_batch:
                        await conn.executemany(insert_query, validated_batch)
                        logger.info(f"Stored {len(validated_batch)} price records")
                
        except Exception as e:
            logger.error(f"Failed to store price data: {e}")
            # Send alert to monitoring system
            await self._send_storage_error_alert(e, len(price_records))
            raise
    
    def _validate_price_record(self, record):
        """Validate individual price record"""
        required_fields = ['card_id', 'source', 'market_price', 'timestamp']
        
        for field in required_fields:
            if field not in record:
                raise ValueError(f"Missing required field: {field}")
        
        # Type and range validation
        card_id = int(record['card_id'])
        if card_id <= 0:
            raise ValueError("Invalid card_id")
        
        market_price = float(record['market_price'])
        if market_price < 0 or market_price > 999999:
            raise ValueError("Invalid market_price range")
        
        return (
            card_id,
            record['source'],
            market_price,
            record.get('price_low', market_price),
            record.get('price_high', market_price),
            record['timestamp'],
            record.get('condition', 'near_mint')
        )
```

### 9.5 Monitoring & Alerting for Errors

#### 9.5.1 Error Monitoring Implementation
```python
class ErrorMonitor:
    def __init__(self, metrics_client, alert_client):
        self.metrics = metrics_client
        self.alerts = alert_client
        
    async def record_error(
        self, 
        error: Exception, 
        context: dict,
        severity: str = 'warning'
    ):
        """Record error metrics and trigger alerts if needed"""
        
        error_type = type(error).__name__
        service = context.get('service', 'unknown')
        operation = context.get('operation', 'unknown')
        
        # Record metrics
        self.metrics.increment(
            'errors_total',
            tags={
                'error_type': error_type,
                'service': service,
                'operation': operation,
                'severity': severity
            }
        )
        
        # Check if alert is needed
        if severity in ['error', 'critical']:
            await self._send_alert(error, context, severity)
        
        # Log with structured data
        logger.error(
            f"Error in {service}.{operation}: {error}",
            extra={
                'error_type': error_type,
                'service': service,
                'operation': operation,
                'severity': severity,
                'context': context
            },
            exc_info=True
        )
    
    async def _send_alert(self, error: Exception, context: dict, severity: str):
        """Send alert to operations team"""
        alert_data = {
            'title': f"{severity.upper()}: {type(error).__name__}",
            'description': str(error),
            'service': context.get('service'),
            'operation': context.get('operation'),
            'severity': severity,
            'timestamp': datetime.utcnow().isoformat(),
            'context': context
        }
        
        await self.alerts.send_alert(alert_data)
```

### 9.6 Graceful Degradation Strategies

#### 9.6.1 Service Degradation Patterns
```python
class GracefulDegradationManager:
    def __init__(self, cache_manager, db_manager):
        self.cache = cache_manager
        self.db = db_manager
        
    async def get_card_prices_with_fallback(self, card_ids):
        """Get prices with multiple fallback strategies"""
        
        # Primary: Real-time API data
        try:
            return await self._get_realtime_prices(card_ids)
        except Exception as e:
            logger.warning(f"Real-time price fetch failed: {e}")
        
        # Fallback 1: Recent cached data
        try:
            return await self._get_cached_prices(card_ids, max_age_minutes=60)
        except Exception as e:
            logger.warning(f"Recent cache lookup failed: {e}")
        
        # Fallback 2: Stale cached data
        try:
            return await self._get_cached_prices(card_ids, max_age_minutes=1440)  # 24 hours
        except Exception as e:
            logger.warning(f"Stale cache lookup failed: {e}")
        
        # Fallback 3: Last known database prices
        try:
            return await self._get_database_prices(card_ids)
        except Exception as e:
            logger.error(f"Database price lookup failed: {e}")
        
        # Final fallback: Return partial data or error response
        return {
            'success': False,
            'error': 'All price data sources unavailable',
            'partial_data': await self._get_partial_price_data(card_ids)
        }
```

---

*Continuing with deployment architecture...*