import { API_BASE } from '../../apiBase'
import { authMasterReport as auth } from '../../firebase'

async function extractError(res) {
  try {
    const data = await res.json()
    return data.detail || res.statusText
  } catch {
    return res.statusText
  }
}

// Every backend call in this tool requires a signed-in user - attach the
// current Firebase ID token so the backend can verify it's really them,
// rather than trusting whatever the browser claims.
async function authHeaders() {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), ...(await authHeaders()) }
  try {
    return await fetch(url, { ...options, headers })
  } catch {
    throw new Error(
      'Could not reach the server. Make sure the backend is running at localhost:8000.'
    )
  }
}

function filenameFromDisposition(res, fallback) {
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match ? match[1] : fallback
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function getTemplateMeta(reportType) {
  const res = await apiFetch(`${API_BASE}/templates/${reportType}/meta`)
  if (!res.ok) throw new Error(await extractError(res))
  return res.json()
}

export async function downloadTemplate(reportType) {
  const res = await apiFetch(`${API_BASE}/templates/${reportType}`)
  if (!res.ok) throw new Error(await extractError(res))
  const blob = await res.blob()
  downloadBlob(blob, filenameFromDisposition(res, `${reportType}_template.xlsx`))
}

export async function uploadTemplate(reportType, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`${API_BASE}/templates/${reportType}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await extractError(res))
  return res.json()
}

export async function processMasterReport(file, leadsFile, meetingsFile) {
  const form = new FormData()
  if (file) form.append('file', file)
  if (leadsFile) form.append('leads_file', leadsFile)
  if (meetingsFile) form.append('meetings_file', meetingsFile)
  const res = await apiFetch(`${API_BASE}/process/master`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await extractError(res))
  const blob = await res.blob()
  downloadBlob(blob, filenameFromDisposition(res, `MIS ${new Date().toISOString().slice(0, 10)}.xlsx`))
}
