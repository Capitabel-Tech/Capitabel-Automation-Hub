import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response

from app.services.activity_log import log_activity
from app.services.firebase_auth import require_auth
from app.config import (
    DEALS_STAGES,
    LEAD_STATUS_FILTER,
    PERIOD_OPTIONS,
    PIPELINE_HIGH_STAGES,
    PIPELINE_HIGH_STAGE_ORDER,
    PIPELINE_LOW_STAGES,
    PIPELINE_LOW_STAGE_ORDER,
    QUARTER_MONTHS,
    REPORT_TYPES,
    TEMPLATE_ANCHOR_HEADERS,
    current_and_complete_quarters,
    current_month_label,
    current_month_range,
    fiscal_year_label,
    fiscal_year_range,
    fiscal_year_start_year,
    quarter_date_range,
)
from app.services import template_store
from app.services.excel_engine import (
    EngineError,
    build_master_workbook,
    parse_date_value,
    process_quarter,
    read_raw_upload,
    read_template,
)

router = APIRouter(prefix="/api/process", tags=["process"])


@router.post("/master")
async def process_master_report(
    file: Optional[UploadFile] = None,
    leads_file: Optional[UploadFile] = None,
    meetings_file: Optional[UploadFile] = None,
    user: dict = Depends(require_auth("master_report")),
):
    # Each of the three reports is independent - only require whichever ones
    # were actually uploaded, and build whichever sheets that data supports.
    if not (file or leads_file or meetings_file):
        raise HTTPException(status_code=400, detail="Please upload at least one report.")

    for f in (file, leads_file, meetings_file):
        if f is not None and not f.filename.lower().endswith((".xlsx", ".xlsm")):
            raise HTTPException(status_code=400, detail="Please upload .xlsx files.")

    try:
        deals_template = pipeline_high_template = pipeline_low_template = None
        leads_template = meetings_template = None
        if file is not None:
            deals_template = read_template(
                io.BytesIO(template_store.get_template_bytes("deals")),
                anchor_headers=TEMPLATE_ANCHOR_HEADERS["deals"],
            )
            pipeline_high_template = read_template(
                io.BytesIO(template_store.get_template_bytes("pipeline_high")),
                anchor_headers=TEMPLATE_ANCHOR_HEADERS["pipeline_high"],
            )
            pipeline_low_template = read_template(
                io.BytesIO(template_store.get_template_bytes("pipeline_low")),
                anchor_headers=TEMPLATE_ANCHOR_HEADERS["pipeline_low"],
            )
        if leads_file is not None:
            leads_template = read_template(
                io.BytesIO(template_store.get_template_bytes("leads")),
                anchor_headers=TEMPLATE_ANCHOR_HEADERS["leads"],
            )
        if meetings_file is not None:
            meetings_template = read_template(
                io.BytesIO(template_store.get_template_bytes("meetings")),
                anchor_headers=TEMPLATE_ANCHOR_HEADERS["meetings"],
            )
    except template_store.TemplateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    today = date.today()
    current_quarter, complete_quarters = current_and_complete_quarters(today)
    fy_start = fiscal_year_start_year(today)
    quarter_ranges = {q: quarter_date_range(q, fy_start) for q in QUARTER_MONTHS}
    fy_range = fiscal_year_range(fy_start)
    fy_label = fiscal_year_label(fy_start)
    month_range = current_month_range(today)
    month_label = current_month_label(today)

    try:
        raw_rows = (
            read_raw_upload(await file.read(), anchor_headers=TEMPLATE_ANCHOR_HEADERS["deals"])
            if file is not None
            else None
        )
        leads_rows = (
            read_raw_upload(await leads_file.read(), anchor_headers=TEMPLATE_ANCHOR_HEADERS["leads"])
            if leads_file is not None
            else None
        )
        meetings_rows = (
            read_raw_upload(await meetings_file.read(), anchor_headers=TEMPLATE_ANCHOR_HEADERS["meetings"])
            if meetings_file is not None
            else None
        )
        # The raw export's "From" (meeting start, with a time component) is a
        # stable Zoho-vs-business naming/format difference, not accidental
        # drift - rename it to "date of meeting" and drop the time so it
        # matches the template's passthrough column by exact header text.
        if meetings_rows is not None:
            for row in meetings_rows:
                row["date of meeting"] = parse_date_value(row.get("from"))
        output_bytes = build_master_workbook(
            deals_template,
            pipeline_high_template,
            pipeline_low_template,
            raw_rows,
            current_quarter,
            complete_quarters,
            quarter_ranges,
            fy_range,
            DEALS_STAGES,
            PIPELINE_HIGH_STAGES,
            PIPELINE_LOW_STAGES,
            pipeline_high_stage_order=PIPELINE_HIGH_STAGE_ORDER,
            pipeline_low_stage_order=PIPELINE_LOW_STAGE_ORDER,
            leads_template=leads_template,
            leads_raw_rows=leads_rows,
            lead_status_filter=LEAD_STATUS_FILTER,
            fiscal_year_label_=fy_label,
            meetings_template=meetings_template,
            meetings_raw_rows=meetings_rows,
            meeting_date_header="date of meeting",
            meeting_month_range=month_range,
            meeting_month_label=month_label,
        )
    except EngineError as e:
        log_activity(
            user["uid"], user["email"], "master_report", "GENERATE_REPORT", "failure",
            {"error": str(e)},
        )
        raise HTTPException(status_code=400, detail=str(e))

    out_name = f"MIS {today.isoformat()}.xlsx"
    log_activity(
        user["uid"], user["email"], "master_report", "GENERATE_REPORT", "success",
        {
            "filename": out_name,
            "included_master": file is not None,
            "included_leads": leads_file is not None,
            "included_meetings": meetings_file is not None,
        },
    )
    return Response(
        content=output_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )


@router.post("/{report_type}/{period}")
async def process_raw_upload(report_type: str, period: str, file: UploadFile):
    report_type = report_type.lower()
    period = period.upper()
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail=f"Unknown report type: {report_type}")
    period_labels = PERIOD_OPTIONS.get(report_type)
    if period_labels is None:
        raise HTTPException(
            status_code=404, detail=f"No single-period flow for report type: {report_type}"
        )
    if period not in period_labels:
        raise HTTPException(status_code=404, detail=f"Unknown period: {period}")
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file.")

    try:
        template_bytes = io.BytesIO(template_store.get_template_bytes(report_type))
    except template_store.TemplateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    content = await file.read()

    # The quarter-mismatch date check only makes sense for Deals, which is
    # scoped to an actual calendar quarter. Pipeline's "periods" are just the
    # full pipeline vs. a <20% probability subset, not different date ranges.
    quarter_kwargs = {}
    if report_type == "deals":
        quarter_kwargs = {
            "expected_months": QUARTER_MONTHS[period],
            "quarter_months_map": QUARTER_MONTHS,
        }

    try:
        output_bytes = process_quarter(
            template_bytes,
            content,
            period_labels[period],
            anchor_headers=TEMPLATE_ANCHOR_HEADERS[report_type],
            **quarter_kwargs,
        )
    except EngineError as e:
        raise HTTPException(status_code=400, detail=str(e))

    out_name = f"{report_type}_{period}_processed.xlsx"
    return Response(
        content=output_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )
