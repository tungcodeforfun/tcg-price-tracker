"""Add JUSTTCG and PRICECHARTING to DataSourceEnum

Revision ID: 002_add_pricing_sources
Revises: 001_initial_schema
Create Date: 2025-08-09 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = '002_add_pricing_sources'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new pricing sources to DataSourceEnum."""
    # PostgreSQL enum modification - add new values
    # Note: PostgreSQL doesn't allow removing enum values easily, so downgrade only comments on this
    op.execute("ALTER TYPE datasourceenum ADD VALUE IF NOT EXISTS 'justtcg'")
    op.execute("ALTER TYPE datasourceenum ADD VALUE IF NOT EXISTS 'pricecharting'")


def downgrade() -> None:
    """Remove pricing sources from DataSourceEnum.
    
    IMPORTANT: PostgreSQL doesn't support removing enum values directly.
    
    If rollback is required, execute these manual steps:
    
    1. Create backup of pricehistory table:
       CREATE TABLE pricehistory_backup AS SELECT * FROM pricehistory;
    
    2. Create new enum without new values:
       CREATE TYPE datasourceenum_new AS ENUM ('tcgplayer', 'ebay', 'cardmarket', 'manual');
    
    3. Update existing JUSTTCG/PRICECHARTING records to MANUAL (or delete):
       UPDATE pricehistory SET source = 'manual' WHERE source IN ('justtcg', 'pricecharting');
    
    4. Alter column to use new enum:
       ALTER TABLE pricehistory ALTER COLUMN source TYPE datasourceenum_new 
       USING source::text::datasourceenum_new;
    
    5. Drop old enum and rename new:
       DROP TYPE datasourceenum;
       ALTER TYPE datasourceenum_new RENAME TO datasourceenum;
    
    WARNING: This will modify existing data. Ensure backups exist before proceeding.
    """
    # Manual rollback required - see docstring for SQL commands
    pass