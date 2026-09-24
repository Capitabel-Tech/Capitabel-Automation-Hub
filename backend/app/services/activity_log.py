"""
Writes rows to the `activity_logs` table - login/logout, sign-up, and business
actions (processing a report, uploading a template, syncing to Zoho). Logging
is always best-effort: a database outage or misconfiguration must never break
the actual action it's logging, so every failure here is caught and just
logged locally, never raised.
"""
import json
from typing import Literal, Optional

from app.services.db import db_cursor
from app.settings import logger

Tool = Literal["leads_meetings", "master_report"]


def log_activity(
    user_id: str,
    email: str,
    tool: Tool,
    action: str,
    status: Literal["success", "failure"],
    details: Optional[dict] = None,
) -> None:
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                insert into activity_logs (user_id, email, tool, action, status, details)
                values (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, email, tool, action, status, json.dumps(details or {})),
            )
    except Exception as e:
        logger.error(f"Failed to write activity log ({tool}/{action}): {e}")
