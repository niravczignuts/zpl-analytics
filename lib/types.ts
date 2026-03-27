export interface Season {
  id: string;
  name: string;
  year: number;
  status: 'upcoming' | 'registration' | 'auction' | 'league' | 'playoffs' | 'completed';
  auction_budget: number;
  max_players_per_team: number;
  max_overs: number;
  max_bowler_overs: number;
  rules_json: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  external_id: string | null;
  first_name: string;
  last_name: string;
  gender: string | null;
  photo_url: string | null;
  batting_hand: string | null;
  bowling_style: string | null;
  player_role: string | null;
  name_variants: string | null;
  created_at: string;
}

export interface PlayerWithStats extends Player {
  batting?: BattingStats;
  bowling?: BowlingStats;
  fielding?: FieldingStats;
  mvp?: MvpStats;
  team?: Team;
  purchase_price?: number;
}

export interface SeasonRegistration {
  id: string;
  season_id: string;
  player_id: string;
  group_number: number | null;
  base_price: number | null;
  is_captain_eligible: boolean;
  registration_status: string;
  created_at: string;
}

export interface Team {
  id: string;
  season_id: string;
  name: string;
  short_name: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  logo_url: string | null;
  captain_id: string | null;
  created_at: string;
}

export interface TeamWithSquad extends Team {
  players: PlayerWithStats[];
  budget_used: number;
  budget_remaining: number;
}

export interface AuctionPurchase {
  id: string;
  season_id: string;
  team_id: string;
  player_id: string;
  purchase_price: number;
  purchase_order: number | null;
  group_number: number | null;
  is_captain: boolean;
  created_at: string;
}

export interface BattingStats {
  player_id?: string;
  name?: string;
  team_name?: string;
  total_match: number;
  innings: number;
  total_runs: number;
  highest_run: number;
  average: number;
  not_out: number;
  strike_rate: number;
  ball_faced: number;
  batting_hand?: string;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
}

export interface BowlingStats {
  player_id?: string;
  name?: string;
  team_name?: string;
  total_match: number;
  innings: number;
  total_wickets: number;
  balls: number;
  highest_wicket: number;
  economy: number;
  sr: number;
  maidens: number;
  avg: number;
  runs: number;
  bowling_style?: string;
  overs: number;
  dot_balls: number;
}

export interface FieldingStats {
  player_id?: string;
  name?: string;
  team_name?: string;
  total_match: number;
  catches: number;
  caught_behind: number;
  run_outs: number;
  assist_run_outs: number;
  stumpings: number;
  caught_and_bowl: number;
  total_catches: number;
  total_dismissal: number;
}

export interface MvpStats {
  player_id?: string;
  name?: string;
  team_name?: string;
  player_role?: string;
  bowling_style?: string;
  batting_hand?: string;
  matches: number;
  batting_score: number;
  bowling_score: number;
  fielding_score: number;
  total_score: number;
}

export interface PlayerSeasonStats {
  id: string;
  player_id: string;
  season_id: string;
  stat_type: 'batting' | 'bowling' | 'fielding' | 'mvp';
  stats_json: string;
  created_at: string;
}

export interface Match {
  id: string;
  season_id: string;
  match_number: number | null;
  match_type: 'league' | 'semifinal' | 'eliminator' | 'final';
  team_a_id: string | null;
  team_b_id: string | null;
  toss_winner_id: string | null;
  toss_decision: string | null;
  winner_id: string | null;
  match_date: string | null;
  venue: string | null;
  status: 'upcoming' | 'live' | 'completed';
  result_summary: string | null;
  created_at: string;
}

export interface Innings {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  innings_number: number;
  total_runs: number | null;
  total_wickets: number | null;
  total_overs: number | null;
  extras_json: string | null;
  created_at: string;
}

export interface BudgetInfo {
  team_id: string;
  total_budget: number;
  spent: number;
  remaining: number;
  players_bought: number;
  max_players: number;
  avg_per_remaining_slot: number;
}

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  team_name: string;
  season_id: string;
  stat_value: number;
  stats: BattingStats | BowlingStats | FieldingStats | MvpStats;
}

export type StatType = 'batting' | 'bowling' | 'fielding' | 'mvp';

export interface PlayerOwnerData {
  player_id: string;
  batting_stars: number | null;   // 0–5, null = not rated
  bowling_stars: number | null;
  fielding_stars: number | null;
  owner_note: string;
  grade: string | null;           // e.g. "A", "B+", "C"
  should_buy: boolean | null;     // from "Buy?" column
  overall_rating: number | null;  // numeric rating from registration file
  updated_at: string;
}

export interface PlayerFilters {
  season_id?: string;
  gender?: string;
  player_role?: string;
  team_id?: string;
  search?: string;
}

export interface PointsTableEntry {
  id: string;
  season_id: string;
  team_id: string;
  team_name: string;
  team_color: string;
  matches_played: number;
  wins: number;
  losses: number;
  ties: number;
  no_results: number;
  points: number;
  net_run_rate: number;
}

export interface PlayerRemark {
  id: string;
  player_id: string;
  season_id: string;
  remark_type: string;
  remark: string;
  created_by: string;
  created_at: string;
}
