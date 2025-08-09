-- Migration: Rename Card model fields to match API layer
-- Date: 2025-01-09
-- Description: Renames card_name to name, set_identifier to set_name, and adds external_id field

-- Rename columns
ALTER TABLE cards RENAME COLUMN card_name TO name;
ALTER TABLE cards RENAME COLUMN set_identifier TO set_name;

-- Add external_id column
ALTER TABLE cards ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);

-- Create index on external_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_cards_external_id ON cards(external_id);

-- Update constraints and indexes
-- Drop old constraints/indexes
ALTER TABLE cards DROP CONSTRAINT IF EXISTS uq_cards_type_set_number;
DROP INDEX IF EXISTS idx_cards_tcg_set;
DROP INDEX IF EXISTS idx_cards_name_search;

-- Create new constraints/indexes with updated column names
ALTER TABLE cards ADD CONSTRAINT uq_cards_type_set_number 
    UNIQUE (tcg_type, set_name, card_number);

CREATE INDEX idx_cards_tcg_set ON cards(tcg_type, set_name);

-- Create GIN index for full-text search on the renamed name column
CREATE INDEX idx_cards_name_search ON cards USING gin(name gin_trgm_ops);

-- Note: Ensure you have the pg_trgm extension installed for the GIN index
-- If not already installed, run: CREATE EXTENSION IF NOT EXISTS pg_trgm;