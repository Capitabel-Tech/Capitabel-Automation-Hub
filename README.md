# Capitabel Automation Hub

Internal tools for Capitabel / Capital Solution. Two tools, one app:

- **Leads & Meetings Sync** — upload a field call recording, review the extracted lead details, sync to Zoho CRM. Upload a day's meetings sheet, review, sync as Zoho events.
- **Master Report Processor** — upload raw Zoho exports (Deals, Leads, Meetings), get back a finished Excel workbook with formulas, sorted sheets, and the pipeline split by stage.

## Structure

```
backend/    FastAPI app (Python)
frontend/   React app (Vite)
```

## Running it locally

**Backend**

```
cd backend
pip install -r requirements.txt
cd alamaticz-zoho-mcp && npm ci --omit=dev --ignore-scripts && cd ..
uvicorn app.main:app --reload --port 8000
```

The Zoho sync (Leads & Meetings tool) goes through a small Node.js bridge in `alamaticz-zoho-mcp/`, which is why both Python and Node are needed.

Copy `.env.example` to `.env` and fill in the real values (see below).

**Frontend**

```
cd frontend
npm install
npm run dev
```

## Environment variables (backend/.env)

| Variable | What it's for |
|---|---|
| `OPENAI_API_KEY` | Transcription and lead extraction |
| `MODEL_ID` | Model used for the translation/cleanup step (default `gpt-4o-mini`) |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | Zoho CRM OAuth credentials |
| `ZOHO_API_DOMAIN`, `ZOHO_ACCOUNTS_URL` | Zoho region (India: `zohoapis.in` / `accounts.zoho.in`) |
| `DATABASE_URL` | Postgres connection string (Supabase, via the connection pooler) |
| `FIREBASE_LEADS_SERVICE_ACCOUNT` | Path to the Leads & Meetings Firebase project's service account key |
| `FIREBASE_MASTER_REPORT_SERVICE_ACCOUNT` | Path to the Master Report Processor Firebase project's service account key |

The two Firebase keys are separate projects — Leads & Meetings and Master Report Processor each have their own sign-in, since one writes to production Zoho and the other doesn't.

**⚠️ Local `.env` should always point at a personal/test Zoho account, never production.** Production credentials only go into the deployed backend's environment settings.

## Database

Run `backend/schema.sql` once against the Postgres database to create the tables (activity log, duplicate-file tracking, saved transcripts, uploaded report templates). It's safe to re-run — everything uses `if not exists`.

## Deploying

- **Backend**: Docker (see `backend/Dockerfile`), since it needs both Python and Node. On Render, create it as a Docker web service with `backend` as the root directory and `/api/health` as the health check path.
- **Frontend**: static build, deploys to Netlify. Set `VITE_API_BASE` to the backend's URL plus `/api`.
- Add the deployed frontend's domain to both Firebase projects' authorized domains, or sign-in will fail there.
- Upload both Firebase service account keys as Render Secret Files, then point the two `FIREBASE_*` env vars at their paths.
