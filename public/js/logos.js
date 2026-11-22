'use strict';

/**
 * ARADA BETTING — game logo marks.
 *
 * Every table gets its own hand-drawn gold mark instead of a shared icon so the
 * lobby reads like a real casino floor. Each mark inherits the game accent
 * colour through --accent, so a logo always matches its card.
 */

const OPEN = '<svg viewBox="0 0 64 64" fill="none" stroke="var(--accent,#d4af37)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const LOGOS = {
  'golden-crash': `${OPEN}
    <path d="M7 51c11-2 17-11 22-20S38 13 57 9"/>
    <path d="M45 9h12v12"/>
    <circle cx="57" cy="9" r="3.6" fill="var(--accent,#d4af37)" stroke="none"/>
    <path d="M10 56h44" stroke-opacity=".3"/>
  </svg>`,

  'dice-duel': `${OPEN}
    <rect x="7" y="7" width="31" height="31" rx="9"/>
    <circle cx="16" cy="16" r="2.7" fill="var(--accent,#d4af37)" stroke="none"/>
    <circle cx="29" cy="29" r="2.7" fill="var(--accent,#d4af37)" stroke="none"/>
    <circle cx="22.5" cy="22.5" r="2.7" fill="var(--accent,#d4af37)" stroke="none"/>
    <rect x="29" y="29" width="28" height="28" rx="8" stroke-opacity=".55"/>
    <circle cx="43" cy="43" r="2.4" fill="var(--accent,#d4af37)" stroke="none" fill-opacity=".7"/>
  </svg>`,

  'royal-coin': `${OPEN}
    <circle cx="32" cy="32" r="21"/>
    <path d="M21 38l-2.5-13 8 5.5L32 21l5.5 9.5 8-5.5L43 38z" fill="var(--accent,#d4af37)" fill-opacity=".28"/>
    <path d="M23 43h18" stroke-opacity=".5"/>
  </svg>`,

  'golden-wheel': `${OPEN}
    <circle cx="32" cy="32" r="21"/>
    <path d="M32 11v21M32 32v21M11 32h21M32 32h21M17.2 17.2l14.8 14.8M32 32l14.8 14.8M46.8 17.2L32 32M32 32L17.2 46.8" stroke-opacity=".55"/>
    <circle cx="32" cy="32" r="4.4" fill="var(--accent,#d4af37)" stroke="none"/>
  </svg>`,

  'lucky-nine': `${OPEN}
    <rect x="9" y="9" width="46" height="46" rx="15"/>
    <circle cx="31" cy="26" r="9.5"/>
    <path d="M40.5 26c0 12-4.5 20-11.5 26"/>
  </svg>`,

  'vip-baccarat': `${OPEN}
    <rect x="11" y="15" width="25" height="35" rx="5" transform="rotate(-13 23.5 32.5)" stroke-opacity=".6"/>
    <rect x="28" y="14" width="25" height="35" rx="5" transform="rotate(13 40.5 31.5)"/>
    <path d="M35 25l5.5 10 5.5-10"/>
    <circle cx="40.5" cy="42" r="2.4" fill="var(--accent,#d4af37)" stroke="none"/>
  </svg>`,

  'vip-blackjack': `${OPEN}
    <rect x="14" y="11" width="36" height="42" rx="7"/>
    <text x="32" y="38" text-anchor="middle" font-size="17" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="var(--accent,#d4af37)" stroke="none">21</text>
    <path d="M24 45h16" stroke-opacity=".45"/>
    <circle cx="49" cy="49" r="4" fill="var(--accent,#d4af37)" stroke="none" fill-opacity=".55"/>
  </svg>`,

  fallback: `${OPEN}
    <rect x="9" y="13" width="46" height="38" rx="9"/>
    <circle cx="24" cy="27" r="2.6" fill="var(--accent,#d4af37)" stroke="none"/>
    <circle cx="40" cy="37" r="2.6" fill="var(--accent,#d4af37)" stroke="none"/>
  </svg>`,
};

export function gameLogo(slug, extraClass = '') {
  const mark = LOGOS[slug] || LOGOS.fallback;
  return `<span class="game-logo${extraClass ? ` ${extraClass}` : ''}" data-logo="${String(slug || '')}">${mark}</span>`;
}

export default gameLogo;
