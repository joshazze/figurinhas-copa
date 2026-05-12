// Thin fetch wrapper that prepends the API base URL and the Bearer token.
import { auth } from '../stores/authState.svelte.js';

export const API_BASE = 'https://figsapp.duckdns.org/api';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

export async function request(path, { method = 'GET', body, auth: needsAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (needsAuth) {
    if (!auth.jwt) throw new ApiError(401, 'no_jwt', 'not authenticated');
    headers.Authorization = `Bearer ${auth.jwt}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, 'network', err.message);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch {}
    throw new ApiError(res.status, detail, detail);
  }

  if (res.status === 204) return null;
  return res.json();
}
