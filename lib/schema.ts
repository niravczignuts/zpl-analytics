export const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming',
  auction_budget REAL DEFAULT 25000000,
  boys_budget REAL DEFAULT 23000000,
  girls_budget REAL DEFAULT 2000000,
  max_players_per_team INTEGER DEFAULT 12,
  max_overs INTEGER DEFAULT 12,
  max_bowler_overs INTEGER DEFAULT 3,
  rules_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  photo_url TEXT,
  batting_hand TEXT,
  bowling_style TEXT,
  player_role TEXT,
  name_variants TEXT,
  is_strong_buy INTEGER DEFAULT 0,
  budget_range TEXT,
  jersey_number TEXT,
  nationality TEXT,
  age INTEGER,
  experience_years INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_registrations (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  player_id TEXT REFERENCES players(id),
  group_number INTEGER,
  base_price REAL,
  is_captain_eligible INTEGER DEFAULT 0,
  registration_status TEXT DEFAULT 'registered',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, player_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  name TEXT NOT NULL,
  short_name TEXT,
  color_primary TEXT,
  color_secondary TEXT,
  logo_url TEXT,
  captain_id TEXT REFERENCES players(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auction_purchases (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  team_id TEXT REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  purchase_price REAL NOT NULL,
  purchase_order INTEGER,
  group_number INTEGER,
  is_captain INTEGER DEFAULT 0,
  team_role TEXT DEFAULT 'player',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(season_id, player_id)
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id),
  season_id TEXT REFERENCES seasons(id),
  stat_type TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, season_id, stat_type)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  match_number INTEGER,
  match_type TEXT DEFAULT 'league',
  team_a_id TEXT REFERENCES teams(id),
  team_b_id TEXT REFERENCES teams(id),
  toss_winner_id TEXT REFERENCES teams(id),
  toss_decision TEXT,
  winner_id TEXT REFERENCES teams(id),
  match_date TIMESTAMP,
  venue TEXT,
  status TEXT DEFAULT 'upcoming',
  result_summary TEXT,
  match_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS innings (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  batting_team_id TEXT REFERENCES teams(id),
  bowling_team_id TEXT REFERENCES teams(id),
  innings_number INTEGER,
  total_runs INTEGER,
  total_wickets INTEGER,
  total_overs REAL,
  extras_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_batting (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  innings_id TEXT REFERENCES innings(id),
  player_id TEXT REFERENCES players(id),
  team_id TEXT REFERENCES teams(id),
  runs_scored INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  strike_rate REAL,
  dismissal_type TEXT,
  dismissal_bowler_id TEXT,
  dismissal_fielder_id TEXT,
  batting_position INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_bowling (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  innings_id TEXT REFERENCES innings(id),
  player_id TEXT REFERENCES players(id),
  team_id TEXT REFERENCES teams(id),
  overs REAL DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  runs_given INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  economy REAL,
  dot_balls INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_fielding (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  player_id TEXT REFERENCES players(id),
  team_id TEXT REFERENCES teams(id),
  catches INTEGER DEFAULT 0,
  caught_behind INTEGER DEFAULT 0,
  run_outs INTEGER DEFAULT 0,
  stumpings INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_scorecards (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES matches(id),
  season_id TEXT,
  pdf_url TEXT,
  raw_text TEXT,
  scorecard_json TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practice_matches (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  date TIMESTAMP,
  notes TEXT,
  scores_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_remarks (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id),
  season_id TEXT REFERENCES seasons(id),
  remark_type TEXT,
  remark TEXT NOT NULL,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS points_table (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  team_id TEXT REFERENCES teams(id),
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  no_results INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  net_run_rate REAL DEFAULT 0,
  UNIQUE(season_id, team_id)
);

CREATE TABLE IF NOT EXISTS player_owner_data (
  player_id TEXT PRIMARY KEY,
  batting_stars INTEGER,
  bowling_stars INTEGER,
  fielding_stars INTEGER,
  owner_note TEXT DEFAULT '',
  grade TEXT,
  should_buy INTEGER,
  overall_rating REAL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
