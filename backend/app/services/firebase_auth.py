"""
Verifies that a request really comes from a signed-in Firebase user, using
the Firebase Admin SDK - server-side, so it can't be faked by editing
frontend code. Each tool has its own Firebase project (see frontend/src/
firebase.js), so each needs its own Admin SDK app + service account key.

This is intentionally separate from the frontend's own Firebase config: the
frontend uses public API keys suitable for a browser; this uses a private
service account key that must never leave the backend.
"""
import os
import threading
from typing import Literal, Optional

import firebase_admin
from fastapi import Header, HTTPException
from firebase_admin import auth as firebase_auth_sdk
from firebase_admin import credentials

from app.settings import (
    BASE_DIR,
    FIREBASE_LEADS_SERVICE_ACCOUNT,
    FIREBASE_MASTER_REPORT_SERVICE_ACCOUNT,
    logger,
)

Tool = Literal["leads_meetings", "master_report"]

_SERVICE_ACCOUNT_PATHS: dict[Tool, Optional[str]] = {
    "leads_meetings": FIREBASE_LEADS_SERVICE_ACCOUNT,
    "master_report": FIREBASE_MASTER_REPORT_SERVICE_ACCOUNT,
}
_APP_NAMES: dict[Tool, str] = {
    "leads_meetings": "auth-leads_meetings",
    "master_report": "auth-master_report",
}
_apps: dict[Tool, firebase_admin.App] = {}
# FastAPI runs sync dependencies (this one included) in a thread pool, so
# several requests for the same tool can genuinely run _get_app() at once -
# e.g. the Master Report page fires 5 parallel template-meta requests on
# load, all needing the same "master_report" app. Without a lock, more than
# one thread can pass the "not yet initialized" check before either finishes,
# and each then calls initialize_app() with the same name, which Firebase
# rejects for every caller after the first.
_init_lock = threading.Lock()


def _get_app(tool: Tool) -> firebase_admin.App:
    """Lazily initializes (once) the Admin SDK app for `tool`. Raises a clear
    503 rather than crashing the whole server if that tool's service account
    key hasn't been configured yet."""
    if tool in _apps:
        return _apps[tool]

    with _init_lock:
        if tool in _apps:  # another thread may have finished while we waited
            return _apps[tool]

        path = _SERVICE_ACCOUNT_PATHS.get(tool)
        if not path:
            raise HTTPException(
                status_code=503,
                detail=f"Server-side auth for '{tool}' isn't configured yet (missing service account key).",
            )
        if not os.path.isabs(path):
            path = os.path.join(BASE_DIR, path)

        try:
            cred = credentials.Certificate(path)
            app = firebase_admin.initialize_app(cred, name=_APP_NAMES[tool])
        except FileNotFoundError:
            raise HTTPException(
                status_code=503,
                detail=f"Server-side auth for '{tool}' isn't configured yet (service account file not found: {path}).",
            )
        except ValueError:
            # An app with this name already exists in firebase_admin's own
            # registry (e.g. left over from a prior reload in this process) -
            # reuse it instead of treating that as a failure.
            app = firebase_admin.get_app(name=_APP_NAMES[tool])
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin app for '{tool}': {e}")
            raise HTTPException(status_code=503, detail=f"Server-side auth for '{tool}' failed to initialize.")

        _apps[tool] = app
        return app


def verify_token(id_token: str, tool: Tool) -> dict:
    """Verifies a Firebase ID token against `tool`'s own Firebase project.
    Returns {"uid": ..., "email": ...} on success. Raises HTTPException(401)
    on an invalid/expired token, or HTTPException(503) if that tool's server
    -side auth isn't configured."""
    app = _get_app(tool)
    try:
        decoded = firebase_auth_sdk.verify_id_token(id_token, app=app)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired session: {e}")

    return {"uid": decoded.get("uid"), "email": decoded.get("email")}


def require_auth(tool: Tool):
    """FastAPI dependency factory: Depends(require_auth("master_report")).
    Expects an `Authorization: Bearer <firebase-id-token>` header."""

    def _dependency(authorization: Optional[str] = Header(default=None)) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
        id_token = authorization.split(" ", 1)[1].strip()
        return verify_token(id_token, tool)

    return _dependency
