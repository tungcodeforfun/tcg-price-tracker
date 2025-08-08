"""Initial database schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Create custom enum types
    tcg_type_enum = postgresql.ENUM('pokemon', 'onepiece', name='tcgtypeenum', create_type=False)
    tcg_type_enum.create(op.get_bind(), checkfirst=True)
    
    card_condition_enum = postgresql.ENUM(
        'mint', 'near_mint', 'lightly_played', 'moderately_played', 
        'heavily_played', 'damaged', 'poor', 
        name='cardconditionenum', create_type=False
    )
    card_condition_enum.create(op.get_bind(), checkfirst=True)
    
    alert_type_enum = postgresql.ENUM(
        'price_drop', 'price_increase', 'availability', 
        name='alerttypeenum', create_type=False
    )
    alert_type_enum.create(op.get_bind(), checkfirst=True)
    
    data_source_enum = postgresql.ENUM(
        'tcgplayer', 'ebay', 'cardmarket', 'manual', 
        name='datasourceenum', create_type=False
    )
    data_source_enum.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('preferences', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('api_key', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('api_key')
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_api_key', 'users', ['api_key'])

    # Create tcg_sets table
    op.create_table(
        'tcg_sets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tcg_type', tcg_type_enum, nullable=False),
        sa.Column('set_code', sa.String(length=50), nullable=False),
        sa.Column('set_name', sa.String(length=255), nullable=False),
        sa.Column('release_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_cards', sa.Integer(), nullable=True),
        sa.Column('series', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tcg_type', 'set_code', name='uq_tcg_sets_type_code')
    )
    op.create_index('ix_tcg_sets_tcg_type', 'tcg_sets', ['tcg_type'])
    op.create_index('idx_tcg_sets_release', 'tcg_sets', ['release_date'])

    # Create data_sources table
    op.create_table(
        'data_sources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('api_endpoint', sa.Text(), nullable=False),
        sa.Column('auth_method', sa.String(length=20), nullable=False),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=True),
        sa.Column('rate_limit_per_hour', sa.Integer(), nullable=True),
        sa.Column('last_updated', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('config', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('ix_data_sources_is_active', 'data_sources', ['is_active'])

    # Create cards table
    op.create_table(
        'cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tcg_type', tcg_type_enum, nullable=False),
        sa.Column('set_identifier', sa.String(length=50), nullable=False),
        sa.Column('card_number', sa.String(length=20), nullable=False),
        sa.Column('card_name', sa.String(length=255), nullable=False),
        sa.Column('rarity', sa.String(length=50), nullable=True),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('tcgplayer_id', sa.Integer(), nullable=True),
        sa.Column('search_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tcg_set_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tcg_set_id'], ['tcg_sets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tcg_type', 'set_identifier', 'card_number', name='uq_cards_type_set_number'),
        sa.UniqueConstraint('tcgplayer_id')
    )
    op.create_index('ix_cards_tcg_type', 'cards', ['tcg_type'])
    op.create_index('ix_cards_set_identifier', 'cards', ['set_identifier'])
    op.create_index('ix_cards_card_name', 'cards', ['card_name'])
    op.create_index('ix_cards_rarity', 'cards', ['rarity'])
    op.create_index('ix_cards_tcg_set_id', 'cards', ['tcg_set_id'])
    op.create_index('idx_cards_tcg_set', 'cards', ['tcg_type', 'set_identifier'])
    op.create_index('idx_cards_popularity', 'cards', ['search_count'])
    
    # Create GIN index for full-text search on card names
    op.execute('CREATE INDEX idx_cards_name_search ON cards USING gin (card_name gin_trgm_ops)')

    # Create price_history table with partitioning consideration
    op.create_table(
        'price_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('card_id', sa.Integer(), nullable=False),
        sa.Column('source', data_source_enum, nullable=False),
        sa.Column('price_low', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('price_high', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('price_avg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('market_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('condition', card_condition_enum, nullable=False, server_default='near_mint'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('sample_size', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['card_id'], ['cards.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('card_id', 'source', 'timestamp', 'condition', name='uq_price_history_card_source_time_condition')
    )
    op.create_index('ix_price_history_card_id', 'price_history', ['card_id'])
    op.create_index('ix_price_history_source', 'price_history', ['source'])
    op.create_index('ix_price_history_timestamp', 'price_history', ['timestamp'])
    op.create_index('idx_price_history_card_time', 'price_history', ['card_id', 'timestamp'])
    op.create_index('idx_price_history_card_source_time', 'price_history', ['card_id', 'source', 'timestamp'])
    
    # Create partial index for recent prices (using a simple index instead of partial to avoid immutable function issues)
    op.create_index('idx_price_history_recent', 'price_history', ['timestamp'])

    # Create user_alerts table
    op.create_table(
        'user_alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('card_id', sa.Integer(), nullable=False),
        sa.Column('price_threshold', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('alert_type', alert_type_enum, nullable=False),
        sa.Column('comparison_operator', sa.String(length=5), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_triggered', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['card_id'], ['cards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_alerts_user_id', 'user_alerts', ['user_id'])
    op.create_index('ix_user_alerts_card_id', 'user_alerts', ['card_id'])
    op.create_index('ix_user_alerts_is_active', 'user_alerts', ['is_active'])
    
    # Create partial indexes for active alerts
    op.execute('CREATE INDEX idx_user_alerts_active ON user_alerts (card_id, price_threshold, comparison_operator) WHERE is_active = true')
    op.execute('CREATE INDEX idx_user_alerts_user_active ON user_alerts (user_id, is_active)')

    # Create api_usage_logs table
    op.create_table(
        'api_usage_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('api_key', sa.String(length=64), nullable=True),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=False),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_api_usage_logs_user_id', 'api_usage_logs', ['user_id'])
    op.create_index('ix_api_usage_logs_api_key', 'api_usage_logs', ['api_key'])
    op.create_index('ix_api_usage_logs_timestamp', 'api_usage_logs', ['timestamp'])
    op.create_index('idx_api_usage_user_time', 'api_usage_logs', ['user_id', 'timestamp'])
    op.create_index('idx_api_usage_endpoint_time', 'api_usage_logs', ['endpoint', 'timestamp'])
    op.create_index('idx_api_usage_status_time', 'api_usage_logs', ['response_status', 'timestamp'])


def downgrade() -> None:
    """Downgrade database schema."""
    # Drop tables in reverse order
    op.drop_table('api_usage_logs')
    op.drop_table('user_alerts')
    op.drop_table('price_history')
    op.drop_table('cards')
    op.drop_table('data_sources')
    op.drop_table('tcg_sets')
    op.drop_table('users')
    
    # Drop enum types
    data_source_enum = postgresql.ENUM(name='datasourceenum')
    data_source_enum.drop(op.get_bind(), checkfirst=True)
    
    alert_type_enum = postgresql.ENUM(name='alerttypeenum')
    alert_type_enum.drop(op.get_bind(), checkfirst=True)
    
    card_condition_enum = postgresql.ENUM(name='cardconditionenum')
    card_condition_enum.drop(op.get_bind(), checkfirst=True)
    
    tcg_type_enum = postgresql.ENUM(name='tcgtypeenum')
    tcg_type_enum.drop(op.get_bind(), checkfirst=True)