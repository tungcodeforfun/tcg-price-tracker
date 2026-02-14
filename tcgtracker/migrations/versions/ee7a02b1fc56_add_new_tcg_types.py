"""Add magic, yugioh, lorcana, digimon to TCGTypeEnum

Revision ID: ee7a02b1fc56
Revises: dd69f1a0eb45
Create Date: 2026-02-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers
revision: str = 'ee7a02b1fc56'
down_revision: Union[str, Sequence[str], None] = 'dd69f1a0eb45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new TCG types to tcgtypeenum."""
    op.execute("ALTER TYPE tcgtypeenum ADD VALUE IF NOT EXISTS 'magic'")
    op.execute("ALTER TYPE tcgtypeenum ADD VALUE IF NOT EXISTS 'yugioh'")
    op.execute("ALTER TYPE tcgtypeenum ADD VALUE IF NOT EXISTS 'lorcana'")
    op.execute("ALTER TYPE tcgtypeenum ADD VALUE IF NOT EXISTS 'digimon'")


def downgrade() -> None:
    """PostgreSQL does not support removing enum values directly.

    To rollback, manually recreate the enum with only the original values.
    See migration 002_add_pricing_sources for the pattern.
    """
    pass
