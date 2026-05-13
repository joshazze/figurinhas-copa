// Server is the source of truth. Initial state loads from the server on boot;
// every mutation pushes immediately. Periodic + visibility-driven pulls keep
// multiple devices on the same account converged.

import { ApiError, request } from './client.js';
import { appState, clearLocalState } from '../stores/appState.svelte.js';
import { auth, clearAuth, isAuthenticated } from '../stores/authState.svelte.js';

const POLL_INTERVAL_MS = 10_000;

export const syncStatus = $state({
  state: 'idle',        // 'idle' | 'loading' | 'pushing' | 'pulling' | 'offline'
  bootReady: false,     // true once initial pull has succeeded at least once
  bootError: null,      // string message if initial pull failed
});

let _lastPushedHash = '';
let _pushing = false;
let _pendingPush = false;
let _serverTs = null;
let _pollTimer = null;
let _listenersWired = false;

function snapshotHash() {
  return JSON.stringify({
    c: appState.collected,
    p: appState.packs,
    l: appState.logs,
    co: appState.commitments,
    s: appState.settings,
    m: appState.meta,
  });
}

function applyServerState(state) {
  if (state.collected) appState.collected = state.collected;
  if (Array.isArray(state.packs)) appState.packs = state.packs;
  if (Array.isArray(state.logs)) appState.logs = state.logs;
  if (Array.isArray(state.commitments)) appState.commitments = state.commitments;
  if (state.settings) appState.settings = { ...appState.settings, ...state.settings };
  if (state.meta) appState.meta = { ...appState.meta, ...state.meta };
}

export async function pullOnBoot() {
  if (!isAuthenticated()) {
    syncStatus.bootReady = false;
    return;
  }
  syncStatus.state = 'loading';
  syncStatus.bootError = null;
  try {
    const res = await request('/sync', { auth: true });
    if (res.state && Object.keys(res.state).length > 0) {
      applyServerState(res.state);
    }
    _serverTs = res.state_updated_at;
    _lastPushedHash = snapshotHash();
    syncStatus.bootReady = true;
    syncStatus.state = 'idle';
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearAuth();
      syncStatus.bootReady = false;
      return;
    }
    syncStatus.state = 'offline';
    syncStatus.bootError = err.message || 'network';
    // Don't flip bootReady — App keeps the splash up; user can retry.
  }
}

async function pullOnce() {
  if (!isAuthenticated() || !syncStatus.bootReady) return;
  if (_pushing) return;
  syncStatus.state = 'pulling';
  try {
    const res = await request('/sync', { auth: true });
    if (res.state_updated_at && res.state_updated_at !== _serverTs) {
      if (res.state && Object.keys(res.state).length > 0) {
        applyServerState(res.state);
        _lastPushedHash = snapshotHash();
        _serverTs = res.state_updated_at;
      }
    }
    syncStatus.state = 'idle';
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearAuth();
      return;
    }
    syncStatus.state = 'offline';
  }
}

async function pushNow() {
  if (!isAuthenticated() || !syncStatus.bootReady) return;
  if (_pushing) { _pendingPush = true; return; }
  const hash = snapshotHash();
  if (hash === _lastPushedHash) return;
  _pushing = true;
  syncStatus.state = 'pushing';
  try {
    const res = await request('/sync', { method: 'POST', auth: true, body: { state: appState } });
    _lastPushedHash = hash;
    _serverTs = res.server_state_updated_at;
    syncStatus.state = 'idle';
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearAuth();
      return;
    }
    syncStatus.state = 'offline';
    // Will retry on next mutation, next pollOnce, or on 'online' event.
  } finally {
    _pushing = false;
    if (_pendingPush) {
      _pendingPush = false;
      // Coalesce: schedule a microtask so this push doesn't overlap.
      queueMicrotask(pushNow);
    }
  }
}

export function setupAutoSync() {
  $effect.root(() => {
    $effect(() => {
      const hash = snapshotHash(); // tracks deep changes via JSON walk
      if (!syncStatus.bootReady || !isAuthenticated()) return;
      if (hash === _lastPushedHash) return;
      pushNow();
    });
  });

  if (!_pollTimer) {
    _pollTimer = setInterval(() => {
      if (!syncStatus.bootReady) return;
      if (_pushing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      pullOnce();
    }, POLL_INTERVAL_MS);
  }

  if (!_listenersWired && typeof window !== 'undefined') {
    _listenersWired = true;
    window.addEventListener('online', () => {
      // Coming back online — push any pending changes, then pull.
      pushNow().then(pullOnce);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && syncStatus.bootReady && !_pushing) {
        pullOnce();
      }
    });
  }
}

// Used by clearAuth flow: reset everything so the next signin starts clean.
export function resetSyncState() {
  _lastPushedHash = '';
  _serverTs = null;
  _pushing = false;
  _pendingPush = false;
  syncStatus.bootReady = false;
  syncStatus.bootError = null;
  syncStatus.state = 'idle';
  clearLocalState();
}

export async function flushSync() {
  await pushNow();
}
