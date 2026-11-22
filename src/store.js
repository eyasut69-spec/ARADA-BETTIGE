'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GAME_DEFS, LIMITS } = require('./catalog');
const sec = require('./security');

const DATA_DIR = process.env.ARADA_DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = process.env.ARADA_UPLOAD_DIR || path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'arada.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let state = null;
let flushTimer = null;
let dirty = false;

function blankState() {
  return {
    meta: { version: 1, createdAt: new Date().toISOString() },
    settings: {
      announcement: 'Demo platform — every credit is virtual. No real money is accepted or paid out.',
      welcomeBonus: LIMITS.welcomeBonus,
    },
    users: [],
    sessions: [],
    games: [],
    bets: [],
    transactions: [],
    deposits: [],
    withdrawals: [],
    crashRounds: [],
  };
}

function persistNow() {
  if (!state) return;
  try {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 0));
    fs.renameSync(tmp, DB_FILE);
    dirty = false;
  } catch (err) {
    console.error('[store] failed to persist database', err.message);
  }
}

function persist() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) persistNow();
  }, 30);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function seedGames() {
  for (const def of GAME_DEFS) {
    let game = state.games.find((g) => g.slug === def.slug);
    if (!game) {
      game = {
        slug: def.slug,
        name: def.name,
        enabled: true,
        minBet: def.minBet,
        maxBet: def.maxBet,
        rtp: def.rtp,
        plays: 0,
        wagered: 0,
        paidOut: 0,
        createdAt: new Date().toISOString(),
      };
      state.games.push(game);
    }
  }
}

function seedUser({ phone, password, name, role, balance }) {
  const existing = state.users.find((u) => u.phone === phone);
  if (existing) return existing;
  const { salt, hash } = sec.hashPassword(password);
  const recovery = sec.hashRecoveryCode(sec.generateRecoveryCode());
  const user = {
    id: `usr_${crypto.randomUUID()}`,
    phone,
    name,
    role,
    balance: sec.round2(balance),
    status: 'active',
    salt,
    hash,
    recoverySalt: recovery.salt,
    recoveryHash: recovery.hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    stats: { bets: 0, wagered: 0, won: 0, wins: 0 },
    note: role === 'admin' ? 'Platform administrator (demo)' : 'Seeded demo player',
  };
  state.users.push(user);
  if (balance > 0) {
    addTransaction({
      userId: user.id,
      type: 'bonus',
      amount: balance,
      status: 'approved',
      note: 'Seeded demo credits',
    });
  }
  return user;
}

function seedUsers() {
  seedUser({
    phone: sec.normalizePhone(process.env.ADMIN_PHONE) || '0911000000',
    password: process.env.ADMIN_PASSWORD || 'Arada@Admin1',
    name: 'ARADA Admin',
    role: 'admin',
    balance: 0,
  });
  seedUser({
    phone: '0912000000',
    password: 'Demo@1234',
    name: 'Demo Player',
    role: 'player',
    balance: 5000,
  });
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      console.error('[store] database unreadable, starting fresh:', err.message);
      try {
        fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
      } catch (_) {
        /* ignore */
      }
      state = null;
    }
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) state = blankState();
  for (const key of [
    'users',
    'sessions',
    'games',
    'bets',
    'transactions',
    'deposits',
    'withdrawals',
    'crashRounds',
  ]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  if (!state.settings || typeof state.settings !== 'object') state.settings = blankState().settings;
  if (!state.meta) state.meta = { version: 1 };
  seedGames();
  seedUsers();
  sweep();
  persistNow();
  const sweeper = setInterval(sweep, 20 * 1000);
  if (typeof sweeper.unref === 'function') sweeper.unref();
  return state;
}

function db() {
  if (!state) init();
  return state;
}

/* ------------------------------------------------------------------ users */

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    balance: sec.round2(user.balance),
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    stats: {
      bets: user.stats?.bets || 0,
      wagered: sec.round2(user.stats?.wagered || 0),
      won: sec.round2(user.stats?.won || 0),
      wins: user.stats?.wins || 0,
    },
    hasRecovery: Boolean(user.recoveryHash),
    note: user.note || '',
  };
}

function findUserByPhone(phone) {
  return db().users.find((u) => u.phone === phone) || null;
}

function findUserById(id) {
  return db().users.find((u) => u.id === id) || null;
}

function createUser({ phone, name, password, role = 'player', balance = 0 }) {
  const { salt, hash } = sec.hashPassword(password);
  const recoveryCode = sec.generateRecoveryCode();
  const recovery = sec.hashRecoveryCode(sec.normalizeRecoveryCode(recoveryCode));
  const user = {
    id: `usr_${crypto.randomUUID()}`,
    phone,
    name: name || `Player ${phone.slice(-4)}`,
    role,
    balance: sec.round2(balance),
    status: 'active',
    salt,
    hash,
    recoverySalt: recovery.salt,
    recoveryHash: recovery.hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    stats: { bets: 0, wagered: 0, won: 0, wins: 0 },
    note: '',
  };
  db().users.push(user);
  persist();
  return { user, recoveryCode };
}

function rotateRecoveryCode(user) {
  const recoveryCode = sec.generateRecoveryCode();
  const recovery = sec.hashRecoveryCode(sec.normalizeRecoveryCode(recoveryCode));
  user.recoverySalt = recovery.salt;
  user.recoveryHash = recovery.hash;
  persist();
  return recoveryCode;
}

function adjustBalance(user, delta) {
  const next = sec.round2((user.balance || 0) + delta);
  user.balance = Math.max(0, next);
  persist();
  return user.balance;
}

/* ------------------------------------------------------------- transactions */

function addTransaction({
  userId,
  type,
  amount,
  status = 'approved',
  method = '',
  reference = '',
  note = '',
  relatedId = '',
}) {
  const tx = {
    id: `tx_${crypto.randomUUID()}`,
    userId,
    type,
    amount: sec.round2(amount),
    status,
    method,
    reference,
    note,
    relatedId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db().transactions.push(tx);
  persist();
  return tx;
}

function updateTransaction(tx, patch) {
  Object.assign(tx, patch, { updatedAt: new Date().toISOString() });
  persist();
  return tx;
}

/* ----------------------------------------------------------------- sessions */

function createSession(userId, { ip = '', ua = '' } = {}) {
  const token = sec.newSessionToken();
  const session = {
    id: `ses_${crypto.randomUUID()}`,
    tokenHash: sec.hashToken(token),
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    ip,
    ua: String(ua).slice(0, 180),
  };
  db().sessions.push(session);
  persist();
  return { token, session };
}

function getSession(token) {
  if (!token) return null;
  const hash = sec.hashToken(token);
  const session = db().sessions.find((s) => s.tokenHash === hash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    destroySession(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  const hash = sec.hashToken(token);
  const before = db().sessions.length;
  state.sessions = db().sessions.filter((s) => s.tokenHash !== hash);
  if (db().sessions.length !== before) persist();
}

function destroyUserSessions(userId, keepTokenHash = null) {
  state.sessions = db().sessions.filter(
    (s) => s.userId !== userId || (keepTokenHash && s.tokenHash === keepTokenHash),
  );
  persist();
}

/* ----------------------------------------------------------------- deposits */

function createDeposit(user, { amount, method }) {
  const now = Date.now();
  const deposit = {
    id: `dep_${crypto.randomUUID()}`,
    userId: user.id,
    amount: sec.round2(amount),
    method,
    status: 'pending',
    reference: `ARD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LIMITS.depositWindowMs).toISOString(),
    screenshot: null,
    reviewedBy: null,
    reviewedAt: null,
    adminNote: '',
    transactionId: null,
  };
  const tx = addTransaction({
    userId: user.id,
    type: 'deposit',
    amount: deposit.amount,
    status: 'pending',
    method,
    reference: deposit.reference,
    note: 'Demo deposit request',
    relatedId: deposit.id,
  });
  deposit.transactionId = tx.id;
  db().deposits.push(deposit);
  persist();
  return deposit;
}

function saveScreenshot(deposit, dataUrl, originalName = 'proof') {
  const match = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    String(dataUrl || ''),
  );
  if (!match) {
    const err = new Error('Screenshot must be a PNG, JPG, WEBP or GIF image.');
    err.status = 400;
    throw err;
  }
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buffer = Buffer.from(match[3].replace(/\s/g, ''), 'base64');
  if (buffer.length === 0) {
    const err = new Error('Screenshot file is empty.');
    err.status = 400;
    throw err;
  }
  if (buffer.length > 6 * 1024 * 1024) {
    const err = new Error('Screenshot is too large (maximum 6 MB).');
    err.status = 413;
    throw err;
  }
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const file = `${deposit.id}.${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buffer);
  deposit.screenshot = {
    file,
    mime,
    size: buffer.length,
    originalName: String(originalName).slice(0, 120),
    uploadedAt: new Date().toISOString(),
  };
  persist();
  return deposit.screenshot;
}

function screenshotPath(deposit) {
  if (!deposit?.screenshot?.file) return null;
  const file = path.join(UPLOAD_DIR, path.basename(deposit.screenshot.file));
  return fs.existsSync(file) ? file : null;
}

function approveDeposit(deposit, admin, note = '') {
  if (deposit.status !== 'pending') {
    const err = new Error(`Deposit is already ${deposit.status}.`);
    err.status = 409;
    throw err;
  }
  const user = findUserById(deposit.userId);
  if (!user) {
    const err = new Error('Deposit owner no longer exists.');
    err.status = 404;
    throw err;
  }
  deposit.status = 'approved';
  deposit.reviewedBy = admin.id;
  deposit.reviewedAt = new Date().toISOString();
  deposit.adminNote = note;
  adjustBalance(user, deposit.amount);
  const tx = db().transactions.find((t) => t.id === deposit.transactionId);
  if (tx) updateTransaction(tx, { status: 'approved', note: note || 'Demo deposit approved' });
  persist();
  return deposit;
}

function rejectDeposit(deposit, admin, note = '') {
  if (deposit.status !== 'pending') {
    const err = new Error(`Deposit is already ${deposit.status}.`);
    err.status = 409;
    throw err;
  }
  deposit.status = 'rejected';
  deposit.reviewedBy = admin.id;
  deposit.reviewedAt = new Date().toISOString();
  deposit.adminNote = note || 'Demo payment could not be verified.';
  const tx = db().transactions.find((t) => t.id === deposit.transactionId);
  if (tx) updateTransaction(tx, { status: 'rejected', note: deposit.adminNote });
  persist();
  return deposit;
}

/* -------------------------------------------------------------- withdrawals */

function createWithdrawal(user, { amount, method, accountName, accountNumber }) {
  const withdrawal = {
    id: `wdr_${crypto.randomUUID()}`,
    userId: user.id,
    amount: sec.round2(amount),
    method,
    accountName,
    accountNumber,
    status: 'pending',
    reference: `ARD-W${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    adminNote: '',
    transactionId: null,
  };
  adjustBalance(user, -withdrawal.amount);
  const tx = addTransaction({
    userId: user.id,
    type: 'withdrawal',
    amount: -withdrawal.amount,
    status: 'pending',
    method,
    reference: withdrawal.reference,
    note: `Demo withdrawal to ${accountNumber}`,
    relatedId: withdrawal.id,
  });
  withdrawal.transactionId = tx.id;
  db().withdrawals.push(withdrawal);
  persist();
  return withdrawal;
}

function approveWithdrawal(withdrawal, admin, note = '') {
  if (withdrawal.status !== 'pending') {
    const err = new Error(`Withdrawal is already ${withdrawal.status}.`);
    err.status = 409;
    throw err;
  }
  withdrawal.status = 'approved';
  withdrawal.reviewedBy = admin.id;
  withdrawal.reviewedAt = new Date().toISOString();
  withdrawal.adminNote = note || 'Demo payout approved.';
  const tx = db().transactions.find((t) => t.id === withdrawal.transactionId);
  if (tx) updateTransaction(tx, { status: 'approved', note: withdrawal.adminNote });
  persist();
  return withdrawal;
}

function rejectWithdrawal(withdrawal, admin, note = '') {
  if (withdrawal.status !== 'pending') {
    const err = new Error(`Withdrawal is already ${withdrawal.status}.`);
    err.status = 409;
    throw err;
  }
  withdrawal.status = 'rejected';
  withdrawal.reviewedBy = admin.id;
  withdrawal.reviewedAt = new Date().toISOString();
  withdrawal.adminNote = note || 'Demo withdrawal rejected, credits returned.';
  const user = findUserById(withdrawal.userId);
  if (user) adjustBalance(user, withdrawal.amount);
  const tx = db().transactions.find((t) => t.id === withdrawal.transactionId);
  if (tx) updateTransaction(tx, { status: 'rejected', note: withdrawal.adminNote });
  persist();
  return withdrawal;
}

/* --------------------------------------------------------------------- bets */

function recordBet({ user, game, stake, multiplier, payout, outcome, detail }) {
  const bet = {
    id: `bet_${crypto.randomUUID()}`,
    userId: user.id,
    game: game.slug,
    gameName: game.name,
    stake: sec.round2(stake),
    multiplier: sec.round2(multiplier),
    payout: sec.round2(payout),
    outcome,
    detail: String(detail || '').slice(0, 200),
    createdAt: new Date().toISOString(),
    balanceAfter: sec.round2(user.balance),
  };
  db().bets.push(bet);
  game.plays = (game.plays || 0) + 1;
  game.wagered = sec.round2((game.wagered || 0) + stake);
  game.paidOut = sec.round2((game.paidOut || 0) + payout);
  user.stats = user.stats || { bets: 0, wagered: 0, won: 0, wins: 0 };
  user.stats.bets += 1;
  user.stats.wagered = sec.round2(user.stats.wagered + stake);
  if (payout > 0) {
    user.stats.won = sec.round2(user.stats.won + payout);
    if (payout > stake) user.stats.wins += 1;
  }
  persist();
  return bet;
}

/* ------------------------------------------------------------------- sweep */

function sweep() {
  if (!state) return;
  const now = Date.now();
  let changed = false;
  for (const deposit of state.deposits) {
    if (deposit.status === 'pending' && new Date(deposit.expiresAt).getTime() <= now) {
      deposit.status = 'rejected';
      deposit.reviewedAt = new Date().toISOString();
      deposit.adminNote = 'Expired: demo payment was not approved within 19 minutes.';
      const tx = state.transactions.find((t) => t.id === deposit.transactionId);
      if (tx && tx.status === 'pending') {
        tx.status = 'rejected';
        tx.updatedAt = new Date().toISOString();
        tx.note = deposit.adminNote;
      }
      changed = true;
    }
  }
  const liveSessions = state.sessions.filter((s) => s.expiresAt > now);
  if (liveSessions.length !== state.sessions.length) {
    state.sessions = liveSessions;
    changed = true;
  }
  if (changed) persist();
}

/* ------------------------------------------------------------------ export */

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  init,
  db,
  persist,
  flush: persistNow,
  publicUser,
  findUserByPhone,
  findUserById,
  createUser,
  rotateRecoveryCode,
  adjustBalance,
  addTransaction,
  updateTransaction,
  createSession,
  getSession,
  destroySession,
  destroyUserSessions,
  createDeposit,
  saveScreenshot,
  screenshotPath,
  approveDeposit,
  rejectDeposit,
  createWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  recordBet,
  sweep,
  seedUser,
};
