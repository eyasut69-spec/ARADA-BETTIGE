'use strict';

const { GAME_DEFS, gameDef, LIMITS } = require('./catalog');
const store = require('./store');
const { secureRandom, secureInt, round2 } = require('./security');

const CRASH_GROWTH = 0.25; // multiplier points per second
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function gameState(slug) {
  const game = store.db().games.find((g) => g.slug === slug);
  const def = gameDef(slug);
  if (!game || !def) return null;
  return {
    ...def,
    enabled: game.enabled !== false,
    minBet: Number(game.minBet) || def.minBet,
    maxBet: Number(game.maxBet) || def.maxBet,
    rtp: Number(game.rtp) || def.rtp,
    plays: game.plays || 0,
    wagered: round2(game.wagered || 0),
    paidOut: round2(game.paidOut || 0),
  };
}

function listGames() {
  return GAME_DEFS.map((def) => gameState(def.slug)).filter(Boolean);
}

function assertBet(user, game, stake) {
  if (!game) {
    const err = new Error('Unknown game.');
    err.status = 404;
    throw err;
  }
  if (!game.enabled) {
    const err = new Error(`${game.name} is temporarily disabled by the operator.`);
    err.status = 403;
    throw err;
  }
  if (!Number.isFinite(stake)) {
    const err = new Error('Enter a valid stake.');
    err.status = 400;
    throw err;
  }
  const rounded = round2(stake);
  if (rounded < game.minBet) {
    const err = new Error(`Minimum stake for ${game.name} is ${game.minBet} ETB.`);
    err.status = 400;
    throw err;
  }
  if (rounded > game.maxBet) {
    const err = new Error(`Maximum stake for ${game.name} is ${game.maxBet} ETB.`);
    err.status = 400;
    throw err;
  }
  if (rounded > user.balance) {
    const err = new Error('Insufficient demo balance. Claim free credits from the cashier.');
    err.status = 400;
    throw err;
  }
  return rounded;
}

function debit(user, stake) {
  store.adjustBalance(user, -stake);
  store.addTransaction({
    userId: user.id,
    type: 'bet',
    amount: -stake,
    status: 'approved',
    note: 'Demo wager',
  });
}

function creditWin(user, game, stake, multiplier, payout, detail) {
  if (payout > 0) store.adjustBalance(user, payout);
  if (payout > 0) {
    store.addTransaction({
      userId: user.id,
      type: 'payout',
      amount: payout,
      status: 'approved',
      note: `${game.name} win at ${round2(multiplier)}x`,
    });
  }
  return store.recordBet({
    user,
    game,
    stake,
    multiplier,
    payout,
    outcome: payout > 0 ? 'win' : 'loss',
    detail,
  });
}

/* ---------------------------------------------------------------- crash game */

function newCrashPoint(rtp = 0.97) {
  // P(crash >= m) = (1 - edge) / m  →  heavy tail, occasional instant busts.
  const edge = Math.min(0.2, Math.max(0.01, 1 - rtp));
  const u = Math.max(secureRandom(), 1e-9);
  const raw = Math.floor(((1 - edge) / u) * 100) / 100;
  return Math.max(1, Math.min(raw, 250));
}

function crashMultiplier(startedAt, now = Date.now()) {
  const seconds = Math.max(0, (now - startedAt) / 1000);
  return round2(1 + CRASH_GROWTH * seconds);
}

function settleCrashRound(round, user, game, atMultiplier, detail) {
  round.status = 'cashed';
  round.cashoutMultiplier = atMultiplier;
  round.payout = round2(round.stake * atMultiplier);
  round.settledAt = new Date().toISOString();
  creditWin(user, game, round.stake, atMultiplier, round.payout, detail);
  store.persist();
  return round;
}

function settleBust(round, user, game) {
  round.status = 'busted';
  round.settledAt = new Date().toISOString();
  store.recordBet({
    user,
    game,
    stake: round.stake,
    multiplier: 0,
    payout: 0,
    outcome: 'loss',
    detail: `Crashed at ${round.crashPoint.toFixed(2)}x`,
  });
  store.persist();
  return round;
}

function startCrash(user, { stake, autoCashout }) {
  const game = gameState('golden-crash');
  const amount = assertBet(user, game, stake);
  const auto = Number(autoCashout);
  if (autoCashout !== undefined && autoCashout !== null && autoCashout !== '' && (!Number.isFinite(auto) || auto < 1.01 || auto > 100)) {
    const err = new Error('Auto cash-out must be between 1.01x and 100x.');
    err.status = 400;
    throw err;
  }
  debit(user, amount);
  const round = {
    id: `crs_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    userId: user.id,
    stake: amount,
    autoCashout: Number.isFinite(auto) && auto >= 1.01 ? round2(auto) : null,
    crashPoint: newCrashPoint(game.rtp),
    startedAt: Date.now(),
    status: 'running',
    cashoutMultiplier: 0,
    payout: 0,
    settledAt: null,
  };
  store.db().crashRounds.push(round);
  store.persist();
  return { round, balance: user.balance };
}

function roundView(round, user) {
  const now = Date.now();
  const multiplier = round.status === 'running' ? crashMultiplier(round.startedAt, now) : round.cashoutMultiplier;
  return {
    id: round.id,
    stake: round.stake,
    status: round.status,
    multiplier: round.status === 'busted' ? 0 : round2(multiplier),
    crashPoint: round.status === 'running' ? null : round.crashPoint,
    payout: round.status === 'cashed' ? round.payout : 0,
    autoCashout: round.autoCashout,
    startedAt: round.startedAt,
    balance: round2(user.balance),
  };
}

/** Advance a running crash round, settling busts and auto cash-outs server side. */
function tickCrash(user, roundId) {
  const round = store.db().crashRounds.find((r) => r.id === roundId && r.userId === user.id);
  if (!round) {
    const err = new Error('Round not found.');
    err.status = 404;
    throw err;
  }
  const game = gameState('golden-crash');
  if (round.status === 'running') {
    const current = crashMultiplier(round.startedAt);
    if (current >= round.crashPoint) {
      settleBust(round, user, game);
    } else if (round.autoCashout && current >= round.autoCashout) {
      settleCrashRound(round, user, game, round.autoCashout, `Auto cash-out at ${round.autoCashout.toFixed(2)}x`);
    }
  }
  return roundView(round, user);
}

function cashoutCrash(user, roundId) {
  const round = store.db().crashRounds.find((r) => r.id === roundId && r.userId === user.id);
  if (!round) {
    const err = new Error('Round not found.');
    err.status = 404;
    throw err;
  }
  if (round.status !== 'running') {
    const err = new Error(`This round already finished (${round.status}).`);
    err.status = 409;
    throw err;
  }
  const game = gameState('golden-crash');
  const current = crashMultiplier(round.startedAt);
  if (current >= round.crashPoint) {
    settleBust(round, user, game);
    return roundView(round, user);
  }
  settleCrashRound(round, user, game, current, `Cashed out at ${current.toFixed(2)}x`);
  return roundView(round, user);
}

/* --------------------------------------------------------------- instant games */

function playDice(user, { stake, target, direction }) {
  const game = gameState('dice-duel');
  const amount = assertBet(user, game, stake);
  const line = Math.round(Number(target));
  const dir = direction === 'over' ? 'over' : 'under';
  if (!Number.isFinite(line) || line < 2 || line > 98) {
    const err = new Error('Dice target must be a whole number between 2 and 98.');
    err.status = 400;
    throw err;
  }
  const chance = dir === 'under' ? line : 100 - line;
  const multiplier = round2((100 / chance) * game.rtp);
  const roll = round2(secureRandom() * 100);
  const win = dir === 'under' ? roll < line : roll > line;
  debit(user, amount);
  const payout = win ? round2(amount * multiplier) : 0;
  const bet = creditWin(
    user,
    game,
    amount,
    win ? multiplier : 0,
    payout,
    `Rolled ${roll.toFixed(2)} ${dir} ${line} → ${win ? 'win' : 'loss'}`,
  );
  return {
    roll,
    target: line,
    direction: dir,
    chance: round2(chance),
    multiplier,
    win,
    payout,
    balance: round2(user.balance),
    bet: bet.id,
  };
}

function playCoin(user, { stake, choice }) {
  const game = gameState('royal-coin');
  const amount = assertBet(user, game, stake);
  const pick = choice === 'tails' ? 'tails' : 'heads';
  const result = secureRandom() < 0.5 ? 'heads' : 'tails';
  const win = pick === result;
  const multiplier = round2(game.rtp * 2);
  debit(user, amount);
  const payout = win ? round2(amount * multiplier) : 0;
  creditWin(user, game, amount, win ? multiplier : 0, payout, `${result} landed → ${win ? 'win' : 'loss'}`);
  return { result, choice: pick, multiplier, win, payout, balance: round2(user.balance) };
}

function playWheel(user, { stake, color }) {
  const game = gameState('golden-wheel');
  const amount = assertBet(user, game, stake);
  const pick = ['red', 'black', 'green'].includes(color) ? color : 'red';
  const number = secureInt(37);
  const landed = number === 0 ? 'green' : RED_NUMBERS.has(number) ? 'red' : 'black';
  const win = pick === landed;
  const multiplier = landed === 'green' ? 14 : 2;
  debit(user, amount);
  const payout = win ? round2(amount * multiplier) : 0;
  creditWin(
    user,
    game,
    amount,
    win ? multiplier : 0,
    payout,
    `Wheel landed ${number} ${landed} → ${win ? 'win' : 'loss'}`,
  );
  return { number, color: landed, choice: pick, multiplier, win, payout, balance: round2(user.balance) };
}

function playLucky(user, { stake, number }) {
  const game = gameState('lucky-nine');
  const amount = assertBet(user, game, stake);
  const pick = Number(number);
  if (!Number.isInteger(pick) || pick < 0 || pick > 9) {
    const err = new Error('Choose a digit between 0 and 9.');
    err.status = 400;
    throw err;
  }
  const drawn = secureInt(10);
  const multiplier = round2(game.rtp * 10);
  const win = pick === drawn;
  debit(user, amount);
  const payout = win ? round2(amount * multiplier) : 0;
  creditWin(user, game, amount, win ? multiplier : 0, payout, `Drew ${drawn} → ${win ? 'win' : 'loss'}`);
  return { drawn, choice: pick, multiplier, win, payout, balance: round2(user.balance) };
}

function play(user, slug, payload) {
  switch (slug) {
    case 'dice-duel':
      return playDice(user, payload);
    case 'royal-coin':
      return playCoin(user, payload);
    case 'golden-wheel':
      return playWheel(user, payload);
    case 'lucky-nine':
      return playLucky(user, payload);
    default: {
      const err = new Error('This game is not playable through this endpoint.');
      err.status = 404;
      throw err;
    }
  }
}

module.exports = {
  LIMITS,
  listGames,
  gameState,
  startCrash,
  tickCrash,
  cashoutCrash,
  play,
  crashMultiplier,
};
