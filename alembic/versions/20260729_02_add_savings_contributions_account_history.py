"""add savings contributions and account history

Revision ID: 20260729_02
Revises: 20260729_01
Create Date: 2026-07-29
"""

from __future__ import annotations

from alembic import context, op

from app.database import DB_SCHEMA
from app.finance.models import AccountUpdateHistory, SavingsContribution

revision = "20260729_02"
down_revision = "20260729_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    x_args = context.get_x_argument(as_dictionary=True)
    scope = (x_args.get("scope") or "monolith").strip().lower()
    if scope not in {"finance", "monolith"}:
        return

    AccountUpdateHistory.__table__.create(bind=bind, checkfirst=True)
    SavingsContribution.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    x_args = context.get_x_argument(as_dictionary=True)
    scope = (x_args.get("scope") or "monolith").strip().lower()
    if scope not in {"finance", "monolith"}:
        return

    SavingsContribution.__table__.drop(bind=bind, checkfirst=True)
    AccountUpdateHistory.__table__.drop(bind=bind, checkfirst=True)
