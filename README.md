# ARADA BETTING — Premium Demo Betting Platform

A full-stack, mobile-first demo betting platform in a luxurious **black, gold and white**
theme. Every credit is **virtual**: no real deposits, no real withdrawals and no real-money
betting are processed anywhere in the application.

## Demo accounts

| Role   | Phone        | Password     |
| ------ | ------------ | ------------ |
| Player | `0912000000` | `Demo@1234`  |
| Admin  | `0911000000` | `Arada@Admin1` |

Set `ADMIN_PASSWORD` (and optionally `ADMIN_PHONE`) to override the seeded admin, which also
hides the admin hint from the sign-in modal.

## Features

**Accounts**
- Phone-number + password registration and login (no OTP for normal login).
- Passwords hashed with `scrypt` and a per-user random salt; timing-safe comparison.
- Login protection: per-IP + per-phone attempt limits, temporary lockouts, generic errors.
- Password recovery with a one-time 16-character recovery code (hashed at rest), plus
  in-session password change and code rotation.
- Instant **guest demo wallet** so any visitor can play without registering.
- HTTP-only, SameSite=Lax session cookies, CSRF-safe JSON API, security headers.

**Games** (server-authoritative outcomes, virtual credits)
- Golden Crash — live multiplier, cash out before the bust.
- Dice Duel — over/under with a tunable target.
- Royal Coin — heads or tails.
- Golden Wheel — red / black / gold segments.
- Lucky Nine — pick a digit, 9× payout.
- Every round is recorded in game history with stake, multiplier, payout and balance.

**Cashier**
- Deposit page with payment-method selection and demo payment instructions.
- **19-minute countdown** on every demo deposit request, with an expiry sweeper.
- Payment screenshot upload as demo proof (PNG/JPEG/WebP, size-limited, stored server-side).
- Deposit limits **100 – 10,000 ETB**; withdrawal limits **500 – 50,000 ETB**, both shown in the UI.
- Transaction states **Pending / Approved / Rejected** everywhere.

**User dashboard** — profile, virtual balance, wallet stats, game history, transaction ledger,
deposit and withdrawal requests with live countdowns, password and recovery-code management.

**Admin dashboard** — totals and house metrics, user management (balance adjustments, block /
unblock, role, password reset, notes), game enable/disable and bet limits, deposit and
withdrawal approval with notes, full transaction ledger, and a screenshot gallery viewer.

**Design** — luxurious black / gold / white palette, responsive down to small phones, keyboard
accessible dialogs, and working navigation, tabs, chips and buttons throughout.

## Run locally

```bash
npm install
npm start            # http://localhost:3000
```

Data is stored in `data/arada.json` (git-ignored) with uploaded proofs in `data/uploads/`.
Override the location with `ARADA_DATA_DIR` / `ARADA_UPLOAD_DIR`.

## Test

```bash
npm test
```

The suite boots the server against a temporary data directory and exercises health, config,
guest wallets, registration, login protection, all five games, deposit creation with limit
validation, screenshot upload, admin approval, withdrawals and the transaction ledger.

## Container

```bash
docker build -t arada-betting .
docker run -p 3000:3000 arada-betting
```

## Environment variables

| Name                | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `PORT`              | HTTP port (default `3000`)                          |
| `ADMIN_PHONE`       | Seeded admin phone (default `0911000000`)           |
| `ADMIN_PASSWORD`    | Seeded admin password (default `Arada@Admin1`)      |
| `ARADA_DATA_DIR`    | Data directory (default `./data`)                   |
| `ARADA_UPLOAD_DIR`  | Upload directory (default `<data>/uploads`)         |

## Demo-only notice

All balances, deposits, withdrawals and payouts are virtual and have no cash value. The platform
never contacts a payment provider and never moves real money.
