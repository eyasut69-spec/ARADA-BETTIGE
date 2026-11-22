'use strict';

import { state, api, money, escapeHtml, toast, copyText, setUser, refreshUser, loadUser } from './api.js';

/* ------------------------------------------------------------------ icons */

const ICONS = {
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.8V21h14V9.8"/>',
  games: '<rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8.5" cy="9.5" r="1.2"/><circle cx="15.5" cy="14.5" r="1.2"/><path d="M12 8v3M10.5 9.5h3M6.5 15.5h3"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
  banknote: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  shield: '<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.3-4 4-5.5 7.5-5.5S18.2 17 19.5 21"/>',
  logout: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0V4z"/><path d="M8 5H5v2a3 3 0 003 3M16 5h3v2a3 3 0 01-3 3"/><path d="M12 13v4M9 21h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  upload: '<path d="M12 16V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 5.5A2.5 2.5 0 0012.5 3H6a2 2 0 00-2 2v7.5A2.5 2.5 0 006.5 15"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 6.3"/><path d="M20 4v7h-7"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 005.5 5.5L16 12l4 1.5v3a2.5 2.5 0 01-2.7 2.5C10.7 18.5 5.5 13.3 4 6.7A2.5 2.5 0 016.5 3z"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  gift: '<rect x="3.5" y="8" width="17" height="12.5" rx="2"/><path d="M3.5 12.5h17M12 8v12.5"/><path d="M12 8S10.5 3.5 8 4.2 8 8 12 8zM12 8s1.5-4.5 4-3.8S16 8 12 8z"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M18.5 15.5l.9 2.3 2.1.7-2.1.8-.9 2.2-.9-2.2-2.1-.8 2.1-.7.9-2.3z"/>',
  chart: '<path d="M4 19h16"/><path d="M7 16V9M12 16V5M17 16v-4"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.5 9.5c-.6-.9-1.6-1.3-2.7-1.3-1.6 0-2.8.9-2.8 2.2 0 3.4 5.6 1.6 5.6 4.6 0 1.4-1.3 2.3-2.9 2.3-1.2 0-2.3-.5-2.9-1.4"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4M12 12L5.6 18.4M12 12h9"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/>',
  play: '<path d="M8 5.5l11 6.5-11 6.5v-13z"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c1-3.5 3.4-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 5.2a3.5 3.5 0 010 6.6M18 15.4c1.6.7 2.7 2.1 3.3 4.1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  alert: '<path d="M12 3l9.5 17H2.5L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  star: '<path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8L12 3z"/>',
  download: '<path d="M12 4v12M7.5 11.5L12 16l4.5-4.5"/><path d="M4 20h16"/>',
  trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4L11 13"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>',
};

export function icon(name, size) {
  const body = ICONS[name] || ICONS.info;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${dim} aria-hidden="true">${body}</svg>`;
}

/* ------------------------------------------------------------------- nav */

const NAV = [
  { href: '#/', label: 'Home', icon: 'home', match: ['/'] },
  { href: '#/games', label: 'Games', icon: 'games', match: ['/games'] },
  { href: '#/deposit', label: 'Deposit', icon: 'wallet', match: ['/deposit'] },
  { href: '#/withdraw', label: 'Withdraw', icon: 'banknote', match: ['/withdraw'] },
  { href: '#/dashboard', label: 'Dashboard', icon: 'grid', match: ['/dashboard'] },
  { href: '#/admin', label: 'Admin', icon: 'shield', match: ['/admin'], admin: true },
];

function currentPath() {
  const raw = (location.hash || '#/').replace(/^#/, '') || '/';
  return '/' + raw.split('?')[0].split('/').filter(Boolean).join('/');
}

function navHtml() {
  const path = currentPath();
  return NAV.filter((item) => !item.admin || state.user?.role === 'admin')
    .map((item) => {
      const active = item.match.some((m) => path === m || (m !== '/' && path.startsWith(m + '/')));
      return `<a class="nav-link${active ? ' active' : ''}" href="${item.href}">${icon(item.icon)}${item.label}</a>`;
    })
    .join('');
}

function headerHtml() {
  const user = state.user;
  const account = user
    ? `<a class="balance-chip" href="#/dashboard" title="Your virtual balance">
         <i class="dot"></i><strong data-balance>${money(user.balance)}</strong><span class="cur">virtual</span>
       </a>
       <a class="icon-btn" href="#/dashboard" title="Dashboard" aria-label="Dashboard">${icon('grid')}</a>
       <button class="icon-btn" data-logout title="Sign out" aria-label="Sign out">${icon('logout')}</button>`
    : `<button class="btn btn-ghost btn-sm" data-auth="login">Sign in</button>
       <button class="btn btn-gold btn-sm" data-auth="register">Join now</button>`;

  return `<div class="topbar-inner">
    <a class="brand" href="#/" aria-label="ARADA BETTING home">
      <span class="brand-mark">A</span>
      <span class="brand-text"><span class="brand-name">ARADA</span><span class="brand-sub">Betting</span></span>
    </a>
    <nav class="nav" aria-label="Main navigation">${navHtml()}</nav>
    <div class="top-actions">
      ${account}
      <button class="icon-btn hamburger" data-open-drawer aria-label="Open menu">${icon('menu')}</button>
    </div>
  </div>`;
}

function footerHtml() {
  const year = new Date().getFullYear();
  return `<div class="footer-inner">
    <div class="footer-brand">
      <a class="brand" href="#/">
        <span class="brand-mark">A</span>
        <span class="brand-text"><span class="brand-name">ARADA</span><span class="brand-sub">Betting</span></span>
      </a>
      <p>Ethiopia's premium betting floor. Fund with Telebirr or CBE, play every table, and cash out through the cashier — each deposit is checked by an operator before credits are added.</p>
      <span class="age-chip">${icon('shield')} 18+ · Play responsibly</span>
    </div>
    <div class="footer-col">
      <h4>Play</h4>
      <a href="#/games">All games</a>
      <a href="#/deposit">Deposit credits</a>
      <a href="#/withdraw">Withdraw credits</a>
      <a href="#/dashboard">My dashboard</a>
    </div>
    <div class="footer-col">
      <h4>Platform</h4>
      <a href="#/promotions">Promotions</a>
      <a href="#/support">Support &amp; FAQ</a>
      <a href="#/responsible">Responsible play</a>
      <a href="#/terms">Terms &amp; rules</a>
    </div>
    <div class="footer-col">
      <h4>Account</h4>
      <a href="#/dashboard" data-auth="login">Sign in</a>
      <a href="#/dashboard" data-auth="register">Create account</a>
      <a href="#/dashboard" data-auth="recover">Recover password</a>
      <a href="#/admin">Admin dashboard</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© ${year} ARADA BETTING. Deposits are verified by an operator before credits are added.</span>
    <span>Deposits verified manually · 18+ only · Play responsibly</span>
  </div>`;
}

function drawerHtml() {
  const user = state.user;
  const links = NAV.filter((item) => !item.admin || user?.role === 'admin')
    .map((item) => `<a href="${item.href}" data-drawer-close>${icon(item.icon)}${item.label}</a>`)
    .join('');
  const account = user
    ? `<div class="divider"></div>
       <div class="row-between small"><span class="muted">Balance</span><strong class="gold">${money(user.balance)}</strong></div>
       <div class="divider"></div>
       <button data-logout>${icon('logout')}Sign out</button>`
    : `<div class="divider"></div>
       <button data-auth="login">${icon('lock')}Sign in</button>
       <button data-auth="register">${icon('user')}Create account</button>
       <button data-auth="recover">${icon('refresh')}Recover password</button>`;

  return `<div class="drawer-backdrop" data-drawer-close></div>
    <aside class="drawer" aria-label="Mobile menu">
      <div class="drawer-head">
        <span class="brand-name">ARADA</span>
        <button class="icon-btn" data-drawer-close aria-label="Close menu">${icon('close')}</button>
      </div>
      <div class="drawer-nav">
        ${links}
        <div class="divider"></div>
        <a href="#/promotions" data-drawer-close>${icon('gift')}Promotions</a>
        <a href="#/support" data-drawer-close>${icon('info')}Support</a>
        ${account}
      </div>
    </aside>`;
}

export function mountChrome() {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) header.innerHTML = headerHtml();
  if (footer) footer.innerHTML = footerHtml();
}

export function updateBalance() {
  const node = document.querySelector('[data-balance]');
  if (node && state.user) node.textContent = money(state.user.balance);
}

export function openDrawer() {
  const root = document.getElementById('drawer-root');
  if (!root) return;
  root.innerHTML = drawerHtml();
  document.body.style.overflow = 'hidden';
}

export function closeDrawer() {
  const root = document.getElementById('drawer-root');
  if (root) root.innerHTML = '';
  document.body.style.overflow = '';
}

/* ----------------------------------------------------------------- modal */

let activeClose = null;

export function closeModal() {
  if (activeClose) activeClose();
  activeClose = null;
}

export function openModal(html, { wide = false, onMount } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  if (!root) return () => {};
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(wrap);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    wrap.remove();
    if (activeClose === close) activeClose = null;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
  activeClose = close;
  if (onMount) onMount(wrap.querySelector('.modal'), close);
  return close;
}

export function modalHead(title, subtitle) {
  return `<div class="modal-head"><div><h3>${title}</h3>${subtitle ? `<div class="modal-sub" style="margin:4px 0 0">${subtitle}</div>` : ''}</div>
    <button class="modal-close" data-close aria-label="Close">${icon('close')}</button></div>`;
}

/* ------------------------------------------------------------- auth modal */

let authListener = null;
export function setAuthListener(fn) {
  authListener = fn;
}

function demoHintsHtml() {
  const hints = state.config?.demoHints || [];
  if (!hints.length) return '';
  return `<div class="divider"></div>
    <div class="tiny muted" style="letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Quick access</div>
    <div class="chip-row">
      ${hints
        .map(
          (h) =>
            `<button class="chip" data-demo-fill="${escapeHtml(h.role)}" data-phone="${escapeHtml(h.phone)}" data-password="${escapeHtml(h.password)}">${icon('user')} ${escapeHtml(h.label)}</button>`,
        )
        .join('')}
    </div>
    <p class="tiny muted mt-8">Tap an account to fill the sign-in form instantly.</p>`;
}

function recoveryCodeHtml(code, message) {
  return `${modalHead('Save your recovery code', message)}
    <div class="pill-note">${icon('shield')}<div>This 16-character code is the only way to reset your password without a phone verification step. Store it safely — it will not be shown again.</div></div>
    <div class="recovery-code mt-16" id="recovery-code">${escapeHtml(code)}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-copy-code>${icon('copy')} Copy code</button>
      <button class="btn btn-gold" data-close>${icon('check')} I saved it</button>
    </div>`;
}

export function openAuthModal(mode = 'login', { message = '' } = {}) {
  const config = state.config || {};
  const welcome = config.limits?.welcomeBonus ?? 1000;
  const refBonus = config.limits?.referralBonus ?? 100;
  const pendingRef = String(state.pendingReferral || '').toUpperCase();
  const forms = {
    login: `
      <form id="auth-form" novalidate>
        ${message ? `<div class="pill-note mb-16">${icon('info')}<div>${escapeHtml(message)}</div></div>` : ''}
        <div class="field"><label for="login-phone">Phone number</label>
          <input class="input" id="login-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0912345678" required /></div>
        <div class="field"><label for="login-password">Password</label>
          <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Your password" required /></div>
        <div class="row-between mb-8">
          <label class="checkbox"><input type="checkbox" name="show" data-toggle-password /> <span>Show password</span></label>
          <button type="button" class="chip" data-auth-mode="recover">Forgot password?</button>
        </div>
        <div id="auth-error" class="pill-note danger hidden">${icon('alert')}<div></div></div>
        <button class="btn btn-gold btn-block mt-8" type="submit">${icon('lock')} Sign in</button>
        <p class="tiny muted center mt-12">No OTP is required. New here? <a href="#/" data-auth-mode="register" class="gold">Create your account</a>.</p>
      </form>
      ${demoHintsHtml()}`,
    register: `
      <form id="auth-form" novalidate>
        <div class="field"><label for="reg-name">Display name</label>
          <input class="input" id="reg-name" name="name" autocomplete="name" placeholder="e.g. Selam T." maxlength="60" /></div>
        <div class="field"><label for="reg-phone">Phone number</label>
          <input class="input" id="reg-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0912345678" required />
          <span class="hint">Ethiopian mobile format: 09xxxxxxxx or +2519xxxxxxxx.</span></div>
        <div class="field"><label for="reg-password">Password</label>
          <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required />
          <span class="hint">Use 8+ characters with at least one letter and one number.</span></div>
        <div class="field"><label for="reg-referral">Invite code (optional)</label>
          <input class="input" id="reg-referral" name="referral" autocomplete="off" maxlength="20" placeholder="ARADA1A2B" value="${escapeHtml(pendingRef)}" />
          <span class="hint">Enter a friend's invite code and you both receive ${money(refBonus, 0)}.</span></div>
        <label class="checkbox mb-8"><input type="checkbox" name="terms" required />
          <span>I am 18+ and accept the ARADA BETTING terms. Betting involves risk — play responsibly.</span></label>
        <div id="auth-error" class="pill-note danger hidden">${icon('alert')}<div></div></div>
        <button class="btn btn-gold btn-block mt-8" type="submit">${icon('gift')} Create account · ${money(welcome, 0)} free</button>
        <p class="tiny muted center mt-12">Already registered? <a href="#/" data-auth-mode="login" class="gold">Sign in</a></p>
      </form>`,
    recover: `
      <form id="auth-form" novalidate>
        <div class="pill-note mb-16">${icon('info')}<div>Password recovery uses the 16-character recovery code shown when you registered. No SMS or OTP needed.</div></div>
        <div class="field"><label for="rec-phone">Phone number</label>
          <input class="input" id="rec-phone" name="phone" type="tel" inputmode="tel" placeholder="0912345678" required /></div>
        <div class="field"><label for="rec-code">Recovery code</label>
          <input class="input" id="rec-code" name="recoveryCode" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" required /></div>
        <div class="field"><label for="rec-password">New password</label>
          <input class="input" id="rec-password" name="newPassword" type="password" autocomplete="new-password" placeholder="At least 8 characters" required /></div>
        <div id="auth-error" class="pill-note danger hidden">${icon('alert')}<div></div></div>
        <button class="btn btn-gold btn-block mt-8" type="submit">${icon('refresh')} Reset password</button>
        <p class="tiny muted center mt-12"><a href="#/" data-auth-mode="login" class="gold">Back to sign in</a></p>
      </form>`,
  };

  const titles = {
    login: ['Welcome back', 'Sign in with your phone number and password.'],
    register: ['Join ARADA BETTING', 'Register with a phone number and password — no OTP needed.'],
    recover: ['Recover your password', 'Reset access with the recovery code from sign-up.'],
  };
  const [title, sub] = titles[mode] || titles.login;

  openModal(`${modalHead(title, sub)}
    <div class="seg mb-16" role="tablist">
      <button type="button" role="tab" data-auth-mode="login" class="${mode === 'login' ? 'active' : ''}">Sign in</button>
      <button type="button" role="tab" data-auth-mode="register" class="${mode === 'register' ? 'active' : ''}">Register</button>
      <button type="button" role="tab" data-auth-mode="recover" class="${mode === 'recover' ? 'active' : ''}">Recover</button>
    </div>
    ${forms[mode] || forms.login}`, {
    onMount(modal, close) {
      modal.querySelectorAll('[data-auth-mode]').forEach((btn) => {
        btn.addEventListener('click', () => openAuthModal(btn.dataset.authMode));
      });
      modal.querySelectorAll('[data-demo-fill]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const phone = modal.querySelector('input[name="phone"]');
          const password = modal.querySelector('input[name="password"]');
          if (phone) phone.value = btn.dataset.phone;
          if (password) password.value = btn.dataset.password;
          toast(`Filled ${btn.dataset.phone}. Press Sign in to continue.`, 'info');
        });
      });
      const show = modal.querySelector('[data-toggle-password]');
      if (show) {
        show.addEventListener('change', () => {
          const input = modal.querySelector('input[name="password"]');
          if (input) input.type = show.checked ? 'text' : 'password';
        });
      }
      const form = modal.querySelector('#auth-form');
      const errorBox = modal.querySelector('#auth-error');
      const showError = (msg) => {
        if (!errorBox) return;
        errorBox.classList.remove('hidden');
        errorBox.querySelector('div').textContent = msg;
      };
      if (!form) return;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        const label = submit.innerHTML;
        submit.disabled = true;
        submit.innerHTML = '<span class="loader"></span> Please wait…';
        if (errorBox) errorBox.classList.add('hidden');
        try {
          if (mode === 'login') {
            const data = await api('/api/auth/login', {
              method: 'POST',
              body: {
                phone: form.phone.value.trim(),
                password: form.password.value,
              },
            });
            setUser(data.user);
            close();
            toast(data.message || 'Signed in.', 'success');
            if (authListener) authListener();
          } else if (mode === 'register') {
            const data = await api('/api/auth/register', {
              method: 'POST',
              body: {
                name: form.name.value.trim(),
                phone: form.phone.value.trim(),
                password: form.password.value,
                acceptedTerms: form.terms.checked,
                referral: form.referral ? form.referral.value.trim() : '',
              },
            });
            setUser(data.user);
            toast(data.message || 'Account created.', 'success');
            if (authListener) authListener({ silent: true });
            openModal(recoveryCodeHtml(data.recoveryCode, 'Your account is ready. One last step:'), {
              onMount(m, closeM) {
                m.querySelector('[data-copy-code]')?.addEventListener('click', async () => {
                  const ok = await copyText(data.recoveryCode);
                  toast(ok ? 'Recovery code copied.' : 'Copy failed — select the code manually.', ok ? 'success' : 'error');
                });
              },
            });
          } else {
            const data = await api('/api/auth/recover', {
              method: 'POST',
              body: {
                phone: form.phone.value.trim(),
                recoveryCode: form.recoveryCode.value.trim(),
                newPassword: form.newPassword.value,
              },
            });
            openModal(recoveryCodeHtml(data.recoveryCode, data.message), {
              onMount(m) {
                m.querySelector('[data-copy-code]')?.addEventListener('click', async () => {
                  const ok = await copyText(data.recoveryCode);
                  toast(ok ? 'Recovery code copied.' : 'Copy failed — select the code manually.', ok ? 'success' : 'error');
                });
              },
            });
          }
        } catch (err) {
          showError(err.message || 'Something went wrong.');
          submit.disabled = false;
          submit.innerHTML = label;
        }
      });
    },
  });
}

export async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (_) {
    /* sign out locally regardless */
  }
  setUser(null);
  closeDrawer();
  toast('Signed out.', 'info');
  if (authListener) authListener();
  if (location.hash !== '#/') location.hash = '#/';
}

/* --------------------------------------------------------------- helpers */

export function statusBadge(status) {
  const map = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' };
  return `<span class="status ${map[status] || 'status-neutral'}">${escapeHtml(status || 'unknown')}</span>`;
}

export function installGlobalHandlers() {
  document.addEventListener('click', (e) => {
    const authBtn = e.target.closest('[data-auth]');
    if (authBtn) {
      e.preventDefault();
      openAuthModal(authBtn.dataset.auth || 'login');
      return;
    }
    if (e.target.closest('[data-logout]')) {
      e.preventDefault();
      logout();
      return;
    }
    if (e.target.closest('[data-open-drawer]')) {
      e.preventDefault();
      openDrawer();
      return;
    }
    if (e.target.closest('[data-drawer-close]')) {
      closeDrawer();
      return;
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

export function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}"><div class="empty">${escapeHtml(message)}</div></td></tr>`;
}

export function tabButton(id, label, iconName, active) {
  return `<button class="tab${active ? ' active' : ''}" data-tab="${id}">${icon(iconName)}${label}</button>`;
}

export { refreshUser, loadUser, money, escapeHtml };
