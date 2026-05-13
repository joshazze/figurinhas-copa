// Client for POST /api/scan. Compresses the file before upload so the round
// trip stays under ~3s on 4G (raw phone photos are 4-8MB, way too big).

import { request } from './client.js';

// Bumped 1600 → 2400. Codes that were ~22px tall at 1600 become ~33px at 2400,
// which sits comfortably above RapidOCR's recognition floor. Backend caps at
// 12MB after base64 — 2400px JPEG q=0.85 of a busy frame is ~600-900KB, well
// inside the budget.
const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 0.88;

async function compressToBase64(file) {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = blobUrl;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return dataUrl.split(',', 2)[1]; // drop "data:image/jpeg;base64,"
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function scan(file) {
  const image = await compressToBase64(file);
  return request('/scan', { method: 'POST', auth: true, body: { image } });
}

/** Re-scrutinize a single region of the image. The bbox is normalised 0..1.
 *  Slower but more accurate than the streaming scan — used when the user
 *  taps a tentative to ask the AI to look again. */
export async function scanRegion(file, bbox) {
  const image = await compressToBase64(file);
  return request('/scan/region', {
    method: 'POST', auth: true, body: { image, bbox },
  });
}

/** Stable-ish hash of a File (size + name + lastModified) so multiple
 *  feedback rows can be joined to the same photo without uploading bytes. */
export function fileFingerprint(file) {
  if (!file) return null;
  return `${file.size}-${file.lastModified}-${file.name || 'photo'}`.slice(0, 128);
}

/** Send user feedback about a scan result.
 *  kind: 'correction' | 'false_positive' | 'missed' */
export async function postScanFeedback(payload) {
  return request('/scan/feedback', {
    method: 'POST', auth: true, body: payload,
  });
}

import { API_BASE } from './client.js';
import { auth } from '../stores/authState.svelte.js';

/**
 * Stream scan results as NDJSON. Each event is one of:
 *   {type: 'progress', pct, phase, label}
 *   {type: 'detection', code, status, bbox, ...}
 *   {type: 'tentative', code: null, bbox, raw_text, ...}
 *   {type: 'done', elapsed_ms, confirmed, tentative}
 *
 * onEvent is called for every parsed line. Returns the final {done} event.
 */
export async function scanStream(file, onEvent) {
  const image = await compressToBase64(file);
  const res = await fetch(`${API_BASE}/scan/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.jwt}`,
    },
    body: JSON.stringify({ image }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch {}
    const err = new Error(detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = detail;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEvent = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const event = JSON.parse(line);
        lastEvent = event;
        onEvent(event);
      } catch {
        // skip malformed line
      }
    }
  }

  // flush trailing fragment if any
  const tail = buffer.trim();
  if (tail) {
    try {
      const event = JSON.parse(tail);
      lastEvent = event;
      onEvent(event);
    } catch {}
  }

  return lastEvent;
}
