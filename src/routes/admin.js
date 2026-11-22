'use strict';

const express = require('express');
const store = require('../store');
const sec = require('../security');
const games = require('../games');
const { TRANSACTION_STATUSES, LIMITS } = require('../catalog');
const { requireAdmin } = require('../http');
const { serializeDeposit, serializeWithdrawal } = require('./user');

const router = express.Router();
router.use(requireAdmin);

function userMini(user) {
  if (!user) return { id: null, name: 'Deleted user', phone: '—' };
  return { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status };
}

function decision(req) {
  const value = String(req.body.decision || '').toLowerCase();
  if (!['approve', 'reject'].includes(value)) {
    const err = new Error('Decision must be approve or reject.');
    err.status = 400;
    throw err;
  }
  return value;
}

/* ----------------------------------------------------------------- overview */

router.get('/overview', (req, res) => {
  const db = store.db();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const users = db.users.filter((u) => u.role !== 'admin');
  const bets = db.bets;
  const wagered = sec.round2(bets.reduce((s, b) => s + b.stake, 0));
  const paidOut = sec.round2(bets.reduce((s, b) => s + b.payout, 0));
  const pendingDeposits = db.deposits.filter((d) => d.status === 'pending');
  const pendingWithdrawals = db.withdrawals.filter((w) => w.status === 'pending');
  const approvedDeposits = db.deposits.filter((d) => d.status === 'approved');
  const approvedWithdrawals = db.withdrawals.filter((w) => w.status === 'approved');

  res.json({
    totals: {
      users: users.length,
      activeUsers: users.filter((u) => u.status === 'active').length,
      blockedUsers: users.filter((u) => u.status === 'blocked').length,
      admins: db.users.filter((u) => u.role === 'admin').length,
      balance: sec.round2(users.reduce((s, u) => s + u.balance, 0)),
      wagered,
      paidOut,
      houseProfit: sec.round2(wagered - paidOut),
      bets: bets.length,
      newUsers24h: users.filter((u) => new Date(u.createdAt).getTime() >= dayAgo).length,
      bets24h: bets.filter((b) => new Date(b.createdAt).getTime() >= dayAgo).length,
      depositApprovedTotal: sec.round2(approvedDeposits.reduce((s, d) => s + d.amount, 0)),
      depositPendingCount: pendingDeposits.length,
      depositPendingAmount: sec.round2(pendingDeposits.reduce((s, d) => s + d.amount, 0)),
      withdrawalApprovedTotal: sec.round2(approvedWithdrawals.reduce((s, w) => s + w.amount, 0)),
      withdrawalPendingCount: pendingWithdrawals.length,
      withdrawalPendingAmount: sec.round2(pendingWithdrawals.reduce((s, w) => s + w.amount, 0)),
      screenshots: db.deposits.filter((d) => d.screenshot).length,
      limits: LIMITS,
    },
    pendingDeposits: pendingDeposits.slice(-6).reverse().map((d) => ({
      ...serializeDeposit(d),
      user: userMini(store.findUserById(d.userId)),
    })),
    pendingWithdrawals: pendingWithdrawals.slice(-6).reverse().map((w) => ({
      ...serializeWithdrawal(w),
      user: userMini(store.findUserById(w.userId)),
    })),
    recentUsers: users.slice(-5).reverse().map(store.publicUser),
    recentBets: bets.slice(-8).reverse().map((b) => ({
      ...b,
      user: userMini(store.findUserById(b.userId)),
    })),
  });
});

/* -------------------------------------------------------------------- users */

router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const status = String(req.query.status || '');
  const role = String(req.query.role || '');
  let items = store.db().users.slice();
  if (q) {
    items = items.filter(
      (u) => u.phone.includes(q) || String(u.name).toLowerCase().includes(q) || u.id.includes(q),
    );
  }
  if (status) items = items.filter((u) => u.status === status);
  if (role) items = items.filter((u) => u.role === role);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({
    users: items.slice(0, 200).map((u) => ({
      ...store.publicUser(u),
      pendingDeposits: store.db().deposits.filter((d) => d.userId === u.id && d.status === 'pending').length,
      pendingWithdrawals: store.db().withdrawals.filter((w) => w.userId === u.id && w.status === 'pending').length,
    })),
  });
});

router.get('/users/:id', (req, res) => {
  const user = store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const db = store.db();
  res.json({
    user: store.publicUser(user),
    deposits: db.deposits
      .filter((d) => d.userId === user.id)
      .slice(-25)
      .reverse()
      .map(serializeDeposit),
    withdrawals: db.withdrawals
      .filter((w) => w.userId === user.id)
      .slice(-25)
      .reverse()
      .map(serializeWithdrawal),
    bets: db.bets.filter((b) => b.userId === user.id).slice(-25).reverse(),
    transactions: db.transactions.filter((t) => t.userId === user.id).slice(-40).reverse(),
  });
});

router.patch('/users/:id', (req, res) => {
  const user = store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { status, name, note } = req.body;
  if (status !== undefined) {
    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or blocked.' });
    }
    if (user.role === 'admin' && status === 'blocked' && user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot block your own admin account.' });
    }
    user.status = status;
    if (status === 'blocked') store.destroyUserSessions(user.id);
  }
  if (name !== undefined) {
    const clean = String(name).replace(/[<>]/g, '').trim().slice(0, 60);
    if (clean.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    user.name = clean;
  }
  if (note !== undefined) user.note = String(note).slice(0, 200);
  store.persist();
  return res.json({ user: store.publicUser(user), message: 'User updated.' });
});

router.post('/users/:id/balance', (req, res) => {
  const user = store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const amount = sec.round2(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: 'Enter a non-zero adjustment amount.' });
  }
  if (Math.abs(amount) > 100000) {
    return res.status(400).json({ error: 'Adjustment is limited to 100,000 ETB per action.' });
  }
  if (amount < 0 && Math.abs(amount) > user.balance) {
    return res.status(400).json({ error: 'Adjustment would push the balance below zero.' });
  }
  store.adjustBalance(user, amount);
  store.addTransaction({
    userId: user.id,
    type: amount > 0 ? 'admin_credit' : 'admin_debit',
    amount,
    status: 'approved',
    note: String(req.body.note || 'Manual demo balance adjustment').slice(0, 160),
  });
  res.json({
    user: store.publicUser(user),
    message: `${amount > 0 ? 'Credited' : 'Debited'} ${Math.abs(amount).toLocaleString()} ETB demo credits.`,
  });
});

router.post('/users/:id/password', (req, res) => {
  const user = store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const password = String(req.body.newPassword || '');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Password needs 8+ characters with a letter and a number.' });
  }
  const fresh = sec.hashPassword(password);
  user.salt = fresh.salt;
  user.hash = fresh.hash;
  store.destroyUserSessions(user.id);
  store.persist();
  res.json({ ok: true, message: 'Password reset. The player must sign in again.' });
});

/* ----------------------------------------------------------------- deposits */

router.get('/deposits', (req, res) => {
  const status = String(req.query.status || '');
  let items = store.db().deposits.slice();
  if (status) items = items.filter((d) => d.status === status);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({
    deposits: items.slice(0, 200).map((d) => ({
      ...serializeDeposit(d),
      user: userMini(store.findUserById(d.userId)),
    })),
  });
});

router.post('/deposits/:id/decision', (req, res) => {
  const deposit = store.db().deposits.find((d) => d.id === req.params.id);
  if (!deposit) return res.status(404).json({ error: 'Deposit not found.' });
  const action = decision(req);
  const note = String(req.body.note || '').slice(0, 160);
  if (action === 'approve') store.approveDeposit(deposit, req.user, note);
  else store.rejectDeposit(deposit, req.user, note);
  res.json({
    deposit: { ...serializeDeposit(deposit), user: userMini(store.findUserById(deposit.userId)) },
    message: action === 'approve' ? 'Demo deposit approved and credited.' : 'Demo deposit rejected.',
  });
});

/* -------------------------------------------------------------- withdrawals */

router.get('/withdrawals', (req, res) => {
  const status = String(req.query.status || '');
  let items = store.db().withdrawals.slice();
  if (status) items = items.filter((w) => w.status === status);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({
    withdrawals: items.slice(0, 200).map((w) => ({
      ...serializeWithdrawal(w),
      user: userMini(store.findUserById(w.userId)),
    })),
  });
});

router.post('/withdrawals/:id/decision', (req, res) => {
  const withdrawal = store.db().withdrawals.find((w) => w.id === req.params.id);
  if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found.' });
  const action = decision(req);
  const note = String(req.body.note || '').slice(0, 160);
  if (action === 'approve') store.approveWithdrawal(withdrawal, req.user, note);
  else store.rejectWithdrawal(withdrawal, req.user, note);
  res.json({
    withdrawal: {
      ...serializeWithdrawal(withdrawal),
      user: userMini(store.findUserById(withdrawal.userId)),
    },
    message:
      action === 'approve'
        ? 'Demo withdrawal approved.'
        : 'Demo withdrawal rejected and credits returned to the player.',
  });
});

/* ------------------------------------------------------------- transactions */

router.get('/transactions', (req, res) => {
  const status = String(req.query.status || '');
  const type = String(req.query.type || '');
  let items = store.db().transactions.slice();
  if (status && TRANSACTION_STATUSES.includes(status)) items = items.filter((t) => t.status === status);
  if (type) items = items.filter((t) => t.type === type);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({
    transactions: items.slice(0, 300).map((t) => ({
      ...t,
      user: userMini(store.findUserById(t.userId)),
    })),
  });
});

router.get('/bets', (req, res) => {
  const items = store.db().bets.slice(-200).reverse();
  res.json({
    bets: items.map((b) => ({ ...b, user: userMini(store.findUserById(b.userId)) })),
  });
});

/* -------------------------------------------------------------------- games */

router.get('/games', (req, res) => {
  res.json({ games: games.listGames() });
});

router.patch('/games/:slug', (req, res) => {
  const game = store.db().games.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  const def = games.gameState(req.params.slug);
  const { enabled, minBet, maxBet, rtp } = req.body;

  if (enabled !== undefined) game.enabled = Boolean(enabled);
  if (minBet !== undefined) {
    const value = Number(minBet);
    if (!Number.isFinite(value) || value < 10 || value > 5000) {
      return res.status(400).json({ error: 'Minimum bet must be between 10 and 5,000 ETB.' });
    }
    game.minBet = sec.round2(value);
  }
  if (maxBet !== undefined) {
    const value = Number(maxBet);
    if (!Number.isFinite(value) || value < (game.minBet || 10) || value > 50000) {
      return res.status(400).json({ error: 'Maximum bet must be at least the minimum and at most 50,000 ETB.' });
    }
    game.maxBet = sec.round2(value);
  }
  if (rtp !== undefined) {
    const value = Number(rtp);
    if (!Number.isFinite(value) || value < 0.5 || value > 0.99) {
      return res.status(400).json({ error: 'RTP must be between 50% and 99%.' });
    }
    game.rtp = Math.round(value * 1000) / 1000;
  }
  store.persist();
  return res.json({ game: { ...def, ...game }, message: `${game.name} settings saved.` });
});

/* --------------------------------------------------------------- screenshots */

router.get('/screenshots', (req, res) => {
  const items = store.db().deposits.filter((d) => d.screenshot).slice().reverse();
  res.json({
    screenshots: items.slice(0, 100).map((d) => ({
      depositId: d.id,
      reference: d.reference,
      amount: d.amount,
      status: d.status,
      createdAt: d.createdAt,
      method: d.method,
      screenshot: serializeDeposit(d).screenshot,
      user: userMini(store.findUserById(d.userId)),
    })),
  });
});

router.get('/screenshots/:depositId', (req, res) => {
  const deposit = store.db().deposits.find((d) => d.id === req.params.depositId);
  if (!deposit || !deposit.screenshot) {
    return res.status(404).json({ error: 'Screenshot not found.' });
  }
  const file = store.screenshotPath(deposit);
  if (!file) return res.status(404).json({ error: 'Screenshot file is missing.' });
  res.set('Content-Type', deposit.screenshot.mime);
  res.set('Cache-Control', 'private, no-store');
  return res.sendFile(file);
});

module.exports = router;
