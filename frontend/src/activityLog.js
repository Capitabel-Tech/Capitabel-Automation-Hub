import { API_BASE } from './apiBase'

// Reports a sign-in/sign-out/sign-up event to the backend, which verifies it
// server-side (via the Firebase ID token, when one exists) before writing it
// to the activity log. Never throws - a logging failure must never block or
// break the actual auth flow it's reporting on.
export async function logEvent({ tool, action, status, details, idToken, attemptedEmail }) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (idToken) headers.Authorization = `Bearer ${idToken}`
    await fetch(`${API_BASE}/log-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool,
        action,
        status,
        details: details || null,
        attempted_email: attemptedEmail || null,
      }),
    })
  } catch {
    // Swallow - logging is best-effort only.
  }
}
