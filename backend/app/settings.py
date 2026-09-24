import os
import logging
from dotenv import load_dotenv
from openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CapitabelAutomationHub")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
load_dotenv(os.path.join(BASE_DIR, ".env"))


def get_env_var(key):
    return os.getenv(key)


openai_client = OpenAI(api_key=get_env_var("OPENAI_API_KEY"))
MEETING_MODEL = get_env_var("MODEL_ID") or "gpt-4o"

ZOHO_MCP_SCRIPT = os.path.join(BASE_DIR, "alamaticz-zoho-mcp", "dist", "index.js")

INCOMING_DIR = os.path.join(BASE_DIR, "incoming")

# Activity logging (direct Postgres connection to the Supabase-hosted
# database) + backend-side auth verification (Firebase Admin SDK) - each
# tool has its own Firebase project, so each needs its own service account
# key. Paths are relative to backend/ unless absolute.
DATABASE_URL = get_env_var("DATABASE_URL")

FIREBASE_LEADS_SERVICE_ACCOUNT = get_env_var("FIREBASE_LEADS_SERVICE_ACCOUNT")
FIREBASE_MASTER_REPORT_SERVICE_ACCOUNT = get_env_var("FIREBASE_MASTER_REPORT_SERVICE_ACCOUNT")
