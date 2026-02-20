"""Denormalize latest price and cleanup redundant indexes

Revision ID: dd69f1a0eb45
Revises: cc58e0f9da34
Create Date: 2025-08-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'dd69f1a0eb45'
down_revision: Union[str, Sequence[str], None] = 'cc58e0f9da34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add denormalized price columns to cards table
    op.add_column('cards', sa.Column(
        'latest_market_price', sa.Numeric(10, 2), nullable=True
    ))
    op.add_column('cards', sa.Column(
        'latest_price_updated_at', sa.DateTime(timezone=True), nullable=True
    ))

    # Backfill from price_history using DISTINCT ON
    op.execute("""
        UPDATE cards
        SET latest_market_price = ph.market_price,
            latest_price_updated_at = ph.timestamp
        FROM (
            SELECT DISTINCT ON (card_id)
                card_id, market_price, timestamp
            FROM price_history
            ORDER BY card_id, timestamp DESC
        ) ph
        WHERE cards.id = ph.card_id
    """)

    # Drop redundant indexes if they exist (user_id and card_id already indexed via column-level index=True)
    op.execute("DROP INDEX IF EXISTS idx_collection_items_user")
    op.execute("DROP INDEX IF EXISTS idx_collection_items_card")


def downgrade() -> None:
    # Re-create the redundant indexes
    op.create_index('idx_collection_items_user', 'collection_items', ['user_id'])
    op.create_index('idx_collection_items_card', 'collection_items', ['card_id'])

    # Drop denormalized columns
    op.drop_column('cards', 'latest_price_updated_at')
    op.drop_column('cards', 'latest_market_price')
