import os
import json
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AuthenticationError as OpenAIAuthError

from app.settings import INCOMING_DIR, logger
from app.services.activity_log import log_activity
from app.services.firebase_auth import require_auth
from app.services.meeting_extraction import extract_meeting_details_with_ai
from app.services.zoho_client import push_meetings_to_zoho

AI_KEY_EXPIRED_MSG = (
    "The AI service isn't working right now — its API key has expired or is invalid. "
    "Please ask your admin to renew it."
)

router = APIRouter(prefix="/api", tags=["meetings"])


async def meeting_processing_stream(file: UploadFile):
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in [".xlsx", ".xls"]:
        yield json.dumps({
            "type": "error",
            "msg": f"Unsupported file type '{file_ext or 'unknown'}'. Meetings only accepts Excel files (.xlsx, .xls)."
        }) + "\n"
        return

    os.makedirs(INCOMING_DIR, exist_ok=True)
    temp_path = os.path.join(INCOMING_DIR, file.filename)

    yield json.dumps({"type": "progress", "percent": 2, "msg": "Waking up AI..."}) + "\n"
    await asyncio.sleep(0.3)
    yield json.dumps({"type": "progress", "percent": 12, "msg": "Uploading document..."}) + "\n"
    content = await file.read()
    with open(temp_path, "wb") as buffer:
        buffer.write(content)
    await asyncio.sleep(0.3)

    yield json.dumps({"type": "progress", "percent": 28, "msg": "Scanning Excel rows..."}) + "\n"
    await asyncio.sleep(0.4)

    yield json.dumps({"type": "progress", "percent": 48, "msg": "Extracting Meeting Intelligence..."}) + "\n"
    try:
        extracted, total_rows = await extract_meeting_details_with_ai(temp_path)
    except OpenAIAuthError:
        logger.error("OpenAI API key is invalid/expired — meeting extraction cannot run.")
        yield json.dumps({"type": "error", "code": "AI_KEY_EXPIRED", "msg": AI_KEY_EXPIRED_MSG}) + "\n"
        return

    if not extracted or "meetings" not in extracted:
        yield json.dumps({"type": "error", "msg": "No meetings found in file"}) + "\n"
        return

    yield json.dumps({"type": "progress", "percent": 82, "msg": "Filtering data literal truths..."}) + "\n"
    await asyncio.sleep(0.3)
    yield json.dumps({"type": "progress", "percent": 96, "msg": "Finalizing Review..."}) + "\n"

    frontend_meetings = []
    seen = set()

    top_staff = ""

    for m in extracted["meetings"]:
        meeting_staff = m.get("staff")
        if meeting_staff == "Unknown" or meeting_staff is None:
            meeting_staff = ""

        m_title = m.get("title") or "Field Meeting"
        m_name = m.get("name") or m.get("Contact_Name") or "Unknown Contact"
        m_phone = str(m.get("phone") or m.get("Phone") or "").strip()
        m_start = m.get("from")
        m_end = m.get("to")
        m_loc = m.get("location")
        m_desc = m.get("description")

        # Exact Deduplication Key
        dup_key = (m_title, m_name, m_phone, m_start, m_end, m_loc, m_desc)
        if dup_key in seen:
            continue
        seen.add(dup_key)

        frontend_meetings.append({
            "Meeting_Title": m_title,
            "Contact_Name": m_name,
            "phone": m_phone,
            "Start_DateTime": m_start,
            "End_DateTime": m_end,
            "Location": m_loc,
            "Description": m_desc,
            "Staff": meeting_staff
        })

    yield json.dumps({"type": "progress", "percent": 100, "msg": "Ready!"}) + "\n"
    yield json.dumps({
        "type": "result",
        "filename": file.filename,
        "meetings": frontend_meetings,
        "staff": top_staff,
        "total_rows_detected": total_rows
    }) + "\n"


@router.post("/process-meeting")
async def process_meeting(file: UploadFile = File(...), user: dict = Depends(require_auth("leads_meetings"))):
    return StreamingResponse(meeting_processing_stream(file), media_type="text/event-stream")


class MeetingSubmission(BaseModel):
    meetings: list
    filename: Optional[str] = None
    staff: Optional[str] = None


async def _sync_meetings_stream_with_logging(sub: MeetingSubmission, user: dict):
    final_results = None
    async for line in push_meetings_to_zoho(sub.meetings, sub.filename, sub.staff):
        try:
            data = json.loads(line)
            if data.get("type") == "result":
                final_results = data.get("results", [])
        except Exception:
            pass
        yield line

    if final_results is not None:
        succeeded = sum(1 for r in final_results if r.get("success"))
        failed = len(final_results) - succeeded
        log_activity(
            user["uid"], user["email"], "leads_meetings", "SYNC_MEETINGS_TO_ZOHO",
            "success" if failed == 0 else "failure",
            {"filename": sub.filename, "succeeded": succeeded, "failed": failed, "total": len(final_results)},
        )
    else:
        log_activity(
            user["uid"], user["email"], "leads_meetings", "SYNC_MEETINGS_TO_ZOHO", "failure",
            {"filename": sub.filename, "note": "stream ended without a result"},
        )


@router.post("/sync-meetings")
async def sync_meetings(sub: MeetingSubmission, user: dict = Depends(require_auth("leads_meetings"))):
    # Sort meetings chronologically
    try:
        sub.meetings.sort(key=lambda x: x.get("Start_DateTime", ""))
    except Exception:
        pass

    return StreamingResponse(
        _sync_meetings_stream_with_logging(sub, user),
        media_type="text/event-stream"
    )
