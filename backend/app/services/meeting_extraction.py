import os
import json
import asyncio
from datetime import datetime

from openai import AuthenticationError as OpenAIAuthError
from app.settings import openai_client, logger, MEETING_MODEL

SYSTEM_PROMPT_MEETING_EXTRACTION = """
You are a strict JSON extraction agent for Capital Solution company field work reports.
Your ONLY job is to extract data from Excel rows and return a valid JSON object.

## STEP 1 — HEADER SCAN (do this BEFORE any extraction):
- Read the first non-empty row as the header row
- Map each column to its logical field using the COLUMN MAPPING below
- Never assume a fixed column position (A, B, C...) — always go by column name
- If a column does not match any known variation → ignore it

## COLUMN MAPPING (match any of these variations, case-insensitive):
- SN       → "SN", "S.No", "S No", "Serial", "No", "#"
- Title    → "Title", "Type", "Meeting Type", "Category"
- Name     → "Name", "Person Name", "Client Name", "Customer Name", "Contact Name"
- Phone    → "Phone Number", "Phone No", "Phone", "Mobile", "Mobile No",
             "Cell No", "Contact No", "Contact Number", "Ph No", "Ph"
- Location → "Area / Location", "Area", "Location", "Place", "Region", "Area/Location"
- Staff    → "Staff", "Staff Name", "Employee", "Agent", "Field Agent", "Representative"
- Date     → "Date", "Meeting Date", "Visit Date", "Day"
- TimeFrom → "Time From", "From", "Start Time", "Start", "Time Start"
- TimeTo   → "Time To", "To", "End Time", "End", "Time End"
- Note     → "Note", "Notes", "Remarks", "Comments", "Description", "Remark"

## IF A COLUMN IS NOT FOUND IN THE SHEET:
- Title not found     → default to "Field Meeting"
- Name not found      → skip the row entirely
- Phone not found     → set phone to null
- Location not found  → set location to null
- Staff not found     → set staff to null
- Date not found      → skip the row entirely
- TimeFrom not found  → set "from" to "[DATE]T00:00:00"
- TimeTo not found    → set "to" to "[DATE]T00:00:00"
- Note not found      → use "Contact: [phone]" as description

## SKIP RULES:
- **Rule 1:** Extract EVERY SINGLE row from the document. Do NOT stop early.
- **Rule 2:** Count the number of rows in the input. If there are N rows, you MUST return exactly N meeting objects. Do not stop early.
- **Rule 3:** Only skip a row if the Name or Date is completely blank.
- **Rule 4:** NEVER deduplicate. If there are multiple rows with the exact same Name (e.g., "Ramesh"), you MUST extract EACH ONE as a separate meeting object.
- **Rule 5:** If the time is missing but the Date is present, you MUST NOT skip the row. Set the time to 00:00:00.
- Never include empty/blank rows in the output.

## TITLE RULES:
- Use the value from the mapped Title column exactly as given
- If the Title column is empty for a row → use "Field Meeting"
- NEVER use the Note column value as the title

## NAME RULES:
- Use the value from the mapped Name column exactly as given
- Fix capitalization (e.g. "akash" → "Akash", "VASIM" → "Vasim")
- If Name is empty → skip this row entirely

## PHONE RULES:
- Use the value from the mapped Phone column
- Remove all spaces (e.g. "70324 67794" → "7032467794")
- Keep the +91 prefix if present, but remove spaces (e.g. "+91 73867 54137" → "+917386754137")
- If Phone is empty → set to null

## HOST RULES:
- Always set to "Capital Solution" for every single entry
- No exceptions, never change this value

## Area/Location RULES:
- Use the value from the mapped Area/Location column
- Capitalize properly (e.g. "NAIDUPETA" → "Naidupeta", "sulurupeta" → "Sulurupeta")
- If Location is empty → set to null

## ⚠️ CRITICAL — DATE/TIME RULES:
- The Date column contains the actual date for EACH ROW — read it per row
- Do NOT assume all rows share the same date
- The year for BOTH 'from' and 'to' MUST be identical and MUST match the year found in the Date column.
- NEVER mix years (e.g., from 2025 to 2026) within a single meeting object.
- Date may appear in formats like "23-04-2026", "2026-04-23", "23/04/2026" — parse all correctly
- Time From and Time To are in H:MM or HH:MM format (e.g. "9:40", "10:02", "11:30")
- Combine Date + Time From → "from" field in ISO 8601 format
- Combine Date + Time To   → "to" field in ISO 8601 format
- Output format: "YYYY-MM-DDTHH:MM:00"
- Example: Date="23-04-2026", Time From="9:40" → "from": "2026-04-23T09:40:00"
- If Date is empty for a row → skip that row

## STAFF RULES:
- Use the value from the mapped Staff column exactly as given
- Fix capitalization if needed (e.g. "narendra" → "Narendra")
- If Staff is empty → set staff to null

## DESCRIPTION RULES:
- Format: "[Note value]. Contact: [phone]"
- Example: "Customer. Contact: 7032467794"
- If Note is empty but phone exists → use "Contact: [phone]"
- If both Note and Phone are empty → use "No additional details"
- NEVER use Note content as the title

## OUTPUT RULES:
- Return ONLY a valid JSON object with key "meetings" containing an array
- No markdown, no code blocks, no explanation, no extra text before or after
- Every entry must have exactly these 9 fields: title, from, to, name, phone, host, location, description, staff
- Preserve the original row order (by SN)

## OUTPUT FORMAT:
{
  "meetings": [
    {
      "title": "Field Meeting",
      "from": "2026-04-23T09:40:00",
      "to": "2026-04-23T10:02:00",
      "name": "Akash",
      "phone": "7032467794",
      "host": "Capital Solution",
      "location": "Naidupeta",
      "description": "Customer. Contact: 7032467794",
      "staff": "Narendra"
    }
  ]
}

## ✅ VALIDATION CHECKLIST — verify before returning output:
[ ] Header scan completed and columns mapped correctly
[ ] Every row with a valid Name and Date is included
[ ] No empty or blank rows are included
[ ] Each "from" and "to" uses the Date from THAT specific row
[ ] No date is today's date or any hardcoded date
[ ] Phone numbers have no spaces
[ ] +91 prefix preserved where present, with no spaces
[ ] Location is properly capitalized
[ ] All 9 fields are present in every entry
[ ] Output is pure JSON only — no markdown, no extra text
"""


def extract_text_from_doc(file_path):
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext in ['.xlsx', '.xls']:
        try:
            import pandas as pd
            # Force all columns to be read as strings to prevent date/number shifting
            df = pd.read_excel(file_path, dtype=str)
            # Drop rows that have less than 4 non-null values (ensures we keep valid rows while dropping blank/title rows)
            df_cleaned = df.dropna(thresh=4)

            # The header row will also be in df_cleaned if we didn't specify header properly,
            # so the actual number of data rows is the length of df_cleaned minus 1 (assuming 1 header row).
            # But let's check if the first row in df_cleaned is actually the header.
            total_rows = max(0, len(df_cleaned) - 1)

            raw_json = df_cleaned.to_json(orient='records')
            with open("sync_debug.log", "a", encoding="utf-8") as f:
                f.write(f"[DEBUG] Raw Excel Data: {raw_json[:500]}...\n")
            return raw_json, total_rows
        except Exception as e:
            logger.error(f"Excel reading error: {e}")
            return "", 0

    return "", 0


async def extract_meeting_details_with_ai(file_path):
    file_ext = os.path.splitext(file_path)[1].lower()
    if file_ext not in ['.xlsx', '.xls']:
        logger.warning(f"Unsupported file type for meetings: {file_ext}. Only Excel is supported.")
        return None

    prompt = f"{SYSTEM_PROMPT_MEETING_EXTRACTION}\nToday is {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}."
    text, total_rows = extract_text_from_doc(file_path)
    if not text:
        return None, 0

    messages = [
        {"role": "system", "content": "You are a specialized Excel data analyst. Extract all rows into JSON accurately."},
        {"role": "user", "content": f"{prompt}\n\nExcel Content (JSON Format):\n{text}"}
    ]

    try:
        logger.info(f"Using OpenAI Vision/Chat ({MEETING_MODEL}) for extraction...")
        response = openai_client.chat.completions.create(
            model=MEETING_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=16384
        )
        raw_content = response.choices[0].message.content
        with open("sync_debug.log", "a", encoding="utf-8") as f:
            f.write(f"\n[DEBUG] AI RAW RESPONSE: {raw_content}\n")
        logger.info(f"AI RAW RESPONSE: {raw_content}")
        parsed_json = json.loads(raw_content)
        return parsed_json, total_rows

    except asyncio.TimeoutError:
        logger.error("AI Extraction Error: Request timed out after 180s")
        return None, 0
    except OpenAIAuthError:
        # Let this propagate — the router turns it into a clear
        # "renew the API key" message instead of a confusing generic error.
        raise
    except Exception as e:
        import traceback
        logger.error(f"AI Extraction Error: {str(e)}")
        logger.error(traceback.format_exc())
        return None, 0
