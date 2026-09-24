import os
import json
import shutil
import asyncio
from datetime import datetime

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.services.zoho_lead_mapping import LOOKUP_FIELDS, build_lead_payload
from app.settings import get_env_var, logger, ZOHO_MCP_SCRIPT


def _describe_error(e: Exception) -> str:
    """anyio TaskGroups (used under the hood by the MCP client session) wrap
    the real failure in an ExceptionGroup whose own str() is just
    'unhandled errors in a TaskGroup (N sub-exceptions)' - unwrap it so logs
    show the actual cause instead."""
    sub_exceptions = getattr(e, "exceptions", None)
    if sub_exceptions:
        return " | ".join(_describe_error(sub) for sub in sub_exceptions)
    return f"{type(e).__name__}: {e}"


def zoho_server_params():
    node_path = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"
    zoho_env = {
        "ZOHO_CLIENT_ID": get_env_var("ZOHO_CLIENT_ID"),
        "ZOHO_CLIENT_SECRET": get_env_var("ZOHO_CLIENT_SECRET"),
        "ZOHO_REFRESH_TOKEN": get_env_var("ZOHO_REFRESH_TOKEN"),
        "ZOHO_API_DOMAIN": get_env_var("ZOHO_API_DOMAIN") or "https://www.zohoapis.in",
        "ZOHO_ACCOUNTS_URL": get_env_var("ZOHO_ACCOUNTS_URL") or "https://accounts.zoho.in"
    }
    return StdioServerParameters(
        command=node_path, args=[ZOHO_MCP_SCRIPT],
        env={**os.environ, **zoho_env}
    )


async def _find_lead_by_mobile(session, mobile: str):
    """Read-only search for an existing Lead with this Mobile number. Returns
    {"id": ..., "name": ...} for the first match, or None (including on a
    search error - a broken duplicate check should never block a real sync,
    same as this app's other best-effort checks)."""
    try:
        # The `criteria` search (Mobile:equals:...) silently returns nothing
        # unless "Mobile" is marked as a searchable field in this org's Search
        # Layout settings - confirmed missing here. The dedicated `phone`
        # search param works regardless of that setting, so use it instead.
        response = await asyncio.wait_for(
            session.call_tool("zohocrm_search_records", {"module": "Leads", "phone": mobile}),
            timeout=15.0,
        )
        raw_text = response.content[0].text if response.content else ""
        if not raw_text.strip().startswith("{"):
            return None
        rows = json.loads(raw_text).get("data") or []
        # Phone search can match loosely (e.g. formatting differences), so
        # confirm an exact Mobile match before treating it as a duplicate.
        row = next((r for r in rows if r.get("Mobile") == mobile), None)
        if not row:
            return None
        return {"id": row.get("id"), "name": row.get("Full_Name") or row.get("Last_Name") or "Unknown"}
    except Exception as e:
        logger.warning(f"Duplicate-mobile check failed, proceeding without it: {e}")
        return None


async def push_to_zoho(fields, lookup_ids=None, confirm_duplicate=False):
    """Returns (record_id, error_msg, duplicate). `duplicate` is set (and both
    others None) when a Lead already exists with this Mobile number and
    `confirm_duplicate` wasn't passed - nothing is created or changed in Zoho
    in that case, it's purely informational so the UI can ask "create a new
    lead anyway?" before ever touching Zoho. Always CREATES a new record
    (never updates an existing one) - the old upsert-with-duplicate-check
    approach silently overwrote whatever existing lead it matched, which is
    exactly what this replaces."""
    try:
        payload, unmapped = build_lead_payload(fields)
        for key, record_id in (lookup_ids or {}).items():
            payload[LOOKUP_FIELDS[key][0]] = {"id": record_id}
        if unmapped:
            logger.warning(f"Not sent to Zoho (no confirmed Zoho field name yet): {', '.join(unmapped)}")
        if not payload.get("Last_Name"):
            payload["Last_Name"] = "Inquiry"
        logger.info(f"SYNCING TO ZOHO: {json.dumps(payload, indent=2)}")

        async with stdio_client(zoho_server_params()) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await asyncio.wait_for(session.initialize(), timeout=15.0)

                mobile = payload.get("Mobile")
                if mobile and not confirm_duplicate:
                    existing = await _find_lead_by_mobile(session, mobile)
                    if existing:
                        return None, None, existing

                response = await asyncio.wait_for(
                    session.call_tool("zohocrm_create_records", arguments={"module": "Leads", "data": [payload]}),
                    timeout=20.0,
                )
                res_json = json.loads(response.content[0].text)
                first_result = res_json.get("data", [{}])[0]
                record_id = first_result.get("details", {}).get("id")
                if record_id:
                    return record_id, None, None

                error_msg = (
                    first_result.get("message")
                    or res_json.get("message")
                    or f"Zoho did not return a record id: {res_json}"
                )
                logger.error(f"Zoho Sync Failed: {error_msg}")
                return None, error_msg, None
    except Exception as e:
        error_msg = _describe_error(e)
        logger.error(f"Zoho Sync Failed: {error_msg}")
        return None, error_msg, None


async def push_meetings_to_zoho(meetings, original_filename=None, staff=None):
    results = []
    total = len(meetings)
    try:
        server_params = zoho_server_params()

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await asyncio.wait_for(session.initialize(), timeout=45.0)

                zoho_batch = []
                for i, m_data in enumerate(meetings):

                    # Yield progress update for each meeting lookup
                    yield json.dumps({
                        "type": "progress",
                        "current": i + 1,
                        "total": total,
                        "name": m_data.get("name") or m_data.get("Contact_Name", "Unknown")
                    }) + "\n"

                    title = m_data.get("title") or m_data.get("Meeting_Title") or "Field Meeting"
                    contact_name = m_data.get("name") or m_data.get("Contact_Name") or "Unknown Contact"
                    start_time = m_data.get("from") or m_data.get("Start_DateTime")
                    end_time = m_data.get("to") or m_data.get("End_DateTime")
                    location = m_data.get("location") or m_data.get("Location") or "Not Specified"
                    contact_phone = m_data.get("phone") or m_data.get("Phone") or ""
                    base_desc = m_data.get("description") or m_data.get("Description") or ""
                    description = base_desc
                    host = m_data.get("host") or "Capital Solution"

                    who_id = None
                    if contact_phone and str(contact_phone).strip() not in ["", "null", "None", "0000000000"]:
                        clean_phone = "".join(filter(str.isdigit, str(contact_phone)))
                        search_val = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

                        try:
                            criteria = f"((Mobile:equals:'{search_val}')or(Phone:equals:'{search_val}'))"
                            search_res = await asyncio.wait_for(session.call_tool("zohocrm_search_records", {
                                "module": "Contacts", "criteria": criteria
                            }), timeout=15.0)

                            raw_text = search_res.content[0].text if search_res.content else ""
                            search_data = json.loads(raw_text) if raw_text.startswith("{") else {"data": []}

                            if isinstance(search_data, dict) and search_data.get("data"):
                                matched_contact = search_data["data"][0]
                                who_id = {"id": matched_contact["id"], "name": matched_contact.get("Full_Name")}
                        except Exception:
                            pass

                    # Smart-Fix for Meeting Times
                    try:
                        from datetime import timedelta
                        s_dt = datetime.fromisoformat(start_time)
                        e_dt = datetime.fromisoformat(end_time)
                        if e_dt <= s_dt:
                            logger.info(f"Smart-Fix: Adjusting end time for {contact_name}")
                            end_time = (s_dt + timedelta(minutes=30)).isoformat()
                    except Exception:
                        pass

                    row_staff = m_data.get("staff") or m_data.get("Staff")
                    final_staff = row_staff if row_staff and row_staff != "Unknown" else ""

                    event_payload = {
                        "Event_Title": title, "Subject": title,
                        "Start_DateTime": start_time, "End_DateTime": end_time,
                        "Description": description, "Venue": location,
                        "Host": host, "Staff": final_staff,
                        "Contact_Name_Raw": contact_name  # Passing through for reporting
                    }

                    if who_id:
                        event_payload["Who_Id"] = who_id
                        event_payload["$se_module"] = "Contacts"

                    zoho_batch.append(event_payload)

                # Batch Sync
                yield json.dumps({"type": "info", "msg": "Finalizing Sync in Zoho..."}) + "\n"
                response = await asyncio.wait_for(session.call_tool("zohocrm_create_records", {"module": "Events", "data": zoho_batch}), timeout=60.0)

                try:
                    raw_text = response.content[0].text if response.content else ""
                    logger.info(f"Zoho Raw Response: {raw_text[:200]}...")

                    if not raw_text:
                        logger.error("Zoho returned an empty response.")
                        yield json.dumps({"type": "error", "msg": "Zoho returned an empty response."}) + "\n"
                        return

                    if not raw_text.strip().startswith("{"):
                        logger.error(f"Zoho returned a non-JSON error: {raw_text}")
                        yield json.dumps({"type": "error", "msg": f"Zoho API Error: {raw_text}"}) + "\n"
                        return

                    res_json = json.loads(raw_text)

                    # Handle case where Zoho returns an error object instead of a data array
                    if "data" not in res_json:
                        error_msg = res_json.get("message") or "Unknown Zoho Error"
                        logger.error(f"Zoho Error Object: {res_json}")
                        yield json.dumps({"type": "error", "msg": f"Zoho Error: {error_msg}"}) + "\n"
                        return

                    for i, rec_data in enumerate(res_json.get("data", [])):
                        m_original = zoho_batch[i]
                        title = m_original["Event_Title"]
                        c_name = m_original.get("Contact_Name_Raw", "Unknown")

                        if rec_data.get("status") == "success":
                            record_id = rec_data.get("id") or rec_data.get("details", {}).get("id")
                            results.append({"subject": title, "name": c_name, "success": True, "id": record_id})
                        else:
                            error_msg = rec_data.get("message") or "Zoho API Error"
                            results.append({"subject": title, "name": c_name, "success": False, "error": error_msg})

                except Exception as e:
                    logger.error(f"Batch parse error: {e}")
                    if 'raw_text' in locals():
                        logger.error(f"Raw text that failed to parse: {raw_text}")
                    yield json.dumps({"type": "error", "msg": f"Sync failed during parsing: {str(e)}"}) + "\n"

        # Final Result
        yield json.dumps({"type": "result", "results": results}) + "\n"
    except Exception as e:
        msg = _describe_error(e)
        logger.error(f"Sync error: {msg}")
        yield json.dumps({"type": "error", "msg": msg}) + "\n"
