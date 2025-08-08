-- Database initialization script for TCG Price Tracker
-- This script sets up the database with proper extensions and initial configuration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types for enums
DO $$
BEGIN
    -- TCG Type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tcg_type_enum') THEN
        CREATE TYPE tcg_type_enum AS ENUM ('pokemon', 'onepiece');
    END IF;
    
    -- Card condition enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_condition_enum') THEN
        CREATE TYPE card_condition_enum AS ENUM (
            'mint', 'near_mint', 'lightly_played', 'moderately_played', 
            'heavily_played', 'damaged', 'poor'
        );
    END IF;
    
    -- Alert type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type_enum') THEN
        CREATE TYPE alert_type_enum AS ENUM ('price_drop', 'price_increase', 'availability');
    END IF;
    
    -- Data source enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_source_enum') THEN
        CREATE TYPE data_source_enum AS ENUM ('tcgplayer', 'ebay', 'cardmarket', 'manual');
    END IF;
END
$$;

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function for generating API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'tk_' || encode(gen_random_bytes(32), 'hex');
END;
$$ language 'plpgsql';

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully with extensions and custom types';
END
$$;