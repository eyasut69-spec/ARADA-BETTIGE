'use strict';

const express = require('express');
const store = require('../store');
const sec = require('../security');
const { LIMITS } = require('../catalog');
const { requireAuth, setSessionCookie, clearSessionCookie, sessionToken, clientIp } = require('../http');

const router = express.Router();

const loginLimiter = new sec.AttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 });
const registerLimiter = new sec.AttemptLimiter({ max: 8, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 });
const recoverLimiter = new sec.AttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000, blockMs: 30 * 60 * 1000 });
const guestLimiter = new sec.AttemptLimiter({ max: 6, windowMs: 30 * 60 * 1000, blockMs: 30 * 60 * 1000 });

const MIN_PASSWORD = 8;

function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (value.length > 128) return 'Password is too long (maximum 128 characters).';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

function safeName(input) {
  return String(input || '').replace(/[<>]/g, '').trim().slice(0, 60);
}

function startSession(req, res, user) {
  const { token } = store.createSession(user.id, {
    ip: clientIp(req),
    ua: req.headers['user-agent'] || '',
  });
  setSessionCookie(req, res, token);
  user.lastLoginAt = new Date().toISOString();
  store.persist();
}

/* Instant demo wallet so every visitor can play without a sign-up form. */
router.post('/guest', (req, res) => {
  const ip = clientIp(req);
  const gate = guestLimiter.check(ip);
  if (!gate.allowed) {
    return res.status(429).json({ error: 'Too many guest wallets from this device. Please create a free account instead.' });
  }
  guestLimiter.fail(ip);
  const user = store.createGuest();
  startSession(req, res, user);
  return res.status(201).json({ user: store.publicUser(user), guest: true });
});

router.post('/register', (req, res) => {
  const ip = clientIp(req);
  const limit = registerLimiter.check(ip);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many accounts created from this device. Try again later.' });
  }
  registerLimiter.fail(ip);

  const phone = sec.normalizePhone(req.body.phone);
  const password = String(req.body.password || '');
  const name = safeName(req.body.name);
  const accepted = req.body.acceptedTerms === true || req.body.acceptedTerms === 'true';

  if (!phone) {
    return res.status(400).json({ error: 'Enter a valid Ethiopian mobile number, e.g. 0912345678.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  if (!accepted) {
    return res.status(400).json({ error: 'Please confirm you are 18+ and accept the ARADA BETTING terms.' });
  }
  if (store.findUserByPhone(phone)) {
    return res.status(409).json({ error: 'An account with this phone number already exists. Please sign in.' });
  }

  const refCode = String(req.body.referral || req.body.ref || '').trim().toUpperCase();
  const inviter = refCode ? store.findUserByReferralCode(refCode) : null;

  const bonus = Number(store.db().settings.welcomeBonus ?? LIMITS.welcomeBonus);
  const { user, recoveryCode } = store.createUser({
    phone,
    name: name || `Player ${phone.slice(-4)}`,
    password,
    balance: bonus,
    referredBy: inviter ? inviter.id : null,
  });
  if (bonus > 0) {
    store.addTransaction({
      userId: user.id,
      type: 'bonus',
      amount: bonus,
      status: 'approved',
      note: 'Welcome credits',
    });
  }

  const inviteBonus = Number(store.db().settings.referralBonus ?? LIMITS.referralBonus);
  if (inviter && inviter.id !== user.id && inviteBonus > 0) {
    store.adjustBalance(inviter, inviteBonus);
    inviter.referralCount = Number(inviter.referralCount || 0) + 1;
    store.addTransaction({
      userId: inviter.id,
      type: 'referral',
      amount: inviteBonus,
      status: 'approved',
      note: `Invite bonus — ${user.name} joined with ${refCode}`,
    });
    store.adjustBalance(user, inviteBonus);
    store.addTransaction({
      userId: user.id,
      type: 'referral',
      amount: inviteBonus,
      status: 'approved',
      note: `Invite bonus from ${refCode}`,
    });
    store.persist();
  }

  startSession(req, res, user);
  const total = bonus + (inviter ? inviteBonus : 0);
  return res.status(201).json({
    user: store.publicUser(user),
    recoveryCode,
    invited: Boolean(inviter),
    message: `Welcome to ARADA BETTING. ${total.toLocaleString()} ETB added to your balance.`,
  });
});

router.post('/login', (req, res) => {
  const phone = sec.normalizePhone(req.body.phone);
  const password = String(req.body.password || '');
  if (!phone || !password) {
    return res.status(400).json({ error: 'Enter your phone number and password.' });
  }
  const key = `${phone}|${clientIp(req)}`;
  const gate = loginLimiter.check(key);
  if (!gate.allowed) {
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minute(s).`,
    });
  }
  const user = store.findUserByPhone(phone);
  if (!user || !sec.verifyPassword(password, user.salt, user.hash)) {
    const after = loginLimiter.fail(key);
    const left = Math.max(0, 5 - (after.remaining === 0 ? 5 : 5 - after.remaining));
    const tries = after.remaining;
    return res.status(401).json({
      error: tries > 0
        ? `Incorrect phone number or password. ${tries} attempt(s) left before a temporary lock.`
        : 'Too many failed attempts. Login is locked for 15 minutes.',
      attemptsLeft: tries,
      remaining: left,
    });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'This account is suspended. Please contact support.' });
  }
  loginLimiter.reset(key);
  startSession(req, res, user);
  return res.json({ user: store.publicUser(user), message: `Welcome back, ${user.name}.` });
});

router.post('/logout', (req, res) => {
  const token = sessionToken(req);
  if (token) store.destroySession(token);
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  return res.json({ user: store.publicUser(req.user) });
});

router.post('/recover', (req, res) => {
  const phone = sec.normalizePhone(req.body.phone);
  const code = sec.normalizeRecoveryCode(req.body.recoveryCode);
  const newPassword = String(req.body.newPassword || '');
  if (!phone) return res.status(400).json({ error: 'Enter the phone number on your account.' });
  if (!code || code.length !== 16) {
    return res.status(400).json({ error: 'Enter the 16-character recovery code you saved at sign-up.' });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ error: problem });

  const key = `${phone}|${clientIp(req)}`;
  const gate = recoverLimiter.check(key);
  if (!gate.allowed) {
    return res.status(429).json({ error: 'Too many recovery attempts. Try again later.' });
  }
  const user = store.findUserByPhone(phone);
  if (!user || !sec.verifyRecoveryCode(code, user.recoverySalt, user.recoveryHash)) {
    recoverLimiter.fail(key);
    return res.status(401).json({ error: 'Phone number or recovery code is incorrect.' });
  }
  const fresh = sec.hashPassword(newPassword);
  user.salt = fresh.salt;
  user.hash = fresh.hash;
  store.destroyUserSessions(user.id);
  const newCode = store.rotateRecoveryCode(user);
  recoverLimiter.reset(key);
  store.addTransaction({
    userId: user.id,
    type: 'security',
    amount: 0,
    status: 'approved',
    note: 'Password reset with recovery code',
  });
  return res.json({
    ok: true,
    recoveryCode: newCode,
    message: 'Password updated. Save your new recovery code — it replaces the old one.',
  });
});

router.post('/change-password', requireAuth, (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (!sec.verifyPassword(current, req.user.salt, req.user.hash)) {
    return res.status(401).json({ error: 'Your current password is incorrect.' });
  }
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });
  const fresh = sec.hashPassword(next);
  req.user.salt = fresh.salt;
  req.user.hash = fresh.hash;
  store.destroyUserSessions(req.user.id, req.session?.tokenHash || null);
  store.persist();
  return res.json({ ok: true, message: 'Password changed successfully.' });
});

router.post('/recovery-code', requireAuth, (req, res) => {
  const password = String(req.body.password || '');
  if (!sec.verifyPassword(password, req.user.salt, req.user.hash)) {
    return res.status(401).json({ error: 'Password is incorrect.' });
  }
  const code = store.rotateRecoveryCode(req.user);
  return res.json({ recoveryCode: code, message: 'New recovery code generated. Save it somewhere safe.' });
});

module.exports = router;
