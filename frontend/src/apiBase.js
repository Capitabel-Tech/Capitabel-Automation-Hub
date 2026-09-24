// Single source of truth for the backend URL, shared by every feature.
// Set VITE_API_BASE per Netlify deploy context (production vs staging) so
// each points at its own backend without any code changes.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'
