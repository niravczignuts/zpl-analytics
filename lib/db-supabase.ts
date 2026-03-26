import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import type {
  Season, Player, Team, TeamWithSquad, AuctionPurchase, BudgetInfo,
  Match, PlayerSeasonStats, LeaderboardEntry, StatType, PlayerFilters,
  PlayerWithStats, PointsTableEntry, PlayerRemark, SeasonRegistration
} from './types';

const sql = postgres(process.env.POSTGRES_URL!, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export class SupabaseDB {

  // ─── Seasons ────────────────────────────────────────────────────────────────

  async getSeasons(): Promise<Season[]> {
    return await sql<Season[]>`SELECT * FROM seasons ORDER BY year DESC`;
  }

  async getSeasonById(id: string): Promise<Season | null> {
    return (await sql<Season[]>`SELECT * FROM seasons WHERE id = ${id}`)[0] ?? null;
  }

  async getLatestSeason(): Promise<Season | null> {
    return (await sql<Season[]>`SELECT * FROM seasons ORDER BY year DESC LIMIT 1`)[0] ?? null;
  }

  async createSeason(data: Partial<Season>): Promise<Season> {
    const id = data.id || uuidv4();
    await sql`
      INSERT INTO seasons (id, name, year, status, auction_budget, max_players_per_team, max_overs, max_bowler_overs, rules_json)
      VALUES (
        ${id}, ${data.name!}, ${data.year!}, ${data.status || 'upcoming'},
        ${data.auction_budget ?? 25000000}, ${data.max_players_per_team ?? 12},
        ${data.max_overs ?? 12}, ${data.max_bowler_overs ?? 3}, ${data.rules_json || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        year = EXCLUDED.year,
        status = EXCLUDED.status,
        auction_budget = EXCLUDED.auction_budget,
        max_players_per_team = EXCLUDED.max_players_per_team,
        max_overs = EXCLUDED.max_overs,
        max_bowler_overs = EXCLUDED.max_bowler_overs,
        rules_json = EXCLUDED.rules_json
    `;
    return (await this.getSeasonById(id))!;
  }

  async updateSeason(id: string, data: Partial<Season>): Promise<Season> {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
    if (keys.length) {
      // Build dynamic UPDATE using sql.unsafe for the SET clause
      const setClauses = keys.map(k => `${k} = $${keys.indexOf(k) + 1}`).join(', ');
      const values = keys.map(k => (data as any)[k]);
      await sql.unsafe(
        `UPDATE seasons SET ${setClauses} WHERE id = $${keys.length + 1}`,
        [...values, id]
      );
    }
    return (await this.getSeasonById(id))!;
  }

  // ─── Players ─────────────────────────────────────────────────────────────────

  async getPlayers(filters: PlayerFilters = {}): Promise<PlayerWithStats[]> {
    if (filters.season_id) {
      const sid = filters.season_id;
      let rows: any[];

      if (filters.gender && filters.player_role && filters.search) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
            AND p.player_role = ${filters.player_role}
            AND (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.gender && filters.player_role) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
            AND p.player_role = ${filters.player_role}
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.gender && filters.search) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
            AND (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.player_role && filters.search) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.player_role = ${filters.player_role}
            AND (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.gender) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.player_role) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.player_role = ${filters.player_role}
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.search) {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else {
        rows = await sql`
          SELECT p.*,
            sr.group_number, sr.base_price as registration_base_price,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${sid}
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = ${sid}
          LEFT JOIN teams t ON ap.team_id = t.id
          ORDER BY p.first_name, p.last_name
        `;
      }
      return rows as PlayerWithStats[];
    } else {
      // No season filter — return all players (admin/global view)
      let rows: any[];

      if (filters.gender && filters.player_role && filters.search) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
            AND p.player_role = ${filters.player_role}
            AND (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.gender && filters.player_role) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
            AND p.player_role = ${filters.player_role}
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.gender && filters.search) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
            AND (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.player_role && filters.search) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.player_role = ${filters.player_role}
            AND (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.gender) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.gender = ${filters.gender}
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.player_role) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE p.player_role = ${filters.player_role}
          ORDER BY p.first_name, p.last_name
        `;
      } else if (filters.search) {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          WHERE (p.first_name LIKE ${'%' + filters.search + '%'} OR p.last_name LIKE ${'%' + filters.search + '%'})
          ORDER BY p.first_name, p.last_name
        `;
      } else {
        rows = await sql`
          SELECT p.*,
            ap.purchase_price, ap.team_id as team_id_from_auction,
            t.name as team_name, t.color_primary as team_color
          FROM players p
          LEFT JOIN auction_purchases ap ON p.id = ap.player_id
          LEFT JOIN teams t ON ap.team_id = t.id
          ORDER BY p.first_name, p.last_name
        `;
      }
      return rows as PlayerWithStats[];
    }
  }

  async getPlayerById(id: string): Promise<Player | null> {
    return (await sql<Player[]>`SELECT * FROM players WHERE id = ${id}`)[0] ?? null;
  }

  async createPlayer(data: Partial<Player>): Promise<Player> {
    const id = data.id || uuidv4();
    await sql`
      INSERT INTO players (id, external_id, first_name, last_name, gender, photo_url, batting_hand, bowling_style, player_role, name_variants)
      VALUES (
        ${id}, ${data.external_id || null}, ${data.first_name!}, ${data.last_name!},
        ${data.gender || null}, ${data.photo_url || null}, ${data.batting_hand || null},
        ${data.bowling_style || null}, ${data.player_role || null}, ${data.name_variants || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        external_id = EXCLUDED.external_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        gender = EXCLUDED.gender,
        photo_url = EXCLUDED.photo_url,
        batting_hand = EXCLUDED.batting_hand,
        bowling_style = EXCLUDED.bowling_style,
        player_role = EXCLUDED.player_role,
        name_variants = EXCLUDED.name_variants
    `;
    return (await this.getPlayerById(id))!;
  }

  async updatePlayer(id: string, data: Partial<Player>): Promise<Player> {
    const allowed = ['first_name', 'last_name', 'gender', 'photo_url', 'batting_hand', 'bowling_style', 'player_role', 'name_variants', 'external_id'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return (await this.getPlayerById(id))!;
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    await sql.unsafe(`UPDATE players SET ${setClauses} WHERE id = $${keys.length + 1}`, [...values, id]);
    return (await this.getPlayerById(id))!;
  }

  async bulkImportPlayers(players: Partial<Player>[]): Promise<void> {
    for (const p of players) {
      const id = p.id || uuidv4();
      await sql`
        INSERT INTO players (id, external_id, first_name, last_name, gender, photo_url, batting_hand, bowling_style, player_role, name_variants)
        VALUES (
          ${id}, ${p.external_id || null}, ${p.first_name!}, ${p.last_name!},
          ${p.gender || null}, ${p.photo_url || null}, ${p.batting_hand || null},
          ${p.bowling_style || null}, ${p.player_role || null}, ${p.name_variants || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          external_id = EXCLUDED.external_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          gender = EXCLUDED.gender,
          photo_url = EXCLUDED.photo_url,
          batting_hand = EXCLUDED.batting_hand,
          bowling_style = EXCLUDED.bowling_style,
          player_role = EXCLUDED.player_role,
          name_variants = EXCLUDED.name_variants
      `;
    }
  }

  // ─── Registrations ───────────────────────────────────────────────────────────

  async clearRegistrations(seasonId: string): Promise<void> {
    await sql`
      DELETE FROM season_registrations
      WHERE season_id = ${seasonId} AND registration_status != 'not_for_sale'
    `;
  }

  async getRegistrations(seasonId: string): Promise<SeasonRegistration[]> {
    return await sql<SeasonRegistration[]>`SELECT * FROM season_registrations WHERE season_id = ${seasonId}`;
  }

  async upsertRegistration(data: Partial<SeasonRegistration>): Promise<void> {
    const id = data.id || uuidv4();
    await sql`
      INSERT INTO season_registrations (id, season_id, player_id, group_number, base_price, is_captain_eligible, registration_status)
      VALUES (
        ${id}, ${data.season_id!}, ${data.player_id!}, ${data.group_number || null},
        ${data.base_price || null}, ${data.is_captain_eligible ? 1 : 0},
        ${data.registration_status || 'registered'}
      )
      ON CONFLICT (season_id, player_id) DO UPDATE SET
        group_number = EXCLUDED.group_number,
        base_price = EXCLUDED.base_price,
        is_captain_eligible = EXCLUDED.is_captain_eligible,
        registration_status = EXCLUDED.registration_status
    `;
  }

  // ─── Teams ───────────────────────────────────────────────────────────────────

  async getTeams(seasonId: string): Promise<Team[]> {
    return await sql<Team[]>`SELECT * FROM teams WHERE season_id = ${seasonId} ORDER BY name`;
  }

  async getTeamById(id: string): Promise<Team | null> {
    return (await sql<Team[]>`SELECT * FROM teams WHERE id = ${id}`)[0] ?? null;
  }

  async getTeamWithSquad(teamId: string, seasonId?: string): Promise<TeamWithSquad | null> {
    const team = await this.getTeamById(teamId);
    if (!team) return null;
    const sid = seasonId || team.season_id;
    const season = await this.getSeasonById(sid);
    const budget = season?.auction_budget || 25000000;

    const players = await sql<any[]>`
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
      WHERE ap.team_id = ${teamId} AND ap.season_id = ${sid}
      ORDER BY ap.purchase_order
    `;

    const budget_used = players.reduce((s: number, p: any) => s + (p.purchase_price || 0), 0);
    return {
      ...team,
      players: players.map((p: any) => ({
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

  async createTeam(data: Partial<Team>): Promise<Team> {
    const id = data.id || uuidv4();
    await sql`
      INSERT INTO teams (id, season_id, name, short_name, color_primary, color_secondary, logo_url, captain_id)
      VALUES (
        ${id}, ${data.season_id!}, ${data.name!}, ${data.short_name || null},
        ${data.color_primary || null}, ${data.color_secondary || null},
        ${data.logo_url || null}, ${data.captain_id || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        season_id = EXCLUDED.season_id,
        name = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        color_primary = EXCLUDED.color_primary,
        color_secondary = EXCLUDED.color_secondary,
        logo_url = EXCLUDED.logo_url,
        captain_id = EXCLUDED.captain_id
    `;
    return (await this.getTeamById(id))!;
  }

  async updateTeam(id: string, data: Partial<Team>): Promise<Team> {
    const allowed = ['name', 'short_name', 'color_primary', 'color_secondary', 'logo_url', 'captain_id'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return (await this.getTeamById(id))!;
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    await sql.unsafe(`UPDATE teams SET ${setClauses} WHERE id = $${keys.length + 1}`, [...values, id]);
    return (await this.getTeamById(id))!;
  }

  // ─── Auction ─────────────────────────────────────────────────────────────────

  async clearAuctionPurchases(seasonId: string): Promise<void> {
    await sql`
      DELETE FROM auction_purchases
      WHERE season_id = ${seasonId} AND (team_role IS NULL OR team_role = 'player')
    `;
  }

  async recordPurchase(data: Partial<AuctionPurchase> & { team_role?: string }): Promise<AuctionPurchase> {
    const id = data.id || uuidv4();
    const maxOrderRow = (await sql<any[]>`
      SELECT MAX(purchase_order) as mo FROM auction_purchases WHERE season_id = ${data.season_id!}
    `)[0];
    const maxOrder = maxOrderRow?.mo || 0;

    await sql`
      INSERT INTO auction_purchases (id, season_id, team_id, player_id, purchase_price, purchase_order, group_number, is_captain, team_role)
      VALUES (
        ${id}, ${data.season_id!}, ${data.team_id!}, ${data.player_id!}, ${data.purchase_price!},
        ${data.purchase_order || maxOrder + 1}, ${data.group_number || null},
        ${data.is_captain ? 1 : 0}, ${data.team_role || 'player'}
      )
      ON CONFLICT (id) DO UPDATE SET
        season_id = EXCLUDED.season_id,
        team_id = EXCLUDED.team_id,
        player_id = EXCLUDED.player_id,
        purchase_price = EXCLUDED.purchase_price,
        purchase_order = EXCLUDED.purchase_order,
        group_number = EXCLUDED.group_number,
        is_captain = EXCLUDED.is_captain,
        team_role = EXCLUDED.team_role
    `;
    return (await sql<AuctionPurchase[]>`SELECT * FROM auction_purchases WHERE id = ${id}`)[0];
  }

  async deletePurchase(id: string): Promise<void> {
    await sql`DELETE FROM auction_purchases WHERE id = ${id}`;
  }

  async getTeamBudget(teamId: string, seasonId: string): Promise<BudgetInfo> {
    const seasonRow = (await sql<any[]>`
      SELECT s.auction_budget, s.max_players_per_team
      FROM seasons s
      JOIN teams t ON t.season_id = s.id
      WHERE t.id = ${teamId}
    `)[0];
    const budget = seasonRow?.auction_budget || 25000000;
    const maxPlayers = seasonRow?.max_players_per_team || 12;

    const result = (await sql<any[]>`
      SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as spent
      FROM auction_purchases WHERE team_id = ${teamId} AND season_id = ${seasonId}
    `)[0];

    const spent = Number(result?.spent) || 0;
    const bought = Number(result?.count) || 0;
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

  async getAuctionPurchases(seasonId: string): Promise<(AuctionPurchase & { player_name: string; team_name: string })[]> {
    return await sql<any[]>`
      SELECT ap.*, p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name, t.color_primary as team_color, ap.team_role
      FROM auction_purchases ap
      JOIN players p ON ap.player_id = p.id
      JOIN teams t ON ap.team_id = t.id
      WHERE ap.season_id = ${seasonId}
      ORDER BY ap.purchase_order
    `;
  }

  async getAvailablePlayers(seasonId: string): Promise<PlayerWithStats[]> {
    const players = await sql<any[]>`
      SELECT p.*, sr.group_number, sr.base_price, sr.is_captain_eligible, sr.registration_status
      FROM players p
      JOIN season_registrations sr ON p.id = sr.player_id AND sr.season_id = ${seasonId}
      WHERE p.id NOT IN (
        SELECT player_id FROM auction_purchases WHERE season_id = ${seasonId}
      )
      AND sr.registration_status != 'not_for_sale'
      ORDER BY sr.group_number, p.first_name
    `;

    return await Promise.all(players.map(async (p: any) => {
      const statRows = await sql<any[]>`
        SELECT stat_type, stats_json, season_id FROM player_season_stats
        WHERE player_id = ${p.id} ORDER BY season_id DESC
      `;
      const batting = statRows.find((r: any) => r.stat_type === 'batting');
      const bowling = statRows.find((r: any) => r.stat_type === 'bowling');
      const mvp = statRows.find((r: any) => r.stat_type === 'mvp');
      return {
        ...p,
        batting: batting ? JSON.parse(batting.stats_json) : null,
        bowling: bowling ? JSON.parse(bowling.stats_json) : null,
        mvp: mvp ? JSON.parse(mvp.stats_json) : null,
      };
    }));
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  async clearPlayerStats(seasonId: string, statType: StatType): Promise<void> {
    await sql`DELETE FROM player_season_stats WHERE season_id = ${seasonId} AND stat_type = ${statType}`;
  }

  async getPlayerStats(playerId: string, seasonId?: string): Promise<Record<string, any>> {
    let rows: PlayerSeasonStats[];
    if (seasonId) {
      rows = await sql<PlayerSeasonStats[]>`
        SELECT * FROM player_season_stats WHERE player_id = ${playerId} AND season_id = ${seasonId}
      `;
    } else {
      rows = await sql<PlayerSeasonStats[]>`
        SELECT * FROM player_season_stats WHERE player_id = ${playerId}
      `;
    }
    const result: Record<string, any> = {};
    for (const row of rows) {
      if (!result[row.season_id]) result[row.season_id] = {};
      result[row.season_id][row.stat_type] = JSON.parse(row.stats_json);
    }
    return result;
  }

  async upsertPlayerStats(playerId: string, seasonId: string, statType: StatType, stats: any): Promise<void> {
    const id = uuidv4();
    await sql`
      INSERT INTO player_season_stats (id, player_id, season_id, stat_type, stats_json)
      VALUES (${id}, ${playerId}, ${seasonId}, ${statType}, ${JSON.stringify(stats)})
      ON CONFLICT (player_id, season_id, stat_type) DO UPDATE SET
        stats_json = EXCLUDED.stats_json
    `;
  }

  async bulkImportStats(stats: { player_id: string; season_id: string; stat_type: StatType; stats: any }[]): Promise<void> {
    for (const s of stats) {
      const id = uuidv4();
      await sql`
        INSERT INTO player_season_stats (id, player_id, season_id, stat_type, stats_json)
        VALUES (${id}, ${s.player_id}, ${s.season_id}, ${s.stat_type}, ${JSON.stringify(s.stats)})
        ON CONFLICT (player_id, season_id, stat_type) DO UPDATE SET
          stats_json = EXCLUDED.stats_json
      `;
    }
  }

  async getSeasonLeaderboard(seasonId: string, statType: StatType): Promise<LeaderboardEntry[]> {
    const rows = await sql<any[]>`
      SELECT pss.*, p.first_name || ' ' || p.last_name as player_name,
        t.name as team_name, t.color_primary as team_color
      FROM player_season_stats pss
      JOIN players p ON pss.player_id = p.id
      LEFT JOIN auction_purchases ap ON p.id = ap.player_id AND ap.season_id = pss.season_id
      LEFT JOIN teams t ON ap.team_id = t.id
      WHERE pss.season_id = ${seasonId} AND pss.stat_type = ${statType}
    `;

    return rows.map((r: any) => {
      const stats = JSON.parse(r.stats_json);
      let stat_value = 0;
      if (statType === 'batting') stat_value = stats.total_runs || 0;
      if (statType === 'bowling') stat_value = stats.total_wickets || 0;
      if (statType === 'fielding') stat_value = stats.total_dismissal || 0;
      if (statType === 'mvp') stat_value = stats.total_score || 0;
      return {
        player_id: r.player_id,
        player_name: r.player_name,
        team_name: r.team_name,
        season_id: r.season_id,
        stat_value,
        stats,
      };
    }).sort((a: any, b: any) => b.stat_value - a.stat_value);
  }

  // ─── Matches ─────────────────────────────────────────────────────────────────

  async getMatches(seasonId: string): Promise<Match[]> {
    return await sql<Match[]>`
      SELECT m.*, ta.name as team_a_name, tb.name as team_b_name,
        ta.color_primary as team_a_color, tb.color_primary as team_b_color,
        w.name as winner_name
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      LEFT JOIN teams w ON m.winner_id = w.id
      WHERE m.season_id = ${seasonId}
      ORDER BY m.match_date, m.match_number
    `;
  }

  async getMatchById(id: string): Promise<Match | null> {
    return (await sql<Match[]>`
      SELECT m.*, ta.name as team_a_name, tb.name as team_b_name,
        ta.color_primary as team_a_color, tb.color_primary as team_b_color
      FROM matches m
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      WHERE m.id = ${id}
    `)[0] ?? null;
  }

  async createMatch(data: Partial<Match>): Promise<Match> {
    const id = data.id || uuidv4();
    await sql`
      INSERT INTO matches (id, season_id, match_number, match_type, team_a_id, team_b_id, match_date, venue, status)
      VALUES (
        ${id}, ${data.season_id!}, ${data.match_number || null}, ${data.match_type || 'league'},
        ${data.team_a_id || null}, ${data.team_b_id || null}, ${data.match_date || null},
        ${data.venue || null}, ${data.status || 'upcoming'}
      )
      ON CONFLICT (id) DO UPDATE SET
        season_id = EXCLUDED.season_id,
        match_number = EXCLUDED.match_number,
        match_type = EXCLUDED.match_type,
        team_a_id = EXCLUDED.team_a_id,
        team_b_id = EXCLUDED.team_b_id,
        match_date = EXCLUDED.match_date,
        venue = EXCLUDED.venue,
        status = EXCLUDED.status
    `;
    return (await this.getMatchById(id))!;
  }

  async updateMatch(id: string, data: Partial<Match>): Promise<Match> {
    const allowed = ['match_number', 'match_type', 'team_a_id', 'team_b_id', 'toss_winner_id', 'toss_decision', 'winner_id', 'match_date', 'venue', 'status', 'result_summary'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return (await this.getMatchById(id))!;
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    await sql.unsafe(`UPDATE matches SET ${setClauses} WHERE id = $${keys.length + 1}`, [...values, id]);
    return (await this.getMatchById(id))!;
  }

  async deleteMatch(id: string): Promise<void> {
    // Cascade: remove every piece of match-related data
    const inningsRows = await sql<{ id: string }[]>`SELECT id FROM innings WHERE match_id = ${id}`;
    for (const inn of inningsRows) {
      await sql`DELETE FROM match_batting WHERE innings_id = ${inn.id}`;
      await sql`DELETE FROM match_bowling WHERE innings_id = ${inn.id}`;
    }
    // Catch any rows linked only by match_id (no innings_id)
    await sql`DELETE FROM match_batting WHERE match_id = ${id}`;
    await sql`DELETE FROM match_bowling WHERE match_id = ${id}`;
    await sql`DELETE FROM innings WHERE match_id = ${id}`;
    await sql`DELETE FROM match_scorecards WHERE match_id = ${id}`;
    await sql`DELETE FROM matches WHERE id = ${id}`;
  }

  // ─── Points Table ──────────────────────────────────────────────────────────

  async getPointsTable(seasonId: string): Promise<PointsTableEntry[]> {
    return await sql<PointsTableEntry[]>`
      SELECT pt.*, t.name as team_name, t.color_primary as team_color, t.short_name as team_short_name
      FROM points_table pt
      JOIN teams t ON pt.team_id = t.id
      WHERE pt.season_id = ${seasonId}
      ORDER BY pt.points DESC, pt.net_run_rate DESC
    `;
  }

  async upsertPointsTable(seasonId: string, teamId: string, data: Partial<PointsTableEntry>): Promise<void> {
    await sql`
      INSERT INTO points_table (id, season_id, team_id, matches_played, wins, losses, ties, no_results, points, net_run_rate)
      VALUES (
        ${uuidv4()}, ${seasonId}, ${teamId},
        ${data.matches_played || 0}, ${data.wins || 0}, ${data.losses || 0},
        ${data.ties || 0}, ${data.no_results || 0}, ${data.points || 0}, ${data.net_run_rate || 0}
      )
      ON CONFLICT (season_id, team_id) DO UPDATE SET
        matches_played = EXCLUDED.matches_played,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        ties = EXCLUDED.ties,
        no_results = EXCLUDED.no_results,
        points = EXCLUDED.points,
        net_run_rate = EXCLUDED.net_run_rate
    `;
  }

  // ─── Player Remarks ───────────────────────────────────────────────────────

  async getPlayerRemarks(playerId: string): Promise<PlayerRemark[]> {
    return await sql<PlayerRemark[]>`
      SELECT * FROM player_remarks WHERE player_id = ${playerId} ORDER BY created_at DESC
    `;
  }

  async createRemark(data: Partial<PlayerRemark>): Promise<PlayerRemark> {
    const id = uuidv4();
    await sql`
      INSERT INTO player_remarks (id, player_id, season_id, remark_type, remark, created_by)
      VALUES (
        ${id}, ${data.player_id!}, ${data.season_id || null},
        ${data.remark_type || 'general'}, ${data.remark!}, ${data.created_by || 'admin'}
      )
    `;
    return (await sql<PlayerRemark[]>`SELECT * FROM player_remarks WHERE id = ${id}`)[0];
  }

  // ─── Scorecards ───────────────────────────────────────────────────────────

  async getScorecardByMatchId(matchId: string): Promise<any | null> {
    return (await sql<any[]>`SELECT * FROM match_scorecards WHERE match_id = ${matchId}`)[0] ?? null;
  }

  async upsertScorecard(data: {
    match_id: string; season_id?: string; pdf_url?: string;
    raw_text?: string; scorecard_json: string; ai_analysis?: string;
  }): Promise<void> {
    const existing = await this.getScorecardByMatchId(data.match_id);
    if (existing) {
      await sql`
        UPDATE match_scorecards
        SET scorecard_json = ${data.scorecard_json},
            ai_analysis = ${data.ai_analysis || null},
            raw_text = ${data.raw_text || null},
            pdf_url = ${data.pdf_url || null}
        WHERE match_id = ${data.match_id}
      `;
    } else {
      await sql`
        INSERT INTO match_scorecards (id, match_id, season_id, pdf_url, raw_text, scorecard_json, ai_analysis)
        VALUES (
          ${uuidv4()}, ${data.match_id}, ${data.season_id || null}, ${data.pdf_url || null},
          ${data.raw_text || null}, ${data.scorecard_json}, ${data.ai_analysis || null}
        )
      `;
    }
  }

  async saveInnings(data: {
    match_id: string; batting_team_id: string | null; bowling_team_id: string | null;
    innings_number: number; total_runs: number; total_wickets: number; total_overs: number; extras_json?: string;
  }): Promise<string> {
    // Delete existing innings for this match+number so we can re-import
    await sql`DELETE FROM innings WHERE match_id = ${data.match_id} AND innings_number = ${data.innings_number}`;
    const id = uuidv4();
    await sql`
      INSERT INTO innings (id, match_id, batting_team_id, bowling_team_id, innings_number, total_runs, total_wickets, total_overs, extras_json)
      VALUES (
        ${id}, ${data.match_id}, ${data.batting_team_id}, ${data.bowling_team_id},
        ${data.innings_number}, ${data.total_runs}, ${data.total_wickets}, ${data.total_overs},
        ${data.extras_json || null}
      )
    `;
    return id;
  }

  async saveMatchBatting(rows: {
    match_id: string; innings_id: string; player_id: string | null; player_name: string;
    team_id: string | null; runs_scored: number; balls_faced: number; fours: number; sixes: number;
    strike_rate: number; dismissal_type?: string; dismissal_bowler_id?: string | null;
    dismissal_fielder_id?: string | null; batting_position: number;
  }[]): Promise<void> {
    if (rows.length === 0) return;
    // Clear existing batting for this innings
    await sql`DELETE FROM match_batting WHERE innings_id = ${rows[0].innings_id}`;
    for (const r of rows) {
      await sql`
        INSERT INTO match_batting (id, match_id, innings_id, player_id, player_name, team_id, runs_scored, balls_faced,
          fours, sixes, strike_rate, dismissal_type, dismissal_bowler_id, dismissal_fielder_id, batting_position)
        VALUES (
          ${uuidv4()}, ${r.match_id}, ${r.innings_id}, ${r.player_id}, ${r.player_name},
          ${r.team_id}, ${r.runs_scored}, ${r.balls_faced}, ${r.fours}, ${r.sixes},
          ${r.strike_rate}, ${r.dismissal_type || null}, ${r.dismissal_bowler_id || null},
          ${r.dismissal_fielder_id || null}, ${r.batting_position}
        )
      `;
    }
  }

  async saveMatchBowling(rows: {
    match_id: string; innings_id: string; player_id: string | null; player_name: string;
    team_id: string | null; overs: number; maidens: number; runs_given: number; wickets: number;
    economy: number; dot_balls?: number; wides?: number; no_balls?: number;
  }[]): Promise<void> {
    if (rows.length === 0) return;
    await sql`DELETE FROM match_bowling WHERE innings_id = ${rows[0].innings_id}`;
    for (const r of rows) {
      await sql`
        INSERT INTO match_bowling (id, match_id, innings_id, player_id, player_name, team_id, overs, maidens, runs_given, wickets, economy, dot_balls, wides, no_balls)
        VALUES (
          ${uuidv4()}, ${r.match_id}, ${r.innings_id}, ${r.player_id}, ${r.player_name},
          ${r.team_id}, ${r.overs}, ${r.maidens}, ${r.runs_given}, ${r.wickets}, ${r.economy},
          ${r.dot_balls || 0}, ${r.wides || 0}, ${r.no_balls || 0}
        )
      `;
    }
  }

  async getMatchInningsWithScores(matchId: string): Promise<any[]> {
    const innings = await sql<any[]>`SELECT * FROM innings WHERE match_id = ${matchId} ORDER BY innings_number`;
    return await Promise.all(innings.map(async (inn: any) => {
      const batting = await sql<any[]>`SELECT * FROM match_batting WHERE innings_id = ${inn.id} ORDER BY batting_position`;
      const bowling = await sql<any[]>`SELECT * FROM match_bowling WHERE innings_id = ${inn.id} ORDER BY overs DESC`;
      return { ...inn, batting, bowling };
    }));
  }

  async getPlayerMatchHistory(playerId: string, limit = 10): Promise<any[]> {
    return await sql<any[]>`
      SELECT mb.*, m.match_date, m.match_type, m.match_number,
        ta.name as team_a_name, tb.name as team_b_name,
        t.name as batting_team_name
      FROM match_batting mb
      JOIN matches m ON mb.match_id = m.id
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      LEFT JOIN teams t ON mb.team_id = t.id
      WHERE mb.player_id = ${playerId}
      ORDER BY m.match_date DESC
      LIMIT ${limit}
    `;
  }

  async getPlayerBowlingHistory(playerId: string, limit = 10): Promise<any[]> {
    return await sql<any[]>`
      SELECT mb.*, m.match_date, m.match_type, m.match_number,
        ta.name as team_a_name, tb.name as team_b_name
      FROM match_bowling mb
      JOIN matches m ON mb.match_id = m.id
      LEFT JOIN teams ta ON m.team_a_id = ta.id
      LEFT JOIN teams tb ON m.team_b_id = tb.id
      WHERE mb.player_id = ${playerId}
      ORDER BY m.match_date DESC
      LIMIT ${limit}
    `;
  }

  // Find player by name (fuzzy) — returns best match or null
  async findPlayerByName(name: string): Promise<Player | null> {
    const cleaned = name.trim().toLowerCase();
    const parts = cleaned.split(/\s+/);

    // Try exact full name match
    const exact = (await sql<Player[]>`
      SELECT * FROM players WHERE LOWER(first_name || ' ' || last_name) = ${cleaned}
    `)[0];
    if (exact) return exact;

    // Try first+last partial
    if (parts.length >= 2) {
      const partial = (await sql<Player[]>`
        SELECT * FROM players WHERE LOWER(first_name) = ${parts[0]} AND LOWER(last_name) = ${parts[parts.length - 1]}
      `)[0];
      if (partial) return partial;
    }

    // Try name_variants
    const allPlayers = await sql<Player[]>`SELECT * FROM players WHERE name_variants IS NOT NULL`;
    for (const p of allPlayers) {
      const variants = (p.name_variants || '').toLowerCase().split(',').map((v: string) => v.trim());
      if (variants.some((v: string) => v === cleaned || v.includes(cleaned) || cleaned.includes(v))) {
        return p;
      }
    }

    // Try any part of the name
    if (parts.length >= 2) {
      const byFirst = (await sql<Player[]>`
        SELECT * FROM players WHERE LOWER(first_name) LIKE ${parts[0] + '%'} LIMIT 1
      `)[0];
      if (byFirst) return byFirst;
    }

    return null;
  }

  // ─── Util ─────────────────────────────────────────────────────────────────

  async rawQuery(query: string, params: any[] = []): Promise<any[]> {
    return await sql.unsafe(query, params);
  }

  async rawRun(query: string, params: any[] = []): Promise<void> {
    await sql.unsafe(query, params);
  }

  async getDashboardStats(seasonId: string): Promise<{
    totalPlayers: number;
    totalTeams: number;
    totalMatches: number;
    completedMatches: number;
  }> {
    const [playersRow, teamsRow, matchesRow, completedRow] = await Promise.all([
      sql<any[]>`SELECT COUNT(*) as c FROM season_registrations WHERE season_id = ${seasonId}`,
      sql<any[]>`SELECT COUNT(*) as c FROM teams WHERE season_id = ${seasonId}`,
      sql<any[]>`SELECT COUNT(*) as c FROM matches WHERE season_id = ${seasonId}`,
      sql<any[]>`SELECT COUNT(*) as c FROM matches WHERE season_id = ${seasonId} AND status = 'completed'`,
    ]);

    return {
      totalPlayers: Number(playersRow[0]?.c) || 0,
      totalTeams: Number(teamsRow[0]?.c) || 0,
      totalMatches: Number(matchesRow[0]?.c) || 0,
      completedMatches: Number(completedRow[0]?.c) || 0,
    };
  }
}
