'use strict';

const store = require('./store');
const sec = require('./security');

const COOKIE_NAME = 'arada_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch (_) {
      out[key] = value;
    }
  }
  return out;
}

function isSecure(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function setSessionCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(req),
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(req),
    path: '/',
  });
}

function sessionToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || null;
}

/** Attach req.user / req.session when a valid session cookie is present. */
function attachUser(req, res, next) {
  req.user = null;
  req.session = null;
  const token = sessionToken(req);
  if (!token) return next();
  const session = store.getSession(token);
  if (!session) {
    clearSessionCookie(req, res);
    return next();
  }
  const user = store.findUserById(session.userId);
  if (!user) {
    store.destroySession(token);
    clearSessionCookie(req, res);
    return next();
  }
  if (user.status === 'blocked') {
    store.destroySession(token);
    clearSessionCookie(req, res);
    return next();
  }
  req.user = user;
  req.session = session;
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access only.' });
  return next();
}

/** Simple per-IP request throttle for the JSON API. */
const ipLimiter = new sec.AttemptLimiter({ max: 600, windowMs: 60 * 1000, blockMs: 60 * 1000 });

function apiRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const check = ipLimiter.check(key);
  if (!check.allowed) {
    res.set('Retry-After', String(check.retryAfterSec || 60));
    return res.status(429).json({ error: 'Too many requests. Please slow down for a moment.' });
  }
  ipLimiter.fail(key);
  return next();
}

function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  );
  next();
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 60);
}

module.exports = {
  COOKIE_NAME,
  attachUser,
  requireAuth,
  requireAdmin,
  apiRateLimit,
  securityHeaders,
  setSessionCookie,
  clearSessionCookie,
  sessionToken,
  clientIp,
};
