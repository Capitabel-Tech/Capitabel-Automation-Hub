from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import AuthenticationError as OpenAIAuthError

from app.routers import process, templates, leads, meetings, activity_log, zoho_lookup
from app.settings import logger

app = FastAPI(title="Capitabel Automation Hub")


@app.exception_handler(OpenAIAuthError)
async def openai_auth_error_handler(request: Request, exc: OpenAIAuthError):
    # Surfaces as a clear, actionable message in the UI instead of a generic
    # 500 error — so staff know to ask an admin to renew the key, instead of
    # reporting "the app is broken" and someone having to dig through logs.
    logger.error(f"OpenAI API key is invalid/expired — request to {request.url.path} failed.")
    return JSONResponse(
        status_code=503,
        content={
            "error": "AI_KEY_EXPIRED",
            "msg": "The AI service isn't working right now — its API key has expired or is invalid. "
                   "Please ask your admin to renew it."
        }
    )

app.add_middleware(
    CORSMiddleware,
    # Local dev (any port) + any Netlify deploy (production and preview
    # subdomains both end in .netlify.app).
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|https://[\w-]+\.netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(templates.router)
app.include_router(process.router)
app.include_router(leads.router)
app.include_router(meetings.router)
app.include_router(activity_log.router)
app.include_router(zoho_lookup.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
