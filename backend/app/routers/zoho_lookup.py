from typing import Literal

from fastapi import APIRouter, Depends

from app.services.firebase_auth import require_auth
from app.services.zoho_lookup import ZohoLookupError, suggest
from app.settings import logger

router = APIRouter(prefix="/api", tags=["zoho-lookup"])


@router.get("/zoho-lookup")
def zoho_lookup(
    field: Literal["Lead_Owner", "Assigned_To", "Referred_By", "Campaign_Source"],
    q: str = "",
    user: dict = Depends(require_auth("leads_meetings")),
):
    """Names in Zoho matching `q` for one of the lead's link fields. When Zoho
    can't be reached the form still works, it just can't suggest or verify."""
    try:
        return {"available": True, "names": suggest(field, q)}
    except ZohoLookupError as e:
        logger.warning(f"Zoho lookup unavailable for {field}: {e}")
        return {"available": False, "names": [], "message": str(e)}
    except Exception as e:
        logger.error(f"Zoho lookup failed for {field}: {e}")
        return {"available": False, "names": [], "message": "Couldn't reach Zoho."}
