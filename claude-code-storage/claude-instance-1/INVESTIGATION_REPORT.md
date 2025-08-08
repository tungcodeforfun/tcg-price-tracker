# TCG Price Tracker Investigation Report

## Initial Codebase Analysis

### Project Structure
- Project name: `tcgtracker`
- Version: 0.1.0
- Author: Tung Nguyen
- Python requirement: >=3.9
- Current state: Basic skeleton with minimal functionality

### Existing Files
1. **pyproject.toml**: Basic project configuration with no dependencies yet
2. **__init__.py**: Contains only a simple "Hello from tcgtracker!" print function
3. **README.md**: Empty/minimal content

### Current Implementation Status
The project is in its initial setup phase with no functional price tracking capabilities implemented yet.

---

## Data Sources Investigation

### TCGPlayer API Analysis
- **API Structure**: TCGPlayer provides a comprehensive API with endpoints for Catalog, Inventory, Pricing, and Stores
- **Authentication**: Uses OAuth-style authorization with application keys generated from authorization codes
- **Base URL**: https://api.tcgplayer.com/
- **Authorization Endpoint**: POST /app/authorize/{authCode}
- **API Categories Available**:
  - Catalog management
  - Inventory tracking
  - Pricing data
  - Store information
- **Status**: Requires further investigation of specific pricing endpoints and card game support

### eBay API Analysis
- **API Structure**: eBay provides multiple APIs including Browse API for searching items
- **Base URL**: https://api.ebay.com/
- **Key API**: Browse API for item search and retrieval
- **Search Capabilities**:
  - Keyword search (suitable for "Pokemon card", "One Piece card")
  - Category filtering
  - Price range filtering
  - Sorting by price
- **Item Data Available**:
  - Current item prices
  - Item condition
  - Seller information
  - Shipping details
  - Buying format (auction vs fixed price)
- **Limitations**:
  - Maximum 200 results per search
  - 10,000 items max in result set
  - Primarily current listings (limited historical data)
- **Authentication**: Requires User Access Tokens
- **Suitability**: Good for real-time price monitoring, limited for historical analysis

---

## TCG Domain Analysis

### Pokemon TCG Structure
- **Card Identification System**:
  - Expansion Series (e.g., "Scarlet & Violet—Black Bolt")
  - Unique card number within set
  - Card name (Pokemon character)
  - Rarity classification
- **Set Conventions**:
  - Series codes (e.g., ZSV10PT5, RSV10PT5)
  - Numbered cards within each expansion
- **Pricing Factors**:
  - Expansion series rarity
  - Pokemon popularity
  - Card rarity level
  - Condition grade
  - Special variants (ex cards, alternate art)
- **Required Metadata**: Set code, card number, card name, rarity

### One Piece TCG Structure
- **Card Identification System**:
  - Set identifier (ST-22 for Starter Decks, OP-12 for Booster Packs)
  - Card number within set
  - Rarity classification
- **Product Types**:
  - Starter Decks (ST prefix)
  - Booster Packs (OP prefix)
  - Special collections
- **Required Metadata**: Set prefix, set number, card number, rarity
- **Status**: Limited information available, requires deeper research

---

## Competitive Analysis

### MTGGoldfish Analysis
- **Features**: Multi-platform price tracking, deck pricing, price movement tracking, collection management, alerts
- **Data Presentation**: Price change percentages, historical context, "Movers & Shakers" trending cards
- **Unique Offerings**: Deck discovery tools, tournament analysis, stream overlays
- **Monetization**: Premium memberships with advanced features
- **Data Sources**: Aggregated marketplace data across paper/digital platforms
- **Lessons**: Community-driven features, comprehensive visualization, tournament insights valuable

### PriceCharting Analysis
- **Scope**: Multi-category platform (video games, trading cards, comics, collectibles)
- **TCG Support**: Pokemon, Magic, YuGiOh, One Piece, Lorcana coverage
- **Key Features**: 
  - Photo recognition for card identification
  - Collection tracking and value calculation
  - eBay integration (Deal Scanner, Lot Bot)
  - Price history and market trends
- **Monetization**: Freemium model with premium subscriptions and affiliate revenue
- **Technical Approach**: API access available, multi-region support

### Market Gap Analysis
- **Opportunities**: 
  - Specialized One Piece TCG focus (less mature market)
  - Real-time price alerting systems
  - Advanced analytics and prediction models
  - Mobile-first experience
- **Challenges**: Established competitors with comprehensive data sets

---

## Investigation Progress
This report will be updated as the investigation proceeds through various aspects of the TCG price tracker requirements.