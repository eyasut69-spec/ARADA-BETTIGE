'use strict';

/* Shared client state, fetch helper, formatting and small UI utilities. */

export const state = {
  config: null,
  user: null,
  games: [],
  booted: false,
};

const cleanups = [];
export function onCleanup(fn) {
  if (typeof fn === 'function') cleanups.push(fn);
}
export function runCleanups() {
  while (cleanups.length) {
    const fn = cleanups.pop();
    try {
      fn();
    } catch (_) {
      /* ignore */
    }
  }
}

const dec2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "1,234.50 ETB" (decimals = 0 → "1,235 ETB") */
export function money(value, decimals = 2) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${decimals === 0 ? dec0.format(safe) : dec2.format(safe)} ETB`;
}

/** "1,234.50" without currency. */
export function amount(value, decimals = 2) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return decimals === 0 ? dec0.format(safe) : dec2.format(safe);
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtDate(iso, { withTime = true } = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(iso, { withTime: false });
}

export function countdown(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function api(path, { method = 'GET', body } = {}) {
  const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, options);
  } catch (_) {
    const err = new Error('Network unavailable. Check your connection and try again.');
    err.status = 0;
    throw err;
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { error: text.slice(0, 200) };
    }
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status}).`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data || {};
}

const TOAST_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
};

export function toast(message, type = 'info', timeout = 4200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${TOAST_ICONS[type] || TOAST_ICONS.info}<div>${escapeHtml(message)}</div>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s';
    setTimeout(() => el.remove(), 260);
  }, timeout);
}

export function setUser(user) {
  state.user = user || null;
}

export async function loadConfig() {
  const data = await api('/api/config');
  state.config = data;
  return data;
}

export async function loadGames() {
  const data = await api('/api/games');
  state.games = data.games || [];
  return state.games;
}

export async function loadUser() {
  const data = await api('/api/auth/me');
  state.user = data.user || null;
  return state.user;
}

export async function refreshUser() {
  if (!state.user) return null;
  try {
    await loadUser();
  } catch (_) {
    /* keep previous value */
  }
  return state.user;
}

export async function bootstrap() {
  const results = await Promise.allSettled([loadConfig(), loadGames(), loadUser()]);
  state.booted = true;
  return results;
}

export function gameBySlug(slug) {
  return state.games.find((g) => g.slug === slug) || null;
}

export function limit(key, fallback) {
  const value = state.config?.limits?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** Copy text, returning true on success (clipboard API with textarea fallback). */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

export function go(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
