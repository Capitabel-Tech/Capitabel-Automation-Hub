import os
import re

from app.settings import logger
from app.services.excel_engine import normalize_header

# Which column-header variations map to each logical field, case/whitespace
# insensitive. This replaces what used to be an AI prompt's "COLUMN MAPPING" -
# same list, just enforced directly instead of relying on a model to follow it.
# Add a new variation here if a real file ever uses a header that isn't matched.
COLUMN_SYNONYMS = {
    "title": ["title", "type", "meeting type", "category"],
    "name": ["name", "person name", "client name", "customer name", "contact name"],
    "phone": [
        "phone number", "phone no", "phone", "mobile", "mobile no",
        "cell no", "contact no", "contact number", "ph no", "ph",
    ],
    "location": ["area / location", "area", "location", "place", "region", "area/location"],
    "staff": ["staff", "staff name", "employee", "agent", "field agent", "representative"],
    "date": ["date", "meeting date", "visit date", "day"],
    "time_from": ["time from", "from", "start time", "start", "time start"],
    "time_to": ["time to", "to", "end time", "end", "time end"],
    "note": ["note", "notes", "remarks", "comments", "description", "remark"],
}


MIN_MATCHED_FIELDS_FOR_HEADER_ROW = 4


def _find_header_row(raw_df, max_scan: int = 10) -> int | None:
    """Real meeting sheets often have a title line (and a blank row) above
    the actual column headers - scans the first `max_scan` rows for the one
    that looks like the header, rather than assuming it's row 0.

    A candidate row qualifies if it maps to more than
    MIN_MATCHED_FIELDS_FOR_HEADER_ROW of our actual declared fields (reusing
    _map_columns itself, the same check that later does the real mapping) -
    not just "contains 2 header-ish words somewhere", which a stray row could
    satisfy by coincidence."""
    for i in range(min(max_scan, len(raw_df))):
        cells = raw_df.iloc[i].tolist()
        if len(_map_columns(cells)) > MIN_MATCHED_FIELDS_FOR_HEADER_ROW:
            return i
    return None


def _map_columns(columns) -> dict[str, str]:
    """Returns {canonical field -> actual column name in the sheet}, for
    whichever fields were found. A field with no matching column is simply
    left out (callers treat that the same as every row having it blank)."""
    reverse = {}
    for field, variants in COLUMN_SYNONYMS.items():
        for variant in variants:
            reverse.setdefault(variant, field)

    mapped: dict[str, str] = {}
    for col in columns:
        field = reverse.get(normalize_header(col))
        if field and field not in mapped:
            mapped[field] = col
    return mapped


def _cell(row, col_name: str | None) -> str | None:
    if col_name is None:
        return None
    value = row.get(col_name)
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return None
    return text


def _fix_capitalization(value: str) -> str:
    return value.strip().title()


def _clean_phone(value: str) -> str:
    return re.sub(r"\s+", "", value)


_ISO_DATE_RE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})")


def _parse_date(value: str):
    # dateutil's dayfirst=True still swaps the day/month of an unambiguous
    # "YYYY-MM-DD" string (e.g. turns 2026-04-09 into 2026-09-04) - which is
    # exactly the format pandas produces when a real Excel date cell gets
    # stringified. Handle that form explicitly before falling back to
    # dayfirst parsing for actually-ambiguous formats like "23-04-2026".
    from datetime import date as date_cls

    iso_match = _ISO_DATE_RE.match(value.strip())
    if iso_match:
        year, month, day = (int(g) for g in iso_match.groups())
        try:
            return date_cls(year, month, day)
        except ValueError:
            return None

    from dateutil import parser as date_parser

    try:
        return date_parser.parse(value, dayfirst=True).date()
    except (ValueError, OverflowError):
        return None


def _parse_time(value: str | None):
    if not value:
        return 0, 0
    from dateutil import parser as date_parser

    try:
        parsed = date_parser.parse(value)
        return parsed.hour, parsed.minute
    except (ValueError, OverflowError):
        return 0, 0


def _combine(the_date, time_value: str | None) -> str:
    from datetime import datetime

    hour, minute = _parse_time(time_value)
    return datetime(the_date.year, the_date.month, the_date.day, hour, minute, 0).isoformat()


def _build_description(note: str | None, phone: str | None) -> str:
    if note and phone:
        return f"{note}. Contact: {phone}"
    if note:
        return note
    if phone:
        return f"Contact: {phone}"
    return "No additional details"


def extract_meeting_details(file_path):
    """Deterministic replacement for what used to be an AI call: reads the
    raw Excel export, maps its columns by name (see COLUMN_SYNONYMS), and
    applies the same per-row rules a human reading the sheet would. No
    network call, no token limit, no model variance between runs.

    Returns ({"meetings": [...]}, total_rows), matching the shape the router
    expects - total_rows is just an informational count for the UI, not used
    in matching or syncing."""
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in [".xlsx", ".xls"]:
        logger.warning(f"Unsupported file type for meetings: {file_ext}. Only Excel is supported.")
        return None, 0

    try:
        import pandas as pd

        # Force all columns to strings so dates/phone numbers don't get
        # reformatted or lose leading characters on the way in. Read with no
        # header first - real meeting sheets often have a title line (and a
        # blank row) above the actual column headers.
        raw = pd.read_excel(file_path, dtype=str, header=None)
        header_row = _find_header_row(raw)
        if header_row is None:
            logger.error("Could not find a recognizable header row (SN/Title/Name/Phone/...) in the first 10 rows.")
            return None, 0

        df = raw.iloc[header_row + 1:].copy()
        df.columns = raw.iloc[header_row].tolist()
        # Drop rows with fewer than 4 non-blank values - blank separator rows,
        # not real data.
        df = df.dropna(thresh=4)
    except Exception as e:
        logger.error(f"Excel reading error: {e}")
        return None, 0

    total_rows = len(df)
    col_map = _map_columns(df.columns)

    meetings = []
    for _, row in df.iterrows():
        name = _cell(row, col_map.get("name"))
        date_text = _cell(row, col_map.get("date"))
        if not name or not date_text:
            continue  # Name or Date blank -> skip this row entirely

        parsed_date = _parse_date(date_text)
        if parsed_date is None:
            continue  # a Date value that can't actually be read as a date

        title = _cell(row, col_map.get("title"))
        phone_raw = _cell(row, col_map.get("phone"))
        phone = _clean_phone(phone_raw) if phone_raw else None
        location_raw = _cell(row, col_map.get("location"))
        staff_raw = _cell(row, col_map.get("staff"))
        note = _cell(row, col_map.get("note"))

        meetings.append({
            "title": title,
            "from": _combine(parsed_date, _cell(row, col_map.get("time_from"))),
            "to": _combine(parsed_date, _cell(row, col_map.get("time_to"))),
            "name": _fix_capitalization(name),
            "phone": phone,
            "host": "Capital Solution",
            "location": _fix_capitalization(location_raw) if location_raw else None,
            "description": _build_description(note, phone),
            "staff": _fix_capitalization(staff_raw) if staff_raw else None,
        })

    return {"meetings": meetings}, total_rows
