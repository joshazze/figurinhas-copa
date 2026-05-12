import { request } from './client.js';
import { auth, setAuth } from '../stores/authState.svelte.js';

export async function redeem(code) {
  const res = await request('/redeem', {
    method: 'POST',
    body: { code: code.trim().toUpperCase(), fingerprint: auth.deviceId },
  });
  setAuth({ jwt: res.jwt, userId: res.user_id, validUntil: res.valid_until });
  return res;
}
