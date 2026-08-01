from __future__ import annotations

from alembic import op

from app.ai_agent.models import PendingChatAction


revision = '20260729_01'
down_revision = '20260430_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    PendingChatAction.__table__.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PendingChatAction.__table__.drop(op.get_bind(), checkfirst=True)
