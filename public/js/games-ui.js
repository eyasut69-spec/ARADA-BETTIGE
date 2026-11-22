'use strict';

import { state, api, money, amount, toast, escapeHtml, onCleanup, refreshUser, setUser } from './api.js';
import { icon, updateBalance, statusBadge } from './ui.js';
import { gameLogo } from './logos.js';

/* ------------------------------------------------------------------ shared */

const QUICK_STAKES = [100, 250, 500, 1000, 2500];

function stakeField(game, { label = 'Stake' } = {}) {
  const min = Math.max(10, Number(game.minBet) || 10);
  const max = Math.min(10000, Number(game.maxBet) || 5000);
  const chips = QUICK_STAKES.filter((v) => v >= min && v <= max)
    .map((v) => `<button type="button" class="chip" data-stake="${v}">${amount(v, 0)}</button>`)
    .join('');
  return `<div class="field">
    <label for="stake">${label}</label>
    <div class="input-affix">
      <input class="input" id="stake" name="stake" type="number" inputmode="decimal" min="${min}" max="${max}" step="10" value="${Math.min(max, Math.max(min, 100))}" />
      <span class="affix">ETB</span>
    </div>
    <div class="chip-row mt-8">${chips}<button type="button" class="chip" data-stake="max">Max</button></div>
    <span class="hint">${money(min, 0)} – ${money(max, 0)} per round · virtual credits</span>
  </div>`;
}

function bindStake(root, game) {
  const input = root.querySelector('#stake');
  const min = Math.max(10, Number(game.minBet) || 10);
  const max = Math.min(10000, Number(game.maxBet) || 5000);
  root.querySelectorAll('[data-stake]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.stake === 'max' ? max : Number(btn.dataset.stake);
      input.value = String(Math.min(max, Math.max(min, v)));
      root.querySelectorAll('[data-stake]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  return {
    min,
    max,
    value() {
      const v = Number(input.value);
      if (!Number.isFinite(v) || v < min || v > max) {
        toast(`Stake must be between ${money(min, 0)} and ${money(max, 0)}.`, 'error');
        return null;
      }
      return Math.round(v * 100) / 100;
    },
  };
}

function resultPanel(kind, title, detail) {
  return `<div class="result result-${kind}">
    <div class="result-icon">${icon(kind === 'win' ? 'trophy' : kind === 'loss' ? 'x' : 'sparkles')}</div>
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>
  </div>`;
}

function historyList(items, emptyText) {
  if (!items.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  return `<ul class="history">${items
    .map(
      (h) => `<li>
        <span class="h-dot ${h.win ? 'win' : 'loss'}"></span>
        <span class="h-main">${escapeHtml(h.label)}</span>
        <span class="h-meta">${escapeHtml(h.meta || '')}</span>
        <span class="h-amt ${h.win ? 'gold' : 'muted'}">${h.win ? '+' : ''}${money(h.payout)}</span>
      </li>`,
    )
    .join('')}</ul>`;
}

function gameHead(game) {
  return `<div class="page-head">
    <a class="back-link" href="#/games">${icon('arrowLeft')} All games</a>
    <div class="row-between wrap gap-16">
      <div class="game-head-main">
        ${gameLogo(game.slug, 'game-head-logo')}
        <div>
        <div class="chip-row mb-8">
          <span class="badge badge-gold">${escapeHtml(game.badge || game.category)}</span>
          <span class="badge">${escapeHtml(game.category)}</span>
          ${game.enabled ? '<span class="badge badge-live">LIVE</span>' : '<span class="badge badge-off">PAUSED</span>'}
        </div>
        <h1>${escapeHtml(game.name)}</h1>
        <p class="muted">${escapeHtml(game.short)}</p>
        </div>
      </div>
      <div class="game-facts">
        <div><span>RTP</span><strong>${(Number(game.rtp) * 100).toFixed(0)}%</strong></div>
        <div><span>Limits</span><strong>${amount(game.minBet, 0)} – ${amount(game.maxBet, 0)} ETB</strong></div>
        <div><span>Rounds</span><strong>${Number(game.plays) || 0}</strong></div>
      </div>
    </div>
  </div>`;
}

function howTo(game) {
  return `<section class="card how-card">
    <div class="card-head"><h3>${icon('info')} How ${escapeHtml(game.name)} works</h3></div>
    <ol class="steps">${(game.howTo || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    <div class="pill-note mt-16">${icon('shield')}<div>Every round is settled on the server with cryptographically secure randomness and recorded in your wallet, game history and transactions.</div></div>
  </section>`;
}

function guestLock(game) {
  return `<section class="card game-stage">
    <div class="guest-lock">
      <div class="guest-icon">${icon('sparkles')}</div>
      <h2>Play ${escapeHtml(game.name)} instantly</h2>
      <p class="muted">No sign-up form needed to try a round. Start with a guest wallet of ${money(state.config?.limits?.welcomeBonus ?? 1000, 0)} in credits.</p>
      <button class="btn btn-gold" data-play-guest>${icon('play')} Play instantly</button>
      <div class="divider"></div>
      <p class="tiny muted">Want to keep your balance and history? <button class="link-btn gold" data-auth="register">Create a free account</button> or <button class="link-btn gold" data-auth="login">sign in</button>.</p>
    </div>
  </section>`;
}

function bindGuest(root) {
  const btn = root.querySelector('[data-play-guest]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Preparing your wallet…';
    try {
      const data = await api('/api/auth/guest', { method: 'POST' });
      setUser(data.user);
      toast(`Guest wallet ready with ${money(data.user.balance, 0)}.`, 'success');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('play')} Play instantly`;
    }
  });
}

/* --------------------------------------------------------------- crash game */

function crashView(game) {
  return `<div class="game-layout">
    <section class="card game-stage crash-stage">
      <div class="stage-glow"></div>
      <div class="multiplier" id="crash-mult">1.00x</div>
      <div class="crash-bar"><span id="crash-fill"></span></div>
      <div class="stage-status" id="crash-status">Set your stake and start a round.</div>
      <div class="crash-actions">
        <button class="btn btn-gold btn-lg" id="crash-start">${icon('play')} Start round</button>
        <button class="btn btn-success btn-lg hidden" id="crash-cash">${icon('coin')} Cash out</button>
      </div>
      <div id="crash-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('sliders')} Place your round</h3></div>
      ${stakeField(game)}
      <div class="field">
        <label for="auto">Auto cash-out (optional)</label>
        <div class="input-affix">
          <input class="input" id="auto" type="number" inputmode="decimal" min="1.01" max="100" step="0.1" placeholder="e.g. 1.80" />
          <span class="affix">x</span>
        </div>
        <span class="hint">The server banks your win automatically at this multiplier.</span>
      </div>
      <div class="balance-line"><span>Virtual balance</span><strong class="gold">${money(state.user?.balance || 0)}</strong></div>
      <div class="divider"></div>
      <div class="card-head"><h3>${icon('clock')} This session</h3></div>
      <div id="crash-history">${historyList([], 'No rounds played yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountCrash(root, game) {
  const stake = bindStake(root, game);
  const multEl = root.querySelector('#crash-mult');
  const fillEl = root.querySelector('#crash-fill');
  const statusEl = root.querySelector('#crash-status');
  const startBtn = root.querySelector('#crash-start');
  const cashBtn = root.querySelector('#crash-cash');
  const autoEl = root.querySelector('#auto');
  const resultEl = root.querySelector('#crash-result');
  const historyEl = root.querySelector('#crash-history');
  const history = [];
  let roundId = null;
  let timer = null;

  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  onCleanup(stop);

  function paintHistory() {
    historyEl.innerHTML = historyList(history.slice(0, 8), 'No rounds played yet.');
  }

  function setMultiplier(value, live) {
    const v = Number(value) || 1;
    multEl.textContent = `${v.toFixed(2)}x`;
    multEl.classList.toggle('live', Boolean(live));
    fillEl.style.width = `${Math.min(100, Math.max(4, (v / 12) * 100))}%`;
  }

  function finish(round) {
    stop();
    roundId = null;
    startBtn.classList.remove('hidden');
    startBtn.disabled = false;
    cashBtn.classList.add('hidden');
    setMultiplier(round.status === 'busted' ? Number(round.crashPoint) || 1 : round.multiplier, false);
    const win = round.status === 'cashed';
    if (win) {
      statusEl.textContent = `Cashed out at ${Number(round.multiplier).toFixed(2)}x`;
      resultEl.innerHTML = resultPanel('win', `You banked ${money(round.payout)}`, `Stake ${money(round.stake)} at ${Number(round.multiplier).toFixed(2)}x · virtual credits`);
      history.unshift({ win: true, label: `Cashed at ${Number(round.multiplier).toFixed(2)}x`, meta: money(round.stake), payout: round.payout });
    } else {
      statusEl.textContent = `Crashed at ${Number(round.crashPoint || 1).toFixed(2)}x`;
      resultEl.innerHTML = resultPanel('loss', 'The curve crashed', `Stake ${money(round.stake)} was lost this round. Try a lower auto cash-out.`);
      history.unshift({ win: false, label: `Crashed at ${Number(round.crashPoint || 1).toFixed(2)}x`, meta: money(round.stake), payout: 0 });
    }
    if (Number.isFinite(Number(round.balance))) {
      state.user.balance = round.balance;
      updateBalance();
    }
    paintHistory();
  }

  async function poll() {
    if (!roundId) return;
    try {
      const { round } = await api(`/api/games/crash/${roundId}`);
      if (round.status === 'running') {
        setMultiplier(round.multiplier, true);
        statusEl.textContent = `Live round · ${money(round.stake)} staked`;
        if (Number.isFinite(Number(round.balance))) {
          state.user.balance = round.balance;
          updateBalance();
        }
        timer = setTimeout(poll, 220);
      } else {
        finish(round);
      }
    } catch (err) {
      stop();
      roundId = null;
      startBtn.classList.remove('hidden');
      startBtn.disabled = false;
      cashBtn.classList.add('hidden');
      toast(err.message, 'error');
    }
  }

  startBtn.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    const auto = autoEl.value.trim();
    if (auto && (Number(auto) < 1.01 || Number(auto) > 100)) {
      toast('Auto cash-out must be between 1.01x and 100x.', 'error');
      return;
    }
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="loader"></span> Starting…';
    try {
      const data = await api('/api/games/crash/start', {
        method: 'POST',
        body: { stake: value, autoCashout: auto ? Number(auto) : undefined },
      });
      roundId = data.round.id;
      if (Number.isFinite(Number(data.balance))) {
        state.user.balance = data.balance;
        updateBalance();
      }
      resultEl.innerHTML = '';
      setMultiplier(1, true);
      statusEl.textContent = 'Round live — cash out before the crash!';
      startBtn.classList.add('hidden');
      startBtn.disabled = false;
      startBtn.innerHTML = `${icon('play')} Start round`;
      cashBtn.classList.remove('hidden');
      cashBtn.disabled = false;
      timer = setTimeout(poll, 200);
    } catch (err) {
      toast(err.message, 'error');
      startBtn.disabled = false;
      startBtn.innerHTML = `${icon('play')} Start round`;
    }
  });

  cashBtn.addEventListener('click', async () => {
    if (!roundId) return;
    cashBtn.disabled = true;
    try {
      const { round } = await api(`/api/games/crash/${roundId}/cashout`, { method: 'POST' });
      finish(round);
    } catch (err) {
      toast(err.message, 'error');
      cashBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------------- dice duel */

function diceView(game) {
  return `<div class="game-layout">
    <section class="card game-stage">
      <div class="dice-display">
        <div class="dice-value" id="dice-roll">00.00</div>
        <div class="dice-track"><span class="dice-line" id="dice-line"></span><span class="dice-marker" id="dice-marker"></span></div>
        <div class="row-between tiny muted"><span>0.00</span><span>Under / Over line</span><span>99.99</span></div>
      </div>
      <div class="stage-status" id="dice-status">Choose your line and roll.</div>
      <div id="dice-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('sliders')} Your roll</h3></div>
      <div class="field">
        <label>Direction</label>
        <div class="seg" id="dice-dir">
          <button type="button" class="active" data-dir="under">Roll under</button>
          <button type="button" data-dir="over">Roll over</button>
        </div>
      </div>
      <div class="field">
        <label for="dice-target">Lucky line · <strong class="gold" id="dice-target-label">50</strong></label>
        <input type="range" id="dice-target" min="2" max="98" step="1" value="50" class="range" />
        <div class="row-between tiny muted"><span>2</span><span>50</span><span>98</span></div>
      </div>
      ${stakeField(game)}
      <div class="pill-note">${icon('chart')}<div id="dice-preview">Win chance 50.00% · pays 1.94x</div></div>
      <button class="btn btn-gold btn-block" id="dice-roll-btn">${icon('dice')} Roll dice</button>
      <div class="divider"></div>
      <div id="dice-history">${historyList([], 'No rolls yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountDice(root, game) {
  const stake = bindStake(root, game);
  const dirEl = root.querySelector('#dice-dir');
  const target = root.querySelector('#dice-target');
  const targetLabel = root.querySelector('#dice-target-label');
  const preview = root.querySelector('#dice-preview');
  const rollEl = root.querySelector('#dice-roll');
  const lineEl = root.querySelector('#dice-line');
  const markerEl = root.querySelector('#dice-marker');
  const statusEl = root.querySelector('#dice-status');
  const resultEl = root.querySelector('#dice-result');
  const historyEl = root.querySelector('#dice-history');
  const btn = root.querySelector('#dice-roll-btn');
  const history = [];
  let direction = 'under';

  const rtp = Number(game.rtp) || 0.97;

  function refresh() {
    const line = Number(target.value);
    const chance = direction === 'under' ? line : 100 - line;
    const multiplier = (100 / chance) * rtp;
    targetLabel.textContent = String(line);
    lineEl.style.left = `${line}%`;
    preview.textContent = `Win chance ${chance.toFixed(2)}% · pays ${multiplier.toFixed(2)}x · house edge ${(100 - rtp * 100).toFixed(1)}%`;
    return { line, chance, multiplier };
  }

  dirEl.querySelectorAll('[data-dir]').forEach((b) => {
    b.addEventListener('click', () => {
      direction = b.dataset.dir;
      dirEl.querySelectorAll('[data-dir]').forEach((x) => x.classList.toggle('active', x === b));
      refresh();
    });
  });
  target.addEventListener('input', refresh);
  refresh();

  btn.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    const { line } = refresh();
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Rolling…';
    resultEl.innerHTML = '';
    statusEl.textContent = 'Rolling…';
    const spin = setInterval(() => {
      const fake = Math.random() * 100;
      rollEl.textContent = fake.toFixed(2);
      markerEl.style.left = `${fake}%`;
    }, 60);
    try {
      const data = await api('/api/games/dice-duel/play', {
        method: 'POST',
        body: { stake: value, target: line, direction },
      });
      clearInterval(spin);
      rollEl.textContent = Number(data.roll).toFixed(2);
      markerEl.style.left = `${Math.min(100, Number(data.roll))}%`;
      markerEl.classList.toggle('win', data.win);
      state.user.balance = data.balance;
      updateBalance();
      statusEl.textContent = `Rolled ${Number(data.roll).toFixed(2)} — ${direction} ${line} (${data.chance}% chance)`;
      resultEl.innerHTML = data.win
        ? resultPanel('win', `You won ${money(data.payout)}`, `${direction === 'under' ? 'Under' : 'Over'} ${line} · ${Number(data.multiplier).toFixed(2)}x payout`)
        : resultPanel('loss', 'No win this roll', `Rolled ${Number(data.roll).toFixed(2)} · ${direction} ${line} needed. Stake ${money(value)} lost.`);
      history.unshift({
        win: data.win,
        label: `${direction === 'under' ? 'Under' : 'Over'} ${line}`,
        meta: `rolled ${Number(data.roll).toFixed(2)}`,
        payout: data.payout,
      });
      historyEl.innerHTML = historyList(history.slice(0, 8), 'No rolls yet.');
    } catch (err) {
      clearInterval(spin);
      toast(err.message, 'error');
      statusEl.textContent = 'Choose your line and roll.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('dice')} Roll dice`;
    }
  });
}

/* --------------------------------------------------------------- royal coin */

function coinView(game) {
  return `<div class="game-layout">
    <section class="card game-stage">
      <div class="coin-wrap"><div class="coin" id="coin"><span class="coin-face">A</span><span class="coin-back">ARADA</span></div></div>
      <div class="stage-status" id="coin-status">Call heads or tails.</div>
      <div id="coin-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('sliders')} Your call</h3></div>
      <div class="field">
        <label>Side</label>
        <div class="seg" id="coin-side">
          <button type="button" class="active" data-side="heads">${icon('star')} Heads</button>
          <button type="button" data-side="tails">${icon('coin')} Tails</button>
        </div>
      </div>
      ${stakeField(game)}
      <div class="pill-note">${icon('chart')}<div>A correct call pays <strong class="gold">${(Number(game.rtp) * 2).toFixed(2)}x</strong> instantly.</div></div>
      <button class="btn btn-gold btn-block" id="coin-flip">${icon('coin')} Flip coin</button>
      <div class="divider"></div>
      <div id="coin-history">${historyList([], 'No flips yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountCoin(root, game) {
  const stake = bindStake(root, game);
  const sideEl = root.querySelector('#coin-side');
  const coin = root.querySelector('#coin');
  const statusEl = root.querySelector('#coin-status');
  const resultEl = root.querySelector('#coin-result');
  const historyEl = root.querySelector('#coin-history');
  const btn = root.querySelector('#coin-flip');
  const history = [];
  let side = 'heads';

  sideEl.querySelectorAll('[data-side]').forEach((b) => {
    b.addEventListener('click', () => {
      side = b.dataset.side;
      sideEl.querySelectorAll('[data-side]').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  btn.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Flipping…';
    resultEl.innerHTML = '';
    statusEl.textContent = 'The coin is in the air…';
    coin.classList.remove('flip-heads', 'flip-tails');
    void coin.offsetWidth;
    coin.classList.add(side === 'heads' ? 'flip-heads' : 'flip-tails');
    try {
      const data = await api('/api/games/royal-coin/play', { method: 'POST', body: { stake: value, choice: side } });
      state.user.balance = data.balance;
      updateBalance();
      statusEl.textContent = `The coin landed on ${data.result}.`;
      resultEl.innerHTML = data.win
        ? resultPanel('win', `You won ${money(data.payout)}`, `${data.result} paid ${Number(data.multiplier).toFixed(2)}x`)
        : resultPanel('loss', 'Wrong call', `${data.result} landed. Stake ${money(value)} lost this round.`);
      history.unshift({ win: data.win, label: data.result, meta: side, payout: data.payout });
      historyEl.innerHTML = historyList(history.slice(0, 8), 'No flips yet.');
    } catch (err) {
      toast(err.message, 'error');
      statusEl.textContent = 'Call heads or tails.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('coin')} Flip coin`;
    }
  });
}

/* -------------------------------------------------------------- golden wheel */

function wheelView(game) {
  return `<div class="game-layout">
    <section class="card game-stage">
      <div class="wheel-wrap">
        <div class="wheel-pointer"></div>
        <div class="wheel" id="wheel"><div class="wheel-hub" id="wheel-number">0</div></div>
      </div>
      <div class="stage-status" id="wheel-status">Pick a colour and spin.</div>
      <div id="wheel-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('sliders')} Your bet</h3></div>
      <div class="field">
        <label>Colour</label>
        <div class="color-grid" id="wheel-color">
          <button type="button" class="color-btn red active" data-color="red"><span></span>Red · 2x</button>
          <button type="button" class="color-btn black" data-color="black"><span></span>Black · 2x</button>
          <button type="button" class="color-btn green" data-color="green"><span></span>Zero · 14x</button>
        </div>
      </div>
      ${stakeField(game)}
      <div class="pill-note">${icon('info')}<div>37 pockets (0–36). Zero is the golden pocket and pays 14x.</div></div>
      <button class="btn btn-gold btn-block" id="wheel-spin">${icon('wheel')} Spin wheel</button>
      <div class="divider"></div>
      <div id="wheel-history">${historyList([], 'No spins yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountWheel(root, game) {
  const stake = bindStake(root, game);
  const colorEl = root.querySelector('#wheel-color');
  const wheel = root.querySelector('#wheel');
  const numberEl = root.querySelector('#wheel-number');
  const statusEl = root.querySelector('#wheel-status');
  const resultEl = root.querySelector('#wheel-result');
  const historyEl = root.querySelector('#wheel-history');
  const btn = root.querySelector('#wheel-spin');
  const history = [];
  let color = 'red';
  let rotation = 0;

  colorEl.querySelectorAll('[data-color]').forEach((b) => {
    b.addEventListener('click', () => {
      color = b.dataset.color;
      colorEl.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  btn.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Spinning…';
    resultEl.innerHTML = '';
    statusEl.textContent = 'The golden wheel is spinning…';
    rotation += 720 + Math.floor(Math.random() * 360);
    wheel.style.transform = `rotate(${rotation}deg)`;
    try {
      const data = await api('/api/games/golden-wheel/play', { method: 'POST', body: { stake: value, color } });
      state.user.balance = data.balance;
      updateBalance();
      numberEl.textContent = String(data.number);
      numberEl.className = `wheel-hub ${data.color}`;
      statusEl.textContent = `Landed on ${data.number} · ${data.color}`;
      resultEl.innerHTML = data.win
        ? resultPanel('win', `You won ${money(data.payout)}`, `${data.color} paid ${Number(data.multiplier).toFixed(2)}x`)
        : resultPanel('loss', 'No win this spin', `${data.number} ${data.color} landed. Stake ${money(value)} lost.`);
      history.unshift({ win: data.win, label: `${data.number} ${data.color}`, meta: color, payout: data.payout });
      historyEl.innerHTML = historyList(history.slice(0, 8), 'No spins yet.');
    } catch (err) {
      toast(err.message, 'error');
      statusEl.textContent = 'Pick a colour and spin.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('wheel')} Spin wheel`;
    }
  });
}

/* --------------------------------------------------------------- lucky nine */

function luckyView(game) {
  return `<div class="game-layout">
    <section class="card game-stage">
      <div class="lucky-display">
        <div class="lucky-digit" id="lucky-drawn">–</div>
        <div class="lucky-caption">Lucky digit</div>
      </div>
      <div class="stage-status" id="lucky-status">Pick a digit from 0 to 9.</div>
      <div id="lucky-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('sliders')} Your digit</h3></div>
      <div class="field">
        <label>Choose your number</label>
        <div class="digit-grid" id="lucky-digits">
          ${Array.from({ length: 10 }, (_, i) => `<button type="button" class="digit-btn${i === 7 ? ' active' : ''}" data-digit="${i}">${i}</button>`).join('')}
        </div>
      </div>
      ${stakeField(game)}
      <div class="pill-note">${icon('chart')}<div>A perfect match pays <strong class="gold">${(Number(game.rtp) * 10).toFixed(1)}x</strong> your stake.</div></div>
      <button class="btn btn-gold btn-block" id="lucky-draw">${icon('sparkles')} Draw lucky digit</button>
      <div class="divider"></div>
      <div id="lucky-history">${historyList([], 'No draws yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountLucky(root, game) {
  const stake = bindStake(root, game);
  const digitsEl = root.querySelector('#lucky-digits');
  const drawnEl = root.querySelector('#lucky-drawn');
  const statusEl = root.querySelector('#lucky-status');
  const resultEl = root.querySelector('#lucky-result');
  const historyEl = root.querySelector('#lucky-history');
  const btn = root.querySelector('#lucky-draw');
  const history = [];
  let digit = 7;

  digitsEl.querySelectorAll('[data-digit]').forEach((b) => {
    b.addEventListener('click', () => {
      digit = Number(b.dataset.digit);
      digitsEl.querySelectorAll('[data-digit]').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  btn.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Drawing…';
    resultEl.innerHTML = '';
    statusEl.textContent = 'Drawing the lucky digit…';
    const spin = setInterval(() => {
      drawnEl.textContent = String(Math.floor(Math.random() * 10));
    }, 70);
    try {
      const data = await api('/api/games/lucky-nine/play', { method: 'POST', body: { stake: value, number: digit } });
      clearInterval(spin);
      drawnEl.textContent = String(data.drawn);
      drawnEl.classList.toggle('win', data.win);
      state.user.balance = data.balance;
      updateBalance();
      statusEl.textContent = `Drew ${data.drawn} · you picked ${digit}`;
      resultEl.innerHTML = data.win
        ? resultPanel('win', `You won ${money(data.payout)}`, `Digit ${data.drawn} matched at ${Number(data.multiplier).toFixed(1)}x`)
        : resultPanel('loss', 'No match', `Drew ${data.drawn}. Stake ${money(value)} lost this round.`);
      history.unshift({ win: data.win, label: `Picked ${digit}`, meta: `drew ${data.drawn}`, payout: data.payout });
      historyEl.innerHTML = historyList(history.slice(0, 8), 'No draws yet.');
    } catch (err) {
      clearInterval(spin);
      toast(err.message, 'error');
      statusEl.textContent = 'Pick a digit from 0 to 9.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('sparkles')} Draw lucky digit`;
    }
  });
}

/* ------------------------------------------------------- card table helpers */

const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

function cardHtml(card) {
  if (!card) return '<div class="playing-card back" aria-hidden="true"></div>';
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  return `<div class="playing-card${red ? ' red' : ''}">
    <span class="pc-rank">${escapeHtml(card.rank)}</span>
    <span class="pc-suit">${SUIT_GLYPH[card.suit] || '♠'}</span>
  </div>`;
}

/* ----------------------------------------------------------------- baccarat */

function baccaratView(game) {
  return `<div class="game-layout">
    <section class="card game-stage">
      <div class="table-felt">
        <div class="table-side">
          <div class="table-side-head"><span>Banker</span><strong id="bac-banker-total">–</strong></div>
          <div class="card-row" id="bac-banker-cards">${cardHtml(null)}${cardHtml(null)}</div>
        </div>
        <div class="table-vs">VS</div>
        <div class="table-side">
          <div class="table-side-head"><span>Player</span><strong id="bac-player-total">–</strong></div>
          <div class="card-row" id="bac-player-cards">${cardHtml(null)}${cardHtml(null)}</div>
        </div>
      </div>
      <div class="stage-status" id="bac-status">Choose Player, Banker or Tie, then deal.</div>
      <div id="bac-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('games')} Place your bet</h3></div>
      <div class="field">
        <label>Side</label>
        <div class="seg" id="bac-bet">
          <button type="button" class="active" data-bac-bet="player">Player · 2x</button>
          <button type="button" data-bac-bet="banker">Banker · 1.95x</button>
          <button type="button" data-bac-bet="tie">Tie · 9x</button>
        </div>
      </div>
      ${stakeField(game)}
      <button class="btn btn-gold btn-block" id="bac-deal">${icon('play')} Deal cards</button>
      <div class="divider"></div>
      <div id="bac-history">${historyList([], 'No hands yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountBaccarat(root, game) {
  const stake = bindStake(root, game);
  const betBox = root.querySelector('#bac-bet');
  const statusEl = root.querySelector('#bac-status');
  const resultEl = root.querySelector('#bac-result');
  const playerCards = root.querySelector('#bac-player-cards');
  const bankerCards = root.querySelector('#bac-banker-cards');
  const playerTotal = root.querySelector('#bac-player-total');
  const bankerTotal = root.querySelector('#bac-banker-total');
  const historyEl = root.querySelector('#bac-history');
  const btn = root.querySelector('#bac-deal');
  const history = [];
  let bet = 'player';

  betBox.querySelectorAll('[data-bac-bet]').forEach((b) => {
    b.addEventListener('click', () => {
      bet = b.dataset.bacBet;
      betBox.querySelectorAll('[data-bac-bet]').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  btn.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="loader"></span> Dealing…';
    try {
      const r = await api('/api/games/vip-baccarat/play', { method: 'POST', body: { stake: value, bet } });
      playerCards.innerHTML = r.playerCards.map((c) => cardHtml(c)).join('');
      bankerCards.innerHTML = r.bankerCards.map((c) => cardHtml(c)).join('');
      playerTotal.textContent = String(r.playerTotal);
      bankerTotal.textContent = String(r.bankerTotal);
      statusEl.textContent = `${r.outcome.toUpperCase()} wins · ${r.playerTotal} – ${r.bankerTotal}`;
      resultEl.innerHTML = resultPanel(
        r.win ? 'win' : 'loss',
        r.win ? `You won ${money(r.payout)}` : `You lost ${money(value)}`,
        `${r.choice} · ${r.win ? `${r.multiplier}x` : `result ${r.outcome}`}`,
      );
      history.unshift({
        win: r.win,
        label: `${r.choice} → ${r.outcome}`,
        meta: `${r.playerTotal}–${r.bankerTotal}`,
        payout: r.payout,
      });
      historyEl.innerHTML = historyList(history.slice(0, 8), 'No hands yet.');
      setUser({ ...state.user, balance: r.balance });
      refreshUser();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('play')} Deal cards`;
    }
  });
}

/* ---------------------------------------------------------------- blackjack */

const BJ_LABELS = { won: 'You won', lost: 'Dealer wins', push: 'Push', blackjack: 'Blackjack!' };

function blackjackView(game) {
  return `<div class="game-layout">
    <section class="card game-stage">
      <div class="table-felt bj-table">
        <div class="table-side">
          <div class="table-side-head"><span>Dealer</span><strong id="bj-dealer-total">–</strong></div>
          <div class="card-row" id="bj-dealer-cards">${cardHtml(null)}${cardHtml(null)}</div>
        </div>
        <div class="table-side">
          <div class="table-side-head"><span>Your hand</span><strong id="bj-player-total">–</strong></div>
          <div class="card-row" id="bj-player-cards"></div>
        </div>
      </div>
      <div class="stage-status" id="bj-status">Set your stake and deal a hand.</div>
      <div id="bj-result"></div>
    </section>
    <aside class="card game-controls">
      <div class="card-head"><h3>${icon('wallet')} Your hand</h3></div>
      ${stakeField(game)}
      <button class="btn btn-gold btn-block" id="bj-deal">${icon('play')} Deal a hand</button>
      <div class="btn-row mt-8 bj-actions">
        <button class="btn btn-ghost" id="bj-hit" disabled>Hit</button>
        <button class="btn btn-ghost" id="bj-stand" disabled>Stand</button>
        <button class="btn btn-outline-gold" id="bj-double" disabled>Double</button>
      </div>
      <div class="pill-note mt-16">${icon('info')}<div>Blackjack pays 3:2 · dealer stands on 17 · double on your first two cards.</div></div>
      <div class="divider"></div>
      <div id="bj-history">${historyList([], 'No hands yet.')}</div>
    </aside>
  </div>
  ${howTo(game)}`;
}

function mountBlackjack(root, game) {
  const stake = bindStake(root, game);
  const els = {
    dealerCards: root.querySelector('#bj-dealer-cards'),
    playerCards: root.querySelector('#bj-player-cards'),
    dealerTotal: root.querySelector('#bj-dealer-total'),
    playerTotal: root.querySelector('#bj-player-total'),
    status: root.querySelector('#bj-status'),
    result: root.querySelector('#bj-result'),
    history: root.querySelector('#bj-history'),
    deal: root.querySelector('#bj-deal'),
    hit: root.querySelector('#bj-hit'),
    stand: root.querySelector('#bj-stand'),
    double: root.querySelector('#bj-double'),
  };
  const history = [];
  let roundId = null;
  let busy = false;

  function paint(r) {
    roundId = r.status === 'player' ? r.id : null;
    els.dealerCards.innerHTML = r.dealerCards.map((c) => cardHtml(c)).join('');
    els.playerCards.innerHTML = r.playerCards.map((c) => cardHtml(c)).join('');
    els.dealerTotal.textContent = r.dealerTotal == null ? '–' : String(r.dealerTotal);
    els.playerTotal.textContent = `${r.playerTotal}${r.playerSoft ? ' soft' : ''}`;
    els.hit.disabled = !r.canHit || busy;
    els.stand.disabled = !r.canHit || busy;
    els.double.disabled = !r.canDouble || busy;
    els.deal.disabled = busy || r.status === 'player';
    if (r.status === 'player') {
      els.status.textContent = `Your total is ${r.playerTotal}. Hit, stand or double.`;
      els.result.innerHTML = '';
      return;
    }
    const label = BJ_LABELS[r.status] || 'Hand settled';
    els.status.textContent = `${label} · ${r.detail}`;
    els.result.innerHTML = resultPanel(
      r.payout > r.stake ? 'win' : r.payout > 0 ? 'info' : 'loss',
      `${label} ${r.payout ? money(r.payout) : money(r.stake)}`,
      `${r.detail} · stake ${money(r.stake)}`,
    );
    history.unshift({
      win: r.payout > r.stake,
      label,
      meta: `${r.playerTotal} vs ${r.dealerTotal == null ? '–' : r.dealerTotal}`,
      payout: r.payout,
    });
    els.history.innerHTML = historyList(history.slice(0, 8), 'No hands yet.');
    setUser({ ...state.user, balance: r.balance });
    refreshUser();
  }

  function idle() {
    els.hit.disabled = true;
    els.stand.disabled = true;
    els.double.disabled = true;
    els.deal.disabled = false;
  }

  async function act(path) {
    if (busy || !roundId) return;
    busy = true;
    try {
      paint(await api(path, { method: 'POST' }));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      busy = false;
      if (roundId) {
        els.hit.disabled = false;
        els.stand.disabled = false;
        els.deal.disabled = true;
      } else {
        idle();
      }
    }
  }

  els.deal.addEventListener('click', async () => {
    const value = stake.value();
    if (value === null) return;
    busy = true;
    els.deal.disabled = true;
    els.deal.innerHTML = '<span class="loader"></span> Dealing…';
    try {
      paint(await api('/api/games/blackjack/start', { method: 'POST', body: { stake: value } }));
    } catch (err) {
      toast(err.message, 'error');
      idle();
    } finally {
      busy = false;
      els.deal.innerHTML = `${icon('play')} Deal a hand`;
      if (roundId) {
        els.hit.disabled = false;
        els.stand.disabled = false;
        els.deal.disabled = true;
      }
    }
  });

  els.hit.addEventListener('click', () => act(`/api/games/blackjack/${roundId}/hit`));
  els.stand.addEventListener('click', () => act(`/api/games/blackjack/${roundId}/stand`));
  els.double.addEventListener('click', () => act(`/api/games/blackjack/${roundId}/double`));
}

/* ------------------------------------------------------------------ exports */

const MOUNTS = {
  'golden-crash': { view: crashView, mount: mountCrash },
  'dice-duel': { view: diceView, mount: mountDice },
  'royal-coin': { view: coinView, mount: mountCoin },
  'golden-wheel': { view: wheelView, mount: mountWheel },
  'lucky-nine': { view: luckyView, mount: mountLucky },
  'vip-baccarat': { view: baccaratView, mount: mountBaccarat },
  'vip-blackjack': { view: blackjackView, mount: mountBlackjack },
};

export function renderGamePage(slug) {
  const game = state.games.find((g) => g.slug === slug);
  if (!game) return null;
  const entry = MOUNTS[game.slug];
  if (!entry) return null;

  const body = state.user && game.enabled ? entry.view(game) : state.user ? `<section class="card game-stage"><div class="guest-lock"><div class="guest-icon">${icon('alert')}</div><h2>${escapeHtml(game.name)} is paused</h2><p class="muted">The operator has temporarily disabled this table. Please try another game.</p><a class="btn btn-gold" href="#/games">${icon('games')} Browse games</a></div></section>` : guestLock(game);

  return {
    html: `${gameHead(game)}${body}`,
    mount(root) {
      if (!state.user) {
        bindGuest(root);
        return;
      }
      if (!game.enabled) return;
      entry.mount(root, game);
    },
  };
}

export { statusBadge, refreshUser };
