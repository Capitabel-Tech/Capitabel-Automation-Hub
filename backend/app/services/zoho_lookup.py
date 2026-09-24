"""
Read-only name lookups against Zoho for the four link fields on a lead (Lead
Owner, Assigned To, Referred By, Campaign Source). The review form renders all
four as dropdowns of every current record in that field's Zoho module (Users,
Field_Sales_Operators, Vendors, Campaigns), so this always returns the full
list - there's no typing/autocomplete to filter down. Only GET requests plus
the OAuth token exchange - nothing here creates or changes Zoho data.
"""
import time
from typing import Optional

import requests

from app.services.zoho_lead_mapping import LOOKUP_FIELDS
from app.settings import get_env_var, logger

MAX_SUGGESTIONS = 500  # generous ceiling, not a real-world ceiling on any of these modules
_CACHE_SECONDS = 120

_token = {"value": None, "expires": 0.0}
_cache: dict[tuple, tuple[float, list[dict]]] = {}


class ZohoLookupError(Exception):
    pass


def _api_domain() -> str:
    return get_env_var("ZOHO_API_DOMAIN") or "https://www.zohoapis.in"


def _access_token() -> str:
    if _token["value"] and _token["expires"] > time.time() + 60:
        return _token["value"]
    accounts = get_env_var("ZOHO_ACCOUNTS_URL") or "https://accounts.zoho.in"
    resp = requests.post(
        f"{accounts}/oauth/v2/token",
        params={
            "grant_type": "refresh_token",
            "client_id": get_env_var("ZOHO_CLIENT_ID"),
            "client_secret": get_env_var("ZOHO_CLIENT_SECRET"),
            "refresh_token": get_env_var("ZOHO_REFRESH_TOKEN"),
        },
        timeout=20,
    ).json()
    if "access_token" not in resp:
        raise ZohoLookupError(f"Zoho login failed: {resp.get('error', 'unknown error')}")
    _token["value"] = resp["access_token"]
    _token["expires"] = time.time() + int(resp.get("expires_in", 3600))
    return _token["value"]


def _get(path: str, params: dict) -> dict:
    r = requests.get(
        f"{_api_domain()}/crm/v7{path}",
        params=params,
        headers={"Authorization": f"Zoho-oauthtoken {_access_token()}"},
        timeout=20,
    )
    if r.status_code == 204:
        return {}
    if r.status_code >= 400:
        try:
            message = r.json().get("message") or r.text[:120]
        except Exception:
            message = r.text[:120]
        raise ZohoLookupError(f"Zoho {r.status_code}: {message}")
    return r.json()


def _norm(text: str) -> str:
    return " ".join(str(text or "").split()).lower()


def _escape_criteria(value: str) -> str:
    for ch in ("\\", "(", ")", ":", ","):
        value = value.replace(ch, "\\" + ch)
    return value


def _users() -> list[dict]:
    data = _get("/users", {"type": "ActiveUsers"})
    return [{"id": u["id"], "name": u.get("full_name") or u.get("name", "")} for u in data.get("users", [])]


def _records(module: str, name_field: str, query: str = "") -> list[dict]:
    if query:
        data = _get(f"/{module}/search", {"word": query, "per_page": 50})
    else:
        data = _get(f"/{module}", {"fields": name_field, "per_page": 200})
    return [{"id": r["id"], "name": r.get(name_field, "")} for r in data.get("data", []) if r.get(name_field)]


def _candidates(field: str, query: str) -> list[dict]:
    _, module, name_field = LOOKUP_FIELDS[field]
    key = (field, _norm(query))
    cached = _cache.get(key)
    if cached and cached[0] > time.time():
        return cached[1]
    rows = _users() if module == "Users" else _records(module, name_field, query)
    _cache[key] = (time.time() + _CACHE_SECONDS, rows)
    return rows


def suggest(field: str, query: str) -> list[str]:
    """Names in Zoho that contain what staff have typed so far."""
    q = _norm(query)
    names = sorted({row["name"] for row in _candidates(field, query.strip()) if not q or q in _norm(row["name"])})
    return names[:MAX_SUGGESTIONS]


def resolve(field: str, name: str) -> Optional[str]:
    """Record ID when exactly one Zoho record has this exact name (ignoring
    capitals and extra spaces), otherwise None."""
    wanted = _norm(name)
    if not wanted:
        return None
    _, module, name_field = LOOKUP_FIELDS[field]
    if module == "Users":
        matches = [r for r in _users() if _norm(r["name"]) == wanted]
    else:
        data = _get(f"/{module}/search", {"criteria": f"({name_field}:equals:{_escape_criteria(name.strip())})"})
        matches = [
            {"id": r["id"], "name": r.get(name_field, "")}
            for r in data.get("data", [])
            if _norm(r.get(name_field, "")) == wanted
        ]
    return matches[0]["id"] if len(matches) == 1 else None


LOOKUP_LABELS = {
    "Lead_Owner": "Lead Owner",
    "Assigned_To": "Assigned To",
    "Referred_By": "Referred By",
    "Campaign_Source": "Campaign Source",
}


def resolve_lookups(fields: dict) -> tuple[dict[str, str], list[tuple[str, str]]]:
    """For every link field with a typed name, returns (form key -> record ID
    for those found, [(form key, typed name)] for those not found). A lookup
    failure counts as not found and never blocks the sync."""
    ids: dict[str, str] = {}
    unresolved: list[tuple[str, str]] = []
    for field in LOOKUP_FIELDS:
        name = (fields.get(field) or "").strip()
        if not name:
            continue
        try:
            record_id = resolve(field, name)
        except Exception as e:
            logger.error(f"Zoho lookup failed for {field} '{name}': {e}")
            record_id = None
        if record_id:
            ids[field] = record_id
        else:
            unresolved.append((field, name))
    return ids, unresolved
