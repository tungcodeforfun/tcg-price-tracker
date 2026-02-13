"""Align schema with current models

Revision ID: cc58e0f9da34
Revises: bb47d9e8cf23
Create Date: 2025-08-10 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'cc58e0f9da34'
down_revision: Union[str, Sequence[str], None] = 'bb47d9e8cf23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Align database schema with current ORM models."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # Rename cards columns to match current models
    cards_columns = [c['name'] for c in inspector.get_columns('cards')]

    if 'set_identifier' in cards_columns:
        # Drop indexes referencing old column names
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('cards')]
        if 'ix_cards_set_identifier' in existing_indexes:
            op.drop_index('ix_cards_set_identifier', table_name='cards')
        if 'idx_cards_tcg_set' in existing_indexes:
            op.drop_index('idx_cards_tcg_set', table_name='cards')

        # Drop unique constraint referencing old column
        op.drop_constraint('uq_cards_type_set_number', 'cards', type_='unique')

        # Rename columns
        op.alter_column('cards', 'set_identifier', new_column_name='set_name')

        # Recreate indexes with new column name
        op.create_index('ix_cards_set_name', 'cards', ['set_name'])
        op.create_index('idx_cards_tcg_set', 'cards', ['tcg_type', 'set_name'])

    if 'card_name' in cards_columns:
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('cards')]
        if 'ix_cards_card_name' in existing_indexes:
            op.drop_index('ix_cards_card_name', table_name='cards')
        if 'idx_cards_name_search' in existing_indexes:
            op.drop_index('idx_cards_name_search', table_name='cards')

        op.alter_column('cards', 'card_name', new_column_name='name')

        op.create_index('ix_cards_name', 'cards', ['name'])
        # Recreate GIN index for text search
        try:
            op.execute('CREATE INDEX idx_cards_name_search ON cards USING gin (name gin_trgm_ops)')
        except Exception:
            op.execute('CREATE INDEX idx_cards_name_search ON cards (name)')

    # Drop tcgplayer_id and add external_id
    if 'tcgplayer_id' in cards_columns:
        # Drop unique constraint on tcgplayer_id
        try:
            op.drop_constraint('cards_tcgplayer_id_key', 'cards', type_='unique')
        except Exception:
            pass
        op.drop_column('cards', 'tcgplayer_id')

    if 'external_id' not in cards_columns:
        op.add_column('cards', sa.Column('external_id', sa.String(100), nullable=True))
        op.create_index('ix_cards_external_id', 'cards', ['external_id'])

    # Make card_number nullable (model says Optional)
    op.alter_column('cards', 'card_number', nullable=True)

    # Recreate unique constraint with new column names
    try:
        op.create_unique_constraint(
            'uq_cards_type_set_number', 'cards',
            ['tcg_type', 'set_name', 'card_number']
        )
    except Exception:
        pass

    # Drop obsolete tables
    if 'data_sources' in existing_tables:
        op.drop_table('data_sources')

    if 'api_usage_logs' in existing_tables:
        op.drop_table('api_usage_logs')


def downgrade() -> None:
    """Reverse schema alignment."""
    pass
