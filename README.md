# 🏏 ZPL Analytics

**Zignuts Premier League** — Full-stack analytics, auction management, and AI-powered insights platform for ZPL corporate cricket tournament.

Live: [zpl-analytics.vercel.app](https://zpl-analytics.vercel.app)

---

## ✨ Features

### 📊 Dashboard
- Season-wide stats: total runs, wickets, matches, players
- Top batsmen, bowlers, and MVP leaderboard
- Team budget overview across all 8 teams

### 🏆 Teams & Players
- Team roster with squad composition, budgets spent/remaining
- Individual player profiles with full career stats (batting, bowling, fielding, MVP)
- Player photos and team logos stored in Supabase Storage
- Cross-season performance comparison

### 🔨 Live Auction Board
- Real-time player pool with group filters (Group 1–4), gender filter, search
- Record auction purchases with budget validation
- Undo last purchase
- **ZPL 2025 price badge** on every player card — instant historical price lookup
- **Owner star ratings** (Batting / Bowling / Fielding, 0–5 each) saved per player
- **Owner notes** (free text, 500 chars) — e.g. *"max 50L"*, *"must have"*
- AI bid advice using a 7-step decision framework (see below)

### 🤖 AI Features
- **"Should I bid?"** — per-player bid recommendation using ZPL 2025 anchor price, owner ratings, market data, budget context
- **Auction strategy suggester** — team-level next-best-player recommendation
- **Player analysis** — detailed career assessment and ZPL value rating
- **Match strategy** — pre-match Playing XI, batting order, bowling plan
- **Scorecard analyser** — upload PDF scorecards, get AI match report

### 📈 Stats & Leaderboards
- Batting: runs, average, strike rate, fifties, sixes
- Bowling: wickets, economy, best figures
- Fielding: catches, run-outs, stumpings
- MVP scoring across all seasons

### 🗓️ Matches
- Schedule and results for league, semifinals, eliminator, final
- Match scorecard entry
- Points table with NRR

### ⚙️ Admin
- Import players from Excel/CSV
- Manage team details, logos, colors
- Season management (create, clone, set status)
- Player remarks/scouting notes
- Team role management (captain, manager)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Animation | Framer Motion |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| DB (local) | SQLite via `better-sqlite3` |
| DB (production) | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Storage | Supabase Storage (team logos, player photos) |
| Deployment | Vercel |
| Testing | Playwright (E2E) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/niravczignuts/zpl-analytics.git
cd zpl-analytics
npm install
```

### Local Development (SQLite)

```bash
# Seed the local SQLite database
npm run seed

# Start dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — default password: `Ai@1234`

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root:

```env
# Auth
APP_PASSWORD=your_app_password
APP_SESSION_TOKEN=any_random_32_char_string

# Database — 'sqlite' for local, 'supabase' for production
DATABASE_PROVIDER=sqlite

# Supabase (required when DATABASE_PROVIDER=supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional
NEXT_PUBLIC_APP_NAME=ZPL Analytics
```

---

## 🗄️ Database Setup

### Local (SQLite)
Tables and migrations run automatically on first start. Just run:
```bash
npm run seed
```

### Production (Supabase)
1. Create a Supabase project
2. Go to **SQL Editor** → run `scripts/supabase-seed-data.sql`
3. Run the owner data migration:
   ```sql
   CREATE TABLE IF NOT EXISTS player_owner_data (
     player_id TEXT PRIMARY KEY,
     batting_stars INTEGER,
     bowling_stars INTEGER,
     fielding_stars INTEGER,
     owner_note TEXT DEFAULT '',
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
4. Set `DATABASE_PROVIDER=supabase` in Vercel environment variables

---

## 🌐 Deploying to Vercel

1. Push repo to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add all environment variables in Vercel dashboard:

| Variable | Value |
|---|---|
| `APP_PASSWORD` | your login password |
| `APP_SESSION_TOKEN` | random stable string |
| `DATABASE_PROVIDER` | `supabase` |
| `SUPABASE_URL` | from Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase API settings |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |
| `NEXT_PUBLIC_APP_NAME` | `ZPL Analytics` |

> **Note:** Vercel's filesystem is read-only. All image uploads go to Supabase Storage — the `images` bucket is auto-created as public on first upload.

---

## 🧪 Testing

```bash
# Install Playwright browsers (one-time setup)
npx playwright install chromium

# Run all E2E tests locally (auto-starts dev server)
npm run test:e2e

# Interactive UI mode — watch tests run in browser
npx playwright test --ui

# Run a single test file
npx playwright test tests/e2e/02-dashboard.spec.ts

# Run against Vercel production (PowerShell)
$env:BASE_URL="https://your-app.vercel.app"; npx playwright test

# View HTML report after test run
npx playwright show-report tests/reports/html
```

---

## 🤖 AI Bid Advice — 7-Step Framework

When you click **"AI: Should I bid?"** in the Auction module, the AI applies this decision framework in order:

| Step | What it considers |
|---|---|
| 1 | **Owner Note** — price ceilings (*"max 50L"*), priority flags (*"must have"*, *"avoid"*) |
| 2 | **Owner Star Ratings** — sum of Batting + Bowling + Fielding stars (0–15) |
| 3 | **ZPL 2025 Anchor** — player's 2025 price ±20% adjusted for performance |
| 4 | **Performance Stats** — career runs, avg, SR, wickets, economy, MVP score |
| 5 | **Market Calibration** — recent 2026 purchases: is the auction running hot or cold? |
| 6 | **Budget Risk** — warns if bid consumes >50% of remaining budget |
| 7 | **Max Bid** — synthesized Lakh-rounded recommendation |

Output: `STRONG BID / BID / CAUTIOUS BID / PASS` + max bid price + reasoning + comparable players.

> Players not in the ZPL 2025 database are flagged as **New Player — No ZPL 2025 record** and priced relative to comparable group players.

---

## 📁 Project Structure

```
zpl-analytics/
├── app/
│   ├── api/
│   │   ├── ai/                  # AI endpoints
│   │   │   ├── bid-advice/      # "Should I bid?" — 7-step framework
│   │   │   ├── auction-suggest/ # Team-level strategy
│   │   │   ├── player-analysis/ # Career assessment
│   │   │   └── match-strategy/  # Pre-match plan
│   │   ├── auction/             # Purchase CRUD + undo
│   │   ├── players/             # Player CRUD, stats, remarks
│   │   ├── teams/               # Team CRUD, budget
│   │   ├── upload/              # Image upload → Supabase Storage
│   │   └── player-owner-data/   # Owner star ratings & notes
│   ├── auction/                 # Live auction board page
│   ├── players/                 # Player listing & profiles
│   ├── teams/                   # Team listing & detail
│   ├── matches/                 # Match schedule & scorecards
│   ├── compare/                 # Head-to-head player comparison
│   └── admin/                   # Admin panel
├── components/                  # Reusable UI components
├── lib/
│   ├── db.ts                    # DB adapter selector (SQLite / Supabase)
│   ├── db-sqlite.ts             # SQLite implementation
│   ├── db-supabase.ts           # Supabase implementation
│   ├── zpl2025-db.ts            # ZPL 2025 price database (96 players, 8 teams)
│   ├── ai.ts                    # Anthropic AI helpers
│   ├── types.ts                 # TypeScript interfaces
│   └── schema.ts                # SQLite schema SQL
├── scripts/                     # Seed & migration scripts
├── tests/
│   └── e2e/                     # Playwright E2E test suites
└── public/                      # Static assets
```

---

## 📜 License

Private — Zignuts Technolab internal tool.
