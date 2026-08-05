from __future__ import annotations

from argparse import Namespace
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import settings
from app.database import _normalize_db_url

import logging
import os

logger = logging.getLogger(__name__)

def run_migrations(scope: str) -> None:
    skip_migrations = os.getenv("SKIP_MIGRATIONS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if skip_migrations:
        logger.info("Startup migration skipped for scope %s", scope)
        return
    project_root = Path(__file__).resolve().parents[1]
    alembic_ini = project_root / "alembic.ini"
    alembic_dir = project_root / "alembic"

    cfg = Config(str(alembic_ini))
    cfg.set_main_option("script_location", str(alembic_dir))
    migration_url = _normalize_db_url(settings.db_url)
    cfg.set_main_option("sqlalchemy.url", migration_url.replace("%", "%%"))

    # Pass runtime scope into Alembic env/revisions via context.get_x_argument().
    cfg.cmd_opts = Namespace(x=[f"scope={scope}"], tag=None, raiseerr=True)

    command.upgrade(cfg, "head")

