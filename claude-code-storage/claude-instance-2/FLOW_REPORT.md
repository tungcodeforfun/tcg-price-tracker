# TCG Price Tracker - Comprehensive Flow Report

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile App     │    │   Admin Panel   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │    API Gateway      │
                    │  (Rate Limiting,    │
                    │   Authentication)   │
                    └─────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Card Data       │    │ Price Ingestion │    │  Alert Service  │
│ Service         │    │ Service         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │              ┌─────────────────┐              │
        │              │ Price Processing│              │
        │              │ Service         │              │
        │              └─────────────────┘              │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────────┐
                    │   Data Storage      │
                    │ (PostgreSQL + Redis)│
                    └─────────────────────┘
```

### Technology Stack Recommendations

**Backend Services:**
- **Language**: Python 3.11+ (FastAPI framework)
- **Database**: PostgreSQL 15+ (time-series optimization)
- **Cache**: Redis 7+ (multi-layer caching)
- **Message Queue**: RabbitMQ/Apache Kafka
- **Search**: Elasticsearch (card search optimization)

**Infrastructure:**
- **Containerization**: Docker + Kubernetes
- **Service Mesh**: Istio (inter-service communication)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **CI/CD**: GitHub Actions + ArgoCD

**External Integrations:**
- **APIs**: TCGPlayer API, eBay Browse API
- **Authentication**: Auth0 or AWS Cognito
- **CDN**: CloudFlare
- **File Storage**: AWS S3 (card images)

## Data Flow Architecture

### Price Data Ingestion Flow

```
External APIs          Ingestion Layer         Processing Layer         Storage Layer
┌─────────────┐       ┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐
│ TCGPlayer   │──────▶│   Scheduler     │────▶│  Validation     │────▶│ PostgreSQL  │
│ API         │       │  (Cron Jobs)    │     │  Service        │     │ (Prices)    │
└─────────────┘       └─────────────────┘     └─────────────────┘     └─────────────┘
                              │                        │                      │
┌─────────────┐       ┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐
│ eBay Browse │──────▶│ Message Queue   │────▶│ Normalization   │────▶│ Redis Cache │
│ API         │       │ (RabbitMQ)      │     │ Engine          │     │ (Hot Data)  │
└─────────────┘       └─────────────────┘     └─────────────────┘     └─────────────┘
                              │                        │
                      ┌─────────────────┐     ┌─────────────────┐
                      │ Dead Letter     │     │ Alert Processor │
                      │ Queue           │     │                 │
                      └─────────────────┘     └─────────────────┘
```

### Real-time Price Update Flow

```python
# Price Update Worker Example
class PriceUpdateWorker:
    async def process_price_update(self, price_data: PriceData):
        # 1. Validate incoming price data
        validated_data = await self.validate_price(price_data)
        
        # 2. Check for significant price changes
        previous_price = await self.get_cached_price(validated_data.card_id)
        price_change = self.calculate_change(previous_price, validated_data.price)
        
        # 3. Store in database
        await self.store_price(validated_data)
        
        # 4. Update cache
        await self.update_cache(validated_data)
        
        # 5. Trigger alerts if significant change
        if price_change >= self.SIGNIFICANT_CHANGE_THRESHOLD:
            await self.trigger_alerts(validated_data, price_change)
        
        # 6. Publish to WebSocket subscribers
        await self.publish_realtime_update(validated_data)
```

## Database Schema Design

### Entity Relationship Diagram

```sql
-- Cards Table (Core card information)
CREATE TABLE cards (
    id SERIAL PRIMARY KEY,
    game_type VARCHAR(20) NOT NULL, -- 'pokemon', 'onepiece'
    name VARCHAR(255) NOT NULL,
    set_code VARCHAR(50) NOT NULL, -- e.g., 'ZSV10PT5', 'ST-22'
    card_number VARCHAR(20) NOT NULL,
    rarity VARCHAR(50),
    game_specific_data JSONB, -- Flexible metadata storage
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(game_type, set_code, card_number),
    INDEX idx_cards_game_set (game_type, set_code),
    INDEX idx_cards_name_fts (name) -- Full-text search
);

-- Price Sources Table
CREATE TABLE price_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- 'tcgplayer', 'ebay'
    api_endpoint VARCHAR(500),
    rate_limit_per_hour INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- Prices Table (Time-series optimized)
CREATE TABLE prices (
    id BIGSERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES cards(id),
    source_id INTEGER REFERENCES price_sources(id),
    price DECIMAL(10,2) NOT NULL,
    condition VARCHAR(50) DEFAULT 'near_mint',
    listing_type VARCHAR(20) DEFAULT 'market', -- 'market', 'auction'
    currency VARCHAR(3) DEFAULT 'USD',
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_prices_card_time (card_id, recorded_at DESC),
    INDEX idx_prices_source_time (source_id, recorded_at DESC)
) PARTITION BY RANGE (recorded_at); -- Monthly partitions

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'local', -- 'local', 'google', 'oauth'
    is_verified BOOLEAN DEFAULT false,
    subscription_tier VARCHAR(20) DEFAULT 'free', -- 'free', 'premium'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price Alerts Table
CREATE TABLE price_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    card_id INTEGER REFERENCES cards(id),
    condition VARCHAR(50) DEFAULT 'any',
    alert_type VARCHAR(20) NOT NULL, -- 'above', 'below', 'change_percent'
    threshold_value DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_alerts_active (is_active, card_id)
);

-- User Collections Table
CREATE TABLE user_collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    card_id INTEGER REFERENCES cards(id),
    quantity INTEGER DEFAULT 1,
    condition VARCHAR(50) DEFAULT 'near_mint',
    purchase_price DECIMAL(10,2),
    purchase_date DATE,
    notes TEXT,
    
    UNIQUE(user_id, card_id, condition)
);
```

### Indexing Strategy

```sql
-- Performance optimization indexes
CREATE INDEX CONCURRENTLY idx_prices_hot_data 
ON prices (card_id, recorded_at DESC) 
WHERE recorded_at > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY idx_cards_search 
ON cards USING gin(to_tsvector('english', name));

-- Partial indexes for active alerts
CREATE INDEX CONCURRENTLY idx_active_alerts 
ON price_alerts (card_id) 
WHERE is_active = true;
```

## API Design

### RESTful API Structure

```python
# FastAPI Route Examples
from fastapi import FastAPI, Depends, HTTPException, WebSocket
from typing import List, Optional

app = FastAPI(title="TCG Price Tracker API", version="1.0.0")

@app.get("/api/v1/cards", response_model=List[CardResponse])
async def search_cards(
    q: Optional[str] = None,
    game_type: Optional[str] = None,
    set_code: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Search cards with filtering and pagination"""
    return await card_service.search_cards(
        query=q, 
        game_type=game_type,
        set_code=set_code,
        page=page,
        limit=limit
    )

@app.get("/api/v1/cards/{card_id}/prices", response_model=PriceHistoryResponse)
async def get_price_history(
    card_id: int,
    source: Optional[str] = None,
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get price history for a specific card"""
    return await price_service.get_price_history(
        card_id=card_id,
        source=source,
        days=days
    )

@app.post("/api/v1/alerts", response_model=AlertResponse)
async def create_alert(
    alert_data: CreateAlertRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new price alert"""
    return await alert_service.create_alert(
        user_id=current_user.id,
        alert_data=alert_data
    )

@app.websocket("/ws/prices/{card_id}")
async def price_updates_websocket(
    websocket: WebSocket,
    card_id: int,
    token: str = Query(...)
):
    """Real-time price updates via WebSocket"""
    user = await authenticate_websocket_user(token)
    await websocket.accept()
    
    await price_stream_manager.subscribe(
        websocket=websocket,
        card_id=card_id,
        user_id=user.id
    )
```

### Request/Response Formats

```python
# Pydantic Models for API
from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

class CardResponse(BaseModel):
    id: int
    name: str
    game_type: str
    set_code: str
    card_number: str
    rarity: Optional[str]
    image_url: Optional[str]
    current_price: Optional[Decimal]
    price_change_24h: Optional[float]

class PricePoint(BaseModel):
    price: Decimal
    source: str
    condition: str
    recorded_at: datetime

class PriceHistoryResponse(BaseModel):
    card_id: int
    prices: List[PricePoint]
    summary: dict  # min, max, avg prices
    
class CreateAlertRequest(BaseModel):
    card_id: int
    alert_type: str  # 'above', 'below', 'change_percent'
    threshold_value: Decimal
    condition: str = 'any'
```

### Authentication Flow

```python
# JWT-based Authentication
from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self):
        self.SECRET_KEY = os.getenv("SECRET_KEY")
        self.ALGORITHM = "HS256"
        self.ACCESS_TOKEN_EXPIRE_MINUTES = 30
    
    async def authenticate_user(self, email: str, password: str):
        user = await self.get_user_by_email(email)
        if not user or not self.verify_password(password, user.password_hash):
            raise HTTPException(401, "Invalid credentials")
        return user
    
    def create_access_token(self, data: dict):
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, self.SECRET_KEY, algorithm=self.ALGORITHM)
```

## Service Integration Flows

### TCGPlayer API Integration

```python
class TCGPlayerService:
    def __init__(self):
        self.base_url = "https://api.tcgplayer.com"
        self.auth_token = None
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60,
            expected_exception=HTTPException
        )
    
    @circuit_breaker
    async def get_card_prices(self, product_ids: List[int]):
        """Get current market prices for products"""
        if not self.auth_token or self.is_token_expired():
            await self.refresh_auth_token()
        
        url = f"{self.base_url}/pricing/product/{','.join(map(str, product_ids))}"
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    
    async def refresh_auth_token(self):
        """OAuth-style token refresh"""
        auth_data = {
            "grant_type": "client_credentials",
            "client_id": os.getenv("TCGPLAYER_CLIENT_ID"),
            "client_secret": os.getenv("TCGPLAYER_CLIENT_SECRET")
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/token",
                data=auth_data
            )
            response.raise_for_status()
            token_data = response.json()
            self.auth_token = token_data["access_token"]
```

### eBay API Integration

```python
class EBayService:
    def __init__(self):
        self.base_url = "https://api.ebay.com/buy/browse/v1"
        self.user_token = os.getenv("EBAY_USER_ACCESS_TOKEN")
        self.rate_limiter = RateLimiter(max_calls=5000, period=3600)  # 5000/hour
    
    @rate_limiter
    async def search_items(self, card_name: str, game_type: str):
        """Search eBay listings for specific card"""
        query = f'"{card_name}" {game_type} card'
        params = {
            "q": query,
            "category_ids": "2536",  # Trading Card Games
            "filter": "buyingOptions:{FIXED_PRICE}",
            "sort": "price",
            "limit": 50
        }
        
        headers = {
            "Authorization": f"Bearer {self.user_token}",
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/item_summary/search",
                params=params,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
    
    def parse_listing_data(self, listing_data: dict) -> PriceData:
        """Extract and normalize price data from eBay response"""
        return PriceData(
            price=Decimal(listing_data["price"]["value"]),
            currency=listing_data["price"]["currency"],
            condition=self.normalize_condition(listing_data.get("condition")),
            listing_type="fixed_price",
            source="ebay"
        )
```

### Error Handling and Circuit Breaker

```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int, recovery_timeout: int, expected_exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def __call__(self, func):
        async def wrapper(*args, **kwargs):
            if self.state == "OPEN":
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = "HALF_OPEN"
                else:
                    raise CircuitBreakerOpenException("Circuit breaker is OPEN")
            
            try:
                result = await func(*args, **kwargs)
                if self.state == "HALF_OPEN":
                    self.state = "CLOSED"
                    self.failure_count = 0
                return result
            
            except self.expected_exception as e:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    self.state = "OPEN"
                
                raise e
        
        return wrapper
```

## Background Job Flows

### Price Update Scheduling

```python
from celery import Celery
from celery.schedules import crontab

# Celery configuration
celery_app = Celery(
    "tcg_price_tracker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

# Schedule definitions
celery_app.conf.beat_schedule = {
    'update-popular-cards': {
        'task': 'tasks.update_popular_card_prices',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'update-all-cards': {
        'task': 'tasks.update_all_card_prices',
        'schedule': crontab(minute=0, hour='*/2'),  # Every 2 hours
    },
    'process-alerts': {
        'task': 'tasks.process_price_alerts',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
    'cleanup-old-prices': {
        'task': 'tasks.cleanup_old_price_data',
        'schedule': crontab(minute=0, hour=2),  # Daily at 2 AM
    }
}

@celery_app.task(bind=True, max_retries=3)
async def update_popular_card_prices(self):
    """Update prices for most-watched cards"""
    try:
        popular_cards = await get_popular_cards(limit=500)
        
        for card in popular_cards:
            # Queue individual card price updates
            update_single_card_price.apply_async(
                args=[card.id],
                countdown=random.randint(1, 60)  # Spread out requests
            )
        
        logger.info(f"Queued price updates for {len(popular_cards)} popular cards")
        
    except Exception as exc:
        logger.error(f"Failed to update popular card prices: {exc}")
        raise self.retry(exc=exc, countdown=60)

@celery_app.task(bind=True, max_retries=3)
async def update_single_card_price(self, card_id: int):
    """Update price for a single card from all sources"""
    try:
        card = await get_card_by_id(card_id)
        price_updates = []
        
        # TCGPlayer prices
        tcg_prices = await tcgplayer_service.get_card_prices([card.tcg_product_id])
        price_updates.extend(tcg_prices)
        
        # eBay prices
        ebay_prices = await ebay_service.search_items(card.name, card.game_type)
        price_updates.extend(ebay_prices)
        
        # Store all price updates
        await store_price_updates(card_id, price_updates)
        
        # Update cache
        await update_price_cache(card_id, price_updates)
        
    except Exception as exc:
        logger.error(f"Failed to update price for card {card_id}: {exc}")
        raise self.retry(exc=exc, countdown=120)
```

### Alert Processing Flow

```python
@celery_app.task
async def process_price_alerts():
    """Process all active price alerts"""
    active_alerts = await get_active_alerts()
    
    for alert in active_alerts:
        try:
            current_price = await get_current_card_price(
                alert.card_id, 
                condition=alert.condition
            )
            
            if should_trigger_alert(alert, current_price):
                await trigger_alert_notification(alert, current_price)
                await update_alert_last_triggered(alert.id)
                
        except Exception as e:
            logger.error(f"Failed to process alert {alert.id}: {e}")

def should_trigger_alert(alert: PriceAlert, current_price: Decimal) -> bool:
    """Determine if alert should be triggered"""
    if alert.alert_type == "above":
        return current_price >= alert.threshold_value
    elif alert.alert_type == "below":
        return current_price <= alert.threshold_value
    elif alert.alert_type == "change_percent":
        last_price = get_last_alert_price(alert.card_id)
        if last_price:
            change_percent = ((current_price - last_price) / last_price) * 100
            return abs(change_percent) >= alert.threshold_value
    
    return False

async def trigger_alert_notification(alert: PriceAlert, current_price: Decimal):
    """Send alert notification to user"""
    user = await get_user_by_id(alert.user_id)
    card = await get_card_by_id(alert.card_id)
    
    notification_data = {
        "user_id": user.id,
        "alert_type": alert.alert_type,
        "card_name": card.name,
        "current_price": current_price,
        "threshold": alert.threshold_value,
        "timestamp": datetime.utcnow()
    }
    
    # Send email notification
    await email_service.send_price_alert(user.email, notification_data)
    
    # Send push notification if mobile app
    if user.push_token:
        await push_notification_service.send(user.push_token, notification_data)
    
    # Send WebSocket notification if user is online
    await websocket_manager.send_to_user(user.id, notification_data)
```

## Caching Strategy

### Multi-Layer Caching Architecture

```python
from typing import Optional, Any
import json
import redis
from functools import wraps

class CacheService:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        
    # Cache key patterns
    CARD_PRICE_KEY = "card_prices:{card_id}:{source_id}"
    TRENDING_CARDS_KEY = "trending_cards:{period}"
    USER_COLLECTION_KEY = "user_collections:{user_id}"
    CARD_SEARCH_KEY = "card_search:{query_hash}"
    
    async def get_card_price(self, card_id: int, source_id: int) -> Optional[dict]:
        """Get cached card price"""
        key = self.CARD_PRICE_KEY.format(card_id=card_id, source_id=source_id)
        cached_data = self.redis_client.get(key)
        
        if cached_data:
            return json.loads(cached_data)
        return None
    
    async def set_card_price(self, card_id: int, source_id: int, price_data: dict, ttl: int = 900):
        """Cache card price with TTL (15 minutes default)"""
        key = self.CARD_PRICE_KEY.format(card_id=card_id, source_id=source_id)
        self.redis_client.setex(
            key, 
            ttl, 
            json.dumps(price_data, default=str)
        )
    
    async def get_trending_cards(self, period: str = "hourly") -> Optional[List[dict]]:
        """Get cached trending cards"""
        key = self.TRENDING_CARDS_KEY.format(period=period)
        cached_data = self.redis_client.get(key)
        
        if cached_data:
            return json.loads(cached_data)
        return None
    
    async def warm_popular_cards_cache(self):
        """Pre-populate cache with popular cards data"""
        popular_cards = await get_popular_cards(limit=1000)
        
        for card in popular_cards:
            # Get latest prices from database
            latest_prices = await get_latest_card_prices(card.id)
            
            # Cache each price source
            for price in latest_prices:
                await self.set_card_price(
                    card.id, 
                    price.source_id, 
                    price.to_dict(),
                    ttl=1800  # 30 minutes for popular cards
                )

# Cache decorator for API endpoints
def cached_response(ttl: int = 300, key_prefix: str = ""):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"{key_prefix}:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached_result = cache_service.redis_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            cache_service.redis_client.setex(
                cache_key, 
                ttl, 
                json.dumps(result, default=str)
            )
            
            return result
        return wrapper
    return decorator

# Usage example
@cached_response(ttl=600, key_prefix="api_cards")
async def get_cards_by_set(set_code: str, game_type: str):
    return await card_service.get_cards_by_set(set_code, game_type)
```

### Cache Invalidation Strategy

```python
class CacheInvalidationService:
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
        self.redis_client = cache_service.redis_client
    
    async def invalidate_card_price_cache(self, card_id: int):
        """Invalidate all cached prices for a card"""
        pattern = f"card_prices:{card_id}:*"
        keys = self.redis_client.keys(pattern)
        
        if keys:
            self.redis_client.delete(*keys)
    
    async def invalidate_user_cache(self, user_id: int):
        """Invalidate user-specific cached data"""
        patterns = [
            f"user_collections:{user_id}",
            f"user_alerts:{user_id}",
            f"user_preferences:{user_id}"
        ]
        
        for pattern in patterns:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
    
    async def publish_cache_invalidation(self, event_type: str, data: dict):
        """Publish cache invalidation event via Redis pub/sub"""
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.redis_client.publish("cache_invalidation", json.dumps(event))

# Cache invalidation subscriber
async def cache_invalidation_subscriber():
    pubsub = cache_service.redis_client.pubsub()
    pubsub.subscribe("cache_invalidation")
    
    for message in pubsub.listen():
        if message["type"] == "message":
            event = json.loads(message["data"])
            
            if event["type"] == "price_update":
                card_id = event["data"]["card_id"]
                await cache_invalidation_service.invalidate_card_price_cache(card_id)
            
            elif event["type"] == "user_update":
                user_id = event["data"]["user_id"]
                await cache_invalidation_service.invalidate_user_cache(user_id)
```

## User Interaction Flows

### Card Search Flow

```python
class CardSearchService:
    def __init__(self, elasticsearch_client, cache_service):
        self.es_client = elasticsearch_client
        self.cache = cache_service
    
    async def search_cards(self, query: str, filters: dict, pagination: dict) -> dict:
        """Advanced card search with filters and caching"""
        
        # Generate cache key
        search_params = {
            "query": query,
            "filters": filters,
            "page": pagination.get("page", 1),
            "limit": pagination.get("limit", 20)
        }
        cache_key = f"card_search:{hash(json.dumps(search_params, sort_keys=True))}"
        
        # Check cache first
        cached_result = await self.cache.get(cache_key)
        if cached_result:
            return cached_result
        
        # Build Elasticsearch query
        es_query = self.build_search_query(query, filters)
        
        # Execute search
        response = await self.es_client.search(
            index="cards",
            body=es_query,
            from_=pagination.get("offset", 0),
            size=pagination.get("limit", 20)
        )
        
        # Process results
        results = self.process_search_results(response)
        
        # Enrich with current prices
        for card in results["cards"]:
            current_price = await self.get_current_price(card["id"])
            card["current_price"] = current_price
        
        # Cache results
        await self.cache.set(cache_key, results, ttl=300)  # 5 minutes
        
        return results
    
    def build_search_query(self, query: str, filters: dict) -> dict:
        """Build Elasticsearch query with filters"""
        es_query = {
            "query": {
                "bool": {
                    "must": [],
                    "filter": []
                }
            },
            "sort": [
                {"_score": {"order": "desc"}},
                {"name.keyword": {"order": "asc"}}
            ]
        }
        
        # Full-text search on card name
        if query:
            es_query["query"]["bool"]["must"].append({
                "multi_match": {
                    "query": query,
                    "fields": ["name^2", "set_code", "rarity"],
                    "type": "best_fields",
                    "fuzziness": "AUTO"
                }
            })
        
        # Apply filters
        if filters.get("game_type"):
            es_query["query"]["bool"]["filter"].append({
                "term": {"game_type": filters["game_type"]}
            })
        
        if filters.get("set_codes"):
            es_query["query"]["bool"]["filter"].append({
                "terms": {"set_code": filters["set_codes"]}
            })
        
        if filters.get("rarity"):
            es_query["query"]["bool"]["filter"].append({
                "terms": {"rarity": filters["rarity"]}
            })
        
        if filters.get("price_range"):
            # This requires a nested query on current prices
            es_query["query"]["bool"]["filter"].append({
                "range": {"current_price": filters["price_range"]}
            })
        
        return es_query
```

### Price Alert Setup Flow

```python
class AlertService:
    def __init__(self, db_service, validation_service):
        self.db = db_service
        self.validator = validation_service
    
    async def create_alert(self, user_id: int, alert_data: CreateAlertRequest) -> AlertResponse:
        """Create new price alert with validation"""
        
        # 1. Validate user subscription limits
        await self.validate_alert_limits(user_id)
        
        # 2. Validate card exists
        card = await self.db.get_card(alert_data.card_id)
        if not card:
            raise HTTPException(404, "Card not found")
        
        # 3. Validate alert parameters
        await self.validator.validate_alert_request(alert_data)
        
        # 4. Check for duplicate alerts
        existing_alert = await self.db.get_existing_alert(
            user_id, 
            alert_data.card_id, 
            alert_data.alert_type,
            alert_data.condition
        )
        
        if existing_alert:
            raise HTTPException(400, "Similar alert already exists")
        
        # 5. Create alert
        alert = await self.db.create_alert({
            "user_id": user_id,
            "card_id": alert_data.card_id,
            "alert_type": alert_data.alert_type,
            "threshold_value": alert_data.threshold_value,
            "condition": alert_data.condition,
            "is_active": True
        })
        
        # 6. Set baseline price for percentage change alerts
        if alert_data.alert_type == "change_percent":
            current_price = await self.get_current_card_price(
                alert_data.card_id, 
                alert_data.condition
            )
            await self.db.set_alert_baseline_price(alert.id, current_price)
        
        # 7. Send confirmation
        await self.send_alert_confirmation(user_id, alert, card)
        
        return AlertResponse.from_orm(alert)
    
    async def validate_alert_limits(self, user_id: int):
        """Check user's alert limits based on subscription tier"""
        user = await self.db.get_user(user_id)
        current_alerts = await self.db.count_user_active_alerts(user_id)
        
        limits = {
            "free": 10,
            "premium": 100,
            "enterprise": 1000
        }
        
        max_alerts = limits.get(user.subscription_tier, 10)
        
        if current_alerts >= max_alerts:
            raise HTTPException(
                403, 
                f"Alert limit reached. {user.subscription_tier} tier allows {max_alerts} alerts"
            )
```

### Real-time Updates Flow

```python
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}  # user_id -> connections
        self.card_subscribers: Dict[int, Set[int]] = {}  # card_id -> user_ids
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept WebSocket connection and register user"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection_confirmed",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            
            # Clean up empty connection lists
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Remove from card subscriptions
        for card_id, subscribers in self.card_subscribers.items():
            subscribers.discard(user_id)
    
    async def subscribe_to_card(self, user_id: int, card_id: int):
        """Subscribe user to card price updates"""
        if card_id not in self.card_subscribers:
            self.card_subscribers[card_id] = set()
        
        self.card_subscribers[card_id].add(user_id)
        
        # Send current price data
        current_price = await get_current_card_price(card_id)
        await self.send_to_user(user_id, {
            "type": "price_update",
            "card_id": card_id,
            "price_data": current_price,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def broadcast_price_update(self, card_id: int, price_data: dict):
        """Broadcast price update to all subscribers"""
        if card_id not in self.card_subscribers:
            return
        
        update_message = {
            "type": "price_update",
            "card_id": card_id,
            "price_data": price_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all subscribers
        subscribers = self.card_subscribers[card_id].copy()
        for user_id in subscribers:
            await self.send_to_user(user_id, update_message)
    
    async def send_to_user(self, user_id: int, message: dict):
        """Send message to specific user's connections"""
        if user_id not in self.active_connections:
            return
        
        # Send to all user's connections
        dead_connections = []
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_json(message)
            except ConnectionClosedError:
                dead_connections.append(websocket)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            await self.disconnect(dead_conn, user_id)

# WebSocket endpoint
websocket_manager = WebSocketManager()

@app.websocket("/ws/user/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, token: str):
    """Main WebSocket endpoint for user connections"""
    
    # Authenticate user
    try:
        user = await authenticate_websocket_user(token)
        if user.id != user_id:
            await websocket.close(code=4003, reason="Unauthorized")
            return
    except AuthenticationError:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    await websocket_manager.connect(websocket, user_id)
    
    try:
        while True:
            # Listen for client messages
            data = await websocket.receive_json()
            
            if data["type"] == "subscribe_card":
                card_id = data["card_id"]
                await websocket_manager.subscribe_to_card(user_id, card_id)
            
            elif data["type"] == "unsubscribe_card":
                card_id = data["card_id"]
                await websocket_manager.unsubscribe_from_card(user_id, card_id)
            
            elif data["type"] == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket, user_id)
```

## Error Handling and Monitoring

### Error Handling Flows

```python
from typing import Optional
import logging
from enum import Enum
import traceback

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorHandlerService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.alert_service = AlertService()
    
    async def handle_api_error(self, error: Exception, context: dict) -> dict:
        """Centralized API error handling"""
        error_info = {
            "error_type": type(error).__name__,
            "message": str(error),
            "context": context,
            "timestamp": datetime.utcnow().isoformat(),
            "trace_id": context.get("trace_id")
        }
        
        # Determine error severity
        severity = self.classify_error_severity(error)
        error_info["severity"] = severity.value
        
        # Log error
        self.logger.error(f"API Error: {error_info}", exc_info=True)
        
        # Send alerts for high/critical errors
        if severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            await self.alert_service.send_error_alert(error_info)
        
        # Return user-friendly error response
        return self.create_error_response(error, severity)
    
    def classify_error_severity(self, error: Exception) -> ErrorSeverity:
        """Classify error severity based on type and context"""
        if isinstance(error, (ConnectionError, TimeoutError)):
            return ErrorSeverity.HIGH
        elif isinstance(error, (ValueError, ValidationError)):
            return ErrorSeverity.MEDIUM
        elif isinstance(error, (AuthenticationError, PermissionError)):
            return ErrorSeverity.MEDIUM
        elif isinstance(error, DatabaseError):
            return ErrorSeverity.CRITICAL
        else:
            return ErrorSeverity.LOW
    
    def create_error_response(self, error: Exception, severity: ErrorSeverity) -> dict:
        """Create user-friendly error response"""
        if severity == ErrorSeverity.CRITICAL:
            return {
                "error": "Service temporarily unavailable",
                "message": "We're experiencing technical difficulties. Please try again later.",
                "code": "SERVICE_UNAVAILABLE"
            }
        elif isinstance(error, ValidationError):
            return {
                "error": "Validation failed",
                "message": str(error),
                "code": "VALIDATION_ERROR"
            }
        elif isinstance(error, AuthenticationError):
            return {
                "error": "Authentication required",
                "message": "Please log in to access this resource",
                "code": "AUTH_REQUIRED"
            }
        else:
            return {
                "error": "Request failed",
                "message": "An error occurred while processing your request",
                "code": "GENERIC_ERROR"
            }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    context = {
        "method": request.method,
        "url": str(request.url),
        "user_id": getattr(request.state, "user_id", None),
        "trace_id": getattr(request.state, "trace_id", None)
    }
    
    error_response = await error_handler.handle_api_error(exc, context)
    
    return JSONResponse(
        status_code=500,
        content=error_response
    )
```

### Graceful Degradation Strategy

```python
class GracefulDegradationService:
    def __init__(self, cache_service, monitoring_service):
        self.cache = cache_service
        self.monitoring = monitoring_service
        self.degraded_mode = False
    
    async def get_card_prices_with_fallback(self, card_id: int) -> dict:
        """Get card prices with fallback to cached data"""
        try:
            # Try to get fresh data from APIs
            fresh_prices = await self.get_fresh_prices(card_id)
            
            # Cache successful response
            await self.cache.set_card_price(card_id, fresh_prices)
            
            return {
                "prices": fresh_prices,
                "data_freshness": "live",
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except ExternalAPIException as e:
            self.logger.warning(f"API failed for card {card_id}, falling back to cache: {e}")
            
            # Fall back to cached data
            cached_prices = await self.cache.get_card_price(card_id)
            
            if cached_prices:
                return {
                    "prices": cached_prices["prices"],
                    "data_freshness": "cached",
                    "last_updated": cached_prices["timestamp"],
                    "notice": "Live data temporarily unavailable, showing cached prices"
                }
            else:
                # No cached data available
                return {
                    "prices": [],
                    "data_freshness": "unavailable",
                    "last_updated": None,
                    "notice": "Price data temporarily unavailable"
                }
    
    async def enable_degraded_mode(self):
        """Enable degraded mode operations"""
        self.degraded_mode = True
        
        # Increase cache TTL
        await self.cache.extend_all_ttl(multiplier=3)
        
        # Reduce API call frequency
        await self.reduce_background_job_frequency()
        
        # Send operational alert
        await self.monitoring.send_alert({
            "type": "degraded_mode_enabled",
            "message": "System operating in degraded mode",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def disable_degraded_mode(self):
        """Disable degraded mode and return to normal operations"""
        self.degraded_mode = False
        
        # Restore normal cache TTL
        await self.cache.restore_normal_ttl()
        
        # Restore normal job frequency
        await self.restore_background_job_frequency()
        
        # Send recovery alert
        await self.monitoring.send_alert({
            "type": "degraded_mode_disabled",
            "message": "System returned to normal operations",
            "timestamp": datetime.utcnow().isoformat()
        })
```

## Deployment Architecture

### Container Orchestration Setup

```yaml
# docker-compose.yml for local development
version: '3.8'
services:
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/tcg_tracker
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  card-service:
    build: ./services/card-service
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/tcg_tracker
    depends_on:
      - db

  price-ingestion-service:
    build: ./services/price-ingestion
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/tcg_tracker
      - REDIS_URL=redis://redis:6379
      - TCGPLAYER_CLIENT_ID=${TCGPLAYER_CLIENT_ID}
      - EBAY_ACCESS_TOKEN=${EBAY_ACCESS_TOKEN}
    depends_on:
      - db
      - redis

  alert-service:
    build: ./services/alert-service
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/tcg_tracker
      - REDIS_URL=redis://redis:6379
      - EMAIL_SERVICE_API_KEY=${EMAIL_SERVICE_API_KEY}
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=tcg_tracker
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
```

### Kubernetes Deployment Configuration

```yaml
# k8s/api-gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: tcg-tracker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: tcg-tracker/api-gateway:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: tcg-tracker
spec:
  selector:
    app: api-gateway
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: tcg-tracker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### CI/CD Pipeline Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy TCG Price Tracker

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: tcg_tracker_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-test.txt
    
    - name: Run tests
      env:
        DATABASE_URL: postgresql://postgres:test@localhost:5432/tcg_tracker_test
      run: |
        pytest tests/ --cov=. --cov-report=xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push images
      run: |
        services=("api-gateway" "card-service" "price-ingestion" "alert-service")
        for service in "${services[@]}"; do
          docker build -t ghcr.io/${{ github.repository }}/$service:${{ github.sha }} ./services/$service
          docker push ghcr.io/${{ github.repository }}/$service:${{ github.sha }}
        done

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Staging
      run: |
        # Update image tags in k8s manifests
        sed -i 's|:latest|:${{ github.sha }}|g' k8s/staging/*.yaml
        
        # Apply to staging cluster
        kubectl apply -f k8s/staging/ --kubeconfig=${{ secrets.STAGING_KUBECONFIG }}
    
    - name: Run integration tests
      run: |
        pytest tests/integration/ --staging-url=${{ secrets.STAGING_URL }}

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Production
      run: |
        # Update image tags in k8s manifests
        sed -i 's|:latest|:${{ github.sha }}|g' k8s/production/*.yaml
        
        # Apply to production cluster with rolling update
        kubectl apply -f k8s/production/ --kubeconfig=${{ secrets.PRODUCTION_KUBECONFIG }}
        
        # Wait for rollout to complete
        kubectl rollout status deployment/api-gateway -n tcg-tracker --kubeconfig=${{ secrets.PRODUCTION_KUBECONFIG }}
```

## Implementation Summary

This comprehensive flow report provides a complete architectural blueprint for the TCG Price Tracker system, covering:

1. **Microservices Architecture** - Scalable, maintainable service separation
2. **Multi-source Data Integration** - TCGPlayer and eBay API integration with error handling
3. **Optimized Database Schema** - Time-series price data with proper indexing
4. **Comprehensive Caching Strategy** - Multi-layer caching for performance
5. **Real-time Communication** - WebSocket implementation for live updates
6. **Robust Error Handling** - Circuit breakers, graceful degradation
7. **Background Job Processing** - Celery-based price update scheduling
8. **Container Orchestration** - Docker and Kubernetes deployment
9. **CI/CD Pipeline** - Automated testing and deployment

The architecture supports the competitive features identified in the investigation:
- Multi-game card support (Pokemon, One Piece)
- Real-time price tracking and alerts
- Advanced search and filtering
- User collections and portfolios
- Mobile-responsive design capabilities
- Scalable infrastructure for growth

Each component is designed with production readiness in mind, including monitoring, logging, security, and performance optimization.