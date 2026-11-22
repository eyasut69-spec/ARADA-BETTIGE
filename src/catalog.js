'use strict';

/**
 * Shared catalog + business constants for ARADA BETTING.
 * Everything here is DEMO / virtual credit only.
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
  depositWindowMs: 19 * 60 * 1000, // 19 minute demo deposit window
};

const TRANSACTION_STATUSES = ['pending', 'approved', 'rejected'];

const DEPOSIT_METHODS = [
  {
    id: 'telebirr',
    name: 'Telebirr',
    tagline: 'Ethio Telecom mobile money',
    account: '0911 000 000',
    holder: 'ARADA BETTING (DEMO)',
    accent: '#22c55e',
    steps: [
      'Open Telebirr and choose "Send Money".',
      'Send your demo amount to 0911 000 000 (ARADA BETTING DEMO).',
      'Copy the transaction reference from the confirmation SMS.',
      'Upload a screenshot of the confirmation as demo proof below.',
    ],
  },
  {
    id: 'cbebirr',
    name: 'CBE Birr',
    tagline: 'Commercial Bank of Ethiopia wallet',
    account: '1000 2345 6789 0',
    holder: 'ARADA BETTING (DEMO)',
    accent: '#a855f7',
    steps: [
      'Open CBE Birr and pick "Transfer to Wallet".',
      'Send your demo amount to 1000 2345 6789 0.',
      'Save the confirmation message reference.',
      'Upload the confirmation screenshot as demo proof below.',
    ],
  },
  {
    id: 'abyssinia',
    name: 'Bank of Abyssinia',
    tagline: 'Apollo mobile banking',
    account: '8812 3456 789',
    holder: 'ARADA BETTING (DEMO)',
    accent: '#38bdf8',
    steps: [
      'Open Apollo and select "Fund Transfer".',
      'Transfer to account 8812 3456 789 (ARADA BETTING DEMO).',
      'Note the reference number shown after transfer.',
      'Upload the receipt screenshot as demo proof below.',
    ],
  },
  {
    id: 'mpesa',
    name: 'M-PESA',
    tagline: 'Safaricom mobile money',
    account: '0911 000 000',
    holder: 'ARADA BETTING (DEMO)',
    accent: '#ef4444',
    steps: [
      'Open M-PESA and choose "Send Money".',
      'Send your demo amount to 0911 000 000.',
      'Copy the M-PESA confirmation code.',
      'Upload the confirmation screenshot as demo proof below.',
    ],
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    tagline: 'Any Ethiopian bank',
    account: '1000 2345 6789 0',
    holder: 'ARADA BETTING (DEMO)',
    accent: '#d4af37',
    steps: [
      'Transfer your demo amount to 1000 2345 6789 0 (CBE, ARADA BETTING DEMO).',
      'Keep the transfer slip or screenshot.',
      'Submit the request, then upload the slip as demo proof.',
      'Demo review is normally instant in this environment.',
    ],
  },
];

const WITHDRAW_METHODS = [
  { id: 'telebirr', name: 'Telebirr', hint: '09xxxxxxxx' },
  { id: 'cbebirr', name: 'CBE Birr', hint: '10 digit wallet number' },
  { id: 'mpesa', name: 'M-PESA', hint: '09xxxxxxxx' },
  { id: 'abyssinia', name: 'Bank of Abyssinia', hint: 'Account number' },
  { id: 'bank', name: 'Bank Transfer', hint: 'Account number' },
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
      'Place your demo stake and flip the royal coin.',
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
      'Place your demo stake and draw the lucky digit.',
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
  DEPOSIT_METHODS,
  WITHDRAW_METHODS,
  GAME_DEFS,
  gameDef,
};
