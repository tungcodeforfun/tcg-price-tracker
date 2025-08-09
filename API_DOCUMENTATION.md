# TCG Price Tracker API Documentation

## Base URL
`http://localhost:8000/api/v1`

## Authentication
The API uses JWT (JSON Web Token) authentication. Include the token in the `Authorization` header:
```
Authorization: Bearer <your_token>
```

## Endpoints

### Authentication (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (returns access & refresh tokens)
- `POST /auth/refresh` - Refresh access token

### Users (`/users`)
- `GET /users/me` - Get current user profile
- `PUT /users/me` - Update current user profile
- `POST /users/alerts` - Create price alert
- `GET /users/alerts` - Get user's price alerts
- `DELETE /users/alerts/{alert_id}` - Delete price alert
- `PUT /users/alerts/{alert_id}/toggle` - Toggle alert active/inactive
- `GET /users/stats` - Get user statistics

### Cards (`/cards`)
- `POST /cards/` - Create new card
- `GET /cards/{card_id}` - Get specific card
- `GET /cards/` - List cards with filters
- `PUT /cards/{card_id}` - Update card
- `DELETE /cards/{card_id}` - Delete card
- `POST /cards/search` - Advanced card search

### Prices (`/prices`)
- `POST /prices/` - Add price entry
- `GET /prices/card/{card_id}` - Get price history
- `POST /prices/update/{card_id}` - Fetch & update latest price
- `POST /prices/update/bulk` - Bulk update prices
- `GET /prices/trends` - Get price trends

### Collections (`/collections`)
- `POST /collections/items` - Add card to collection
- `GET /collections/items` - Get collection items
- `GET /collections/items/{item_id}` - Get specific item
- `PUT /collections/items/{item_id}` - Update collection item
- `DELETE /collections/items/{item_id}` - Remove from collection
- `GET /collections/stats` - Get collection statistics
- `GET /collections/value-history` - Get collection value history

### Search (`/search`)
- `POST /search/tcgplayer` - Search TCGPlayer
- `POST /search/ebay` - Search eBay
- `POST /search/all` - Search all sources
- `POST /search/import` - Import card from search
- `GET /search/suggestions` - Get search suggestions

## Request/Response Examples

### Register User
```json
POST /auth/register
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123"
}
```

### Login
```json
POST /auth/login
{
  "username": "johndoe",  // or email
  "password": "securepassword123"
}

Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Add Card to Collection
```json
POST /collections/items
{
  "card_id": 1,
  "quantity": 2,
  "condition": "near_mint",
  "purchase_price": 25.99,
  "notes": "Bought from local store"
}
```

### Search Cards
```json
POST /search/tcgplayer
{
  "query": "Charizard",
  "game_type": "pokemon",
  "limit": 20
}
```

## Game Types
- `pokemon`
- `one_piece`
- `magic`
- `yugioh`

## Card Conditions
- `mint`
- `near_mint`
- `lightly_played`
- `moderately_played`
- `heavily_played`
- `damaged`

## Price Sources
- `tcgplayer`
- `ebay`
- `cardmarket`

## Error Responses
All errors follow this format:
```json
{
  "detail": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `503` - Service Unavailable (external API issues)