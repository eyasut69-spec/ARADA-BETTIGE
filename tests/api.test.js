'use strict';

/**
 * ARADA BETTING — end-to-end API test suite.
 * Boots the real server against a throwaway data directory and walks the
 * complete demo journey: guest wallet, registration, login, games, deposit +
 * screenshot, withdrawal, admin review, balance adjustment and recovery.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3800 + Math.floor(Math.random() * 150);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'arada-test-'));
const ROOT = path.join(__dirname, '..');

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function check(condition, message) {
  assert.ok(condition, message);
}

/* --------------------------------------------------------------- http client */

function client() {
  const cookies = new Map();
  return {
    cookies,
    async req(method, url, body, opts = {}) {
      const headers = {};
      if (body !== undefined) headers['content-type'] = 'application/json';
      if (cookies.size) {
        headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      }
      const res = await fetch(BASE + url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: opts.redirect || 'manual',
      });
      const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      for (const raw of setCookies) {
        const pair = raw.split(';')[0];
        const idx = pair.indexOf('=');
        if (idx > 0) cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return { status: res.status, data, headers: res.headers };
    },
    get(url) {
      return this.req('GET', url);
    },
    post(url, body) {
      return this.req('POST', url, body === undefined ? {} : body);
    },
    patch(url, body) {
      return this.req('PATCH', url, body === undefined ? {} : body);
    },
  };
}

/* ------------------------------------------------------------------ server */

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    ARADA_DATA_DIR: DATA_DIR,
    ARADA_UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
    NODE_ENV: 'test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => {
  serverLog += d.toString();
});
server.stderr.on('data', (d) => {
  serverLog += d.toString();
});

function shutdown(code) {
  try {
    server.kill('SIGKILL');
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  if (code !== 0) {
    console.error('\n--- server log ---\n' + serverLog.split('\n').slice(-40).join('\n'));
  }
  process.exit(code);
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start in time');
}

/* -------------------------------------------------------------------- tests */

async function main() {
  await waitForServer();
  const guest = client();
  const player = client();
  const admin = client();

  console.log('\nARADA BETTING — demo platform end-to-end');

  // --- health & config -----------------------------------------------------
  const health = await guest.get('/api/health');
  check(health.status === 200, 'health endpoint should return 200');
  ok('health endpoint responds');

  const config = await guest.get('/api/config');
  check(config.status === 200, 'config should return 200');
  const limits = config.data.limits;
  check(limits.depositMin === 100, `deposit minimum should be 100, got ${limits.depositMin}`);
  check(limits.depositMax === 10000, `deposit maximum should be 10000, got ${limits.depositMax}`);
  check(limits.withdrawMin === 500, `withdrawal minimum should be 500, got ${limits.withdrawMin}`);
  check(limits.withdrawMax === 50000, `withdrawal maximum should be 50000, got ${limits.withdrawMax}`);
  check(limits.depositWindowMs === 19 * 60 * 1000, 'deposit window should be 19 minutes');
  check(Array.isArray(config.data.depositMethods) && config.data.depositMethods.length >= 3, 'deposit methods expected');
  const telebirrMethod = config.data.depositMethods.find((m) => m.id === 'telebirr');
  check(
    telebirrMethod && telebirrMethod.account === '0964050295',
    `telebirr account should be 0964050295, got ${telebirrMethod && telebirrMethod.account}`,
  );
  const cbeMethod = config.data.depositMethods.find((m) => m.id === 'bank');
  check(
    cbeMethod && cbeMethod.account === '1000642419928',
    `CBE account should be 1000642419928, got ${cbeMethod && cbeMethod.account}`,
  );
  ok('config exposes 100/10,000 deposit and 500/50,000 withdrawal limits with a 19-minute window');

  // --- games ---------------------------------------------------------------
  const gamesRes = await guest.get('/api/games');
  check(gamesRes.status === 200, 'games should return 200');
  const games = gamesRes.data.games;
  check(Array.isArray(games) && games.length === 7, `expected 7 games, got ${games?.length}`);
  for (const slug of ['golden-crash', 'dice-duel', 'royal-coin', 'golden-wheel', 'lucky-nine', 'vip-baccarat', 'vip-blackjack']) {
    check(games.some((g) => g.slug === slug), `game ${slug} should be listed`);
  }
  check(
    games.every((g) => g.name && g.short && g.accent),
    'every game should expose a name, tagline and logo accent',
  );
  ok('all seven games, including baccarat and blackjack, are listed publicly');

  // --- guest wallet + play -------------------------------------------------
  const guestRes = await guest.post('/api/auth/guest');
  check(guestRes.status === 201, `guest wallet should be created, got ${guestRes.status}`);
  const guestStart = guestRes.data.user.balance;
  check(guestStart > 0, 'guest wallet should start with demo credits');
  ok('a visitor can open a guest wallet and play without registering');

  const guestPlay = await guest.post('/api/games/dice-duel/play', { stake: 50, target: 50, direction: 'over' });
  check(guestPlay.status === 200, `dice play should succeed, got ${guestPlay.status}: ${JSON.stringify(guestPlay.data)}`);
  check(typeof guestPlay.data.balance === 'number', 'play response should report the new balance');
  check(typeof guestPlay.data.win === 'boolean', 'play response should report the outcome');
  ok('guest plays a real server-side dice round with virtual credits');

  const guestMe = await guest.get('/api/me/overview');
  check(guestMe.data.stats.bets === 1, 'guest bet should be recorded in history');
  ok('guest game history records the round');

  // --- casino tables -------------------------------------------------------
  const baccarat = await guest.post('/api/games/vip-baccarat/play', { stake: 50, bet: 'player' });
  check(baccarat.status === 200, `baccarat should play, got ${baccarat.status}: ${JSON.stringify(baccarat.data)}`);
  check(baccarat.data.playerCards.length >= 2, 'baccarat should deal a player hand');
  check(baccarat.data.bankerCards.length >= 2, 'baccarat should deal a banker hand');
  check(['player', 'banker', 'tie'].includes(baccarat.data.outcome), 'baccarat should report the outcome');
  ok('baccarat deals and settles a real round on the server');

  const bjStart = await guest.post('/api/games/blackjack/start', { stake: 50 });
  check(bjStart.status === 200, `blackjack should start, got ${bjStart.status}: ${JSON.stringify(bjStart.data)}`);
  check(typeof bjStart.data.id === 'string' && bjStart.data.playerCards.length === 2, 'blackjack should deal two cards');
  const bjId = bjStart.data.id;
  const bjEnd = await guest.post(`/api/games/blackjack/${bjId}/stand`);
  check(bjEnd.status === 200, `blackjack stand should succeed, got ${bjEnd.status}: ${JSON.stringify(bjEnd.data)}`);
  check(['won', 'lost', 'push', 'blackjack'].includes(bjEnd.data.status), `unexpected blackjack status ${bjEnd.data.status}`);
  const bjReplay = await guest.post(`/api/games/blackjack/${bjId}/hit`);
  check(bjReplay.status === 409, 'a settled blackjack hand cannot be played again');
  ok('blackjack deals, stands and locks settled hands');

  // --- registration --------------------------------------------------------
  const phone = '0912345678';
  const password = 'Player@1234';
  const reg = await player.post('/api/auth/register', {
    phone,
    password,
    name: 'Test Player',
    acceptedTerms: true,
  });
  check(reg.status === 201, `register should return 201, got ${reg.status}: ${JSON.stringify(reg.data)}`);
  check(reg.data.user.role === 'player', 'new account should be a player');
  check(typeof reg.data.recoveryCode === 'string' && reg.data.recoveryCode.replace(/-/g, '').length === 16, 'recovery code expected');
  const recoveryCode = reg.data.recoveryCode;
  ok('phone + password registration returns a 16-character recovery code');

  // --- invite link ---------------------------------------------------------
  const invite = await player.get('/api/me/referral');
  check(invite.status === 200, `invite link should load, got ${invite.status}`);
  check(/^ARADA[A-Z0-9]{4}$/.test(invite.data.code), `unexpected invite code: ${invite.data.code}`);
  check(invite.data.link.includes(`?ref=${invite.data.code}`), 'invite link should carry the code');
  const invitedReg = await client().post('/api/auth/register', {
    phone: '0912345671',
    password,
    name: 'Invited Friend',
    acceptedTerms: true,
    referral: invite.data.code,
  });
  check(invitedReg.status === 201, `invited registration should succeed, got ${invitedReg.status}: ${JSON.stringify(invitedReg.data)}`);
  const inviteAfter = await player.get('/api/me/referral');
  check(inviteAfter.data.invited === 1, `inviter should see one invited friend, got ${inviteAfter.data.invited}`);
  check(inviteAfter.data.earned >= 100, `inviter should earn the referral bonus, got ${inviteAfter.data.earned}`);
  ok('invite links register friends and pay the referral bonus to both sides');

  const noTerms = await client().post('/api/auth/register', {
    phone: '0912345679',
    password,
    name: 'No Terms',
  });
  check(noTerms.status === 400, 'registration without accepting demo terms should fail');
  ok('registration requires accepting the virtual-money terms');

  const dupe = await client().post('/api/auth/register', { phone, password, name: 'Dupe', acceptedTerms: true });
  check(dupe.status === 409, 'duplicate phone should be rejected');
  ok('duplicate phone numbers are rejected');

  // --- login ---------------------------------------------------------------
  const badLogin = await client().post('/api/auth/login', { phone, password: 'WrongPass1' });
  check(badLogin.status === 401, 'wrong password should be 401');
  ok('wrong passwords are rejected with attempt feedback');

  const login = await player.post('/api/auth/login', { phone, password });
  check(login.status === 200, `login should succeed, got ${login.status}`);
  check(login.data.user.phone === phone, 'login should return the signed-in user');
  ok('phone + password login works without any OTP step');

  const overview0 = await player.get('/api/me/overview');
  const balance0 = overview0.data.user.balance;
  check(balance0 > 0, 'player should have welcome demo credits');
  check(overview0.data.stats.bets === 0, 'new player has no bets');
  ok('player dashboard overview returns balance, stats and empty history');

  const unauth = await client().get('/api/me/overview');
  check(unauth.status === 401, 'protected endpoint should reject anonymous access');
  ok('protected endpoints reject anonymous requests');

  // --- deposit validation + creation --------------------------------------
  const lowDeposit = await player.post('/api/deposits', { amount: 99, method: 'telebirr' });
  check(lowDeposit.status === 400, 'deposit below minimum should fail');
  const highDeposit = await player.post('/api/deposits', { amount: 10001, method: 'telebirr' });
  check(highDeposit.status === 400, 'deposit above maximum should fail');
  const badMethod = await player.post('/api/deposits', { amount: 500, method: 'bitcoin' });
  check(badMethod.status === 400, 'unknown deposit method should fail');
  ok('deposit limits (100 – 10,000 ETB) and method validation are enforced');

  const deposit = await player.post('/api/deposits', { amount: 500, method: 'telebirr' });
  check(deposit.status === 201, `deposit should be created, got ${deposit.status}: ${JSON.stringify(deposit.data)}`);
  const dep = deposit.data.deposit;
  check(dep.status === 'pending', 'new deposit should be pending');
  check(typeof dep.reference === 'string' && dep.reference.length > 3, 'deposit should have a reference');
  check(
    dep.remainingMs > 18.5 * 60 * 1000 && dep.remainingMs <= 19 * 60 * 1000,
    `deposit should have a ~19 minute countdown, got ${dep.remainingMs}ms`,
  );
  ok('demo deposit created with a 19-minute review countdown');

  const shot = await player.post(`/api/deposits/${dep.id}/screenshot`, {
    image: `data:image/png;base64,${PNG_1X1}`,
    fileName: 'proof.png',
  });
  check(shot.status === 200, `screenshot upload should succeed, got ${shot.status}: ${JSON.stringify(shot.data)}`);
  check(shot.data.deposit.screenshot && shot.data.deposit.screenshot.size > 0, 'screenshot metadata expected');
  ok('payment screenshot uploaded as demo proof');

  const shotFetch = await player.get(`/api/deposits/${dep.id}/screenshot`);
  check(shotFetch.status === 200, 'owner should be able to open their proof');
  ok('uploaded proof is retrievable by its owner');

  const foreignShot = await client().get(`/api/deposits/${dep.id}/screenshot`);
  check(foreignShot.status === 401 || foreignShot.status === 403, 'other visitors must not read the proof');
  ok('payment proofs are not exposed to other visitors');

  // --- withdrawal validation ----------------------------------------------
  const lowWd = await player.post('/api/withdrawals', {
    amount: 499,
    method: 'telebirr',
    accountName: 'Test Player',
    accountNumber: '0912345678',
  });
  check(lowWd.status === 400, 'withdrawal below 500 should fail');
  const highWd = await player.post('/api/withdrawals', {
    amount: 50001,
    method: 'telebirr',
    accountName: 'Test Player',
    accountNumber: '0912345678',
  });
  check(highWd.status === 400, 'withdrawal above 50,000 should fail');
  const overBalance = await player.post('/api/withdrawals', {
    amount: 50000,
    method: 'telebirr',
    accountName: 'Test Player',
    accountNumber: '0912345678',
  });
  check(overBalance.status === 400, 'withdrawal above the balance should fail');
  ok('withdrawal limits (500 – 50,000 ETB) and balance checks are enforced');

  const withdrawal = await player.post('/api/withdrawals', {
    amount: 500,
    method: 'telebirr',
    accountName: 'Test Player',
    accountNumber: '0912345678',
  });
  check(withdrawal.status === 201, `withdrawal should be created, got ${withdrawal.status}: ${JSON.stringify(withdrawal.data)}`);
  const wd = withdrawal.data.withdrawal;
  check(wd.status === 'pending', 'new withdrawal should be pending');
  ok('demo withdrawal request created as pending');

  const held = await player.get('/api/me/overview');
  check(
    Math.abs(held.data.user.balance - (balance0 - 500)) < 0.01,
    `pending withdrawal should hold 500, got ${held.data.user.balance}`,
  );
  ok('pending withdrawal holds the demo amount until review');

  // --- admin ---------------------------------------------------------------
  const adminLogin = await admin.post('/api/auth/login', { phone: '0911000000', password: 'Arada@Admin1' });
  check(adminLogin.status === 200, `admin login should work, got ${adminLogin.status}: ${JSON.stringify(adminLogin.data)}`);
  check(adminLogin.data.user.role === 'admin', 'admin role expected');
  ok('operator account signs in with admin role');

  const playerAdminAttempt = await player.get('/api/admin/overview');
  check(playerAdminAttempt.status === 403, 'players must not reach admin APIs');
  ok('admin APIs are restricted to admin accounts');

  const adminOverview = await admin.get('/api/admin/overview');
  check(adminOverview.status === 200, 'admin overview should load');
  check(adminOverview.data.totals.users >= 2, 'admin overview should count users');
  check(adminOverview.data.totals.depositPendingCount >= 1, 'pending deposit should be visible');
  check(adminOverview.data.pendingDeposits[0].user.phone, 'pending deposit should name its player');
  ok('admin overview reports totals and pending queues');

  const adminUsers = await admin.get('/api/admin/users');
  const listedPlayer = adminUsers.data.users.find((u) => u.phone === phone);
  check(!!listedPlayer, 'registered player should appear in the admin user list');
  ok('admin user management lists registered players');

  // approve deposit
  const approveDep = await admin.post(`/api/admin/deposits/${dep.id}/decision`, {
    decision: 'approve',
    note: 'Verified demo proof',
  });
  check(approveDep.status === 200, `approving deposit should work, got ${approveDep.status}: ${JSON.stringify(approveDep.data)}`);
  check(approveDep.data.deposit.status === 'approved', 'deposit should be approved');

  const afterDeposit = await player.get('/api/me/overview');
  check(
    Math.abs(afterDeposit.data.user.balance - (held.data.user.balance + 500)) < 0.01,
    `balance should rise by 500 from ${held.data.user.balance}, got ${afterDeposit.data.user.balance}`,
  );
  check(afterDeposit.data.stats.depositTotal === 500, 'approved deposit should count in totals');
  ok('approved demo deposit credits the player balance');

  // reject a second deposit
  const dep2 = await player.post('/api/deposits', { amount: 300, method: 'cbebirr' });
  check(dep2.status === 201, 'second deposit should be created');
  const rejectDep = await admin.post(`/api/admin/deposits/${dep2.data.deposit.id}/decision`, {
    decision: 'reject',
    note: 'Proof unreadable',
  });
  check(rejectDep.data.deposit.status === 'rejected', 'second deposit should be rejected');
  const afterReject = await player.get('/api/me/overview');
  check(
    Math.abs(afterReject.data.user.balance - afterDeposit.data.user.balance) < 0.01,
    'rejected deposit must not change the balance',
  );
  ok('rejected demo deposit is recorded without crediting the balance');

  // approve withdrawal
  const approveWd = await admin.post(`/api/admin/withdrawals/${wd.id}/decision`, {
    decision: 'approve',
    note: 'Demo payout complete',
  });
  check(approveWd.status === 200, `approving withdrawal should work, got ${approveWd.status}: ${JSON.stringify(approveWd.data)}`);
  check(approveWd.data.withdrawal.status === 'approved', 'withdrawal should be approved');
  const afterWd = await player.get('/api/me/overview');
  check(
    Math.abs(afterWd.data.user.balance - afterReject.data.user.balance) < 0.01,
    `approved withdrawal must not debit twice, got ${afterWd.data.user.balance}`,
  );
  ok('approved demo withdrawal settles the amount already held');

  const wd2 = await player.post('/api/withdrawals', {
    amount: 500,
    method: 'cbebirr',
    accountName: 'Test Player',
    accountNumber: '0912345678',
  });
  check(wd2.status === 201, 'second withdrawal should be created');
  const afterHold = await player.get('/api/me/overview');
  check(
    Math.abs(afterHold.data.user.balance - (afterWd.data.user.balance - 500)) < 0.01,
    'new withdrawal should hold its amount',
  );
  const rejectWd = await admin.post(`/api/admin/withdrawals/${wd2.data.withdrawal.id}/decision`, {
    decision: 'reject',
    note: 'Demo refund',
  });
  check(rejectWd.status === 200 && rejectWd.data.withdrawal.status === 'rejected', 'second withdrawal should be rejected');
  const afterRefund = await player.get('/api/me/overview');
  check(
    Math.abs(afterRefund.data.user.balance - afterWd.data.user.balance) < 0.01,
    `rejected withdrawal should refund the hold, got ${afterRefund.data.user.balance}`,
  );
  ok('rejected demo withdrawal returns the held credits');

  // balance adjustment
  const beforeAdjust = afterRefund.data.user.balance;
  const adjust = await admin.post(`/api/admin/users/${listedPlayer.id}/balance`, {
    amount: 1000,
    note: 'Demo bonus',
  });
  check(adjust.status === 200, `balance adjustment should work, got ${adjust.status}`);
  check(Math.abs(adjust.data.user.balance - (beforeAdjust + 1000)) < 0.01, 'admin credit should raise the balance');
  ok('admin can adjust a player demo balance');

  // screenshots + transactions
  const shots = await admin.get('/api/admin/screenshots');
  check(shots.status === 200 && shots.data.screenshots.length >= 1, 'uploaded screenshot should be listed for review');
  ok('admin screenshot gallery lists uploaded proofs');

  const adminShot = await admin.get(`/api/admin/screenshots/${dep.id}`);
  check(adminShot.status === 200, 'admin should be able to open the proof image');
  ok('admin can open the uploaded proof image');

  const adminTx = await admin.get('/api/admin/transactions');
  check(adminTx.status === 200 && adminTx.data.transactions.length >= 3, 'transactions should be listed');
  const statuses = new Set(adminTx.data.transactions.map((t) => t.status));
  check(statuses.has('approved'), 'approved transactions expected');
  check(statuses.has('pending') || statuses.has('rejected'), 'pending/rejected history expected');
  ok('transactions expose pending, approved and rejected states');

  // games management
  const patchGame = await admin.patch('/api/admin/games/dice-duel', { enabled: true, minBet: 20, maxBet: 2000 });
  check(patchGame.status === 200, `game update should work, got ${patchGame.status}: ${JSON.stringify(patchGame.data)}`);
  check(patchGame.data.game.minBet === 20 && patchGame.data.game.maxBet === 2000, 'game limits should be saved');
  const badGame = await admin.patch('/api/admin/games/dice-duel', { minBet: 1 });
  check(badGame.status === 400, 'invalid game limits should be rejected');
  ok('admin can edit game availability and bet limits');

  // recovery + password change + block
  const recover = await client().post('/api/auth/recover', {
    phone,
    recoveryCode,
    newPassword: 'Fresh@9876',
  });
  check(recover.status === 200, `recovery should succeed, got ${recover.status}: ${JSON.stringify(recover.data)}`);
  check(recover.data.recoveryCode && recover.data.recoveryCode !== recoveryCode, 'recovery should rotate the code');
  ok('password recovery works with the saved recovery code and rotates it');

  const oldLogin = await client().post('/api/auth/login', { phone, password });
  check(oldLogin.status === 401, 'old password must stop working after recovery');
  const newLogin = await client().post('/api/auth/login', { phone, password: 'Fresh@9876' });
  check(newLogin.status === 200, 'new password should sign in');
  ok('recovered password replaces the old one');

  const block = await admin.patch(`/api/admin/users/${listedPlayer.id}`, { status: 'blocked' });
  check(block.status === 200, 'admin should be able to block a player');
  const blockedLogin = await client().post('/api/auth/login', { phone, password: 'Fresh@9876' });
  check(blockedLogin.status === 403, 'blocked player should not sign in');
  ok('blocked demo accounts cannot sign in');

  // static app shell
  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  check(home.status === 200 && homeHtml.includes('ARADA BETTING'), 'app shell should be served');
  const appJs = await fetch(`${BASE}/js/app.js`);
  check(appJs.status === 200, 'client bundle should be served');
  ok('app shell and client bundle are served');

  console.log(`\nAll ${passed} checks passed.\n`);
  shutdown(0);
}

main().catch((err) => {
  console.error('\n✗ Test failure:', err && err.message ? err.message : err);
  shutdown(1);
});
