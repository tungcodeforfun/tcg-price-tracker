"""Add username field to users table

Revision ID: 001_add_username
Revises: 
Create Date: 2025-08-09

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001_add_username'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add username field to users table."""
    # Add username column with temporary default
    op.add_column('users', 
        sa.Column('username', sa.String(length=50), nullable=False, server_default='')
    )
    
    # Update existing users with unique usernames
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT id FROM users"))
    for row in result:
        connection.execute(
            sa.text("UPDATE users SET username = :username WHERE id = :id"),
            {"username": f"user_{row.id}", "id": row.id}
        )
    
    # Remove server default
    op.alter_column('users', 'username', server_default=None)
    
    # Add unique constraint
    op.create_unique_constraint('uq_users_username', 'users', ['username'])
    
    # Add index for performance
    op.create_index('ix_users_username', 'users', ['username'])


def downgrade() -> None:
    """Remove username field from users table."""
    op.drop_index('ix_users_username', table_name='users')
    op.drop_constraint('uq_users_username', 'users', type_='unique')
    op.drop_column('users', 'username')