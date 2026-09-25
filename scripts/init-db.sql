-- Database initialization script for TCG Price Tracker
-- Runs once on first container start; the schema itself is managed by Alembic.

-- Trigram search on card names (idx_cards_name_search uses gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
