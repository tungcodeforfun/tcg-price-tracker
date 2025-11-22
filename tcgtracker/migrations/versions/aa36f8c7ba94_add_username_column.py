"""add_username_column

Revision ID: aa36f8c7ba94
Revises: 002_add_pricing_sources
Create Date: 2025-08-09 11:06:51.001958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa36f8c7ba94'
down_revision: Union[str, Sequence[str], None] = '002_add_pricing_sources'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add username column to users table
    op.add_column('users', sa.Column('username', sa.String(50), nullable=True))
    
    # Create unique index for username
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    
    # Update existing users to have a username based on email (temporary)
    # This ensures we can set nullable=False after populating the field
    op.execute("""
        UPDATE users 
        SET username = SPLIT_PART(email, '@', 1) || '_' || id
        WHERE username IS NULL
    """)
    
    # Now make the column non-nullable
    op.alter_column('users', 'username', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the index first
    op.drop_index('ix_users_username', table_name='users')
    
    # Drop the username column
    op.drop_column('users', 'username')
