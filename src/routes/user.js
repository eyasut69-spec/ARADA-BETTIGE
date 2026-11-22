'use strict';

const express = require('express');
const store = require('../store');
const sec = require('../security');
const games = require('../games');
const {
  LIMITS,
  CURRENCY,
  DEPOSIT_METHODS,
  WITHDRAW_METHODS,
  TRANSACTION_STATUSES,
} = require('../catalog');
const { requireAuth } = require('../http');

const router = express.Router();

function methodName(id) {
  const found = [...DEPOSIT_METHODS, ...WITHDRAW_METHODS].find((m) => m.id === id);
  return found ? found.name : id;
}

function serializeDeposit(deposit) {
  const now = Date.now();
  const expires = new Date(deposit.expiresAt).getTime();
  return {
    id: deposit.id,
    amount: deposit.amount,
    method: deposit.method,
    methodName: methodName(deposit.method),
    status: deposit.status,
    reference: deposit.reference,
    createdAt: deposit.createdAt,
    expiresAt: deposit.expiresAt,
    remainingMs: deposit.status === 'pending' ? Math.max(0, expires - now) : 0,
    screenshot: deposit.screenshot
      ? {
          uploadedAt: deposit.screenshot.uploadedAt,
          size: deposit.screenshot.size,
          mime: deposit.screenshot.mime,
          originalName: deposit.screenshot.originalName,
        }
      : null,
    adminNote: deposit.adminNote || '',
    reviewedAt: deposit.reviewedAt,
    canCancel: deposit.status === 'pending',
  };
}

function serializeWithdrawal(withdrawal) {
  return {
    id: withdrawal.id,
    amount: withdrawal.amount,
    method: withdrawal.method,
    methodName: methodName(withdrawal.method),
    accountName: withdrawal.accountName,
    accountNumber: withdrawal.accountNumber,
    status: withdrawal.status,
    reference: withdrawal.reference,
    createdAt: withdrawal.createdAt,
    adminNote: withdrawal.adminNote || '',
    reviewedAt: withdrawal.reviewedAt,
  };
}

function demoHints() {
  const hints = [{ role: 'player', phone: '0912000000', password: 'Demo@1234', label: 'Player account' }];
  if (!process.env.ADMIN_PASSWORD) {
    hints.push({
      role: 'admin',
      phone: process.env.ADMIN_PHONE || '0911000000',
      password: 'Arada@Admin1',
      label: 'Admin account',
    });
  }
  return hints;
}

/* ------------------------------------------------------------------- config */

router.get('/config', (req, res) => {
  res.json({
    brand: 'ARADA BETTING',
    currency: CURRENCY,
    limits: LIMITS,
    depositMethods: DEPOSIT_METHODS,
    withdrawMethods: WITHDRAW_METHODS,
    transactionStatuses: TRANSACTION_STATUSES,
    announcement: store.db().settings.announcement,
    demoHints: demoHints(),
    virtualOnly: true,
  });
});

/* -------------------------------------------------------------------- games */

router.get('/games', (req, res) => {
  res.json({ games: games.listGames() });
});

router.post('/games/crash/start', requireAuth, (req, res) => {
  const result = games.startCrash(req.user, {
    stake: Number(req.body.stake),
    autoCashout: req.body.autoCashout,
  });
  res.status(201).json(result);
});

router.get('/games/crash/:roundId', requireAuth, (req, res) => {
  res.json({ round: games.tickCrash(req.user, req.params.roundId) });
});

router.post('/games/crash/:roundId/cashout', requireAuth, (req, res) => {
  res.json({ round: games.cashoutCrash(req.user, req.params.roundId) });
});

router.get('/games/:slug', (req, res) => {
  const game = games.gameState(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  return res.json({ game });
});

router.post('/games/:slug/play', requireAuth, (req, res) => {
  const result = games.play(req.user, req.params.slug, req.body || {});
  res.json(result);
});

/* ----------------------------------------------------------- blackjack table */

router.post('/games/blackjack/start', requireAuth, (req, res) => {
  res.json(games.startBlackjack(req.user, req.body || {}));
});

router.get('/games/blackjack/:roundId', requireAuth, (req, res) => {
  res.json(games.blackjackRoundView(req.user, req.params.roundId));
});

for (const action of ['hit', 'stand', 'double']) {
  router.post(`/games/blackjack/:roundId/${action}`, requireAuth, (req, res) => {
    res.json(games.blackjackAction(req.user, req.params.roundId, action));
  });
}

/* ------------------------------------------------------------------ invites */

router.get('/me/referral', requireAuth, (req, res) => {
  const user = req.user;
  const publicInfo = store.publicUser(user);
  const invited = store.db().users.filter((u) => u.referredBy === user.id);
  const earned = store
    .db()
    .transactions.filter((t) => t.userId === user.id && t.type === 'referral' && t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0);
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    code: publicInfo.referralCode,
    link: `${origin}/?ref=${encodeURIComponent(publicInfo.referralCode)}`,
    invited: invited.length,
    earned: Math.round(earned * 100) / 100,
    bonus: Number(store.db().settings.referralBonus ?? LIMITS.referralBonus),
    recent: invited.slice(-5).map((u) => ({ name: u.name, at: u.createdAt })),
  });
});

/* ---------------------------------------------------------------- my profile */

router.get('/me/overview', requireAuth, (req, res) => {
  const user = req.user;
  const myDeposits = store.db().deposits.filter((d) => d.userId === user.id);
  const myWithdrawals = store.db().withdrawals.filter((w) => w.userId === user.id);
  const myBets = store.db().bets.filter((b) => b.userId === user.id);
  const myTransactions = store.db().transactions.filter((t) => t.userId === user.id);

  const approvedDeposits = myDeposits
    .filter((d) => d.status === 'approved')
    .reduce((sum, d) => sum + d.amount, 0);
  const approvedWithdrawals = myWithdrawals
    .filter((w) => w.status === 'approved')
    .reduce((sum, w) => sum + w.amount, 0);

  res.json({
    user: store.publicUser(user),
    currency: CURRENCY,
    limits: LIMITS,
    stats: {
      bets: myBets.length,
      wagered: sec.round2(myBets.reduce((s, b) => s + b.stake, 0)),
      won: sec.round2(myBets.reduce((s, b) => s + b.payout, 0)),
      net: sec.round2(myBets.reduce((s, b) => s + b.payout - b.stake, 0)),
      depositTotal: sec.round2(approvedDeposits),
      withdrawalTotal: sec.round2(approvedWithdrawals),
      pendingDeposits: myDeposits.filter((d) => d.status === 'pending').length,
      pendingWithdrawals: myWithdrawals.filter((w) => w.status === 'pending').length,
      transactions: myTransactions.length,
    },
    recentBets: myBets.slice(-8).reverse(),
    recentTransactions: myTransactions.slice(-8).reverse(),
    recentDeposits: myDeposits.slice(-5).reverse().map(serializeDeposit),
    recentWithdrawals: myWithdrawals.slice(-5).reverse().map(serializeWithdrawal),
  });
});

router.get('/me/bets', requireAuth, (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const bets = store
    .db()
    .bets.filter((b) => b.userId === req.user.id)
    .slice(-limit)
    .reverse();
  res.json({ bets });
});

router.get('/me/transactions', requireAuth, (req, res) => {
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 100));
  const { status, type } = req.query;
  let items = store.db().transactions.filter((t) => t.userId === req.user.id);
  if (status && TRANSACTION_STATUSES.includes(status)) items = items.filter((t) => t.status === status);
  if (type) items = items.filter((t) => t.type === type);
  res.json({ transactions: items.slice(-limit).reverse() });
});

router.patch('/me/profile', requireAuth, (req, res) => {
  const name = String(req.body.name || '').replace(/[<>]/g, '').trim();
  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ error: 'Name must be between 2 and 60 characters.' });
  }
  req.user.name = name;
  store.persist();
  res.json({ user: store.publicUser(req.user), message: 'Profile updated.' });
});

/* ----------------------------------------------------------------- deposits */

router.get('/deposits/methods', (req, res) => {
  res.json({ methods: DEPOSIT_METHODS, limits: LIMITS, currency: CURRENCY });
});

router.get('/deposits', requireAuth, (req, res) => {
  const items = store
    .db()
    .deposits.filter((d) => d.userId === req.user.id)
    .slice(-50)
    .reverse()
    .map(serializeDeposit);
  res.json({ deposits: items });
});

router.post('/deposits', requireAuth, (req, res) => {
  const amount = sec.round2(Number(req.body.amount));
  const method = String(req.body.method || '');
  if (!Number.isFinite(amount) || amount < LIMITS.depositMin || amount > LIMITS.depositMax) {
    return res.status(400).json({
      error: `Deposits must be between ${LIMITS.depositMin} and ${LIMITS.depositMax} ETB.`,
    });
  }
  if (!DEPOSIT_METHODS.some((m) => m.id === method)) {
    return res.status(400).json({ error: 'Choose a valid payment method.' });
  }
  const pending = store
    .db()
    .deposits.filter((d) => d.userId === req.user.id && d.status === 'pending');
  if (pending.length >= 3) {
    return res.status(429).json({
      error: 'You already have 3 pending demo deposits. Wait for review or cancel one first.',
    });
  }
  const deposit = store.createDeposit(req.user, { amount, method });
  res.status(201).json({
    deposit: serializeDeposit(deposit),
    message: `Demo deposit ${deposit.reference} created. Upload your proof within 19 minutes.`,
  });
});

router.post('/deposits/:id/screenshot', requireAuth, (req, res) => {
  const deposit = store.db().deposits.find((d) => d.id === req.params.id && d.userId === req.user.id);
  if (!deposit) return res.status(404).json({ error: 'Deposit request not found.' });
  if (deposit.status !== 'pending') {
    return res.status(409).json({ error: `This deposit is already ${deposit.status}.` });
  }
  store.saveScreenshot(deposit, req.body.image, req.body.fileName || 'payment-proof');
  res.json({
    deposit: serializeDeposit(deposit),
    message: 'Screenshot attached as demo proof. Awaiting admin review.',
  });
});

router.get('/deposits/:id/screenshot', requireAuth, (req, res) => {
  const deposit = store.db().deposits.find((d) => d.id === req.params.id);
  if (!deposit) return res.status(404).json({ error: 'Deposit request not found.' });
  if (deposit.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not allowed.' });
  }
  const file = store.screenshotPath(deposit);
  if (!file) return res.status(404).json({ error: 'No screenshot uploaded for this deposit.' });
  res.set('Content-Type', deposit.screenshot.mime);
  res.set('Cache-Control', 'private, no-store');
  return res.sendFile(file);
});

router.post('/deposits/:id/cancel', requireAuth, (req, res) => {
  const deposit = store.db().deposits.find((d) => d.id === req.params.id && d.userId === req.user.id);
  if (!deposit) return res.status(404).json({ error: 'Deposit request not found.' });
  if (deposit.status !== 'pending') {
    return res.status(409).json({ error: `This deposit is already ${deposit.status}.` });
  }
  store.rejectDeposit(deposit, { id: req.user.id }, 'Cancelled by player.');
  res.json({ deposit: serializeDeposit(deposit), message: 'Deposit request cancelled.' });
});

/* -------------------------------------------------------------- withdrawals */

router.get('/withdrawals/methods', (req, res) => {
  res.json({ methods: WITHDRAW_METHODS, limits: LIMITS, currency: CURRENCY });
});

router.get('/withdrawals', requireAuth, (req, res) => {
  const items = store
    .db()
    .withdrawals.filter((w) => w.userId === req.user.id)
    .slice(-50)
    .reverse()
    .map(serializeWithdrawal);
  res.json({ withdrawals: items });
});

router.post('/withdrawals', requireAuth, (req, res) => {
  const amount = sec.round2(Number(req.body.amount));
  const method = String(req.body.method || '');
  const accountName = String(req.body.accountName || '').replace(/[<>]/g, '').trim().slice(0, 60);
  const accountNumber = String(req.body.accountNumber || '').replace(/[^\d]/g, '').slice(0, 20);

  if (!Number.isFinite(amount) || amount < LIMITS.withdrawMin || amount > LIMITS.withdrawMax) {
    return res.status(400).json({
      error: `Demo withdrawals must be between ${LIMITS.withdrawMin.toLocaleString()} and ${LIMITS.withdrawMax.toLocaleString()} ETB.`,
    });
  }
  if (!WITHDRAW_METHODS.some((m) => m.id === method)) {
    return res.status(400).json({ error: 'Choose a valid payout method.' });
  }
  if (accountName.length < 3) {
    return res.status(400).json({ error: 'Enter the account holder name.' });
  }
  if (accountNumber.length < 6) {
    return res.status(400).json({ error: 'Enter a valid account or wallet number.' });
  }
  if (amount > req.user.balance) {
    return res.status(400).json({ error: 'Withdrawal exceeds your available demo balance.' });
  }
  const pending = store
    .db()
    .withdrawals.filter((w) => w.userId === req.user.id && w.status === 'pending');
  if (pending.length >= 2) {
    return res.status(429).json({ error: 'You already have 2 pending withdrawals. Please wait for review.' });
  }
  const withdrawal = store.createWithdrawal(req.user, { amount, method, accountName, accountNumber });
  res.status(201).json({
    withdrawal: serializeWithdrawal(withdrawal),
    balance: sec.round2(req.user.balance),
    message: `Withdrawal ${withdrawal.reference} submitted for demo review.`,
  });
});

module.exports = router;
module.exports.serializeDeposit = serializeDeposit;
module.exports.serializeWithdrawal = serializeWithdrawal;
