"""reconcile schema with models

Columns renamed and is_admin added by hand-run SQL were never captured in
the Alembic chain; this brings a chain-built database in line with the models.

Revision ID: dde982cf9401
Revises: ee7a02b1fc56
Create Date: 2026-09-25 06:31:36.809520

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dde982cf9401'
down_revision: Union[str, Sequence[str], None] = 'ee7a02b1fc56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('cards', 'name', new_column_name='card_name')
    op.alter_column('cards', 'set_name', new_column_name='set_identifier')
    op.alter_column(
        'cards', 'external_id',
        new_column_name='tcgplayer_id',
        type_=sa.String(length=255),
        existing_type=sa.String(length=100),
    )
    op.execute('ALTER INDEX ix_cards_name RENAME TO ix_cards_card_name')
    op.execute('ALTER INDEX ix_cards_set_name RENAME TO ix_cards_set_identifier')
    op.drop_index('ix_cards_external_id', table_name='cards')
    op.create_unique_constraint('cards_tcgplayer_id_key', 'cards', ['tcgplayer_id'])

    op.create_unique_constraint(
        'uq_collection_items_user_card_condition',
        'collection_items',
        ['user_id', 'card_id', 'condition'],
    )

    op.add_column(
        'users',
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.drop_constraint('users_api_key_key', 'users', type_='unique')
    op.drop_constraint('users_email_key', 'users', type_='unique')
    op.drop_index('ix_users_api_key', table_name='users')
    op.create_index('ix_users_api_key', 'users', ['api_key'], unique=True)
    op.drop_index('ix_users_email', table_name='users')
    op.create_index('ix_users_email', 'users', ['email'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_users_email', table_name='users')
    op.create_index('ix_users_email', 'users', ['email'], unique=False)
    op.drop_index('ix_users_api_key', table_name='users')
    op.create_index('ix_users_api_key', 'users', ['api_key'], unique=False)
    op.create_unique_constraint('users_email_key', 'users', ['email'])
    op.create_unique_constraint('users_api_key_key', 'users', ['api_key'])
    op.drop_column('users', 'is_admin')

    op.drop_constraint('uq_collection_items_user_card_condition', 'collection_items', type_='unique')

    op.drop_constraint('cards_tcgplayer_id_key', 'cards', type_='unique')
    op.create_index('ix_cards_external_id', 'cards', ['tcgplayer_id'], unique=False)
    op.execute('ALTER INDEX ix_cards_set_identifier RENAME TO ix_cards_set_name')
    op.execute('ALTER INDEX ix_cards_card_name RENAME TO ix_cards_name')
    op.alter_column(
        'cards', 'tcgplayer_id',
        new_column_name='external_id',
        type_=sa.String(length=100),
        existing_type=sa.String(length=255),
    )
    op.alter_column('cards', 'set_identifier', new_column_name='set_name')
    op.alter_column('cards', 'card_name', new_column_name='name')
