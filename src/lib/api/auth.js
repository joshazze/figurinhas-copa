import { request } from './client.js';
import { setAuth } from '../stores/authState.svelte.js';

function applyAuthResponse(res) {
  setAuth({
    jwt: res.jwt,
    userId: res.user_id,
    email: res.email,
    validUntil: res.valid_until,
    tier: res.tier,
  });
  return res;
}

export async function signup({ email, password, code }) {
  const res = await request('/signup', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      password,
      code: code.trim().toUpperCase(),
    },
  });
  return applyAuthResponse(res);
}

export async function login({ email, password }) {
  const res = await request('/login', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
  });
  return applyAuthResponse(res);
}

export async function renew({ email, password, code }) {
  const res = await request('/renew', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      password,
      code: code.trim().toUpperCase(),
    },
  });
  return applyAuthResponse(res);
}
