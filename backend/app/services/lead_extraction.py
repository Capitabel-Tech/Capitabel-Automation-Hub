import os
import json

from app.settings import openai_client, logger
from app.services.lead_schema import (
    clean_fields, SALUTATIONS, TYPES_OF_CUSTOMER, LEAD_SOURCES, LEAD_STATUSES,
    OCCUPATIONS, COMPANY_TYPES, MSME_OPTIONS, LOAN_TYPES, PROPERTY_TYPES,
)


def _opts(values):
    return " | ".join(f"'{v}'" for v in values)


SYSTEM_PROMPT_EXTRACTION = f"""You are an Autonomous Senior Zoho CRM Architect & Data Auditor.
Your task is to analyze the literal transcript, extract data, and assess quality.

AUDITOR PROTOCOLS:
- Confidence_Score: Rate the clarity of the lead data from 0-100.
- Needs_Review: Set to TRUE if:
  * Last_Name is 'Unknown'.
  * Requested_Loan_Amount is missing.
  * The transcript is too noisy/brief to confirm intent.

ZERO-LOSS MANDATE:
- NEVER add "Thank you for watching" or pleasantries.
- Stop exactly where the transcript ends.

GOLDEN RULE: fill a field ONLY when the transcript clearly states it. Never guess or infer. Anything not clearly stated must be null - staff will fill it in by hand.

EXTRACTION RULES:
1. ENTITY IDENTIFICATION: Identify subject as 'Last_Name'. Agent is ignored.
   - If the transcript only mentions one name (e.g. "Karthik"), set it as 'Last_Name' and keep 'First_Name' as NULL. NEVER repeat the same name in both.
   - If the name is completely unknown, but the transcript mentions a reference or referral source (e.g. "referred by Ashok"), set Last_Name to "Unknown (Ashok)".
   - If NO name and NO reference are found, use a key identifier from the transcript in brackets, such as their profession, location, or loan requirement (e.g., "Unknown (Doctor from Delhi)", "Unknown (Seeking 30L PL)"). Do NOT just use "Unknown".
2. CUSTOMER TYPE: 'Company' when the lead is a business entity (private limited, LLP, partnership, proprietorship firm, trust, etc.) and the loan is for that entity; otherwise 'Individual'.
   - Individual leads use: Salutation, First_Name, Email, Date_of_Birth, Mobile, PAN, Occupation, Aadhar_No, Profession, Monthly_Income, Organisation (the person's employer).
   - Company leads use: Company_Name, Company_Type, Company_PAN, Date_of_Incorporation, POC_Name, POC_Contact_Mobile, POC_Designation, POC_Email_Id, MSME_Registered, Company_GST, Annual_Turnover, Company_Industry. For a Company, Last_Name is the contact person if one is named, otherwise the company name.
   - Fill only the group matching the customer type; leave the other group null.
3. FINANCIAL PRECISION: Monthly_Income, Requested_Loan_Amount and Annual_Turnover are rupee amounts written as plain digits only (e.g. "150000"), no symbols or commas. Convert "1.5 crore" to "15000000" and "1.1 lakh" to "110000".
4. DATES: Date_of_Birth and Date_of_Incorporation as YYYY-MM-DD, only if fully stated.
5. DROPDOWNS - use EXACTLY one of the listed values, or null if the transcript does not clearly match one:
   - Salutation: {_opts(SALUTATIONS)}
   - Type_of_Customer: {_opts(TYPES_OF_CUSTOMER)}
   - Occupation: {_opts(OCCUPATIONS)}
   - Company_Type: {_opts(COMPANY_TYPES)}
   - MSME_Registered: {_opts(MSME_OPTIONS)}
   - Loan_Type: {_opts(LOAN_TYPES)}
   - Property_Type (the kind of property/security for the loan): {_opts(PROPERTY_TYPES)}
   - Lead_Source: {_opts(LEAD_SOURCES)}. Use "External Referral" if no source is mentioned.
6. ADDRESS: Extract Street, City, State, ZIP (digits), Country and the property Location only if explicitly stated.
7. PERSONAL IDENTIFIERS: Extract Date_of_Birth, PAN and Aadhar_No ONLY if explicitly stated. Never guess.
8. REFERRAL: If a specific referrer's name is mentioned (e.g. "referred by Ashok"), extract it as 'Referred_By'. This is separate from the Lead_Source category.
9. CONTACT: Mobile is the customer's phone number, digits only.
10. NOTE: A short professional summary (1-3 sentences) of the call outcome and next step.

LEAD STATUS - use ONLY one of: {_opts(LEAD_STATUSES)}.
    - 'New': FIRST CRM ENTRY. Lead is just being logged into the CRM for the first time (e.g., 'new lead login'). Even if requirements are mentioned, if it is the very first CRM logging event without PD/Processing, it MUST be New.
    - 'Enquiry': Conversation already happened and requirements discussed, but NO processing or PD has started.
    - 'In-Progress': PD (Personal Discussion) completed OR documents collected OR loan processing/eligibility check has actively started.
    - 'Cold': Customer delays decision or asks to follow up later.
    - 'Not Qualified': Customer fails eligibility criteria (CIBIL, income, FOIR, policy rejection).
    - 'Junk': Spam, invalid lead, wrong number, or no business intent.
    - 'Pre Qualified' and 'Cancelled': ONLY if the transcript explicitly says so.
    FINAL PRODUCTION RULES (DECISION TREE):
    1. First time entry into CRM (e.g., 'new lead login', 'capture this info') -> MUST be 'New'.
    2. Requirement discussion done but NOT first entry -> MUST be 'Enquiry'.
    3. PD (Personal discussion) done or processing actively started -> MUST be 'In-Progress'.
    4. Override any agent-provided status if it contradicts this decision tree.
    5. Choose ONLY ONE correct status.

OUTPUT SCHEMA (JSON, every key present, null when not clearly stated):
{{
  "Type_of_Customer": "Individual or Company",
  "Last_Name": "string",
  "First_Name": "string or null",
  "Salutation": "one of the list or null",
  "Email": "string or null",
  "Mobile": "digits or null",
  "Date_of_Birth": "YYYY-MM-DD or null",
  "PAN": "string or null",
  "Occupation": "one of the list or null",
  "Aadhar_No": "string or null",
  "Profession": "string or null",
  "Monthly_Income": "digits or null",
  "Organisation": "string or null",
  "Company_Name": "string or null",
  "Company_Type": "one of the list or null",
  "Company_PAN": "string or null",
  "Date_of_Incorporation": "YYYY-MM-DD or null",
  "POC_Name": "string or null",
  "POC_Contact_Mobile": "digits or null",
  "POC_Designation": "string or null",
  "POC_Email_Id": "string or null",
  "MSME_Registered": "Yes/No or null",
  "Company_GST": "string or null",
  "Annual_Turnover": "digits or null",
  "Company_Industry": "string or null",
  "Street": "string or null",
  "City": "string or null",
  "State": "string or null",
  "ZIP": "string or null",
  "Country": "string or null",
  "Loan_Type": "one of the list or null",
  "Property_Type": "one of the list or null",
  "Requested_Loan_Amount": "digits or null",
  "Location": "string or null",
  "Lead_Source": "one of the list",
  "Lead_Status": "one of the list",
  "Referred_By": "string or null",
  "Note": "1-3 sentence summary",
  "Confidence_Score": 0-100,
  "Needs_Review": true or false
}}
"""


def extract_staff_from_filename(filename):
    """
    Extracts staff name from filename pattern like 'field activity_29-04-26_narendra.pdf'
    Returns the last part before the extension if underscores are present.
    """
    if not filename:
        return ""
    try:
        # Remove extension and get basename
        name_no_ext = os.path.splitext(os.path.basename(filename))[0]
        if "_" in name_no_ext:
            parts = name_no_ext.split("_")
            if len(parts) >= 2:
                # Typically format is description_date_staff or activity_staff
                staff_name = parts[-1].strip()
                # Simple check: if it's a date-like string (contains hyphens/slashes), it might not be the name
                # but the user's example shows narendra at the end.
                return staff_name.capitalize()
    except Exception as e:
        logger.error(f"Error extracting staff from filename: {e}")
    return ""


def extract_lead_fields(transcript):
    """
    Runs AI extraction on a transcript and returns a clean, editable dict of
    lead fields. Called as its own step (before submit) so staff can review
    and correct the individual fields in the UI, instead of only seeing raw
    transcript text.
    """
    logger.info("Extracting Structured Intelligence from Transcript...")
    extract_res = openai_client.chat.completions.create(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT_EXTRACTION},
            {"role": "user", "content": f"TRANSCRIPT:\n{transcript}"}
        ],
        model="gpt-4o",
        temperature=0,
        response_format={"type": "json_object"},
        timeout=20.0
    )
    data = json.loads(extract_res.choices[0].message.content)
    fields = clean_fields(data)

    first_name = fields["First_Name"]
    last_name = fields["Last_Name"] or "Inquiry"

    # Robust Name Deduplication (handles "Name Name Name", "First Last Last")
    new_words = []
    for w in last_name.split():
        if not new_words or w.lower() != new_words[-1].lower():
            new_words.append(w)
    last_name = " ".join(new_words)

    # TO PREVENT "Karthik Karthik": If they match, clear First_Name.
    if first_name.lower() == last_name.lower():
        first_name = ""

    fields["First_Name"] = first_name
    fields["Last_Name"] = last_name
    fields["Confidence_Score"] = data.get("Confidence_Score")
    fields["Needs_Review"] = bool(data.get("Needs_Review"))
    return fields
