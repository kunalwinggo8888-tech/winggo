# WINGGO — Play More Win More

India's fast-growing real-money skill gaming platform. Users play games like Ludo, Carrom, Snakes & Ladders, Cricket, and more to win real cash rewards instantly.

## Run & Operate

- `pnpm --filter @workspace/winzo run dev` — run the WINGGO frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind v4, Framer Motion, shadcn/ui
- State: screen-based state machine (no URL routing)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (future)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/winzo/src/App.tsx` — screen state machine (splash → login → dashboard → spinwheel / ludo)
- `artifacts/winzo/src/pages/SplashScreen.tsx` — branded animated splash
- `artifacts/winzo/src/pages/LoginScreen.tsx` — +91 mobile OTP login
- `artifacts/winzo/src/pages/Dashboard.tsx` — home with banner, game grid, daily spin modal
- `artifacts/winzo/src/pages/SpinWheel.tsx` — daily spin-to-win (localStorage daily limit)
- `artifacts/winzo/src/pages/LudoGame.tsx` — full Ludo game with bot AI and matchmaking
- `artifacts/winzo/src/index.css` — dark gold/purple theme (CSS vars)

## Architecture decisions

- All screens are state-managed in App.tsx (`Screen` union type) — no router needed for mobile-style flows
- SpinWheel is rendered both as a full screen (from App) and as a bottom-sheet overlay modal (from Dashboard header icon)
- Ludo game is a complete client-side implementation with SVG board, bot AI, and phase-based state machine
- Daily spin limit stored in localStorage (`winggo_last_spin_date`)
- Bot difficulty: prefers captures > advancing furthest token > taking tokens out of yard

## Product

- **Splash**: animated WINGGO logo with loading bar and feature pill badges
- **Login**: glassmorphism card, Indian +91 phone input, new user ₹50 bonus badge
- **Dashboard**: auto-scrolling banners, Daily Spin icon (header), game grid (Ludo playable), bottom nav
- **Spin Wheel**: 8-segment SVG wheel, confetti, daily limit, win modal
- **Ludo**: 2-player & 4-player modes, entry fee rooms (₹1/5/10/50), full 52-cell board, bot AI, emoji reactions

## User preferences

- Brand name: WINGGO ("WIN" white + "GGO" gold)
- Theme: dark (#0a0a0f background), gold (#FFD700), purple accents
- Mobile-first, max-width 480px
- No URL routing — state machine navigation
- Premium WinZO/MPL-style gaming UI

## Gotchas

- The Vite app reads `PORT` from env — do not hardcode a port
- `pnpm --filter @workspace/winzo run typecheck` to verify TS — not `build` (build needs workflow-provided env vars)
- SpinWheel appears both as a route AND as an overlay inside Dashboard — both paths use the same component
