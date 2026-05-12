// Client for POST /api/scan. Compresses the file before upload so the round
// trip stays under ~3s on 4G (raw phone photos are 4-8MB, way too big).

import { request } from './client.js';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

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
