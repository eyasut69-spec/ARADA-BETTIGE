'use strict';

/**
 * Shared catalog + business constants for ARADA BETTING.
 *
 * Payments are collected manually on the real accounts below and verified by an
 * operator before credits are added. Override any destination without editing
 * code by setting DEPOSIT_TELEBIRR_NUMBER, DEPOSIT_CBE_ACCOUNT or
 * DEPOSIT_ACCOUNT_NAME in the hosting environment.
 */

const CURRENCY = 'ETB';

const LIMITS = {
  depositMin: 100,
  depositMax: 10000,
  withdrawMin: 500,
  withdrawMax: 50000,
  minBet: 10,
  maxBet: 10000,
  welcomeBonus: 1000,
  depositWindowMs: 19 * 60 * 1000, // 19 minute window to upload payment proof
};

const TRANSACTION_STATUSES = ['pending', 'approved', 'rejected'];

const PAYMENT_ACCOUNTS = {
  holder: process.env.DEPOSIT_ACCOUNT_NAME || 'ARADA BETTING',
  telebirr: process.env.DEPOSIT_TELEBIRR_NUMBER || '0964050295',
  cbe: process.env.DEPOSIT_CBE_ACCOUNT || '1000642419928',
};

const DEPOSIT_METHODS = [
  {
    id: 'telebirr',
    name: 'Telebirr',
    tagline: 'Ethio Telecom mobile money',
    account: PAYMENT_ACCOUNTS.telebirr,
    holder: PAYMENT_ACCOUNTS.holder,
    accent: '#22c55e',
    steps: [
      'Open Telebirr and choose "Send Money".',
      `Send the exact deposit amount to ${PAYMENT_ACCOUNTS.telebirr} (${PAYMENT_ACCOUNTS.holder}).`,
      'Copy the transaction number from the confirmation SMS.',
      'Upload a screenshot of the confirmation below. Our team verifies it and credits your balance.',
    ],
  },
  {
    id: 'cbebirr',
    name: 'CBE Birr',
    tagline: 'Commercial Bank of Ethiopia wallet',
    account: PAYMENT_ACCOUNTS.cbe,
    holder: PAYMENT_ACCOUNTS.holder,
    accent: '#a855f7',
    steps: [
      'Open CBE Birr and choose "Transfer" then "To CBE Account".',
      `Send the exact deposit amount to ${PAYMENT_ACCOUNTS.cbe} (${PAYMENT_ACCOUNTS.holder}).`,
      'Save the transaction number shown after the transfer.',
      'Upload the confirmation screenshot below for verification.',
    ],
  },
  {
    id: 'bank',
    name: 'CBE Bank Transfer',
    tagline: 'Commercial Bank of Ethiopia account',
    account: PAYMENT_ACCOUNTS.cbe,
    holder: PAYMENT_ACCOUNTS.holder,
    accent: '#d4af37',
    steps: [
      `Transfer the exact deposit amount to CBE account ${PAYMENT_ACCOUNTS.cbe} (${PAYMENT_ACCOUNTS.holder}).`,
      'Use mobile banking, an ATM or a branch deposit.',
      'Keep the transfer slip with the transaction number visible.',
      'Upload the slip below. Our team verifies the payment and credits your balance.',
    ],
  },
];

const WITHDRAW_METHODS = [
  { id: 'telebirr', name: 'Telebirr', hint: '09xxxxxxxx' },
  { id: 'cbebirr', name: 'CBE Birr', hint: 'CBE wallet number' },
  { id: 'bank', name: 'CBE Bank Transfer', hint: 'CBE account number' },
];

const GAME_DEFS = [
  {
    slug: 'golden-crash',
    name: 'Golden Crash',
    short: 'Ride the golden curve and cash out before it crashes.',
    category: 'Crash',
    rtp: 0.97,
    minBet: 10,
    maxBet: 5000,
    badge: 'HOT',
    accent: '#d4af37',
    howTo: [
      'Choose your stake and an optional auto cash-out multiplier.',
      'The multiplier climbs from 1.00x while the round is live.',
      'Press CASH OUT before the crash to bank stake x multiplier.',
      'If the curve crashes first, the round is lost.',
    ],
  },
  {
    slug: 'dice-duel',
    name: 'Dice Duel',
    short: 'Roll under or over your lucky line.',
    category: 'Dice',
    rtp: 0.97,
    minBet: 10,
    maxBet: 10000,
    badge: 'POPULAR',
    accent: '#38bdf8',
    howTo: [
      'Pick a target between 2 and 98 and choose Under or Over.',
      'The lower the win chance, the higher the multiplier.',
      'Roll a number from 0.00 to 99.99.',
      'Win when the roll lands on your side of the line.',
    ],
  },
  {
    slug: 'royal-coin',
    name: 'Royal Coin',
    short: 'Call the toss for a clean 1.96x.',
    category: 'Instant',
    rtp: 0.98,
    minBet: 10,
    maxBet: 5000,
    badge: 'INSTANT',
    accent: '#f5d67b',
    howTo: [
      'Choose Heads or Tails.',
      'Place your stake and flip the royal coin.',
      'A correct call pays 1.96x your stake instantly.',
    ],
  },
  {
    slug: 'golden-wheel',
    name: 'Golden Wheel',
    short: 'Red, black or the 14x golden zero.',
    category: 'Table',
    rtp: 0.97,
    minBet: 10,
    maxBet: 5000,
    badge: 'CLASSIC',
    accent: '#ef4444',
    howTo: [
      'Choose Red, Black or the golden Zero pocket.',
      'The wheel spins across 37 pockets (0 - 36).',
      'Red or Black pays 2x, Zero pays 14x.',
    ],
  },
  {
    slug: 'lucky-nine',
    name: 'Lucky Nine',
    short: 'Pick a digit, hit 9.5x.',
    category: 'Instant',
    rtp: 0.95,
    minBet: 10,
    maxBet: 2000,
    badge: 'NEW',
    accent: '#a855f7',
    howTo: [
      'Pick any digit from 0 to 9.',
      'Place your stake and draw the lucky digit.',
      'A perfect match pays 9.5x instantly.',
    ],
  },
];

function gameDef(slug) {
  return GAME_DEFS.find((g) => g.slug === slug) || null;
}

module.exports = {
  CURRENCY,
  LIMITS,
  TRANSACTION_STATUSES,
  PAYMENT_ACCOUNTS,
  DEPOSIT_METHODS,
  WITHDRAW_METHODS,
  GAME_DEFS,
  gameDef,
};
