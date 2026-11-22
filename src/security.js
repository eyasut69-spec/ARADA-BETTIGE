'use strict';

const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** Hash a password with a fresh random salt using scrypt. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  }).toString('hex');
  return { salt, hash };
}

/** Constant-time password check. */
function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== candidate.length) return false;
  return crypto.timingSafeEqual(expected, candidate);
}

/** Hash a recovery code the same way as a password (never store it in clear). */
function hashRecoveryCode(code) {
  return hashPassword(code);
}

function verifyRecoveryCode(code, salt, hash) {
  return verifyPassword(code, salt, hash);
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human friendly recovery code, e.g. K7QF-2M9P-XR4T-HB8N */
function generateRecoveryCode() {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    if (i % 4 === 3 && i !== 15) out += '-';
  }
  return out;
}

function normalizeRecoveryCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Normalize an Ethiopian mobile number to 0XXXXXXXXX. Returns null if invalid. */
function normalizePhone(input) {
  let digits = String(input || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('251')) digits = `0${digits.slice(3)}`;
  else if (digits.length === 9 && /^[79]/.test(digits)) digits = `0${digits}`;
  if (!/^0[79]\d{8}$/.test(digits)) return null;
  return digits;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** Crypto-strong float in [0, 1). */
function secureRandom() {
  // 6 random bytes give 48 bits of entropy; read them directly because
  // crypto.randomInt() rejects a span of 2**48 (its maximum is 2**48 - 1).
  const buf = crypto.randomBytes(6);
  return buf.readUIntBE(0, 6) / 2 ** 48;
}

/** Crypto-strong integer in [0, max). */
function secureInt(max) {
  if (max <= 0) return 0;
  return crypto.randomInt(0, max);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Sliding window attempt limiter used to slow down credential stuffing.
 * Keyed by e.g. "login:<phone>|<ip>".
 */
class AttemptLimiter {
  constructor({ max = 5, windowMs = 15 * 60 * 1000, blockMs = 15 * 60 * 1000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.blockMs = blockMs;
    this.entries = new Map();
    const timer = setInterval(() => this.sweep(), 5 * 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.blockedUntil && entry.blockedUntil > now) continue;
      if (now - entry.firstAt > this.windowMs && (!entry.blockedUntil || entry.blockedUntil <= now)) {
        this.entries.delete(key);
      }
    }
  }

  /** @returns {{allowed: boolean, remaining: number, retryAfterSec: number}} */
  check(key) {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry) return { allowed: true, remaining: this.max, retryAfterSec: 0 };
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }
    if (now - entry.firstAt > this.windowMs) {
      this.entries.delete(key);
      return { allowed: true, remaining: this.max, retryAfterSec: 0 };
    }
    return {
      allowed: entry.count < this.max,
      remaining: Math.max(0, this.max - entry.count),
      retryAfterSec: 0,
    };
  }

  fail(key) {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry || now - entry.firstAt > this.windowMs) {
      entry = { count: 0, firstAt: now, blockedUntil: 0 };
    }
    entry.count += 1;
    if (entry.count >= this.max) entry.blockedUntil = now + this.blockMs;
    this.entries.set(key, entry);
    return this.check(key);
  }

  reset(key) {
    this.entries.delete(key);
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashRecoveryCode,
  verifyRecoveryCode,
  generateRecoveryCode,
  normalizeRecoveryCode,
  normalizePhone,
  hashToken,
  newSessionToken,
  secureRandom,
  secureInt,
  round2,
  AttemptLimiter,
};
