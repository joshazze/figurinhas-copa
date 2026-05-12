// Pull on boot + debounced push on every appState mutation.
// Last-write-wins by timestamp — keep it simple for solo users.

import { ApiError, request } from './client.js';
import { appState } from '../stores/appState.svelte.js';
import { auth, clearAuth, isAuthenticated } from '../stores/authState.svelte.js';

const SYNC_DEBOUNCE_MS = 5_000;
const LOCAL_TS_KEY = 'figs.state_updated_at';

let _lastPushedHash = '';
let _pushTimer = null;
let _pushing = false;
let _pullDone = false;

function snapshotHash() {
  return JSON.stringify(appState);
}

function localUpdatedAt() {
  return localStorage.getItem(LOCAL_TS_KEY) || appState.meta?.createdAt || null;
}

function markLocalUpdated() {
  localStorage.setItem(LOCAL_TS_KEY, new Date().toISOString());
}

export async function pullOnBoot() {
  if (!isAuthenticated()) return;
  try {
    const res = await request('/sync', { auth: true });
    const serverTs = new Date(res.state_updated_at);
    const localTs = localUpdatedAt() ? new Date(localUpdatedAt()) : null;
    const serverHasData = res.state && Object.keys(res.state).length > 0;

    if (serverHasData && (!localTs || serverTs > localTs)) {
      // Server is fresher — adopt it.
      applyServerState(res.state);
      localStorage.setItem(LOCAL_TS_KEY, res.state_updated_at);
    }
    // else: local is fresher or equal — keep local; debounced push will eventually upload.
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearAuth();
    }
    // network errors → silent; will retry on next mutation
  } finally {
    _pullDone = true;
    _lastPushedHash = snapshotHash();
  }
}

function applyServerState(state) {
  // Replace top-level fields without dropping unknown keys.
  if (state.collected) appState.collected = state.collected;
  if (Array.isArray(state.packs)) appState.packs = state.packs;
  if (Array.isArray(state.logs)) appState.logs = state.logs;
  if (Array.isArray(state.commitments)) appState.commitments = state.commitments;
  if (state.settings) appState.settings = { ...appState.settings, ...state.settings };
  if (state.meta) appState.meta = { ...appState.meta, ...state.meta };
}

async function pushNow() {
  if (!isAuthenticated() || _pushing) return;
  const hash = snapshotHash();
  if (hash === _lastPushedHash) return;
  _pushing = true;
  try {
    const res = await request('/sync', { method: 'POST', auth: true, body: { state: appState } });
    _lastPushedHash = hash;
    localStorage.setItem(LOCAL_TS_KEY, res.server_state_updated_at);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) clearAuth();
    // network/server errors → retry on next mutation
  } finally {
    _pushing = false;
  }
}

export function setupAutoSync() {
  $effect.root(() => {
    $effect(() => {
      const hash = snapshotHash(); // tracks deep changes via JSON walk
      if (!_pullDone || !isAuthenticated()) return;
      if (hash === _lastPushedHash) return;
      markLocalUpdated();
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(pushNow, SYNC_DEBOUNCE_MS);
    });
  });
}

export async function flushSync() {
  clearTimeout(_pushTimer);
  await pushNow();
}
