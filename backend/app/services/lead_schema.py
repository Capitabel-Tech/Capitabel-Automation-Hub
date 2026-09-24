"""
The lead review form's fields and dropdown choices, mirroring the production
Zoho Leads layout (Individual and Company). frontend/src/leadSchema.js holds
the same lists for the UI - keep the two in sync.

Dropdown values must match Zoho's picklists exactly (spelling and case),
because Zoho rejects a value that isn't in the list.
"""
import re
from typing import Any

SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]
TYPES_OF_CUSTOMER = ["Individual", "Company"]
LEAD_SOURCES = [
    "Associations", "Channel Partnership", "Cold Call", "Customer Referral",
    "Employee Referral", "External Referral", "Facebook", "Field Activity",
    "Flyer", "Hoardings", "Partner", "Sunpack Board", "Trade Show",
]
LEAD_STATUSES = [
    "New", "In-Progress", "Enquiry", "Pre Qualified", "Not Qualified",
    "Junk", "Cold", "Cancelled",
]
OCCUPATIONS = ["Home Maker", "Pensioner", "Salaried", "Self Employed", "Student", "Un-Employed"]
COMPANY_TYPES = [
    "General Partnership", "Limited Liability Partnership", "One Person Company",
    "Private Limited Company", "Section 8 Company", "Sole Proprietorship",
]
MSME_OPTIONS = ["Yes", "No"]
LOAN_TYPES = [
    "Business Loan", "Commercial Loan - Commercial Land / Property",
    "Commercial Real Estate Loan", "Home Loan - Balance + Top Up",
    "Home Loan - Balance Transfer", "Home Loan - Construction",
    "Home Loan - Extension/ Improvement", "Home Loan - New Purchase",
    "Home Loan - Plot", "Home Loan - Short Term Bridge", "Home Loan - Top Up",
    "Loan Against Property", "MSME - BG", "MSME - CC", "MSME - CGTMSE",
    "MSME - LAP", "MSME - LC", "MSME - OD / Working Capital", "MSME - Term Loan",
    "Other Loan", "Personal Loan", "Vehicle Loan",
]
PROPERTY_TYPES = [
    "Commercial Property", "Farm Lands", "Fund Based", "Residential Cum Commercial",
    "Residential-Let Out", "Residential-Self Occupancy", "Stock & Debtors",
    "Unsecure", "Vacant Land-Commercial", "Vacant Land-Residential", "Vehicle",
]

PICKLISTS = {
    "Salutation": SALUTATIONS,
    "Type_of_Customer": TYPES_OF_CUSTOMER,
    "Lead_Source": LEAD_SOURCES,
    "Lead_Status": LEAD_STATUSES,
    "Occupation": OCCUPATIONS,
    "Company_Type": COMPANY_TYPES,
    "MSME_Registered": MSME_OPTIONS,
    "Loan_Type": LOAN_TYPES,
    "Property_Type": PROPERTY_TYPES,
}

# Free-typed text (no list to check against).
TEXT_FIELDS = [
    "Lead_Owner", "Assigned_To", "Campaign_Source", "Referred_By",
    "First_Name", "Last_Name", "Email", "Mobile", "PAN", "Aadhar_No", "Profession",
    "Organisation", "Company_Name", "Company_PAN", "POC_Name", "POC_Contact_Mobile",
    "POC_Designation", "POC_Email_Id", "Company_GST", "Company_Industry",
    "Street", "City", "State", "ZIP", "Country", "Location", "Note",
]
# Rupee amounts - stored as plain digits (Zoho's Currency fields reject "₹1,10,000").
AMOUNT_FIELDS = ["Monthly_Income", "Requested_Loan_Amount", "Annual_Turnover"]
DATE_FIELDS = ["Date_of_Birth", "Date_of_Incorporation"]

ALL_FIELDS = list(PICKLISTS) + TEXT_FIELDS + AMOUNT_FIELDS + DATE_FIELDS

DEFAULTS = {
    "Type_of_Customer": "Individual",
    "Lead_Status": "New",
    "Lead_Source": "External Referral",
}


def _match_pick(value: Any, options: list[str]) -> str:
    """Returns the option matching `value` ignoring case/extra spaces, else ''."""
    cleaned = " ".join(str(value or "").split()).lower()
    for opt in options:
        if opt.lower() == cleaned:
            return opt
    return ""


def clean_fields(data: dict) -> dict:
    """Shapes the AI's raw output into exactly the form's fields: dropdowns
    are forced to a valid choice (or left blank), amounts to digits, dates to
    YYYY-MM-DD, and everything else to trimmed text."""
    out: dict[str, Any] = {}
    for key, options in PICKLISTS.items():
        out[key] = _match_pick(data.get(key), options) or DEFAULTS.get(key, "")
    for key in TEXT_FIELDS:
        out[key] = str(data.get(key) or "").strip()
    for key in AMOUNT_FIELDS:
        out[key] = re.sub(r"[^0-9]", "", str(data.get(key) or ""))
    for key in DATE_FIELDS:
        raw = str(data.get(key) or "").strip()
        out[key] = raw if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw) else ""
    return out
