"""add_missing_tables

Revision ID: bb47d9e8cf23
Revises: aa36f8c7ba94
Create Date: 2025-08-09 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'bb47d9e8cf23'
down_revision: Union[str, Sequence[str], None] = 'aa36f8c7ba94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Only create collection_items table if it doesn't exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'collection_items' not in existing_tables:
        op.create_table(
            'collection_items',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('card_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('condition', postgresql.ENUM('mint', 'near_mint', 'lightly_played', 'moderately_played', 
                     'heavily_played', 'damaged', 'poor', name='cardconditionenum', create_type=False), 
                     nullable=False, server_default='near_mint'),
            sa.Column('purchase_price', sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['card_id'], ['cards.id'], ondelete='CASCADE')
        )
        op.create_index('ix_collection_items_user_id', 'collection_items', ['user_id'])
        op.create_index('ix_collection_items_card_id', 'collection_items', ['card_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Only drop the collection_items table that was created in this migration
    op.drop_table('collection_items')