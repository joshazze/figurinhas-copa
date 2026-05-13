// Authentication / subscription state, persisted in localStorage.

const KEY = 'figs.auth@v2';
const LEGACY_KEY = 'figs.auth@v1';
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
    // v2 is the email-based model; v1 sessions are no longer usable.
    if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY);

    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

function empty() {
  return { jwt: null, userId: null, email: null, validUntil: null, tier: null };
}

const initial = loadAuth();

export const auth = $state({
  jwt: initial.jwt,
  userId: initial.userId,
  email: initial.email,
  validUntil: initial.validUntil,
  tier: initial.tier,
  deviceId: loadDeviceId(),
});

$effect.root(() => {
  $effect(() => {
    const persisted = {
      jwt: auth.jwt,
      userId: auth.userId,
      email: auth.email,
      validUntil: auth.validUntil,
      tier: auth.tier,
    };
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

export function setAuth({ jwt, userId, email, validUntil, tier }) {
  auth.jwt = jwt;
  auth.userId = userId;
  auth.email = email ?? auth.email;
  auth.validUntil = validUntil;
  auth.tier = tier ?? null;
}

export function clearAuth() {
  auth.jwt = null;
  auth.userId = null;
  auth.validUntil = null;
  auth.tier = null;
  // keep email so login form pre-fills with last used address
  // Defer import to break circular dep with sync.
  import('../api/sync.svelte.js').then(({ resetSyncState }) => resetSyncState());
}

export function hasScan() {
  return isAuthenticated() && auth.tier === 'pro';
}

export const renewModal = $state({ open: false });

export function openRenewModal() {
  renewModal.open = true;
}

export function closeRenewModal() {
  renewModal.open = false;
}
