"""
Duplicate-audio detection. A file's identity is the MD5 of its raw bytes (not
its name), and a hash is only recorded once the lead has actually synced to
Zoho. Stored in Postgres (`processed_files`) rather than on disk, since the
host's disk is wiped on every redeploy.
"""
import hashlib
from typing import Optional

from app.services.db import db_cursor
from app.settings import logger


def calculate_file_hash(file_content: bytes) -> str:
    return hashlib.md5(file_content).hexdigest()


def is_file_duplicate(file_hash: str) -> bool:
    # Fails open: if the database is down, allow the upload rather than block
    # every user - Zoho's own phone-based dedupe is still a backstop.
    try:
        with db_cursor() as cur:
            cur.execute("select 1 from processed_files where file_hash = %s", (file_hash,))
            return cur.fetchone() is not None
    except Exception as e:
        logger.error(f"Duplicate-file check failed, allowing upload: {e}")
        return False


def register_file_hash(file_hash: str, filename: str, zoho_id: Optional[str] = None) -> None:
    try:
        with db_cursor() as cur:
            cur.execute(
                """
                insert into processed_files (file_hash, filename, zoho_id)
                values (%s, %s, %s)
                on conflict (file_hash) do nothing
                """,
                (file_hash, filename, zoho_id),
            )
    except Exception as e:
        logger.error(f"Error registering file hash: {e}")
