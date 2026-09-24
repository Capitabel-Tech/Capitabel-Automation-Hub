"""
Where each review-form field goes in Zoho Leads: form key -> Zoho API name.

All names were read from the production Zoho org's field list (read-only
settings/fields check). Watch for the two quirks Zoho has there:
  * Labels and API names don't always line up: the box labelled "Profession"
    is stored as `Organisation`, and the box labelled "Organisation" as
    `Organisation1`; Loan Type is `Purpose`, Occupation is `Employment_1`.
  * Dropdowns store a different value from what they display (e.g. Lead Status
    "New" is stored as `Contacted`). The API needs the stored value - see
    PICKLIST_STORED_VALUES. Re-check both if an admin edits the fields.

A value of None means "not sent" (logged on the server). Zoho silently ignores
a field name it doesn't recognise, so a wrong name here loses data without any
error - don't guess names.

Lookup fields (Lead_Owner, Assigned_To, Referred_By, Campaign_Source) need a
record ID rather than typed text, so they aren't sent until the name-to-record
search exists; LOOKUP_FIELDS records where each one points.
"""
from typing import Optional

from app.services.lead_schema import AMOUNT_FIELDS

ZOHO_LEAD_FIELDS: dict[str, Optional[str]] = {
    # Basic Info
    "Type_of_Customer": "Type_of_Customer",
    "Lead_Owner": None,
    "Assigned_To": None,
    "Campaign_Source": None,
    "Lead_Source": "Lead_Source",
    "Lead_Status": "Lead_Status",
    "Referred_By": None,
    "Last_Name": "Last_Name",
    # Individual
    "Salutation": "Salutation",
    "First_Name": "First_Name",
    "Email": "Email",
    "Date_of_Birth": "DOB",
    "Mobile": "Mobile",
    "PAN": "PAN",
    "Occupation": "Employment_1",
    "Aadhar_No": "Aadhar_No",
    "Profession": "Organisation",
    "Monthly_Income": "Monthly_Income",
    "Organisation": "Organisation1",
    # Company
    "Company_Name": "Company_Name",
    "Company_Type": "Company_Type",
    "Company_PAN": "Company_PAN",
    "Date_of_Incorporation": "Date_of_Incorporation",
    "POC_Name": "POC_Name",
    "POC_Contact_Mobile": "POC_Contact_Mobile",
    "POC_Designation": "POC_Designation",
    "POC_Email_Id": "POC_Email_id",
    "MSME_Registered": "MSME_Registered",
    "Company_GST": "Company_GST",
    "Annual_Turnover": "Annual_Turnover",
    "Company_Industry": "Company_Industry",
    # Address Information
    "Street": "Street",
    "City": "City",
    "State": "State",
    "ZIP": "ZIP",
    "Country": "Country",
    # Property-Loan Information
    "Loan_Type": "Purpose",
    "Property_Type": "Property_Type",
    "Requested_Loan_Amount": "Loan_amount",
    "Location": "Location",
    # Description Information
    "Note": "Note",
}

# Where each lookup field points: (Zoho API name, module, name field to search).
# Lead_Owner points at Users rather than a module.
LOOKUP_FIELDS = {
    "Lead_Owner": ("Owner", "Users", None),
    "Assigned_To": ("Assigned_To", "Field_Sales_Operators", "Name"),
    "Referred_By": ("Referral_Person", "Vendors", "Vendor_Name"),
    "Campaign_Source": ("Campaign_Source1", "Campaigns", "Campaign_Name"),
}

# Whole-number fields (Zoho's ZIP is an Integer field).
INTEGER_FIELDS = ["ZIP"]

# Dropdown: value shown in Zoho's UI -> value the API stores, only where they
# differ. Anything not listed is sent as-is.
PICKLIST_STORED_VALUES: dict[str, dict[str, str]] = {
    "Lead_Source": {
        "Associations": "Advertisement",
        "Cold Call": "Cold Call1",
        "Customer Referral": "Chat",
        "Employee Referral": "Cold Call",
        "External Referral": "External Referral1",
        "Hoardings": "Hordings",
        "Partner": "Partner1",
    },
    "Lead_Status": {
        "New": "Contacted",
        "In-Progress": "Junk Lead",
        "Enquiry": "Lost Lead",
        "Pre Qualified": "Qualified",
        "Junk": "Pre-Qualified",
    },
    "Occupation": {"Home Maker": "House Wife"},
    "Loan_Type": {"Loan Against Property": "Buying Assets"},
    "Property_Type": {
        "Residential-Self Occupancy": "Home",
        "Vacant Land-Commercial": "Shop",
        "Vacant Land-Residential": "Land",
    },
}


def build_lead_payload(fields: dict) -> tuple[dict, list[str]]:
    """Returns (payload for Zoho, form keys that had a value but aren't sent)."""
    payload: dict = {}
    unmapped: list[str] = []
    for key, api_name in ZOHO_LEAD_FIELDS.items():
        value = fields.get(key)
        if value in (None, ""):
            continue
        if api_name is None:
            unmapped.append(key)
            continue
        value = PICKLIST_STORED_VALUES.get(key, {}).get(value, value)
        if key in AMOUNT_FIELDS or key in INTEGER_FIELDS:
            digits = "".join(ch for ch in str(value) if ch.isdigit())
            if not digits:
                continue
            value = int(digits)
        payload[api_name] = value
    return payload, unmapped
