"""
Shared Postgres connection pool (the Supabase database, via DATABASE_URL).
Used by activity logging and duplicate-file tracking. Callers decide how to
handle an unavailable database - both current callers treat it as best-effort.
"""
import time
from contextlib import contextmanager

from app.settings import DATABASE_URL, logger

_pool = None
_last_failure_time = None
_RETRY_COOLDOWN_SECONDS = 10  # avoid hammering a genuinely-down database on every request


def _get_pool():
    global _pool, _last_failure_time
    if _pool is not None:
        return _pool

    # A failed attempt is only retried after the cooldown - otherwise a
    # transient blip at startup (e.g. one dropped connection to the Supabase
    # pooler) would permanently break the database for this process's entire
    # lifetime, since every call before this used to cache that first failure
    # forever and never try again until a manual restart.
    if _last_failure_time is not None and time.monotonic() - _last_failure_time < _RETRY_COOLDOWN_SECONDS:
        return None

    if not DATABASE_URL:
        logger.warning("Database isn't configured (missing DATABASE_URL).")
        _last_failure_time = time.monotonic()
        return None

    try:
        from psycopg2 import pool as pg_pool
        _pool = pg_pool.SimpleConnectionPool(1, 5, DATABASE_URL)
        _last_failure_time = None
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        _pool = None
        _last_failure_time = time.monotonic()

    return _pool


@contextmanager
def db_cursor():
    """Yields a cursor inside a transaction that commits on success and rolls
    back on error. Raises RuntimeError if the database isn't available."""
    conn_pool = _get_pool()
    if conn_pool is None:
        raise RuntimeError("Database isn't configured or reachable.")

    conn = conn_pool.getconn()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn_pool.putconn(conn)
