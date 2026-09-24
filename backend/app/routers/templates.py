import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import REPORT_TYPES, TEMPLATE_ANCHOR_HEADERS
from app.services import template_store
from app.services.activity_log import log_activity
from app.services.excel_engine import EngineError, read_template
from app.services.firebase_auth import require_auth

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _validate_report_type(report_type: str) -> str:
    report_type = report_type.lower()
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail=f"Unknown report type: {report_type}")
    return report_type


@router.get("/{report_type}/meta")
def template_meta(report_type: str, user: dict = Depends(require_auth("master_report"))):
    report_type = _validate_report_type(report_type)
    last_updated = template_store.get_template_last_updated(report_type)
    return {"report_type": report_type, "last_updated": last_updated.isoformat() if last_updated else None}


@router.get("/{report_type}")
def download_template(report_type: str, user: dict = Depends(require_auth("master_report"))):
    report_type = _validate_report_type(report_type)
    try:
        file_bytes = template_store.get_template_bytes(report_type)
    except template_store.TemplateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{report_type}_template.xlsx"'},
    )


@router.post("/{report_type}")
async def upload_template(report_type: str, file: UploadFile, user: dict = Depends(require_auth("master_report"))):
    report_type = _validate_report_type(report_type)
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file.")

    content = await file.read()

    # validate it parses as a well-formed template before accepting it
    try:
        read_template(io.BytesIO(content), anchor_headers=TEMPLATE_ANCHOR_HEADERS[report_type])
    except EngineError as e:
        log_activity(
            user["uid"], user["email"], "master_report", "UPLOAD_TEMPLATE", "failure",
            {"report_type": report_type, "error": str(e)},
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        log_activity(
            user["uid"], user["email"], "master_report", "UPLOAD_TEMPLATE", "failure",
            {"report_type": report_type, "error": "not a valid template"},
        )
        raise HTTPException(status_code=400, detail="Could not read this file as a valid template.")

    template_store.save_template(report_type, content, file.filename, user["email"])
    log_activity(
        user["uid"], user["email"], "master_report", "UPLOAD_TEMPLATE", "success",
        {"report_type": report_type, "filename": file.filename},
    )
    return {"status": "ok", "report_type": report_type}
