"""
Keeps the full transcript of every lead submitted from the review screen in
Postgres. Best-effort like activity logging: a database problem must never
stop the Zoho sync itself.
"""
import json
from typing import Optional

from app.services.db import db_cursor
from app.settings import logger


def save_lead_transcript(
    email: str, filename: str, transcript: str, fields: dict, zoho_id: Optional[str]
) -> None:
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                insert into lead_transcripts (email, filename, transcript, fields, zoho_id)
                values (%s, %s, %s, %s, %s)
                """,
                (email, filename, transcript, json.dumps(fields), zoho_id),
            )
    except Exception as e:
        logger.error(f"Failed to save lead transcript ({filename}): {e}")
