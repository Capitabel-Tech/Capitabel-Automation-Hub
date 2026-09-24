import os
import json
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AuthenticationError as OpenAIAuthError

from app.settings import logger, INCOMING_DIR
from app.services.activity_log import log_activity
from app.services.lead_transcripts import save_lead_transcript
from app.services.audio_transcription import transcribe_audio, translate_and_clean
from app.services.firebase_auth import require_auth
from app.services.lead_extraction import extract_lead_fields, extract_staff_from_filename
from app.services.file_hash import calculate_file_hash, is_file_duplicate, register_file_hash
from app.services.zoho_client import push_to_zoho
from app.services.zoho_lookup import LOOKUP_LABELS, resolve_lookups

AI_KEY_EXPIRED_MSG = (
    "The AI service isn't working right now — its API key has expired or is invalid. "
    "Please ask your admin to renew it."
)

router = APIRouter(prefix="/api", tags=["leads"])


async def lead_processing_stream(file: UploadFile):
    os.makedirs(INCOMING_DIR, exist_ok=True)
    temp_path = os.path.join(INCOMING_DIR, file.filename)
    content = await file.read()
    file_hash = calculate_file_hash(content)

    if is_file_duplicate(file_hash):
        yield json.dumps({
            "type": "error",
            "code": "DUPLICATE_FILE",
            "msg": "This exact audio file has already been synced to Zoho as a lead. "
                   "If you need to process it again anyway, rename the file and re-upload."
        }) + "\n"
        return

    with open(temp_path, "wb") as buffer:
        buffer.write(content)

    yield json.dumps({"type": "progress", "percent": 8, "msg": "Waking up AI..."}) + "\n"
    await asyncio.sleep(0.2)
    yield json.dumps({"type": "progress", "percent": 20, "msg": "Uploading audio..."}) + "\n"

    # Stage 1: Transcribe in the ORIGINAL language(s) — no translation yet.
    # gpt-4o-transcribe handles code-switched audio (English/Tamil/Telugu/Hindi/Kannada
    # mixed in one recording) more reliably than translating in the same pass.
    yield json.dumps({"type": "progress", "percent": 35, "msg": "Transcribing audio..."}) + "\n"
    try:
        raw_text, transcription_failed = transcribe_audio(
            file.filename, content,
            prompt="This is a real estate home loan sales field call recording, often mixing English "
                   "with Tamil, Telugu, Hindi, and Kannada."
        )
    except OpenAIAuthError:
        yield json.dumps({"type": "error", "code": "AI_KEY_EXPIRED", "msg": AI_KEY_EXPIRED_MSG}) + "\n"
        return

    if transcription_failed:
        logger.error(f"Transcription still broken (loop or too-short) after retry: {raw_text[:300]}...")
        yield json.dumps({
            "type": "error",
            "code": "TRANSCRIPTION_FAILED",
            "msg": "The AI could not reliably transcribe this audio — it either got stuck repeating "
                   "a phrase, or returned far less text than a recording this long should have. "
                   "This usually happens on unclear or noisy audio. Please check the recording and "
                   "try again."
        }) + "\n"
        return

    logger.info(f"RAW TRANSCRIPT (native language): {raw_text}")

    # Stage 2: Translate to English + remove filler words in one LLM pass.
    yield json.dumps({"type": "progress", "percent": 60, "msg": "Translating & cleaning transcript..."}) + "\n"
    try:
        clean_text = translate_and_clean(raw_text)
    except OpenAIAuthError:
        yield json.dumps({"type": "error", "code": "AI_KEY_EXPIRED", "msg": AI_KEY_EXPIRED_MSG}) + "\n"
        return

    staff = extract_staff_from_filename(file.filename)

    yield json.dumps({"type": "progress", "percent": 82, "msg": "Extracting lead fields..."}) + "\n"
    try:
        fields = extract_lead_fields(clean_text)
    except OpenAIAuthError:
        yield json.dumps({"type": "error", "code": "AI_KEY_EXPIRED", "msg": AI_KEY_EXPIRED_MSG}) + "\n"
        return
    if staff:
        note = fields.get("Note", "")
        fields["Note"] = "\n\n".join(part for part in (note, f"Recorded by: {staff}") if part)

    yield json.dumps({"type": "progress", "percent": 100, "msg": "Ready!"}) + "\n"
    yield json.dumps({
        "type": "result",
        "filename": file.filename,
        "transcript": clean_text,
        "staff": staff,
        "fields": fields
    }) + "\n"


@router.post("/process-audio")
async def process_audio(file: UploadFile = File(...), user: dict = Depends(require_auth("leads_meetings"))):
    return StreamingResponse(lead_processing_stream(file), media_type="text/event-stream")


class LeadFields(BaseModel):
    Type_of_Customer: str = "Individual"
    Lead_Owner: str = ""
    Assigned_To: str = ""
    Campaign_Source: str = ""
    Lead_Source: str = ""
    Lead_Status: str = "New"
    Referred_By: str = ""
    Last_Name: str = ""
    Salutation: str = ""
    First_Name: str = ""
    Email: str = ""
    Date_of_Birth: str = ""
    Mobile: str = ""
    PAN: str = ""
    Occupation: str = ""
    Aadhar_No: str = ""
    Profession: str = ""
    Monthly_Income: str = ""
    Organisation: str = ""
    Company_Name: str = ""
    Company_Type: str = ""
    Company_PAN: str = ""
    Date_of_Incorporation: str = ""
    POC_Name: str = ""
    POC_Contact_Mobile: str = ""
    POC_Designation: str = ""
    POC_Email_Id: str = ""
    MSME_Registered: str = ""
    Company_GST: str = ""
    Annual_Turnover: str = ""
    Company_Industry: str = ""
    Street: str = ""
    City: str = ""
    State: str = ""
    ZIP: str = ""
    Country: str = ""
    Loan_Type: str = ""
    Property_Type: str = ""
    Requested_Loan_Amount: str = ""
    Location: str = ""
    Note: str = ""
    Confidence_Score: Optional[int] = None
    Needs_Review: bool = False


class TranscriptSubmission(BaseModel):
    transcript: str
    filename: str
    staff: Optional[str] = None
    fields: LeadFields
    confirm_duplicate: bool = False


@router.post("/submit-to-zoho")
async def final_submit(sub: TranscriptSubmission, user: dict = Depends(require_auth("leads_meetings"))):
    fields = sub.fields.dict()

    # Link fields (owner, assigned to, referred by, campaign) go to Zoho as record
    # IDs. A name with no single exact match is left empty in Zoho and written
    # into the Note instead, so it isn't lost.
    lookup_ids, unresolved = await run_in_threadpool(resolve_lookups, fields)
    if unresolved:
        lines = [f"{LOOKUP_LABELS[key]}: {name} (not found in Zoho)" for key, name in unresolved]
        not_found = "; ".join(lines)
        fields["Note"] = "\n\n".join(part for part in (fields.get("Note", ""), not_found) if part)

    zoho_id, zoho_error, duplicate = await push_to_zoho(fields, lookup_ids, confirm_duplicate=sub.confirm_duplicate)

    if duplicate:
        # Nothing was created or changed in Zoho - just tell the caller so they
        # can ask "create a new lead anyway?" and resubmit with confirm_duplicate.
        return {
            "status": "duplicate",
            "msg": f"A lead with this mobile number already exists in Zoho ({duplicate.get('name', 'Unknown')}).",
        }

    save_lead_transcript(user["email"], sub.filename, sub.transcript, fields, zoho_id)
    if zoho_id:
        # Register hash only on successful Zoho sync
        try:
            temp_path = os.path.join(INCOMING_DIR, sub.filename)
            if os.path.exists(temp_path):
                with open(temp_path, "rb") as f:
                    file_hash = calculate_file_hash(f.read())
                    register_file_hash(file_hash, sub.filename, zoho_id)
        except Exception:
            pass

        log_activity(
            user["uid"], user["email"], "leads_meetings", "SYNC_TO_ZOHO", "success",
            {"filename": sub.filename, "zoho_id": zoho_id},
        )
        return {"status": "success", "msg": f"Lead created in Zoho! ID: {zoho_id}"}

    log_activity(
        user["uid"], user["email"], "leads_meetings", "SYNC_TO_ZOHO", "failure",
        {"filename": sub.filename, "error": zoho_error},
    )
    return {
        "status": "error",
        "msg": f"Zoho push failed: {zoho_error or 'unknown error'}",
    }
