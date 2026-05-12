// Authentication / subscription state, persisted in localStorage.

const KEY = 'figs.auth@v1';
const DEVICE_KEY = 'figs.device_id';

function loadDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { jwt: null, userId: null, validUntil: null };
    return JSON.parse(raw);
  } catch {
    return { jwt: null, userId: null, validUntil: null };
  }
}

const initial = loadAuth();

export const auth = $state({
  jwt: initial.jwt,
  userId: initial.userId,
  validUntil: initial.validUntil,
  deviceId: loadDeviceId(),
});

$effect.root(() => {
  $effect(() => {
    const persisted = { jwt: auth.jwt, userId: auth.userId, validUntil: auth.validUntil };
    try {
      localStorage.setItem(KEY, JSON.stringify(persisted));
    } catch {}
  });
});

export function isAuthenticated() {
  return !!auth.jwt && !isExpired();
}

export function isExpired() {
  if (!auth.validUntil) return true;
  return new Date(auth.validUntil) <= new Date();
}

export function daysRemaining() {
  if (!auth.validUntil) return 0;
  const ms = new Date(auth.validUntil) - new Date();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function setAuth({ jwt, userId, validUntil }) {
  auth.jwt = jwt;
  auth.userId = userId;
  auth.validUntil = validUntil;
}

export function clearAuth() {
  auth.jwt = null;
  auth.userId = null;
  auth.validUntil = null;
}
