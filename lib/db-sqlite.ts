import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SCHEMA_SQL } from './schema';
import type {
  Season, Player, Team, TeamWithSquad, AuctionPurchase, BudgetInfo,
  Match, PlayerSeasonStats, LeaderboardEntry, StatType, PlayerFilters,
  PlayerWithStats, PointsTableEntry, PlayerRemark, SeasonRegistration,
  PlayerOwnerData
} from './types';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.SQLITE_PATH || './data/zpl.db';
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(resolvedPath);
  _db.exec(SCHEMA_SQL);
  // Migrations for existing DBs — ALTER TABLE is a no-op if column already exists would error,
  // so we check the column list first.
  const apCols = (_db.prepare("PRAGMA table_info(auction_purchases)").all() as any[]).map(c => c.name);
  if (!apCols.includes('team_role')) {
    _db.exec("ALTER TABLE auction_purchases ADD COLUMN team_role TEXT DEFAULT 'player'");
  }
  // Migrations for match_batting / match_bowling — add player_name column if missing
  const mbCols = (_db.prepare("PRAGMA table_info(match_batting)").all() as any[]).map(c => c.name);
  if (!mbCols.includes('player_name')) {
    _db.exec("ALTER TABLE match_batting ADD COLUMN player_name TEXT");
  }
  const mbolCols = (_db.prepare("PRAGMA table_info(match_bowling)").all() as any[]).map(c => c.name);
  if (!mbolCols.includes('player_name')) {
    _db.exec("ALTER TABLE match_bowling ADD COLUMN player_name TEXT");
  }
  // Migration: match_notes on matches
  const mCols = (_db.prepare("PRAGMA table_info(matches)").all() as any[]).map(c => c.name);
  if (!mCols.includes('match_notes')) {
    _db.exec("ALTER TABLE matches ADD COLUMN match_notes TEXT");
  }
  // Migrations: extended player profile fields
  const pCols = (_db.prepare("PRAGMA table_info(players)").all() as any[]).map(c => c.name);
  const playerExtras: [string, string][] = [
    ['is_strong_buy', 'INTEGER DEFAULT 0'],
    ['budget_range',  'TEXT'],
    ['jersey_number', 'TEXT'],
    ['nationality',   'TEXT'],
    ['age',           'INTEGER'],
    ['experience_years', 'INTEGER'],
    ['notes',         'TEXT'],
  ];
  for (const [col, def] of playerExtras) {
    if (!pCols.includes(col)) {
      _db.exec(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
    }
  }
  // Migration: player_owner_data table
  try {
    _db.exec(`CREATE TABLE IF NOT EXISTS player_owner_data (
      player_id TEXT PRIMARY KEY,
      batting_stars INTEGER,
      bowling_stars INTEGER,
      fielding_stars INTEGER,
      owner_note TEXT DEFAULT '',
      grade TEXT,
      should_buy INTEGER,
      overall_rating REAL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch {}
  // Migrations for existing player_owner_data rows
  const podCols = (_db.prepare("PRAGMA table_info(player_owner_data)").all() as any[]).map(c => c.name);
  if (!podCols.includes('grade')) _db.exec("ALTER TABLE player_owner_data ADD COLUMN grade TEXT");
  if (!podCols.includes('should_buy')) _db.exec("ALTER TABLE player_owner_data ADD COLUMN should_buy INTEGER");
  if (!podCols.includes('overall_rating')) _db.exec("ALTER TABLE player_owner_data ADD COLUMN overall_rating REAL");
  return _db;
}

export class SQLiteDB {
  private get db() { return getDb(); }

  // ─── Seasons ────────────────────────────────────────────────────────────────
  getSeasons(): Season[] {
    return this.db.prepare('SELECT * FROM seasons ORDER BY year DESC').all() as Season[];
  }

  getSeasonById(id: string): Season | null {
    return (this.db.prepare('SELECT * FROM seasons WHERE id = ?').get(id) as Season) || null;
  }

  getLatestSeason(): Season | null {
    return (this.db.prepare('SELECT * FROM seasons ORDER BY year DESC LIMIT 1').get() as Season) || null;
  }

  createSeason(data: Partial<Season>): Season {
    const id = data.id || uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO seasons (id, name, year, status, auction_budget, max_players_per_team, max_overs, max_bowler_overs, rules_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.year, data.status || 'upcoming',
      data.auction_budget ?? 25000000, data.max_players_per_team ?? 12,
      data.max_overs ?? 12, data.max_bowler_overs ?? 3, data.rules_json || null);
    return this.getSeasonById(id)!;
  }

  updateSeason(id: string, data: Partial<Season>): Season {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
    const values = Object.keys(data).filter(k => k !== 'id').map(k => (data as any)[k]);
    this.db.prepare(`UPDATE seasons SET ${fields} WHERE id = ?`).run(...values, id);
    return this.getSeasonById(id)!;
  }

  // ─── Players ─────────────────────────────────────────────────────────────────
  getPlayers(filters: PlayerFilters = {}): PlayerWithStats[] {
    const params: any[] = [];

    // When a season is given, only return players REGISTERED for that season
    let sql: string;
    if (filters.season_id) {
      sql = `
        SELECT p.*,
          sr.group_number, sr.base_price as registration_base_price,
          ap.purchase_price, ap.team_id as team_id_from_auction,
          t.name as team_name, t.color_primary as team_color
        FROM players p
        JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ?
        LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ?
        LEFT JOIN teams t ON ap.team_id = t.id
        WHERE 1=1
      `;
      params.push(filters.season_id, filters.season_id);
    } else {
      // No season filter — return all players (admin/global view)
      sql = `
        SELECT p.*,
          ap.purchase_price, ap.team_id as team_id_from_auction,
          t.name as team_name, t.color_primary as team_color
        FROM players p
        LEFT JOIN auction_purchases ap ON p.id = ap.player_id
        LEFT JOIN teams t ON ap.team_id = t.id
        WHERE 1=1
      `;
    }

    if (filters.gender) { sql += ' AND p.gender = ?'; params.push(filters.gender); }
    if (filters.player_role) { sql += ' AND p.player_role = ?'; params.push(filters.player_role); }
    if (filters.search) {
      sql += ' AND (p.first_name LIKE ? OR p.last_name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    sql += ' ORDER BY p.first_name, p.last_name';
    return this.db.prepare(sql).all(...params) as PlayerWithStats[];
  }

  getPlayerById(id: string): Player | null {
    return (this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as Player) || null;
  }

  createPlayer(data: Partial<Player>): Player {
    const id = data.id || uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO players (id, external_id, first_name, last_name, gender, photo_url, batting_hand, bowling_style, player_role, name_variants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.external_id || null, data.first_name, data.last_name,
      data.gender || null, data.photo_url || null, data.batting_hand || null,
      data.bowling_style || null, data.player_role || null, data.name_variants || null);
    return this.getPlayerById(id)!;
  }

  updatePlayer(id: string, data: Partial<Player>): Player {
    const allowed = ['first_name','last_name','gender','photo_url','batting_hand','bowling_style','player_role','name_variants','external_id'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return this.getPlayerById(id)!;
    const fields = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    this.db.prepare(`UPDATE players SET ${fields} WHERE id = ?`).run(...values, id);
    return this.getPlayerById(id)!;
  }

  bulkImportPlayers(players: Partial<Player>[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO players (id, external_id, first_name, last_name, gender, photo_url, batting_hand, bowling_style, player_role, name_variants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((rows: Partial<Player>[]) => {
      for (const p of rows) {
        const id = p.id || uuidv4();
        stmt.run(id, p.external_id || null, p.first_name, p.last_name,
          p.gender || null, p.photo_url || null, p.batting_hand || null,
          p.bowling_style || null, p.player_role || null, p.name_variants || null);
      }
    });
    insertMany(players);
  }

  // ─── Registrations ───────────────────────────────────────────────────────────
  clearRegistrations(seasonId: string): void {
    // Preserve not_for_sale entries (captains/managers) — they are set by team-role assignment, not registration import
    this.db.prepare(
      "DELETE FROM season_registrations WHERE season_id = ? AND registration_status != 'not_for_sale'"
    ).run(seasonId);
  }

  getRegistrations(seasonId: string): SeasonRegistration[] {
    return this.db.prepare('SELECT * FROM season_registrations WHERE season_id = ?').all(seasonId) as SeasonRegistration[];
  }

  upsertRegistration(data: Partial<SeasonRegistration>): void {
    const id = data.id || uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO season_registrations (id, season_id, player_id, group_number, base_price, is_captain_eligible, registration_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.season_id, data.player_id, data.group_number || null,
      data.base_price || null, data.is_captain_eligible ? 1 : 0,
      data.registration_status || 'registered');
  }

  // ─── Teams ───────────────────────────────────────────────────────────────────
  getTeams(seasonId: string): Team[] {
    return this.db.prepare('SELECT * FROM teams WHERE season_id = ? ORDER BY name').all(seasonId) as Team[];
  }

  getTeamById(id: string): Team | null {
    return (this.db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as Team) || null;
  }

  getTeamWithSquad(teamId: string, seasonId?: string): TeamWithSquad | null {
    const team = this.getTeamById(teamId);
    if (!team) return null;
    const sid = seasonId || team.season_id;
    const season = this.getSeasonById(sid);
    const budget = season?.auction_budget || 25000000;

    const players = this.db.prepare(`
      SELECT p.*, ap.purchase_price, ap.group_number, ap.is_captain, ap.team_role,
        pss_bat.stats_json as batting_json,
        pss_bowl.stats_json as bowling_json,
        pss_field.stats_json as fielding_json,
        pss_mvp.stats_json as mvp_json
      FROM auction_purchases ap
      JOIN players p ON ap.player_id = p.id
      LEFT JOIN player_season_stats pss_bat ON p.id = pss_bat.player_id AND pss_bat.stat_type = 'batting'
        AND pss_bat.season_id = (SELECT MAX(s2.season_id) FROM player_season_stats s2 WHERE s2.player_id = p.id AND s2.stat_type = 'batting')
      LEFT JOIN player_season_stats pss_bowl ON p.id = pss_bowl.player_id AND pss_bowl.stat_type = 'bowling'
        AND pss_bowl.season_id = (SELECT MAX(s2.season_id) FROM player_season_stats s2 WHERE s2.player_id = p.id AND s2.stat_type = 'bowling')
      LEFT JOIN player_season_stats pss_field ON p.id = pss_field.player_id AND pss_field.stat_type = 'fielding'
        AND pss_field.season_id = (SELECT MAX(s2.season_id) FROM player_season_stats s2 WHERE s2.player_id = p.id AND s2.stat_type = 'fielding')
      LEFT JOIN player_season_stats pss_mvp ON p.id = pss_mvp.player_id AND pss_mvp.stat_type = 'mvp'
        AND pss_mvp.season_id = (SELECT MAX(s2.season_id) FROM player_season_stats s2 WHERE s2.player_id = p.id AND s2.stat_type = 'mvp')
      WHERE ap.team_id = ? AND ap.season_id = ?
      ORDER BY ap.purchase_order
    `).all(teamId, sid) as any[];

    const budget_used = players.reduce((s, p) => s + (p.purchase_price || 0), 0);
    return {
      ...team,
      players: players.map(p => ({
        ...p,
        batting: p.batting_json ? JSON.parse(p.batting_json) : null,
        bowling: p.bowling_json ? JSON.parse(p.bowling_json) : null,
        fielding: p.fielding_json ? JSON.parse(p.fielding_json) : null,
        mvp: p.mvp_json ? JSON.parse(p.mvp_json) : null,
      })),
      budget_used,
      budget_remaining: budget - budget_used,
    };
  }

  createTeam(data: Partial<Team>): Team {
    const id = data.id || uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO teams (id, season_id, name, short_name, color_primary, color_secondary, logo_url, captain_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.season_id, data.name, data.short_name || null,
      data.color_primary || null, data.color_secondary || null,
      data.logo_url || null, data.captain_id || null);
    return this.getTeamById(id)!;
  }

  updateTeam(id: string, data: Partial<Team>): Team {
    const allowed = ['name','short_name','color_primary','color_secondary','logo_url','captain_id'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return this.getTeamById(id)!;
    const fields = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    this.db.prepare(`UPDATE teams SET ${fields} WHERE id = ?`).run(...values, id);
    return this.getTeamById(id)!;
  }

  // ─── Auction ─────────────────────────────────────────────────────────────────
  clearAuctionPurchases(seasonId: string): void {
    // Preserve captain/manager pre-assignments — they are set by team-role assignment, not auction import
    this.db.prepare(
      "DELETE FROM auction_purchases WHERE season_id = ? AND (team_role IS NULL OR team_role = 'player')"
    ).run(seasonId);
  }

  recordPurchase(data: Partial<AuctionPurchase> & { team_role?: string }): AuctionPurchase {
    const id = data.id || uuidv4();
    const maxOrder = (this.db.prepare(
      'SELECT MAX(purchase_order) as mo FROM auction_purchases WHERE season_id = ?'
    ).get(data.season_id) as any)?.mo || 0;

    this.db.prepare(`
      INSERT OR REPLACE INTO auction_purchases (id, season_id, team_id, player_id, purchase_price, purchase_order, group_number, is_captain, team_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.season_id, data.team_id, data.player_id, data.purchase_price,
      data.purchase_order || maxOrder + 1, data.group_number || null, data.is_captain ? 1 : 0,
      data.team_role || 'player');
    return this.db.prepare('SELECT * FROM auction_purchases WHERE id = ?').get(id) as AuctionPurchase;
  }

  deletePurchase(id: string): void {
    this.db.prepare('DELETE FROM auction_purchases WHERE id = ?').run(id);
  }

  getTeamBudget(teamId: string, seasonId: string): BudgetInfo {
    const season = this.db.prepare(
      'SELECT auction_budget, max_players_per_team FROM seasons s JOIN teams t ON t.season_id = s.id WHERE t.id = ?'
    ).get(teamId) as any;
    const budget = season?.auction_budget || 25000000;
    const maxPlayers = season?.max_players_per_team || 12;

    const result = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as spent
      FROM auction_purchases WHERE team_id = ? AND season_id = ?
    `).get(teamId, seasonId) as any;

    const spent = result?.spent || 0;
    const bought = result?.count || 0;
    const remaining = budget - spent;
    const slotsLeft = maxPlayers - bought;

    return {
      team_id: teamId,
      total_budget: budget,
      spent,
      remaining,
      players_bought: bought,
      max_players: maxPlayers,
      avg_per_remaining_slot: slotsLeft > 0 ? remaining / slotsLeft : 0,
    };
  }

  getAuctionPurchases(seasonId: string): (AuctionPurchase & { player_name: string; team_name: string })[] {
    return this.db.prepare(`
      SELECT ap.*, p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name, t.color_primary as team_color, ap.team_role
      FROM auction_purchases ap
      JOIN players p ON ap.player_id = p.id
      JOIN teams t ON ap.team_id = t.id
      WHERE ap.season_id = ?
      ORDER BY ap.purchase_order
    `).all(seasonId) as any[];
  }

  getAvailablePlayers(seasonId: string): PlayerWithStats[] {
    // Join with ALL seasons' stats (not just current) so auction page can show historical performance
    const players = this.db.prepare(`
      SELECT p.*, sr.group_number, sr.base_price, sr.is_captain_eligible, sr.registration_status
      FROM players p
      JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ?
      WHERE p.id NOT IN (
        SELECT player_id FROM auction_purchases WHERE season_id = ?
      )
      AND sr.registration_status != 'not_for_sale'
      ORDER BY sr.group_number, p.first_name
    `).all(seasonId, seasonId) as PlayerWithStats[];

    // Attach latest available batting/bowling/mvp stats for each player (from any season)
    return players.map(p => {
      const statRows = this.db.prepare(`
        SELECT stat_type, stats_json, season_id FROM player_season_stats
        WHERE player_id = ? ORDER BY season_id DESC
      `).all(p.id) as any[];

      const batting = statRows.find(r => r.stat_type === 'batting');
      const bowling = statRows.find(r => r.stat_type === 'bowling');
      const mvp = statRows.find(r => r.stat_type === 'mvp');

      return {
        ...p,
        batting: batting ? JSON.parse(batting.stats_json) : null,
        bowling: bowling ? JSON.parse(bowling.stats_json) : null,
        mvp: mvp ? JSON.parse(mvp.stats_json) : null,
      };
    });
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────
  clearPlayerStats(seasonId: string, statType: StatType): void {
    this.db.prepare('DELETE FROM player_season_stats WHERE season_id = ? AND stat_type = ?').run(seasonId, statType);
  }

  getPlayerStats(playerId: string, seasonId?: string): Record<string, any> {
    let sql = 'SELECT * FROM player_season_stats WHERE player_id = ?';
    const params: any[] = [playerId];
    if (seasonId) { sql += ' AND season_id = ?'; params.push(seasonId); }
    const rows = this.db.prepare(sql).all(...params) as PlayerSeasonStats[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      if (!result[row.season_id]) result[row.season_id] = {};
      result[row.season_id][row.stat_type] = JSON.parse(row.stats_json);
    }
    return result;
  }

  upsertPlayerStats(playerId: string, seasonId: string, statType: StatType, stats: any): void {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO player_season_stats (id, player_id, season_id, stat_type, stats_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(player_id, season_id, stat_type) DO UPDATE SET stats_json = excluded.stats_json
    `).run(id, playerId, seasonId, statType, JSON.stringify(stats));
  }

  bulkImportStats(stats: { player_id: string; season_id: string; stat_type: StatType; stats: any }[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO player_season_stats (id, player_id, season_id, stat_type, stats_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(player_id, season_id, stat_type) DO UPDATE SET stats_json = excluded.stats_json
    `);
    const run = this.db.transaction(() => {
      for (const s of stats) stmt.run(uuidv4(), s.player_id, s.season_id, s.stat_type, JSON.stringify(s.stats));
    });
    run();
  }

  getSeasonLeaderboard(seasonId: string, statType: StatType): LeaderboardEntry[] {
    const rows = this.db.prepare(`
      SELECT pss.*, p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name, t.color_primary as team_color
      FROM player_season_stats pss
      JOIN players p ON pss.player_id = p.id
      LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = pss.season_id
      LEFT JOIN teams t ON ap.team_id = t.id
      WHERE pss.season_id = ? AND pss.stat_type = ?
    `).all(seasonId, statType) as any[];

    return rows.map(r => {
      const stats = JSON.parse(r.stats_json);
      let stat_value = 0;
      if (statType === 'batting') stat_value = stats.total_runs || 0;
      if (statType === 'bowling') stat_value = stats.total_wickets || 0;
      if (statType === 'fielding') stat_value = stats.total_dismissal || 0;
      if (statType === 'mvp') stat_value = stats.total_score || 0;
      return { player_id: r.player_id, player_name: r.player_name, team_name: r.team_name, season_id: r.season_id, stat_value, stats };
    }).sort((a, b) => b.stat_value - a.stat_value);
  }

  // ─── Matches ─────────────────────────────────────────────────────────────────
  getMatches(seasonId: string): Match[] {
    return this.db.prepare(`
      SELECT m.*, ta.name as team_a_name, tb.name as team_b_name,
        ta.color_primary as team_a_color, tb.color_primary as team_b_color,
        w.name as winner_name
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      LEFT JOIN teams w ON m.winner_id = w.id
      WHERE m.season_id = ?
      ORDER BY m.match_date, m.match_number
    `).all(seasonId) as Match[];
  }

  getMatchById(id: string): Match | null {
    return (this.db.prepare(`
      SELECT m.*, ta.name as team_a_name, tb.name as team_b_name,
        ta.color_primary as team_a_color, tb.color_primary as team_b_color
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      WHERE m.id = ?
    `).get(id) as Match) || null;
  }

  createMatch(data: Partial<Match>): Match {
    const id = data.id || uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO matches (id, season_id, match_number, match_type, team_a_id, team_b_id, match_date, venue, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.season_id, data.match_number || null, data.match_type || 'league',
      data.team_a_id || null, data.team_b_id || null, data.match_date || null,
      data.venue || null, data.status || 'upcoming');
    return this.getMatchById(id)!;
  }

  updateMatch(id: string, data: Partial<Match>): Match {
    const allowed = ['match_number','match_type','team_a_id','team_b_id','toss_winner_id','toss_decision','winner_id','match_date','venue','status','result_summary'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return this.getMatchById(id)!;
    const fields = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    this.db.prepare(`UPDATE matches SET ${fields} WHERE id = ?`).run(...values, id);
    return this.getMatchById(id)!;
  }

  deleteMatch(id: string): void {
    // Cascade: remove every piece of match-related data atomically
    this.db.transaction(() => {
      // Get innings IDs first for targeted batting/bowling cleanup
      const inningsRows = this.db.prepare(
        'SELECT id FROM innings WHERE match_id = ?'
      ).all(id) as { id: string }[];
      for (const inn of inningsRows) {
        this.db.prepare('DELETE FROM match_batting  WHERE innings_id = ?').run(inn.id);
        this.db.prepare('DELETE FROM match_bowling  WHERE innings_id = ?').run(inn.id);
      }
      // Catch any rows linked only by match_id (no innings_id)
      this.db.prepare('DELETE FROM match_batting    WHERE match_id = ?').run(id);
      this.db.prepare('DELETE FROM match_bowling    WHERE match_id = ?').run(id);
      this.db.prepare('DELETE FROM innings          WHERE match_id = ?').run(id);
      this.db.prepare('DELETE FROM match_scorecards WHERE match_id = ?').run(id);
      this.db.prepare('DELETE FROM matches          WHERE id = ?').run(id);
    })();
  }

  // ─── Points Table ──────────────────────────────────────────────────────────
  getPointsTable(seasonId: string): PointsTableEntry[] {
    return this.db.prepare(`
      SELECT pt.*, t.name as team_name, t.color_primary as team_color, t.short_name as team_short_name
      FROM points_table pt
      JOIN teams t ON pt.team_id = t.id
      WHERE pt.season_id = ?
      ORDER BY pt.points DESC, pt.net_run_rate DESC
    `).all(seasonId) as PointsTableEntry[];
  }

  upsertPointsTable(seasonId: string, teamId: string, data: Partial<PointsTableEntry>): void {
    this.db.prepare(`
      INSERT INTO points_table (id, season_id, team_id, matches_played, wins, losses, ties, no_results, points, net_run_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(season_id, team_id) DO UPDATE SET
        matches_played = excluded.matches_played,
        wins = excluded.wins, losses = excluded.losses,
        ties = excluded.ties, no_results = excluded.no_results,
        points = excluded.points, net_run_rate = excluded.net_run_rate
    `).run(uuidv4(), seasonId, teamId,
      data.matches_played || 0, data.wins || 0, data.losses || 0,
      data.ties || 0, data.no_results || 0, data.points || 0, data.net_run_rate || 0);
  }

  // ─── Player Remarks ───────────────────────────────────────────────────────
  getPlayerRemarks(playerId: string): PlayerRemark[] {
    return this.db.prepare('SELECT * FROM player_remarks WHERE player_id = ? ORDER BY created_at DESC').all(playerId) as PlayerRemark[];
  }

  createRemark(data: Partial<PlayerRemark>): PlayerRemark {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO player_remarks (id, player_id, season_id, remark_type, remark, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.player_id, data.season_id || null, data.remark_type || 'general', data.remark, data.created_by || 'admin');
    return this.db.prepare('SELECT * FROM player_remarks WHERE id = ?').get(id) as PlayerRemark;
  }

  // ─── Scorecards ───────────────────────────────────────────────────────────
  getScorecardByMatchId(matchId: string): any | null {
    return this.db.prepare('SELECT * FROM match_scorecards WHERE match_id = ?').get(matchId) || null;
  }

  upsertScorecard(data: {
    match_id: string; season_id?: string; pdf_url?: string;
    raw_text?: string; scorecard_json: string; ai_analysis?: string;
  }): void {
    const existing = this.getScorecardByMatchId(data.match_id);
    if (existing) {
      this.db.prepare(`
        UPDATE match_scorecards SET scorecard_json=?, ai_analysis=?, raw_text=?, pdf_url=? WHERE match_id=?
      `).run(data.scorecard_json, data.ai_analysis || null, data.raw_text || null, data.pdf_url || null, data.match_id);
    } else {
      this.db.prepare(`
        INSERT INTO match_scorecards (id, match_id, season_id, pdf_url, raw_text, scorecard_json, ai_analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), data.match_id, data.season_id || null, data.pdf_url || null,
        data.raw_text || null, data.scorecard_json, data.ai_analysis || null);
    }
  }

  saveInnings(data: {
    match_id: string; batting_team_id: string | null; bowling_team_id: string | null;
    innings_number: number; total_runs: number; total_wickets: number; total_overs: number; extras_json?: string;
  }): string {
    // Delete existing innings for this match+number so we can re-import
    this.db.prepare('DELETE FROM innings WHERE match_id = ? AND innings_number = ?').run(data.match_id, data.innings_number);
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO innings (id, match_id, batting_team_id, bowling_team_id, innings_number, total_runs, total_wickets, total_overs, extras_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.match_id, data.batting_team_id, data.bowling_team_id,
      data.innings_number, data.total_runs, data.total_wickets, data.total_overs,
      data.extras_json || null);
    return id;
  }

  saveMatchBatting(rows: {
    match_id: string; innings_id: string; player_id: string | null; player_name: string;
    team_id: string | null; runs_scored: number; balls_faced: number; fours: number; sixes: number;
    strike_rate: number; dismissal_type?: string; dismissal_bowler_id?: string | null;
    dismissal_fielder_id?: string | null; batting_position: number;
  }[]): void {
    // Clear existing batting for this innings
    if (rows.length > 0) {
      this.db.prepare('DELETE FROM match_batting WHERE innings_id = ?').run(rows[0].innings_id);
    }
    const stmt = this.db.prepare(`
      INSERT INTO match_batting (id, match_id, innings_id, player_id, player_name, team_id, runs_scored, balls_faced,
        fours, sixes, strike_rate, dismissal_type, dismissal_bowler_id, dismissal_fielder_id, batting_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const run = this.db.transaction(() => {
      for (const r of rows) {
        stmt.run(uuidv4(), r.match_id, r.innings_id, r.player_id, r.player_name,
          r.team_id, r.runs_scored, r.balls_faced, r.fours, r.sixes,
          r.strike_rate, r.dismissal_type || null, r.dismissal_bowler_id || null,
          r.dismissal_fielder_id || null, r.batting_position);
      }
    });
    run();
  }

  saveMatchBowling(rows: {
    match_id: string; innings_id: string; player_id: string | null; player_name: string;
    team_id: string | null; overs: number; maidens: number; runs_given: number; wickets: number;
    economy: number; dot_balls?: number; wides?: number; no_balls?: number;
  }[]): void {
    if (rows.length > 0) {
      this.db.prepare('DELETE FROM match_bowling WHERE innings_id = ?').run(rows[0].innings_id);
    }
    const stmt = this.db.prepare(`
      INSERT INTO match_bowling (id, match_id, innings_id, player_id, player_name, team_id, overs, maidens, runs_given, wickets, economy, dot_balls, wides, no_balls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const run = this.db.transaction(() => {
      for (const r of rows) {
        stmt.run(uuidv4(), r.match_id, r.innings_id, r.player_id, r.player_name,
          r.team_id, r.overs, r.maidens, r.runs_given, r.wickets, r.economy,
          r.dot_balls || 0, r.wides || 0, r.no_balls || 0);
      }
    });
    run();
  }

  getMatchInningsWithScores(matchId: string): any[] {
    const innings = this.db.prepare('SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number').all(matchId);
    return innings.map((inn: any) => {
      const batting = this.db.prepare(
        'SELECT * FROM match_batting WHERE innings_id = ? ORDER BY batting_position'
      ).all(inn.id);
      const bowling = this.db.prepare(
        'SELECT * FROM match_bowling WHERE innings_id = ? ORDER BY overs DESC'
      ).all(inn.id);
      return { ...inn, batting, bowling };
    });
  }

  getPlayerMatchHistory(playerId: string, limit = 10): any[] {
    return this.db.prepare(`
      SELECT mb.*, m.match_date, m.match_type, m.match_number,
        ta.name as team_a_name, tb.name as team_b_name,
        t.name as batting_team_name
      FROM match_batting mb
      JOIN matches m ON mb.match_id = m.id
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      LEFT JOIN teams t ON mb.team_id = t.id
      WHERE mb.player_id = ?
      ORDER BY m.match_date DESC
      LIMIT ?
    `).all(playerId, limit) as any[];
  }

  getPlayerBowlingHistory(playerId: string, limit = 10): any[] {
    return this.db.prepare(`
      SELECT mb.*, m.match_date, m.match_type, m.match_number,
        ta.name as team_a_name, tb.name as team_b_name
      FROM match_bowling mb
      JOIN matches m ON mb.match_id = m.id
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      WHERE mb.player_id = ?
      ORDER BY m.match_date DESC
      LIMIT ?
    `).all(playerId, limit) as any[];
  }

  // Find player by name (fuzzy) — returns best match or null
  findPlayerByName(name: string): Player | null {
    const cleaned = name.trim().toLowerCase();
    const parts = cleaned.split(/\s+/);
    // Try exact full name match
    const exact = this.db.prepare(
      "SELECT * FROM players WHERE LOWER(first_name || ' ' || last_name) = ?"
    ).get(cleaned) as Player | undefined;
    if (exact) return exact;
    // Try first+last partial
    if (parts.length >= 2) {
      const partial = this.db.prepare(
        "SELECT * FROM players WHERE LOWER(first_name) = ? AND LOWER(last_name) = ?"
      ).get(parts[0], parts[parts.length - 1]) as Player | undefined;
      if (partial) return partial;
    }
    // Try name_variants
    const allPlayers = this.db.prepare('SELECT * FROM players WHERE name_variants IS NOT NULL').all() as Player[];
    for (const p of allPlayers) {
      const variants = (p.name_variants || '').toLowerCase().split(',').map((v: string) => v.trim());
      if (variants.some(v => v === cleaned || v.includes(cleaned) || cleaned.includes(v))) {
        return p;
      }
    }
    // Try any part of the name
    if (parts.length >= 2) {
      const byFirst = this.db.prepare(
        "SELECT * FROM players WHERE LOWER(first_name) LIKE ? LIMIT 1"
      ).get(`${parts[0]}%`) as Player | undefined;
      if (byFirst) return byFirst;
    }
    return null;
  }

  // ─── Util ─────────────────────────────────────────────────────────────────
  rawQuery(sql: string, params: any[] = []): any[] {
    return this.db.prepare(sql).all(...params);
  }

  rawRun(sql: string, params: any[] = []): void {
    this.db.prepare(sql).run(...params);
  }

  getDashboardStats(seasonId: string) {
    const totalPlayers = (this.db.prepare('SELECT COUNT(*) as c FROM season_registrations WHERE season_id = ?').get(seasonId) as any)?.c || 0;
    const totalTeams = (this.db.prepare('SELECT COUNT(*) as c FROM teams WHERE season_id = ?').get(seasonId) as any)?.c || 0;
    const totalMatches = (this.db.prepare('SELECT COUNT(*) as c FROM matches WHERE season_id = ?').get(seasonId) as any)?.c || 0;
    const completedMatches = (this.db.prepare("SELECT COUNT(*) as c FROM matches WHERE season_id = ? AND status = 'completed'").get(seasonId) as any)?.c || 0;
    return { totalPlayers, totalTeams, totalMatches, completedMatches };
  }

  getLatestPlayerRegistration(playerId: string): { base_price: number | null } | null {
    const row = this.db.prepare(
      'SELECT base_price FROM season_registrations WHERE player_id = ? ORDER BY season_id DESC LIMIT 1'
    ).get(playerId) as any;
    return row || null;
  }

  // ─── Player Owner Data ───────────────────────────────────────────────────────
  getPlayerOwnerData(playerId: string): PlayerOwnerData | null {
    const row = this.db.prepare('SELECT * FROM player_owner_data WHERE player_id = ?').get(playerId) as any;
    return row || null;
  }

  getPlayerOwnerDataBulk(playerIds: string[]): Record<string, PlayerOwnerData> {
    if (!playerIds.length) return {};
    const placeholders = playerIds.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT * FROM player_owner_data WHERE player_id IN (${placeholders})`).all(...playerIds) as any[];
    const result: Record<string, PlayerOwnerData> = {};
    for (const row of rows) result[row.player_id] = row;
    return result;
  }

  upsertPlayerOwnerData(data: Partial<PlayerOwnerData> & { player_id: string }): PlayerOwnerData {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO player_owner_data (player_id, batting_stars, bowling_stars, fielding_stars, owner_note, grade, should_buy, overall_rating, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        batting_stars = COALESCE(excluded.batting_stars, batting_stars),
        bowling_stars = COALESCE(excluded.bowling_stars, bowling_stars),
        fielding_stars = COALESCE(excluded.fielding_stars, fielding_stars),
        owner_note = CASE WHEN excluded.owner_note != '' THEN excluded.owner_note ELSE owner_note END,
        grade = COALESCE(excluded.grade, grade),
        should_buy = COALESCE(excluded.should_buy, should_buy),
        overall_rating = COALESCE(excluded.overall_rating, overall_rating),
        updated_at = excluded.updated_at
    `).run(
      data.player_id,
      data.batting_stars ?? null,
      data.bowling_stars ?? null,
      data.fielding_stars ?? null,
      data.owner_note ?? '',
      data.grade ?? null,
      data.should_buy != null ? (data.should_buy ? 1 : 0) : null,
      data.overall_rating ?? null,
      now
    );
    return this.getPlayerOwnerData(data.player_id)!;
  }
}
