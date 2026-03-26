# ZPL Analytics — Zignuts Premier League Management Platform

A full-stack cricket analytics and management platform for the Zignuts Premier League (ZPL) — a corporate T12 cricket tournament.

---

## Quick Start

```bash
npm install
npm run dev      # http://localhost:3000
```

**Password:** `Ai@1234`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | SQLite via better-sqlite3 |
| AI | Anthropic Claude Sonnet 4.6 |
| Image Gen | Together.ai FLUX.1-schnell-Free |
| UI | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Auth | Cookie-based password protection |
| Testing | Playwright (E2E + API coverage) |

---

## Authentication

All routes are protected by a single password gate.

- **Password:** `Ai@1234`
- Change via `APP_PASSWORD` in `.env.local`
- Sessions last 30 days (httpOnly cookie)

---

## Modules

### Dashboard `/`
Live season overview — players, teams, matches, budget used, leaderboard.

---

### Players `/players`
- Browse all registered players with role, stats, team assignment
- Search by name, filter by role / gender
- Click any player to see inline profile + stats
- Add scouting notes per player
- **Bulk import via CSV/Excel** — create or update multiple players at once

**Bulk Import CSV/XLSX columns:**
| Column | Description |
|---|---|
| `first_name` / `last_name` or `name` | Player name (required) |
| `gender` | Male / Female |
| `player_role` | Batsman, Bowler, All-rounder, Wicketkeeper, WK-Batsman |
| `batting_hand` | Right-handed / Left-handed |
| `bowling_style` | Right-arm fast, Left-arm orthodox, etc. |
| `strong_buy` | yes/no/1/0 — strong buy flag for auction |
| `budget_range` | e.g. 500000-1000000 |
| `jersey_number` | Jersey number |
| `age` | Player age |
| `experience_years` | Years of cricket experience |
| `notes` | Scouting notes |

---

### Player Detail `/players/[id]`
- Full career stats (batting, bowling, fielding, MVP score)
- Match-by-match history (last 15 matches)
- AI player analysis report
- Scouting remarks

---

### Teams `/teams`
List of all teams — budget, squad count, win/loss.

### Team Detail `/teams/[id]`
**World-class advanced analytics dashboard:**
- Budget utilisation bar
- **8 KPI cards:** total runs, wickets, batting strike rate, bowling economy, batting average, boundaries, girls in squad, batting depth
- **Squad Composition** pie chart
- **Team Strengths Radar** (Batting, Bowling, Firepower, Depth, Girls Advantage, Value)
- **Value-for-Money** horizontal bar chart (performance score per lakh spent)
- **Key Player spotlights:** Top Scorer, Top Wicket-Taker, Best Economy, Best SR, Girls First-Over asset, MVP
- **Tactical Insights panel:** Batting Depth, Bowling Attack quality, Girls First Over readiness, Power Hitters — with ✅/⚠️/❌ ratings
- **AI Deep Analysis** — full Claude-powered cricket report

---

### Matches `/matches`
List all matches — filter by status, search by team.

### Match Detail `/matches/[id]`
- Match result, toss, venue, scorecard
- Edit result (status, winner, toss, date, venue)
- **Match Notes** — rich notes field fed into AI across all modules when no scorecard exists
- Scorecard PDF upload → AI auto-parses batting/bowling data
- Full innings tables
- AI match analysis report

**Match Notes** are used by AI Strategy, Comparison, and Player Analysis. Include: pitch conditions, key moments, injuries, tactical decisions, weather, standout plays.

---

### Auction `/auction`
Live auction interface:
- Player cards with base price, group, and stats
- Real-time budget tracking per team
- AI bid suggestion (tells you how much to bid and why)

---

### Compare `/compare`
Head-to-head player comparison with batting/bowling stats side-by-side and AI analysis.

---

### Strategy `/strategy`
Team vs team AI tactical plan — batting order, bowling rotations, powerplay strategy, girls first over usage.

---

### Campaign Creator `/campaign`
**Next-Generation Social Media Campaign Creator:**

1. **Brief** — paste stats, write an idea, upload a photo
2. **Market Research** — AI analyses current cricket hashtag trends
3. **3 Concepts** — each with a unique format, tone, angle
4. **AI Images** — FLUX generates cricket-specific backgrounds; your photo composites on top per format layout
5. **Full Post Package** per concept — caption, 30 hashtags, story version, reel script
6. **Approve → Copy** — ready to paste into Instagram
7. **Performance Dashboard** — track engagement and the AI learns what works best for your team

Concept formats: Cinematic Recap · Player Spotlight · Fan Energy Hype · Stats-Led · Behind the Scenes · Motivational

---

### Admin

#### Player Management `/admin/players`
- Edit roles, batting hand, bowling style, photos
- **Bulk Import** (same CSV/Excel format as /players)

#### Team Management `/admin/teams`
Create and edit teams — colors, logos, captains.

#### Season Settings `/admin/season`
Set auction budget, max players per team, overs, rules.

#### Match Scheduler `/admin/matches/new`
Schedule matches — select teams, date, venue.
Match types: League · Semi-Final · Final · **Practice Match**

#### Data Import `/admin/import`
Bulk import historical season data.

---

## AI Features

All AI uses **Claude Sonnet 4.6** with full ZPL rule awareness:
- 12-over T12 format
- Girls First Over — runs **doubled** in over 1, only 4 fielders, must be bowled by a girl
- At least 2 girls in playing XI
- Impact Player substitution
- DRS (1 review per team)

| Endpoint | Purpose |
|---|---|
| `POST /api/ai/player-analysis` | In-depth player report |
| `POST /api/ai/match-strategy` | Tactical plan for a matchup |
| `POST /api/ai/compare` | Head-to-head comparison |
| `POST /api/ai/auction-suggest` | Live auction bid guidance |
| `POST /api/campaign/generate` | Social media campaign + images |

---

## Match Notes → AI Context

Match Notes (on any match detail page) feed directly into:
- AI Strategy recommendations
- Player comparison analysis
- Team analytics

Useful when you cannot upload a scorecard. Write what you observed: pitch behaviour, player form, tactical calls, injuries, fielding highlights. The AI treats this as ground truth.

---

## Testing

### Run All Tests (single command)

```bash
npm run test:all
```

This runs the full E2E suite followed by the performance monitor.

### Commands

| Command | Description |
|---|---|
| `npm run test` | Run all E2E tests |
| `npm run test:e2e` | Same as above (explicit alias) |
| `npm run test:perf` | Core Web Vitals + API response time report |
| `npm run test:fix` | Auto-fix failures found in the last E2E run |
| `npm run test:perf:fix` | Auto-fix performance issues from the last perf run |
| `npm run test:all` | E2E tests + performance monitoring in sequence |

> The dev server starts automatically if not already running. Auth is handled automatically using `Ai@1234`.

---

### E2E Test Suite

Located in `tests/e2e/`. Covers all 9 test modules:

| File | Coverage |
|---|---|
| `01-auth.spec.ts` | Login, wrong password, redirect, unauthenticated API, show/hide password |
| `02-dashboard.spec.ts` | Page load, branding, sidebar nav, dashboard & leaderboard APIs, logout |
| `03-teams.spec.ts` | Teams list, team cards, API, team detail, KPIs, PATCH update, admin teams |
| `04-players.spec.ts` | Player list, API filters, search, gender filter, player detail, bulk import |
| `05-matches.spec.ts` | Match list, create + delete match, match detail, PATCH status, scorecard API |
| `06-auction.spec.ts` | Auction page, purchases API, available players, create + delete, duplicate guard |
| `07-ai-features.spec.ts` | Compare/Strategy/Campaign pages, all AI API endpoints |
| `08-admin.spec.ts` | All admin pages, seasons API (3 seasons), clone API, upload API, team-roles API |
| `09-api-coverage.spec.ts` | Exhaustive GET coverage, response shape validation, data integrity checks |

**Auth:** A single setup step authenticates once and saves session state — all subsequent tests reuse it (no repeated logins).

**Reports** saved to `tests/reports/`:
- `results.json` — Playwright JSON report
- `html/` — Interactive HTML report

---

### Performance Monitor

```bash
npm run test:perf
```

Measures for **12 routes** and **9 API endpoints**:

| Metric | Threshold |
|---|---|
| TTFB (Time to First Byte) | < 800ms |
| FCP (First Contentful Paint) | < 3,000ms |
| LCP (Largest Contentful Paint) | < 4,000ms |
| API response time | < 2,000ms |

Report saved to `tests/reports/perf-report.json`.

---

### Auto-Fix Scripts

#### After E2E failures:
```bash
npm run test:fix
```
Reads the last test run's `results.json` and automatically fixes:
- Missing `useState` / `useEffect` / `useRef` imports
- `onError` DOM mutations causing React hydration mismatches
- `next/image` with `fill` prop (replaces with `<img>`)
- API routes returning 404 (creates stub handler)
- Missing `'use client'` directives

#### After performance issues:
```bash
npm run test:perf:fix
```
Reads `perf-report.json` and automatically applies:
- `Cache-Control` headers to slow API route handlers
- `LIMIT 500` guard on unbounded DB queries
- Warns on unguarded `requestAnimationFrame` loops

---

## Performance Architecture

### Image Rendering
All images use plain `<img>` tags (not `next/image`) to avoid Sharp's Windows null-return issue. `unoptimized: true` is set in `next.config.ts` as an additional guard.

### Animation Loops
All canvas/RAF-based effects are idle-safe — they stop automatically when there is nothing to render:
- **CursorGlow** — RAF stops when cursor converges (delta < 0.5px)
- **ClickParticles** — RAF stops when particle array is empty; restarts on click
- **Confetti** — RAF stops when pieces array is empty
- **SoundPanel** — uses 140ms `setInterval` instead of 60fps RAF

### Middleware
`middleware.ts` excludes all static assets from the auth gate at the matcher pattern level:
```
/((?!_next/static|_next/image|favicon\.ico|.*\.(?:png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|mp3|wav|pdf)).*)
```

### React Hydration
Components with `onError` image fallbacks use the `hydrated` guard pattern to prevent SSR/client mismatch:
```tsx
const [hydrated, setHydrated] = useState(false);
useEffect(() => { setHydrated(true); }, []);
// Then: {hydrated && logoError ? <Fallback /> : <img onError={...} />}
```

---

## Environment Variables

```env
# Database
DATABASE_PROVIDER=sqlite
SQLITE_PATH=./data/zpl.db

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Image Generation (free — 100 images/day)
TOGETHER_API_KEY=tgp_v1_...

# Auth
APP_PASSWORD=Ai@1234
APP_SESSION_TOKEN=zpl_authenticated_2025

# App
NEXT_PUBLIC_APP_NAME=ZPL Analytics
```

---

## Database Schema

```
seasons
  ├── season_registrations → players
  ├── teams → auction_purchases → players
  ├── matches
  │     ├── innings → match_batting / match_bowling → players
  │     └── match_scorecards
  ├── player_season_stats
  ├── player_remarks
  └── points_table
```

---

## Player Extended Fields

Added in bulk import or manually:

| Field | Type | Notes |
|---|---|---|
| `is_strong_buy` | INTEGER (0/1) | Auction recommendation flag |
| `budget_range` | TEXT | e.g. "500000-1500000" |
| `jersey_number` | TEXT | |
| `nationality` | TEXT | |
| `age` | INTEGER | |
| `experience_years` | INTEGER | |
| `notes` | TEXT | Scouting notes |

---

## Player Data Accuracy

Historical stats (batting, bowling, fielding, MVP) for 2024 and 2025 seasons have been validated against source CSV files:

- **717 / 721 data points verified (99.4% accuracy)**
- Validated fields: runs, innings, strike rate, average, wickets, economy, maidens, dot balls, catches, stumpings, run outs, MVP scores

---

## Gamification

- Hover/click sounds (Web Audio API synthesiser — no external files)
- Click particles, cursor glow
- Sidebar: floating icons, glow rings, accent colors per section
- 3D holographic tilt cards on hover
- Konami Code easter egg (↑↑↓↓←→←→BA)
- Sound control panel (volume, ambient stadium, mute) — bottom-right

---

## Development Commands

```bash
npm run dev        # development (Turbopack)
npm run build      # production build
npm run start      # serve production
npm run typecheck  # TypeScript check
npm run seed       # seed the database
```

Database auto-created at `./data/zpl.db` on first run.

---

*ZPL Analytics — Zignuts Premier League 2026*
