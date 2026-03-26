-- ============================================================
-- ZPL Analytics — Supabase / PostgreSQL Schema
-- Run this entire script in: Supabase → SQL Editor → New query
-- ============================================================

-- Enable UUID extension (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Seasons ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  year          INTEGER NOT NULL,
  status        TEXT DEFAULT 'upcoming',
  auction_budget DOUBLE PRECISION DEFAULT 25000000,
  max_players_per_team INTEGER DEFAULT 12,
  max_overs     INTEGER DEFAULT 12,
  max_bowler_overs INTEGER DEFAULT 3,
  rules_json    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Players ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,
  external_id     TEXT,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  gender          TEXT,
  photo_url       TEXT,
  batting_hand    TEXT,
  bowling_style   TEXT,
  player_role     TEXT,
  name_variants   TEXT,
  is_strong_buy   INTEGER DEFAULT 0,
  budget_range    TEXT,
  jersey_number   TEXT,
  nationality     TEXT,
  age             INTEGER,
  experience_years INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Season Registrations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_registrations (
  id                  TEXT PRIMARY KEY,
  season_id           TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  player_id           TEXT REFERENCES players(id) ON DELETE CASCADE,
  group_number        INTEGER,
  base_price          DOUBLE PRECISION,
  is_captain_eligible INTEGER DEFAULT 0,
  registration_status TEXT DEFAULT 'registered',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, player_id)
);

-- ── Teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id              TEXT PRIMARY KEY,
  season_id       TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  short_name      TEXT,
  color_primary   TEXT,
  color_secondary TEXT,
  logo_url        TEXT,
  captain_id      TEXT REFERENCES players(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auction Purchases ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_purchases (
  id             TEXT PRIMARY KEY,
  season_id      TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  team_id        TEXT REFERENCES teams(id) ON DELETE CASCADE,
  player_id      TEXT REFERENCES players(id) ON DELETE CASCADE,
  purchase_price DOUBLE PRECISION NOT NULL,
  purchase_order INTEGER,
  group_number   INTEGER,
  is_captain     INTEGER DEFAULT 0,
  team_role      TEXT DEFAULT 'player',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, player_id)
);

-- ── Player Season Stats ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_season_stats (
  id         TEXT PRIMARY KEY,
  player_id  TEXT REFERENCES players(id) ON DELETE CASCADE,
  season_id  TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  stat_type  TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season_id, stat_type)
);

-- ── Matches ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id              TEXT PRIMARY KEY,
  season_id       TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  match_number    INTEGER,
  match_type      TEXT DEFAULT 'league',
  team_a_id       TEXT REFERENCES teams(id) ON DELETE SET NULL,
  team_b_id       TEXT REFERENCES teams(id) ON DELETE SET NULL,
  toss_winner_id  TEXT REFERENCES teams(id) ON DELETE SET NULL,
  toss_decision   TEXT,
  winner_id       TEXT REFERENCES teams(id) ON DELETE SET NULL,
  match_date      TIMESTAMPTZ,
  venue           TEXT,
  status          TEXT DEFAULT 'upcoming',
  result_summary  TEXT,
  match_notes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Innings ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS innings (
  id              TEXT PRIMARY KEY,
  match_id        TEXT REFERENCES matches(id) ON DELETE CASCADE,
  batting_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  bowling_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  innings_number  INTEGER,
  total_runs      INTEGER,
  total_wickets   INTEGER,
  total_overs     DOUBLE PRECISION,
  extras_json     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Match Batting ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_batting (
  id                   TEXT PRIMARY KEY,
  match_id             TEXT REFERENCES matches(id) ON DELETE CASCADE,
  innings_id           TEXT REFERENCES innings(id) ON DELETE CASCADE,
  player_id            TEXT REFERENCES players(id) ON DELETE SET NULL,
  player_name          TEXT,
  team_id              TEXT REFERENCES teams(id) ON DELETE SET NULL,
  runs_scored          INTEGER DEFAULT 0,
  balls_faced          INTEGER DEFAULT 0,
  fours                INTEGER DEFAULT 0,
  sixes                INTEGER DEFAULT 0,
  strike_rate          DOUBLE PRECISION,
  dismissal_type       TEXT,
  dismissal_bowler_id  TEXT,
  dismissal_fielder_id TEXT,
  batting_position     INTEGER,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Match Bowling ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_bowling (
  id          TEXT PRIMARY KEY,
  match_id    TEXT REFERENCES matches(id) ON DELETE CASCADE,
  innings_id  TEXT REFERENCES innings(id) ON DELETE CASCADE,
  player_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
  player_name TEXT,
  team_id     TEXT REFERENCES teams(id) ON DELETE SET NULL,
  overs       DOUBLE PRECISION DEFAULT 0,
  maidens     INTEGER DEFAULT 0,
  runs_given  INTEGER DEFAULT 0,
  wickets     INTEGER DEFAULT 0,
  economy     DOUBLE PRECISION,
  dot_balls   INTEGER DEFAULT 0,
  wides       INTEGER DEFAULT 0,
  no_balls    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Match Fielding ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_fielding (
  id            TEXT PRIMARY KEY,
  match_id      TEXT REFERENCES matches(id) ON DELETE CASCADE,
  player_id     TEXT REFERENCES players(id) ON DELETE SET NULL,
  team_id       TEXT REFERENCES teams(id) ON DELETE SET NULL,
  catches       INTEGER DEFAULT 0,
  caught_behind INTEGER DEFAULT 0,
  run_outs      INTEGER DEFAULT 0,
  stumpings     INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Match Scorecards ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_scorecards (
  id             TEXT PRIMARY KEY,
  match_id       TEXT REFERENCES matches(id) ON DELETE CASCADE,
  season_id      TEXT,
  pdf_url        TEXT,
  raw_text       TEXT,
  scorecard_json TEXT,
  ai_analysis    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Practice Matches ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_matches (
  id          TEXT PRIMARY KEY,
  season_id   TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  date        TIMESTAMPTZ,
  notes       TEXT,
  scores_json TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Player Remarks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_remarks (
  id           TEXT PRIMARY KEY,
  player_id    TEXT REFERENCES players(id) ON DELETE CASCADE,
  season_id    TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  remark_type  TEXT,
  remark       TEXT NOT NULL,
  created_by   TEXT DEFAULT 'admin',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Points Table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_table (
  id             TEXT PRIMARY KEY,
  season_id      TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  team_id        TEXT REFERENCES teams(id) ON DELETE CASCADE,
  matches_played INTEGER DEFAULT 0,
  wins           INTEGER DEFAULT 0,
  losses         INTEGER DEFAULT 0,
  ties           INTEGER DEFAULT 0,
  no_results     INTEGER DEFAULT 0,
  points         INTEGER DEFAULT 0,
  net_run_rate   DOUBLE PRECISION DEFAULT 0,
  UNIQUE(season_id, team_id)
);

-- ── Row Level Security (disable for server-side access) ──────────────────────
-- The app uses a server-side POSTGRES_URL (pooler) — RLS not needed.
-- If you want RLS, enable it per table and create policies.
ALTER TABLE seasons              DISABLE ROW LEVEL SECURITY;
ALTER TABLE players              DISABLE ROW LEVEL SECURITY;
ALTER TABLE season_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams                DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_purchases    DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats  DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches              DISABLE ROW LEVEL SECURITY;
ALTER TABLE innings              DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_batting        DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_bowling        DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_fielding       DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_scorecards     DISABLE ROW LEVEL SECURITY;
ALTER TABLE practice_matches     DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_remarks       DISABLE ROW LEVEL SECURITY;
ALTER TABLE points_table         DISABLE ROW LEVEL SECURITY;

-- ── Indexes for performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_teams_season            ON teams(season_id);
CREATE INDEX IF NOT EXISTS idx_auction_season          ON auction_purchases(season_id);
CREATE INDEX IF NOT EXISTS idx_auction_team            ON auction_purchases(team_id);
CREATE INDEX IF NOT EXISTS idx_pss_player              ON player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_pss_season_type         ON player_season_stats(season_id, stat_type);
CREATE INDEX IF NOT EXISTS idx_matches_season          ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_registrations_season    ON season_registrations(season_id);
CREATE INDEX IF NOT EXISTS idx_remarks_player          ON player_remarks(player_id);
