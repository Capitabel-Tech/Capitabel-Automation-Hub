from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.services.activity_log import log_activity
from app.services.firebase_auth import verify_token

router = APIRouter(prefix="/api", tags=["activity-log"])


class LogEventRequest(BaseModel):
    tool: Literal["leads_meetings", "master_report"]
    action: str  # e.g. "LOGIN", "LOGOUT", "SIGNUP"
    status: Literal["success", "failure"]
    details: Optional[dict] = None
    # Only used for a "failure" event, where Firebase never issued a token
    # (e.g. a wrong-password login attempt) - there is nothing to verify in
    # that case, so it's recorded as a self-reported, unverified attempt.
    attempted_email: Optional[str] = None


@router.post("/log-event")
async def log_event(body: LogEventRequest, authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        id_token = authorization.split(" ", 1)[1].strip()
        user = verify_token(id_token, body.tool)
        log_activity(
            user_id=user["uid"],
            email=user["email"],
            tool=body.tool,
            action=body.action,
            status=body.status,
            details=body.details,
        )
        return {"status": "logged", "verified": True}

    # No token to verify - only acceptable for a failure event (a failed
    # login/sign-up genuinely has no Firebase token to prove identity with).
    if body.status != "failure":
        raise HTTPException(
            status_code=401,
            detail="A success event must include a valid Authorization header.",
        )

    log_activity(
        user_id="unverified",
        email=body.attempted_email or "unknown",
        tool=body.tool,
        action=body.action,
        status=body.status,
        details={**(body.details or {}), "verified": False},
    )
    return {"status": "logged", "verified": False}
