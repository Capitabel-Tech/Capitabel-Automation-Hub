"""
Templates for the Master Report Processor. An uploaded template overrides the
built-in default for that report type, stored in Postgres (`report_templates`)
rather than on disk, since a Render redeploy wipes local disk but the default
files bundled in backend/data/templates/ ship with the code either way - so a
report type with no upload yet still works out of the box.
"""
from datetime import datetime, timezone
from typing import Optional

from app.config import REPORT_TYPES, template_path
from app.services.db import db_cursor


class TemplateNotFoundError(Exception):
    pass


def _check_type(report_type: str) -> None:
    if report_type not in REPORT_TYPES:
        raise ValueError(f"Unknown report type: {report_type}")


def _default_bytes(report_type: str) -> Optional[bytes]:
    path = template_path(report_type)
    return path.read_bytes() if path.exists() else None


def get_template_bytes(report_type: str) -> bytes:
    """The uploaded override if one exists, else the built-in default."""
    _check_type(report_type)
    with db_cursor() as cur:
        cur.execute("select file_bytes from report_templates where report_type = %s", (report_type,))
        row = cur.fetchone()
    if row:
        return bytes(row[0])
    default = _default_bytes(report_type)
    if default is None:
        raise TemplateNotFoundError(f"No template has been uploaded yet for {report_type}.")
    return default


def get_template_last_updated(report_type: str) -> Optional[datetime]:
    _check_type(report_type)
    with db_cursor() as cur:
        cur.execute("select uploaded_at from report_templates where report_type = %s", (report_type,))
        row = cur.fetchone()
    if row:
        return row[0]
    path = template_path(report_type)
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc) if path.exists() else None


def save_template(report_type: str, file_bytes: bytes, filename: str, uploaded_by: str) -> None:
    _check_type(report_type)
    with db_cursor() as cur:
        cur.execute(
            """
            insert into report_templates (report_type, filename, file_bytes, uploaded_by)
            values (%s, %s, %s, %s)
            on conflict (report_type) do update
                set filename = excluded.filename,
                    file_bytes = excluded.file_bytes,
                    uploaded_by = excluded.uploaded_by,
                    uploaded_at = now()
            """,
            (report_type, filename, file_bytes, uploaded_by),
        )
