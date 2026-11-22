'use strict';

import { gameLogo } from './logos.js';

/**
 * ARADA BETTING — client router and pages.
 * Every view is rendered from real API data; nothing here is a dead link.
 */

import {
  state,
  api,
  money,
  escapeHtml,
  fmtDate,
  timeAgo,
  countdown,
  toast,
  setUser,
  limit,
  onCleanup,
  runCleanups,
  bootstrap,
} from './api.js';
import {
  icon,
  mountChrome,
  setAuthListener,
  installGlobalHandlers,
  statusBadge,
  emptyRow,
  openModal,
  modalHead,
  closeModal,
} from './ui.js';
import { renderGamePage } from './games-ui.js';

const view = () => document.getElementById('view');

/* ------------------------------------------------------------------ helpers */

function pageHead(title, sub, actions = '') {
  return `<div class="page-head">
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${sub ? `<p class="muted">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="btn-row">${actions}</div>` : ''}
  </div>`;
}

function stat(label, value, note = '') {
  return `<div class="stat">
    <span class="tiny muted">${escapeHtml(label)}</span>
    <strong>${value}</strong>
    ${note ? `<span class="kpi-note">${note}</span>` : ''}
  </div>`;
}

function dataTable(headers, rows, empty) {
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') : emptyRow(headers.length, empty)}</tbody>
  </table></div>`;
}

function authGate(title, sub, extra = '') {
  return `<section class="section narrow">
    <div class="card auth-gate">
      <div class="guest-icon">${icon('lock')}</div>
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(sub)}</p>
      ${extra}
      <div class="btn-row">
        <button class="btn btn-gold" data-auth="login">${icon('lock')} Sign in</button>
        <button class="btn btn-outline-gold" data-auth="register">${icon('user')} Create account</button>
        <button class="btn btn-ghost" data-guest>${icon('sparkles')} Guest wallet</button>
      </div>
      <p class="tiny muted">No OTP is required for normal sign-in.</p>
    </div>
  </section>`;
}

function bindGuest(rootEl) {
  rootEl.querySelectorAll('[data-guest]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      const original = btn.innerHTML;
      btn.innerHTML = `${icon('refresh')} Opening wallet…`;
      try {
        const data = await api('/api/auth/guest', { method: 'POST' });
        setUser(data.user);
        toast(`Guest wallet ready with ${money(data.user.balance)} credits.`, 'success');
        mountChrome();
        await render();
      } catch (err) {
        toast(err.message || 'Could not open a guest wallet.', 'error');
        btn.innerHTML = original;
        delete btn.dataset.busy;
      }
    });
  });
}

function startCountdowns(rootEl) {
  const nodes = Array.from(rootEl.querySelectorAll('[data-expires]'));
  if (!nodes.length) return;
  const tick = () => {
    for (const node of nodes) {
      const expires = Number(node.dataset.expires);
      const left = expires - Date.now();
      node.textContent = left > 0 ? countdown(left) : 'Expired';
      node.classList.toggle('expired', left <= 0);
    }
  };
  tick();
  const id = setInterval(tick, 1000);
  onCleanup(() => clearInterval(id));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function field(label, inputHtml, hint = '') {
  return `<div class="field"><label>${escapeHtml(label)}</label>${inputHtml}${hint ? `<p class="tiny muted">${hint}</p>` : ''}</div>`;
}

/* --------------------------------------------------------------- home page */

function gameCard(game) {
  const accent = /^#[0-9a-f]{3,8}$/i.test(String(game.accent || '')) ? game.accent : '#d4af37';
  return `<a class="game-card" href="#/games/${game.slug}" style="--accent:${accent}">
    <div class="game-card-art">
      ${gameLogo(game.slug, 'game-card-logo')}
      ${game.enabled === false ? '<span class="badge badge-off">Paused</span>' : `<span class="badge badge-live">${escapeHtml(game.badge || 'Live')}</span>`}
    </div>
    <div class="game-card-body">
      <div class="row-between"><h3>${escapeHtml(game.name)}</h3><span class="tiny muted">RTP ${Number(game.rtp || 0)}%</span></div>
      <p class="muted small">${escapeHtml(game.short || '')}</p>
      <div class="row-between tiny muted">
        <span>${money(game.minBet, 0)} – ${money(game.maxBet, 0)}</span>
        <span>${Number(game.plays || 0)} plays</span>
      </div>
    </div>
  </a>`;
}

async function homePage() {
  const games = state.games.slice(0, 6);
  const user = state.user;
  const dMin = limit('depositMin', 100);
  const dMax = limit('depositMax', 10000);
  const wMin = limit('withdrawMin', 500);
  const wMax = limit('withdrawMax', 50000);

  return `
  <section class="hero">
    <div class="hero-inner">
      <span class="badge badge-gold">${icon('shield')} 18+ · Play responsibly</span>
      <h1>Welcome to <span class="gold">ARADA</span><br />Betting.</h1>
      <p class="lead">A premium betting floor in black, gold and white. Browse every table, play with ETB credits, and top up through Telebirr or Commercial Bank of Ethiopia — every payment is verified by our team.</p>
      <div class="btn-row">
        <a class="btn btn-gold btn-lg" href="#/games">${icon('games')} Browse games</a>
        ${user ? `<a class="btn btn-outline-gold btn-lg" href="#/dashboard">${icon('grid')} My dashboard</a>` : `<button class="btn btn-outline-gold btn-lg" data-guest>${icon('sparkles')} Play instantly</button>`}
      </div>
      <div class="hero-stats">
        ${stat('Games', String(state.games.length), 'Instant play')}
        ${stat('Deposit range', `${money(dMin, 0)} – ${money(dMax, 0)}`)}
        ${stat('Withdrawal range', `${money(wMin, 0)} – ${money(wMax, 0)}`)}
      </div>
    </div>
  </section>

  <section class="section">
    ${pageHead('Featured games', 'Every table, instant game and casino classic — server-side results and a full audit trail.', `<a class="btn btn-ghost btn-sm" href="#/games">All games ${icon('games')}</a>`)}
    <div class="game-grid">${games.map(gameCard).join('')}</div>
  </section>

  <section class="section">
    ${pageHead('How ARADA works', 'Register in seconds, play instantly, cash out through the cashier.')}
    <div class="grid-3">
      <div class="how-card">
        <div class="guest-icon">${icon('user')}</div>
        <h3>1 · Open a wallet</h3>
        <p class="muted small">Register with a phone number and password, or start a guest wallet instantly. Every new account receives ${money(limit('welcomeBonus', 1000))} in credits.</p>
      </div>
      <div class="how-card">
        <div class="guest-icon">${icon('games')}</div>
        <h3>2 · Play the tables</h3>
        <p class="muted small">Crash, dice, coin, wheel, lucky digits, baccarat and blackjack. Every round lands in your game history with its multiplier and payout.</p>
      </div>
      <div class="how-card">
        <div class="guest-icon">${icon('wallet')}</div>
        <h3>3 · Use the cashier</h3>
        <p class="muted small">Deposit with Telebirr or CBE, attach your payment screenshot within 19 minutes, and our team verifies it. Withdrawals follow the same review flow.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('wallet')} Deposit limits</h3><span class="badge badge-gold">Verified</span></div>
        <div class="balance-line"><strong>${money(dMin, 0)}</strong><span class="muted">minimum</span></div>
        <div class="balance-line"><strong>${money(dMax, 0)}</strong><span class="muted">maximum</span></div>
        <p class="small muted">Choose Telebirr, CBE Birr or a CBE bank transfer, send the exact amount to the account shown, then upload your payment screenshot. Every request carries a 19-minute upload window.</p>
        <a class="btn btn-gold btn-block" href="#/deposit">${icon('wallet')} Open deposit page</a>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('banknote')} Withdrawal limits</h3><span class="badge badge-gold">ETB</span></div>
        <div class="balance-line"><strong>${money(wMin, 0)}</strong><span class="muted">minimum</span></div>
        <div class="balance-line"><strong>${money(wMax, 0)}</strong><span class="muted">maximum</span></div>
        <p class="small muted">Withdrawal requests are reviewed by our team and paid out to the Telebirr or CBE account you enter. Minimum 500 ETB, maximum 50,000 ETB per request.</p>
        <a class="btn btn-outline-gold btn-block" href="#/withdraw">${icon('banknote')} Open withdrawal page</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="card cta-band">
      <div>
        <h2>Ready for the golden floor?</h2>
        <p class="muted">Create your account in seconds. No OTP and no card required — deposit with Telebirr or CBE.</p>
      </div>
      <div class="btn-row">
        ${user ? `<a class="btn btn-gold" href="#/games">${icon('games')} Keep playing</a>` : `<button class="btn btn-gold" data-auth="register">${icon('user')} Create account</button>`}
        <a class="btn btn-ghost" href="#/support">${icon('info')} How it works</a>
      </div>
    </div>
  </section>`;
}

/* -------------------------------------------------------------- games pages */

async function gamesPage() {
  const categories = ['All', ...Array.from(new Set(state.games.map((g) => g.category).filter(Boolean)))];
  return `${pageHead(
    'The golden floor',
    'Browse every table. Results are generated on the server and recorded in your history.',
    `<a class="btn btn-ghost btn-sm" href="#/dashboard">${icon('grid')} My dashboard</a>`,
  )}
  <div class="filter-row">
    <div class="chip-row" id="game-cats">
      ${categories
        .map((c, i) => `<button class="btn ${i === 0 ? 'btn-gold' : 'btn-ghost'} btn-sm" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join('')}
    </div>
    <input class="input" id="game-search" type="search" placeholder="Search games" aria-label="Search games" />
  </div>
  <div class="game-grid" id="game-grid">${state.games.map(gameCard).join('')}</div>
  <p class="empty" id="game-empty" hidden>No games match that filter.</p>`;
}

async function gamePage(slug) {
  const page = renderGamePage(slug);
  if (!page) return notFoundPage();
  return {
    html: page.html,
    mount(rootEl) {
      page.mount(rootEl);
    },
  };
}

/* ------------------------------------------------------------ deposit page */

let focusDepositId = null;

function copyRow(label, value) {
  return `<div class="copy-row">
    <span class="tiny muted">${escapeHtml(label)}</span>
    <strong class="copy-value">${escapeHtml(value)}</strong>
    <button type="button" class="link-btn gold" data-copy="${escapeHtml(value)}">Copy</button>
  </div>`;
}

function methodButton(m, active) {
  return `<button type="button" class="method${active ? ' active' : ''}" data-method="${escapeHtml(m.id)}">
    <strong>${escapeHtml(m.name)}</strong>
    <span>${escapeHtml(m.tagline || m.hint || 'Payment method')}</span>
    ${m.account ? `<span class="method-account">${escapeHtml(m.account)}</span>` : ''}
  </button>`;
}

function depositLiveCard(deposit, methods) {
  const method = methods.find((m) => m.id === deposit.method);
  const steps = method && Array.isArray(method.steps) && method.steps.length
    ? method.steps
    : [
        'Open Telebirr or your bank app and prepare the transfer.',
        'Send the exact amount, then upload the payment screenshot below.',
        'Our team verifies the payment and credits your balance.',
      ];
  const expires = new Date(deposit.expiresAt).getTime();
  return `<section class="card deposit-live mb-16">
    <div class="card-head">
      <div>
        <span class="tiny muted">Deposit reference</span>
        <h3 class="gold">${escapeHtml(deposit.reference)}</h3>
      </div>
      ${statusBadge(deposit.status)}
    </div>
    <div class="balance-line"><strong>${money(deposit.amount)}</strong><span class="muted">${escapeHtml(deposit.methodName)}</span></div>
    <div class="pay-details">
      ${method && method.account ? copyRow(`${method.name} account`, method.account) : ''}
      ${method && method.holder ? copyRow('Account name', method.holder) : ''}
      ${copyRow('Exact amount', `${money(deposit.amount)} ETB`)}
      ${copyRow('Transfer note', deposit.reference)}
    </div>
    <div class="countdown-bar">
      <span class="tiny muted">Upload window</span>
      <span class="countdown" data-expires="${expires}">19:00</span>
    </div>
    <ol class="steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    <div class="upload-zone">
      <input type="file" id="proof-input" accept="image/png,image/jpeg,image/webp" hidden />
      <label for="proof-input" class="btn btn-gold">${icon('copy')} ${deposit.screenshot ? 'Replace screenshot' : 'Upload payment screenshot'}</label>
      <p class="tiny muted">PNG, JPG or WEBP · maximum 6 MB · a clear screenshot speeds up approval.</p>
    </div>
    ${deposit.screenshot ? `<p class="tiny muted">Proof attached ${timeAgo(deposit.screenshot.uploadedAt)} (${Math.round(deposit.screenshot.size / 1024)} KB). Awaiting review.</p>` : ''}
  </section>`;
}

function depositRows(deposits) {
  return deposits.map((d) => {
    const expires = new Date(d.expiresAt).getTime();
    const timer = d.status === 'pending'
      ? `<span class="countdown" data-expires="${expires}">${countdown(Math.max(0, expires - Date.now()))}</span>`
      : '<span class="tiny muted">—</span>';
    const proof = d.screenshot
      ? `<a class="link-btn" href="/api/deposits/${d.id}/screenshot" target="_blank" rel="noopener">${icon('copy')} View</a>`
      : '<span class="tiny muted">None</span>';
    const actions = d.status === 'pending'
      ? `<div class="btn-row"><button class="btn btn-ghost btn-sm" data-cancel-deposit="${d.id}">Cancel</button></div>`
      : '<span class="tiny muted">—</span>';
    return [
      `<strong>${money(d.amount)}</strong><div class="tiny muted">${escapeHtml(d.reference)}</div>`,
      escapeHtml(d.methodName || d.method),
      statusBadge(d.status),
      timer,
      proof,
      actions,
    ];
  });
}

async function depositPage() {
  if (!state.user) {
    return authGate(
      'Sign in to deposit credits',
      'Sign in to see the Telebirr and CBE accounts, then upload your payment proof.',
      `<div class="stat-grid mb-16">
        ${stat('Minimum deposit', money(limit('depositMin', 100), 0))}
        ${stat('Maximum deposit', money(limit('depositMax', 10000), 0))}
      </div>`,
    );
  }
  const { deposits } = await api('/api/deposits');
  const methods = state.config?.depositMethods || [];
  const min = limit('depositMin', 100);
  const max = limit('depositMax', 10000);
  const focus = focusDepositId ? deposits.find((d) => d.id === focusDepositId) : null;
  const active = focus ? focus.method : methods[0]?.id || '';

  return `${pageHead(
    'Deposit ETB',
    `Send between ${money(min, 0)} and ${money(max, 0)} to the account shown, then upload your payment screenshot for verification.`,
    `<a class="btn btn-ghost btn-sm" href="#/withdraw">${icon('banknote')} Withdraw</a>`,
  )}
  ${focus ? depositLiveCard(focus, methods) : ''}
  <div class="grid-2">
    <form class="card" id="deposit-form" novalidate>
      <div class="card-head"><h3 class="card-title">${icon('wallet')} New deposit</h3><span class="badge badge-gold">19-min window</span></div>
      ${field('Payment method', `<div class="method-grid" id="method-grid">${methods.map((m) => methodButton(m, m.id === active)).join('')}</div><input type="hidden" name="method" value="${escapeHtml(active)}" />`)}
      ${field(
        'Amount (ETB)',
        `<input class="input" id="dep-amount" name="amount" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" placeholder="${min}" required />
         <div class="chip-row mt-8">${[100, 500, 1000, 2500, 5000, 10000]
           .filter((v) => v >= min && v <= max)
           .map((v) => `<button type="button" class="chip" data-amount="${v}">${v.toLocaleString()}</button>`)
           .join('')}</div>`,
        `Minimum ${money(min, 0)} · Maximum ${money(max, 0)}`,
      )}
      <button class="btn btn-gold btn-block" type="submit">${icon('check')} Create deposit request</button>
    </form>

    <div class="card">
      <div class="card-head"><h3 class="card-title">${icon('info')} Where to send your payment</h3></div>
      <div class="pay-details">
        ${methods.filter((m) => m.account).map((m) => copyRow(m.name, m.account)).join('')}
      </div>
      <ol class="steps">
        <li>Pick a method and enter an amount inside the allowed range.</li>
        <li>Send the exact amount to the account shown and keep the confirmation SMS.</li>
        <li>Submit the request to receive a reference and a 19-minute upload window.</li>
        <li>Upload your payment screenshot; our team verifies it and credits your balance.</li>
      </ol>
      <div class="pill-note">${icon('shield')}<div>Every payment is checked by our team before credits are added. Send the exact amount and keep your screenshot until it is approved.</div></div>
    </div>
  </div>

  <section class="section">
    ${pageHead('My deposit requests', 'Pending, approved and rejected deposits.')}
    <div class="card">${dataTable(['Amount', 'Method', 'Status', 'Proof window', 'Screenshot', 'Actions'], depositRows(deposits), 'No deposits yet.')}</div>
  </section>`;
}

/* ----------------------------------------------------------- withdraw page */

function withdrawalRows(items) {
  return items.map((w) => [
    `<strong>${money(w.amount)}</strong><div class="tiny muted">${escapeHtml(w.reference)}</div>`,
    escapeHtml(w.methodName || w.method),
    `${escapeHtml(w.accountName || '—')}<div class="tiny muted">${escapeHtml(w.accountNumber || '')}</div>`,
    statusBadge(w.status),
    `<span class="tiny muted">${escapeHtml(w.adminNote || '—')}</span>`,
    `<span class="tiny muted">${timeAgo(w.createdAt)}</span>`,
  ]);
}

async function withdrawPage() {
  if (!state.user) {
    return authGate(
      'Sign in to request a withdrawal',
      'Withdrawals are reviewed by our team and paid out to your Telebirr or CBE account.',
      `<div class="stat-grid mb-16">
        ${stat('Minimum withdrawal', money(limit('withdrawMin', 500), 0))}
        ${stat('Maximum withdrawal', money(limit('withdrawMax', 50000), 0))}
      </div>`,
    );
  }
  const { withdrawals } = await api('/api/withdrawals');
  const methods = state.config?.withdrawMethods || [];
  const min = limit('withdrawMin', 500);
  const max = limit('withdrawMax', 50000);
  const balance = Number(state.user.balance || 0);

  return `${pageHead(
    'Withdraw ETB',
    `Request between ${money(min, 0)} and ${money(max, 0)} from your balance. Our team pays out to your Telebirr or CBE account.`,
    `<a class="btn btn-ghost btn-sm" href="#/deposit">${icon('wallet')} Deposit</a>`,
  )}
  <div class="stat-grid mb-16">
    ${stat('Minimum withdrawal', money(min, 0))}
    ${stat('Maximum withdrawal', money(max, 0))}
    ${stat('Available balance', money(balance))}
  </div>
  <div class="grid-2">
    <form class="card" id="withdraw-form" novalidate>
      <div class="card-head"><h3 class="card-title">${icon('banknote')} New withdrawal</h3><span class="badge badge-gold">Reviewed</span></div>
      ${field('Payout method', `<div class="method-grid" id="method-grid">${methods.map((m, i) => methodButton(m, i === 0)).join('')}</div><input type="hidden" name="method" value="${escapeHtml(methods[0]?.id || '')}" />`)}
      ${field('Amount (ETB)', `<input class="input" id="wd-amount" name="amount" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" placeholder="${min}" required />`, `Minimum ${money(min, 0)} · Maximum ${money(max, 0)} · Balance ${money(balance)}`)}
      ${field('Account holder name', `<input class="input" name="accountName" id="wd-name" type="text" maxlength="60" placeholder="Full name on the account" required />`)}
      ${field('Account / wallet number', `<input class="input" name="accountNumber" id="wd-account" type="tel" inputmode="numeric" maxlength="20" placeholder="09xxxxxxxx" required />`)}
      <button class="btn btn-gold btn-block" type="submit">${icon('check')} Request withdrawal</button>
      <p class="tiny muted">Requests are reviewed by our team before payout.</p>
    </form>
    <div class="card">
      <div class="card-head"><h3 class="card-title">${icon('info')} Withdrawal rules</h3></div>
      <ol class="steps">
        <li>Minimum request: <strong>${money(min, 0)}</strong>.</li>
        <li>Maximum request: <strong>${money(max, 0)}</strong>.</li>
        <li>The amount must be covered by your balance.</li>
        <li>Approved requests are paid out to your account; rejected requests return the balance.</li>
      </ol>
      <div class="pill-note">${icon('alert')}<div>Payouts are manual. Make sure the account name and number you enter are correct. 18+ only.</div></div>
    </div>
  </div>
  <section class="section">
    ${pageHead('My withdrawal requests', 'Pending, approved and rejected withdrawals.')}
    <div class="card">${dataTable(['Amount', 'Method', 'Destination', 'Status', 'Operator note', 'Requested'], withdrawalRows(withdrawals), 'No withdrawals yet.')}</div>
  </section>`;
}

/* ---------------------------------------------------------- user dashboard */

function betRows(bets) {
  return bets.map((b) => [
    `<strong>${escapeHtml(b.gameName || b.game || 'Game')}</strong><div class="tiny muted">${escapeHtml(b.detail || '')}</div>`,
    money(b.stake),
    `${Number(b.multiplier || 0).toFixed(2)}×`,
    `<span class="${Number(b.payout) > 0 ? 'gold' : 'muted'}">${money(b.payout)}</span>`,
    `<span class="tiny muted">${timeAgo(b.createdAt)}</span>`,
  ]);
}

function txRows(items) {
  return items.map((t) => {
    const positive = Number(t.amount) >= 0;
    return [
      `<strong>${escapeHtml(String(t.type || '').replace(/_/g, ' '))}</strong><div class="tiny muted">${escapeHtml(t.note || '')}</div>`,
      `<span class="${positive ? 'gold' : 'muted'}">${positive ? '+' : ''}${money(t.amount)}</span>`,
      statusBadge(t.status),
      `<span class="tiny muted">${timeAgo(t.createdAt)}</span>`,
    ];
  });
}

function inviteCard(ref) {
  if (!ref || !ref.link) return '';
  const share = encodeURIComponent(`Join me on ARADA BETTING. Use my invite code ${ref.code}: ${ref.link}`);
  return `<div class="card invite-card mb-16">
    <div class="invite-main">
      <div class="guest-icon">${icon('gift')}</div>
      <div>
        <h3>Invite friends · earn ${money(ref.bonus, 0)} each</h3>
        <p class="tiny muted">Share your personal link. When a friend registers with your code you both receive ${money(ref.bonus, 0)}. Invited: <strong>${Number(ref.invited) || 0}</strong> · Earned: <strong class="gold">${money(ref.earned)}</strong></p>
      </div>
    </div>
    <div class="invite-actions">
      <input class="input" readonly value="${escapeHtml(ref.link)}" data-invite-link aria-label="Your invite link" />
      <button type="button" class="btn btn-gold btn-sm" data-invite-copy="${escapeHtml(ref.link)}">${icon('copy')} Copy link</button>
      <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${share}">${icon('users')} Share</a>
    </div>
  </div>`;
}

async function dashboardPage() {
  if (!state.user) {
    return authGate('Your ARADA dashboard', 'Sign in to see your profile, balance, game history and transactions.');
  }
  const [overview, betsData, txData, refData] = await Promise.all([
    api('/api/me/overview'),
    api('/api/me/bets?limit=100'),
    api('/api/me/transactions?limit=100'),
    api('/api/me/referral').catch(() => null),
  ]);
  setUser(overview.user);
  const u = overview.user;
  const s = overview.stats;
  const initials = String(u.name || 'A').trim().slice(0, 1).toUpperCase();

  const tabs = [
    ['overview', 'Overview'],
    ['history', 'Game history'],
    ['transactions', 'Transactions'],
    ['deposits', 'Deposits'],
    ['withdrawals', 'Withdrawals'],
    ['profile', 'Profile'],
  ];

  return {
    html: `${pageHead(
      'My dashboard',
      'Profile, balance, game history and the full transaction ledger.',
      `<a class="btn btn-gold btn-sm" href="#/deposit">${icon('wallet')} Deposit</a><a class="btn btn-ghost btn-sm" href="#/withdraw">${icon('banknote')} Withdraw</a>`,
    )}
    <section class="card mb-16">
      <div class="profile-head">
        <div class="avatar">${escapeHtml(initials)}</div>
        <div>
          <h2>${escapeHtml(u.name)}</h2>
          <p class="tiny muted">${u.phone ? escapeHtml(u.phone) : 'Guest wallet'} · Member since ${fmtDate(u.createdAt, { withTime: false })}</p>
          <div class="chip-row mt-8">
            <span class="badge badge-gold">${escapeHtml(u.role)}</span>
            <span class="badge ${u.status === 'active' ? 'badge-live' : 'badge-off'}">${escapeHtml(u.status)}</span>
            ${u.isGuest ? `<button class="badge badge-gold" data-auth="register">${icon('user')} Save this wallet</button>` : ''}
          </div>
        </div>
        <div class="profile-balance">
          <span class="tiny muted">Available balance</span>
          <strong class="gold">${money(u.balance)}</strong>
          <span class="tiny muted">ETB · ready to play</span>
        </div>
      </div>
    </section>
    <div class="stat-grid mb-16">
      ${stat('Total bets', String(s.bets))}
      ${stat('Wagered', money(s.wagered))}
      ${stat('Total payout', money(s.won))}
      ${stat('Net result', `${Number(s.net) >= 0 ? '+' : ''}${money(s.net)}`)}
      ${stat('Approved deposits', money(s.depositTotal))}
      ${stat('Approved withdrawals', money(s.withdrawalTotal))}
    </div>
    <div class="tab-bar" id="dash-tabs">
      ${tabs.map(([id, label], i) => `<button class="btn ${i === 0 ? 'btn-gold' : 'btn-ghost'} btn-sm" data-dash-tab="${id}">${label}</button>`).join('')}
    </div>
    <div id="dash-panel">
      <div class="tab-panel" data-panel="overview">
        ${inviteCard(refData)}
        <div class="grid-2">
          <div class="card">
            <div class="card-head"><h3 class="card-title">${icon('games')} Recent game history</h3><a class="link-btn" href="#/games">Play</a></div>
            ${dataTable(['Game', 'Stake', 'Multiplier', 'Payout', 'When'], betRows(overview.recentBets || []), 'No bets yet — open a game to start.')}
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">${icon('refresh')} Recent transactions</h3></div>
            ${dataTable(['Type', 'Amount', 'Status', 'When'], txRows(overview.recentTransactions || []), 'No transactions yet.')}
          </div>
        </div>
        <div class="grid-2 mt-16">
          <div class="card">
            <div class="card-head"><h3 class="card-title">${icon('wallet')} Latest deposits</h3><a class="link-btn" href="#/deposit">Deposit</a></div>
            ${dataTable(['Amount', 'Method', 'Status', 'Proof window', 'Screenshot', 'Actions'], depositRows(overview.recentDeposits || []), 'No deposits yet.')}
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">${icon('banknote')} Latest withdrawals</h3><a class="link-btn" href="#/withdraw">Withdraw</a></div>
            ${dataTable(['Amount', 'Method', 'Destination', 'Status', 'Operator note', 'Requested'], withdrawalRows(overview.recentWithdrawals || []), 'No withdrawals yet.')}
          </div>
        </div>
      </div>
      <div class="tab-panel" data-panel="history" hidden>
        <div class="card">${dataTable(['Game', 'Stake', 'Multiplier', 'Payout', 'When'], betRows(betsData.bets || []), 'No game history yet.')}</div>
      </div>
      <div class="tab-panel" data-panel="transactions" hidden>
        <div class="card">${dataTable(['Type', 'Amount', 'Status', 'When'], txRows(txData.transactions || []), 'No transactions yet.')}</div>
      </div>
      <div class="tab-panel" data-panel="deposits" hidden>
        <div class="card">${dataTable(['Amount', 'Method', 'Status', 'Proof window', 'Screenshot', 'Actions'], depositRows(overview.recentDeposits || []), 'No deposits yet.')}</div>
      </div>
      <div class="tab-panel" data-panel="withdrawals" hidden>
        <div class="card">${dataTable(['Amount', 'Method', 'Destination', 'Status', 'Operator note', 'Requested'], withdrawalRows(overview.recentWithdrawals || []), 'No withdrawals yet.')}</div>
      </div>
      <div class="tab-panel" data-panel="profile" hidden>
        <div class="grid-2">
          <form class="card" id="profile-form">
            <div class="card-head"><h3 class="card-title">${icon('user')} Profile</h3></div>
            ${field('Display name', `<input class="input" name="name" type="text" maxlength="60" value="${escapeHtml(u.name)}" required />`)}
            ${field('Phone number', `<input class="input" type="text" value="${u.phone ? escapeHtml(u.phone) : 'Guest wallet — no phone linked'}" disabled />`)}
            <button class="btn btn-gold" type="submit">${icon('check')} Save profile</button>
          </form>
          <div>
            <form class="card mb-16" id="password-form">
              <div class="card-head"><h3 class="card-title">${icon('lock')} Change password</h3></div>
              ${field('Current password', '<input class="input" name="currentPassword" type="password" autocomplete="current-password" required />')}
              ${field('New password', '<input class="input" name="newPassword" type="password" autocomplete="new-password" required />', 'At least 8 characters with a letter and a number.')}
              <button class="btn btn-outline-gold" type="submit">${icon('lock')} Update password</button>
            </form>
            <form class="card" id="recovery-form">
              <div class="card-head"><h3 class="card-title">${icon('shield')} Recovery code</h3></div>
              <p class="small muted">Recovery codes reset your password without OTP. Generating a new code replaces the previous one.</p>
              ${field('Confirm with password', '<input class="input" name="password" type="password" autocomplete="current-password" required />')}
              <button class="btn btn-ghost" type="submit">${icon('refresh')} Generate new recovery code</button>
            </form>
          </div>
        </div>
      </div>
    </div>`,
    mount(rootEl) {
      rootEl.querySelectorAll('[data-dash-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.dashTab;
          rootEl.querySelectorAll('[data-dash-tab]').forEach((b) => {
            b.className = `btn ${b.dataset.dashTab === name ? 'btn-gold' : 'btn-ghost'} btn-sm`;
          });
          rootEl.querySelectorAll('[data-panel]').forEach((p) => {
            p.hidden = p.dataset.panel !== name;
          });
        });
      });

      rootEl.querySelector('#profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.name.value.trim();
        try {
          const data = await api('/api/me/profile', { method: 'PATCH', body: { name } });
          setUser(data.user);
          toast(data.message || 'Profile updated.', 'success');
          await render();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      rootEl.querySelector('#password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const data = await api('/api/auth/change-password', {
            method: 'POST',
            body: { currentPassword: e.target.currentPassword.value, newPassword: e.target.newPassword.value },
          });
          toast(data.message || 'Password updated.', 'success');
          e.target.reset();
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      rootEl.querySelector('#recovery-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const data = await api('/api/auth/recovery-code', {
            method: 'POST',
            body: { password: e.target.password.value },
          });
          e.target.reset();
          openModal(`${modalHead('Your new recovery code', 'Store it somewhere safe — it will not be shown again.')}
            <div class="recovery-code" id="new-recovery-code">${escapeHtml(data.recoveryCode)}</div>
            <div class="modal-actions"><button class="btn btn-gold" data-close>${icon('check')} I saved it</button></div>`);
        } catch (err) {
          toast(err.message, 'error');
        }
      });

      rootEl.querySelectorAll('[data-cancel-deposit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await api(`/api/deposits/${btn.dataset.cancelDeposit}/cancel`, { method: 'POST' });
            toast('Deposit request cancelled.', 'info');
            await render();
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      });
    },
  };
}

/* --------------------------------------------------------- admin dashboard */

function adminTabBar() {
  const tabs = [
    ['overview', 'Overview', 'grid'],
    ['users', 'Users', 'user'],
    ['deposits', 'Deposits', 'wallet'],
    ['withdrawals', 'Withdrawals', 'banknote'],
    ['transactions', 'Transactions', 'refresh'],
    ['games', 'Games', 'games'],
    ['screenshots', 'Screenshots', 'copy'],
  ];
  return `<div class="tab-bar" id="admin-tabs">
    ${tabs.map(([id, label, ic], i) => `<button class="btn ${i === 0 ? 'btn-gold' : 'btn-ghost'} btn-sm" data-admin-tab="${id}">${icon(ic)} ${label}</button>`).join('')}
  </div>`;
}

function adminOverviewHtml(overview) {
  const t = overview.totals;
  const pendingDepositRows = (overview.pendingDeposits || []).map((d) => [
    `<strong>${money(d.amount)}</strong><div class="tiny muted">${escapeHtml(d.reference)}</div>`,
    escapeHtml(d.user?.phone || d.user?.name || '—'),
    escapeHtml(d.methodName || d.method),
    d.screenshot ? `<a class="link-btn" href="/api/admin/screenshots/${d.id}" target="_blank" rel="noopener">${icon('copy')} Proof</a>` : '<span class="tiny muted">None</span>',
    `<div class="btn-row">
      <button class="btn btn-success btn-sm" data-admin-action="approve-deposit" data-id="${d.id}">Approve</button>
      <button class="btn btn-danger btn-sm" data-admin-action="reject-deposit" data-id="${d.id}">Reject</button>
    </div>`,
  ]);
  const pendingWithdrawalRows = (overview.pendingWithdrawals || []).map((w) => [
    `<strong>${money(w.amount)}</strong><div class="tiny muted">${escapeHtml(w.reference)}</div>`,
    escapeHtml(w.user?.phone || w.user?.name || '—'),
    `${escapeHtml(w.methodName || w.method)}<div class="tiny muted">${escapeHtml(w.accountNumber || '')}</div>`,
    `<div class="btn-row">
      <button class="btn btn-success btn-sm" data-admin-action="approve-withdrawal" data-id="${w.id}">Approve</button>
      <button class="btn btn-danger btn-sm" data-admin-action="reject-withdrawal" data-id="${w.id}">Reject</button>
    </div>`,
  ]);

  return `<div class="stat-grid mb-16">
      ${stat('Users', String(t.users), `${t.newUsers24h} new in 24h`)}
      ${stat('Credits in play', money(t.balance))}
      ${stat('Total wagered', money(t.wagered))}
      ${stat('Paid out', money(t.paidOut))}
      ${stat('House profit', money(t.houseProfit))}
      ${stat('Bets', String(t.bets))}
      ${stat('Deposits approved', money(t.depositApprovedTotal))}
      ${stat('Withdrawals approved', money(t.withdrawalApprovedTotal))}
      ${stat('Pending deposits', String(t.depositPendingCount), money(t.depositPendingAmount))}
      ${stat('Pending withdrawals', String(t.withdrawalPendingCount), money(t.withdrawalPendingAmount))}
      ${stat('Screenshots', String(t.screenshots))}
      ${stat('Blocked users', String(t.blockedUsers))}
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('wallet')} Pending deposits</h3><span class="badge badge-gold">${t.depositPendingCount}</span></div>
        ${dataTable(['Amount', 'Player', 'Method', 'Proof', 'Decision'], pendingDepositRows, 'No pending deposits.')}
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('banknote')} Pending withdrawals</h3><span class="badge badge-gold">${t.withdrawalPendingCount}</span></div>
        ${dataTable(['Amount', 'Player', 'Method', 'Decision'], pendingWithdrawalRows, 'No pending withdrawals.')}
      </div>
    </div>
    <div class="card mt-16">
      <div class="card-head"><h3 class="card-title">${icon('user')} Newest accounts</h3></div>
      ${dataTable(
        ['Player', 'Role', 'Balance', 'Status', 'Joined'],
        (overview.recentUsers || []).map((u) => [
          `<strong>${escapeHtml(u.name)}</strong><div class="tiny muted">${u.phone ? escapeHtml(u.phone) : 'guest wallet'}</div>`,
          escapeHtml(u.role),
          money(u.balance),
          statusBadge(u.status === 'active' ? 'approved' : 'rejected'),
          `<span class="tiny muted">${timeAgo(u.createdAt)}</span>`,
        ]),
        'No accounts yet.',
      )}
    </div>`;
}

function adminUsersHtml(users) {
  return `<div class="admin-toolbar">
      <input class="input" id="admin-user-search" type="search" placeholder="Search by phone, name or ID" aria-label="Search users" />
      <button class="btn btn-ghost btn-sm" id="admin-user-search-btn">${icon('games')} Search</button>
      <span class="badge badge-gold">${users.length} accounts</span>
    </div>
    <div class="card">${dataTable(
      ['Player', 'Role', 'Balance', 'Status', 'Requests', 'Actions'],
      users.map((u) => [
        `<strong>${escapeHtml(u.name)}</strong><div class="tiny muted">${u.phone ? escapeHtml(u.phone) : 'guest wallet'}${u.isGuest ? ' · guest' : ''}</div>`,
        escapeHtml(u.role),
        `<strong class="gold">${money(u.balance)}</strong>`,
        `<span class="badge ${u.status === 'active' ? 'badge-live' : 'badge-off'}">${escapeHtml(u.status)}</span>`,
        `<span class="tiny muted">${u.pendingDeposits} dep · ${u.pendingWithdrawals} wd</span>`,
        `<div class="btn-row">
          <button class="btn btn-ghost btn-sm" data-admin-action="adjust" data-id="${u.id}">${icon('wallet')} Balance</button>
          <button class="btn btn-ghost btn-sm" data-admin-action="reset-pass" data-id="${u.id}">${icon('lock')} Password</button>
          <button class="btn ${u.status === 'blocked' ? 'btn-success' : 'btn-danger'} btn-sm" data-admin-action="${u.status === 'blocked' ? 'unblock' : 'block'}" data-id="${u.id}">${u.status === 'blocked' ? 'Unblock' : 'Block'}</button>
        </div>`,
      ]),
      'No accounts match.',
    )}</div>`;
}

function adminDepositsHtml(deposits) {
  return `<div class="card">${dataTable(
    ['Amount', 'Player', 'Method', 'Status', 'Proof', 'Decision'],
    deposits.map((d) => [
      `<strong>${money(d.amount)}</strong><div class="tiny muted">${escapeHtml(d.reference)}</div>`,
      `${escapeHtml(d.user?.phone || d.user?.name || '—')}<div class="tiny muted">${timeAgo(d.createdAt)}</div>`,
      escapeHtml(d.methodName || d.method),
      statusBadge(d.status),
      d.screenshot ? `<a class="link-btn" href="/api/admin/screenshots/${d.id}" target="_blank" rel="noopener">${icon('copy')} View proof</a>` : '<span class="tiny muted">None</span>',
      d.status === 'pending'
        ? `<div class="btn-row">
             <button class="btn btn-success btn-sm" data-admin-action="approve-deposit" data-id="${d.id}">Approve</button>
             <button class="btn btn-danger btn-sm" data-admin-action="reject-deposit" data-id="${d.id}">Reject</button>
           </div>`
        : `<span class="tiny muted">${escapeHtml(d.adminNote || 'Reviewed')}</span>`,
    ]),
    'No deposit requests yet.',
  )}</div>`;
}

function adminWithdrawalsHtml(items) {
  return `<div class="card">${dataTable(
    ['Amount', 'Player', 'Method', 'Destination', 'Status', 'Decision'],
    items.map((w) => [
      `<strong>${money(w.amount)}</strong><div class="tiny muted">${escapeHtml(w.reference)}</div>`,
      `${escapeHtml(w.user?.phone || w.user?.name || '—')}<div class="tiny muted">${timeAgo(w.createdAt)}</div>`,
      escapeHtml(w.methodName || w.method),
      `${escapeHtml(w.accountName || '—')}<div class="tiny muted">${escapeHtml(w.accountNumber || '')}</div>`,
      statusBadge(w.status),
      w.status === 'pending'
        ? `<div class="btn-row">
             <button class="btn btn-success btn-sm" data-admin-action="approve-withdrawal" data-id="${w.id}">Approve</button>
             <button class="btn btn-danger btn-sm" data-admin-action="reject-withdrawal" data-id="${w.id}">Reject</button>
           </div>`
        : `<span class="tiny muted">${escapeHtml(w.adminNote || 'Reviewed')}</span>`,
    ]),
    'No withdrawal requests yet.',
  )}</div>`;
}

function adminTransactionsHtml(items) {
  return `<div class="card">${dataTable(
    ['Type', 'Player', 'Amount', 'Status', 'Note', 'When'],
    items.map((t) => [
      escapeHtml(String(t.type || '').replace(/_/g, ' ')),
      escapeHtml(t.user?.phone || t.user?.name || '—'),
      `<span class="${Number(t.amount) >= 0 ? 'gold' : 'muted'}">${Number(t.amount) >= 0 ? '+' : ''}${money(t.amount)}</span>`,
      statusBadge(t.status),
      `<span class="tiny muted">${escapeHtml(t.note || '—')}</span>`,
      `<span class="tiny muted">${timeAgo(t.createdAt)}</span>`,
    ]),
    'No transactions yet.',
  )}</div>`;
}

function adminGamesHtml(games) {
  return `<div class="card">${dataTable(
    ['Game', 'Status', 'RTP', 'Min bet', 'Max bet', 'Plays', 'Save'],
    games.map((g) => [
      `<strong>${escapeHtml(g.name)}</strong><div class="tiny muted">${escapeHtml(g.category || '')}</div>`,
      `<label class="checkbox"><input type="checkbox" data-game-enabled="${g.slug}" ${g.enabled ? 'checked' : ''} /> <span>${g.enabled ? 'Enabled' : 'Paused'}</span></label>`,
      `${Number(g.rtp || 0)}%`,
      `<input class="input input-sm" type="number" min="10" max="5000" step="10" value="${Number(g.minBet || 10)}" data-game-min="${g.slug}" />`,
      `<input class="input input-sm" type="number" min="10" max="50000" step="10" value="${Number(g.maxBet || 10000)}" data-game-max="${g.slug}" />`,
      `<span class="tiny muted">${Number(g.plays || 0)}</span>`,
      `<button class="btn btn-gold btn-sm" data-admin-action="save-game" data-id="${g.slug}">${icon('check')} Save</button>`,
    ]),
    'No games configured.',
  )}</div>`;
}

function adminScreenshotsHtml(items) {
  if (!items.length) return '<div class="card"><p class="empty">No payment screenshots uploaded yet.</p></div>';
  return `<div class="proof-grid">${items
    .map(
      (s) => `<figure class="proof-card">
        <a href="/api/admin/screenshots/${s.depositId}" target="_blank" rel="noopener">
          <img src="/api/admin/screenshots/${s.depositId}" alt="Payment proof for ${escapeHtml(s.reference)}" loading="lazy" />
        </a>
        <figcaption>
          <strong>${money(s.amount)}</strong>
          <span class="tiny muted">${escapeHtml(s.user?.phone || s.user?.name || '—')} · ${timeAgo(s.createdAt)}</span>
          <div class="row-between">
            ${statusBadge(s.status)}
            ${s.status === 'pending'
              ? `<div class="btn-row">
                   <button class="btn btn-success btn-sm" data-admin-action="approve-deposit" data-id="${s.depositId}">Approve</button>
                   <button class="btn btn-danger btn-sm" data-admin-action="reject-deposit" data-id="${s.depositId}">Reject</button>
                 </div>`
              : `<span class="tiny muted">${escapeHtml(s.reference)}</span>`}
          </div>
        </figcaption>
      </figure>`,
    )
    .join('')}</div>`;
}

function noteModal({ title, label, confirmLabel, onConfirm }) {
  openModal(
    `${modalHead(title, 'Operator action')}
     <div class="field"><label for="admin-note">${escapeHtml(label)}</label>
       <textarea class="input" id="admin-note" rows="3" maxlength="160" placeholder="Optional note"></textarea></div>
     <div class="modal-actions">
       <button class="btn btn-ghost" data-close>Cancel</button>
       <button class="btn btn-gold" id="admin-note-confirm">${escapeHtml(confirmLabel)}</button>
     </div>`,
    {
      onMount(m, close) {
        m.querySelector('#admin-note-confirm').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            await onConfirm(m.querySelector('#admin-note').value.trim());
            close();
          } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
          }
        });
      },
    },
  );
}

async function adminPage() {
  if (!state.user) {
    return authGate('Operator sign-in', 'Sign in with an admin account to manage users, balances, games and requests.');
  }
  if (state.user.role !== 'admin') {
    return `<section class="section narrow"><div class="card auth-gate">
      <div class="guest-icon">${icon('shield')}</div>
      <h2>Admin access required</h2>
      <p class="muted">This account is a player account. Sign in with the operator account to open the admin dashboard.</p>
      <div class="btn-row"><a class="btn btn-gold" href="#/dashboard">${icon('grid')} My dashboard</a><a class="btn btn-ghost" href="#/games">${icon('games')} Games</a></div>
      <p class="tiny muted">Operator: 0911000000 · Arada@Admin1</p>
    </div></section>`;
  }

  const overview = await api('/api/admin/overview');

  return {
    html: `${pageHead(
      'Admin dashboard',
      'Manage users, balances, games, transactions and uploaded payment screenshots.',
      `<a class="btn btn-ghost btn-sm" href="#/dashboard">${icon('grid')} Player view</a>`,
    )}
    ${adminTabBar()}
    <div id="admin-panel"><div class="card"><p class="empty">Loading overview…</p></div></div>`,
    mount(rootEl) {
      const panel = rootEl.querySelector('#admin-panel');
      let current = 'overview';
      let usersCache = [];

      const setTab = (name) => {
        current = name;
        rootEl.querySelectorAll('[data-admin-tab]').forEach((b) => {
          b.className = `btn ${b.dataset.adminTab === name ? 'btn-gold' : 'btn-ghost'} btn-sm`;
        });
      };

      const load = async (name) => {
        setTab(name);
        panel.innerHTML = '<div class="card"><p class="empty">Loading…</p></div>';
        try {
          if (name === 'overview') {
            const data = await api('/api/admin/overview');
            panel.innerHTML = adminOverviewHtml(data);
          } else if (name === 'users') {
            const data = await api('/api/admin/users');
            usersCache = data.users || [];
            panel.innerHTML = adminUsersHtml(usersCache);
          } else if (name === 'deposits') {
            const data = await api('/api/admin/deposits');
            panel.innerHTML = adminDepositsHtml(data.deposits || []);
          } else if (name === 'withdrawals') {
            const data = await api('/api/admin/withdrawals');
            panel.innerHTML = adminWithdrawalsHtml(data.withdrawals || []);
          } else if (name === 'transactions') {
            const data = await api('/api/admin/transactions');
            panel.innerHTML = adminTransactionsHtml(data.transactions || []);
          } else if (name === 'games') {
            const data = await api('/api/admin/games');
            panel.innerHTML = adminGamesHtml(data.games || []);
          } else if (name === 'screenshots') {
            const data = await api('/api/admin/screenshots');
            panel.innerHTML = adminScreenshotsHtml(data.screenshots || []);
          }
        } catch (err) {
          panel.innerHTML = `<div class="card"><p class="empty">${escapeHtml(err.message || 'Could not load this section.')}</p></div>`;
        }
      };

      rootEl.querySelectorAll('[data-admin-tab]').forEach((btn) => {
        btn.addEventListener('click', () => load(btn.dataset.adminTab));
      });

      panel.addEventListener('click', async (e) => {
        const searchBtn = e.target.closest('#admin-user-search-btn');
        if (searchBtn) {
          const q = panel.querySelector('#admin-user-search')?.value.trim() || '';
          const data = await api(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
          usersCache = data.users || [];
          panel.innerHTML = adminUsersHtml(usersCache);
          return;
        }

        const btn = e.target.closest('[data-admin-action]');
        if (!btn) return;
        const action = btn.dataset.adminAction;
        const id = btn.dataset.id;
        const user = usersCache.find((u) => u.id === id);

        try {
          if (action === 'approve-deposit' || action === 'reject-deposit') {
            const kind = 'deposits';
            const approve = action === 'approve-deposit';
            noteModal({
              title: approve ? 'Approve deposit' : 'Reject deposit',
              label: approve ? 'Credit note (optional)' : 'Reason for rejection',
              confirmLabel: approve ? 'Approve & credit' : 'Reject request',
              async onConfirm(note) {
                const data = await api(`/api/admin/${kind}/${id}/decision`, {
                  method: 'POST',
                  body: { decision: approve ? 'approve' : 'reject', note },
                });
                toast(data.message, approve ? 'success' : 'info');
                await load(current);
              },
            });
          } else if (action === 'approve-withdrawal' || action === 'reject-withdrawal') {
            const approve = action === 'approve-withdrawal';
            noteModal({
              title: approve ? 'Approve withdrawal' : 'Reject withdrawal',
              label: approve ? 'Payout note (optional)' : 'Reason for rejection',
              confirmLabel: approve ? 'Approve payout' : 'Reject request',
              async onConfirm(note) {
                const data = await api(`/api/admin/withdrawals/${id}/decision`, {
                  method: 'POST',
                  body: { decision: approve ? 'approve' : 'reject', note },
                });
                toast(data.message, approve ? 'success' : 'info');
                await load(current);
              },
            });
          } else if (action === 'block' || action === 'unblock') {
            const data = await api(`/api/admin/users/${id}`, {
              method: 'PATCH',
              body: { status: action === 'block' ? 'blocked' : 'active' },
            });
            toast(data.message, 'success');
            await load('users');
          } else if (action === 'adjust' && user) {
            openModal(
              `${modalHead(`Adjust balance — ${escapeHtml(user.name)}`, `Current balance ${money(user.balance)}`)}
               <div class="field"><label for="adjust-amount">Amount (ETB)</label>
                 <input class="input" id="adjust-amount" type="number" step="0.01" placeholder="e.g. 1000 or -500" /></div>
               <div class="field"><label for="adjust-note">Note</label>
                 <input class="input" id="adjust-note" type="text" maxlength="160" placeholder="Manual balance adjustment" /></div>
               <div class="modal-actions">
                 <button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-gold" id="adjust-save">${icon('check')} Apply adjustment</button>
               </div>`,
              {
                onMount(m, close) {
                  m.querySelector('#adjust-save').addEventListener('click', async (ev) => {
                    ev.currentTarget.disabled = true;
                    try {
                      const data = await api(`/api/admin/users/${user.id}/balance`, {
                        method: 'POST',
                        body: {
                          amount: Number(m.querySelector('#adjust-amount').value),
                          note: m.querySelector('#adjust-note').value.trim(),
                        },
                      });
                      toast(data.message, 'success');
                      close();
                      await load('users');
                    } catch (err) {
                      toast(err.message, 'error');
                      ev.currentTarget.disabled = false;
                    }
                  });
                },
              },
            );
          } else if (action === 'reset-pass' && user) {
            openModal(
              `${modalHead(`Reset password — ${escapeHtml(user.name)}`, 'The player will be signed out everywhere.')}
               <div class="field"><label for="reset-pass">New password</label>
                 <input class="input" id="reset-pass" type="password" autocomplete="new-password" placeholder="8+ characters, letter and number" /></div>
               <div class="modal-actions">
                 <button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-gold" id="reset-pass-save">${icon('lock')} Reset password</button>
               </div>`,
              {
                onMount(m, close) {
                  m.querySelector('#reset-pass-save').addEventListener('click', async (ev) => {
                    ev.currentTarget.disabled = true;
                    try {
                      const data = await api(`/api/admin/users/${user.id}/password`, {
                        method: 'POST',
                        body: { newPassword: m.querySelector('#reset-pass').value },
                      });
                      toast(data.message, 'success');
                      close();
                    } catch (err) {
                      toast(err.message, 'error');
                      ev.currentTarget.disabled = false;
                    }
                  });
                },
              },
            );
          } else if (action === 'save-game') {
            const slug = id;
            const enabled = panel.querySelector(`[data-game-enabled="${slug}"]`)?.checked ?? true;
            const minBet = Number(panel.querySelector(`[data-game-min="${slug}"]`)?.value);
            const maxBet = Number(panel.querySelector(`[data-game-max="${slug}"]`)?.value);
            const data = await api(`/api/admin/games/${slug}`, {
              method: 'PATCH',
              body: { enabled, minBet, maxBet },
            });
            toast(data.message, 'success');
            await load('games');
          }
        } catch (err) {
          toast(err.message || 'That action could not be completed.', 'error');
        }
      });

      panel.innerHTML = adminOverviewHtml(overview);
    },
  };
}

/* ------------------------------------------------------------ static pages */

function promotionsPage() {
  const bonus = money(limit('welcomeBonus', 1000));
  return `${pageHead('Promotions', 'Rewards for players who fund their wallet.')}
  <div class="grid-3">
    <div class="card"><div class="guest-icon">${icon('gift')}</div><h3>Welcome credits</h3><p class="muted small">Every new account starts with ${bonus} in credits. Guest wallets receive the same amount.</p><a class="btn btn-gold btn-block" href="#/games">Play now</a></div>
    <div class="card"><div class="guest-icon">${icon('refresh')}</div><h3>Cashier practice</h3><p class="muted small">Run the full deposit and withdrawal flow with screenshots and operator review — all in ETB.</p><a class="btn btn-outline-gold btn-block" href="#/deposit">Open cashier</a></div>
    <div class="card"><div class="guest-icon">${icon('shield')}</div><h3>Responsible play</h3><p class="muted small">Set your own limits, take breaks and only play with money you can afford to lose.</p><a class="btn btn-ghost btn-block" href="#/responsible">Read guidance</a></div>
  </div>`;
}

function supportPage() {
  const faqs = [
    ['How do I fund my account?', 'Choose Telebirr or CBE, transfer to the account shown on the deposit page, then upload your payment screenshot within 19 minutes for operator approval.'],
    ['Do I need an OTP to sign in?', 'No. Sign in with your phone number and password. A recovery code handles forgotten passwords without any SMS step.'],
    ['How do deposits work?', 'Create a request between 100 and 10,000 ETB, upload a payment screenshot within the 19-minute window, and the operator approves or rejects it.'],
    ['What are the withdrawal limits?', 'Minimum 500 ETB and maximum 50,000 ETB per request, and the amount must be covered by your balance.'],
    ['Can I play without registering?', 'Yes. Open a guest wallet instantly from the home page or any locked page, then convert it into a full account whenever you like.'],
  ];
  return `${pageHead('Support & FAQ', 'Answers about the platform.')}
  <div class="grid-2">
    <div class="card">
      ${faqs.map(([q, a]) => `<details class="faq"><summary>${escapeHtml(q)}</summary><p class="muted small">${escapeHtml(a)}</p></details>`).join('')}
    </div>
    <div class="card">
      <div class="card-head"><h3 class="card-title">${icon('info')} Quick links</h3></div>
      <div class="mini-list">
        <a class="mini-item" href="#/games">${icon('games')} Browse games</a>
        <a class="mini-item" href="#/deposit">${icon('wallet')} Deposit credits</a>
        <a class="mini-item" href="#/withdraw">${icon('banknote')} Withdraw credits</a>
        <a class="mini-item" href="#/dashboard">${icon('grid')} My dashboard</a>
        <a class="mini-item" href="#/terms">${icon('shield')} Terms & rules</a>
      </div>
      <div class="pill-note">${icon('alert')}<div>Include your deposit reference when contacting support so we can match your payment quickly.</div></div>
    </div>
  </div>`;
}

function responsiblePage() {
  return `${pageHead('Responsible play', 'Keep your sessions balanced.')}
  <div class="card">
    <ol class="steps">
      <li>Deposits are added only after an operator verifies your payment screenshot.</li>
      <li>Take regular breaks and set your own limits before you play.</li>
      <li>If gambling affects your life, seek local support. This platform is 18+ only.</li>
      <li>Operators can block accounts at any time to enforce safe use.</li>
    </ol>
    <div class="pill-note">${icon('shield')}<div>ARADA BETTING never processes real deposits, real withdrawals or real-money bets.</div></div>
  </div>`;
}

function termsPage() {
  return `${pageHead('Terms & rules', 'Deposits, withdrawals and responsible play.')}
  <div class="card">
    <ol class="steps">
      <li>Accounts are accounts identified by a phone number and password.</li>
      <li>Credits are added only after an operator verifies your payment.</li>
      <li>Deposits (100 – 10,000 ETB) and withdrawals (500 – 50,000 ETB) are requests reviewed by the operator.</li>
      <li>Uploaded screenshots are stored as payment proof and are visible to the operator.</li>
      <li>Abuse, automation or attempts to break the platform may result in a blocked account.</li>
      <li>18+ only. Play responsibly and set your own limits.</li>
    </ol>
    <a class="btn btn-gold" href="#/games">${icon('games')} Back to the games</a>
  </div>`;
}

function notFoundPage() {
  return `<section class="section narrow"><div class="card auth-gate">
    <div class="guest-icon">${icon('alert')}</div>
    <h2>Page not found</h2>
    <p class="muted">That link does not exist. Try the golden floor instead.</p>
    <div class="btn-row"><a class="btn btn-gold" href="#/games">${icon('games')} Games</a><a class="btn btn-ghost" href="#/">${icon('home')} Home</a></div>
  </div></section>`;
}

function errorPage(err) {
  return `<section class="section narrow"><div class="card auth-gate">
    <div class="guest-icon">${icon('alert')}</div>
    <h2>Something went wrong</h2>
    <p class="muted">${escapeHtml(err.message || 'Please try again.')}</p>
    <div class="btn-row"><button class="btn btn-gold" onclick="location.reload()">${icon('refresh')} Reload</button><a class="btn btn-ghost" href="#/">${icon('home')} Home</a></div>
  </div></section>`;
}

/* ------------------------------------------------------------------ router */

function currentPath() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  return '/' + raw.split('?')[0].split('/').filter(Boolean).join('/');
}

async function resolvePage(path) {
  if (path === '/') return homePage();
  if (path === '/games') return gamesPage();
  if (path.startsWith('/games/')) return gamePage(path.split('/')[2]);
  if (path === '/deposit') return depositPage();
  if (path === '/withdraw') return withdrawPage();
  if (path === '/dashboard') return dashboardPage();
  if (path === '/admin') return adminPage();
  if (path === '/promotions') return promotionsPage();
  if (path === '/support') return supportPage();
  if (path === '/responsible') return responsiblePage();
  if (path === '/terms') return termsPage();
  return notFoundPage();
}

let renderToken = 0;

async function render() {
  const token = ++renderToken;
  runCleanups();
  const path = currentPath();
  let result;
  try {
    result = await resolvePage(path);
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      result = authGate('Please sign in', err.message || 'Your session expired. Sign in to continue.');
    } else {
      result = errorPage(err);
    }
  }
  if (token !== renderToken) return;

  const rootEl = view();
  if (!rootEl) return;
  const html = typeof result === 'string' ? result : result.html;
  rootEl.innerHTML = html;
  mountChrome();
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (result && typeof result === 'object' && typeof result.mount === 'function') {
    try {
      result.mount(rootEl);
    } catch (err) {
      toast(err.message || 'This page could not finish loading.', 'error');
    }
  }
  bindGuest(rootEl);
  startCountdowns(rootEl);

  if (path === '/games') {
    const grid = rootEl.querySelector('#game-grid');
    const empty = rootEl.querySelector('#game-empty');
    const search = rootEl.querySelector('#game-search');
    let category = 'All';
    const apply = () => {
      const term = (search?.value || '').trim().toLowerCase();
      let shown = 0;
      rootEl.querySelectorAll('[data-cat]').forEach((b) => {
        b.className = `btn ${b.dataset.cat === category ? 'btn-gold' : 'btn-ghost'} btn-sm`;
      });
      grid.querySelectorAll('.game-card').forEach((card) => {
        const slug = card.getAttribute('href').split('/').pop();
        const game = state.games.find((g) => g.slug === slug);
        if (!game) return;
        const matchesCat = category === 'All' || game.category === category;
        const matchesTerm = !term || `${game.name} ${game.short} ${game.category}`.toLowerCase().includes(term);
        const visible = matchesCat && matchesTerm;
        card.hidden = !visible;
        if (visible) shown += 1;
      });
      if (empty) empty.hidden = shown > 0;
    };
    rootEl.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        category = btn.dataset.cat;
        apply();
      });
    });
    search?.addEventListener('input', apply);
  }

  if (path === '/deposit') {
    const form = rootEl.querySelector('#deposit-form');
    const grid = rootEl.querySelector('#method-grid');
    const amountInput = rootEl.querySelector('#dep-amount');

    grid?.querySelectorAll('[data-method]').forEach((btn) => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('[data-method]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        form.method.value = btn.dataset.method;
      });
    });
    rootEl.querySelectorAll('[data-amount]').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (amountInput) amountInput.value = chip.dataset.amount;
      });
    });
    rootEl.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const value = btn.getAttribute('data-copy') || '';
        const label = btn.textContent;
        try {
          await navigator.clipboard.writeText(value);
          btn.textContent = 'Copied ✓';
        } catch {
          btn.textContent = 'Select & copy';
        }
        setTimeout(() => {
          btn.textContent = label;
        }, 1800);
      });
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const amount = Number(amountInput.value);
      const min = limit('depositMin', 100);
      const max = limit('depositMax', 10000);
      if (!Number.isFinite(amount) || amount < min || amount > max) {
        toast(`Deposits must be between ${money(min, 0)} and ${money(max, 0)}.`, 'error');
        return;
      }
      submit.disabled = true;
      try {
        const data = await api('/api/deposits', {
          method: 'POST',
          body: { amount, method: form.method.value },
        });
        focusDepositId = data.deposit.id;
        toast(data.message || 'Deposit request created.', 'success');
        await render();
      } catch (err) {
        toast(err.message, 'error');
        submit.disabled = false;
      }
    });

    const proof = rootEl.querySelector('#proof-input');
    proof?.addEventListener('change', async () => {
      const file = proof.files && proof.files[0];
      if (!file || !focusDepositId) return;
      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
        toast('Upload a PNG, JPG or WEBP image.', 'error');
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        toast('Screenshot is too large (maximum 6 MB).', 'error');
        return;
      }
      try {
        const image = await readFileAsDataUrl(file);
        const data = await api(`/api/deposits/${focusDepositId}/screenshot`, {
          method: 'POST',
          body: { image, fileName: file.name },
        });
        toast(data.message || 'Screenshot attached.', 'success');
        await render();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    rootEl.querySelectorAll('[data-cancel-deposit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/api/deposits/${btn.dataset.cancelDeposit}/cancel`, { method: 'POST' });
          toast('Deposit request cancelled.', 'info');
          if (focusDepositId === btn.dataset.cancelDeposit) focusDepositId = null;
          await render();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  if (path === '/withdraw') {
    const form = rootEl.querySelector('#withdraw-form');
    const grid = rootEl.querySelector('#method-grid');
    grid?.querySelectorAll('[data-method]').forEach((btn) => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('[data-method]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        form.method.value = btn.dataset.method;
      });
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const amount = Number(form.amount.value);
      const min = limit('withdrawMin', 500);
      const max = limit('withdrawMax', 50000);
      if (!Number.isFinite(amount) || amount < min || amount > max) {
        toast(`Withdrawals must be between ${money(min, 0)} and ${money(max, 0)}.`, 'error');
        return;
      }
      if (amount > Number(state.user.balance)) {
        toast('That amount exceeds your balance.', 'error');
        return;
      }
      submit.disabled = true;
      try {
        const data = await api('/api/withdrawals', {
          method: 'POST',
          body: {
            amount,
            method: form.method.value,
            accountName: form.accountName.value.trim(),
            accountNumber: form.accountNumber.value.trim(),
          },
        });
        toast(data.message || 'Demo withdrawal requested.', 'success');
        await render();
      } catch (err) {
        toast(err.message, 'error');
        submit.disabled = false;
      }
    });
  }
}

async function boot() {
  installGlobalHandlers();
  const refParam = new URLSearchParams(window.location.search).get('ref');
  if (refParam) {
    state.pendingReferral = refParam.trim().toUpperCase();
    toast(`Invite code ${state.pendingReferral} saved — it will be applied when you register.`, 'info');
  }
  document.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-invite-copy]');
    if (!copyBtn) return;
    const link = copyBtn.getAttribute('data-invite-copy') || '';
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied.', 'success');
    } catch (err) {
      toast('Copy failed — select the link and copy it manually.', 'error');
    }
  });
  setAuthListener(() => {
    render();
  });
  try {
    await bootstrap();
  } catch (err) {
    const rootEl = view();
    if (rootEl) rootEl.innerHTML = errorPage(err);
    return;
  }
  await render();
}

window.addEventListener('hashchange', () => render());
window.addEventListener('DOMContentLoaded', boot, { once: true });
if (document.readyState !== 'loading') boot();
