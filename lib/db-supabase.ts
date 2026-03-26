import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Season, Player, Team, TeamWithSquad, AuctionPurchase, BudgetInfo,
  Match, PlayerSeasonStats, LeaderboardEntry, StatType, PlayerFilters,
  PlayerWithStats, PointsTableEntry, PlayerRemark, SeasonRegistration
} from './types';

export class SupabaseDB {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }

  // ─── Seasons ────────────────────────────────────────────────────────────────

  async getSeasons(): Promise<Season[]> {
    const { data, error } = await this.supabase
      .from('seasons')
      .select('*')
      .order('year', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getSeasonById(id: string): Promise<Season | null> {
    const { data, error } = await this.supabase
      .from('seasons')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async getLatestSeason(): Promise<Season | null> {
    const { data, error } = await this.supabase
      .from('seasons')
      .select('*')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async createSeason(data: Partial<Season>): Promise<Season> {
    const id = data.id || uuidv4();
    const row = {
      id,
      name: data.name!,
      year: data.year!,
      status: data.status || 'upcoming',
      auction_budget: data.auction_budget ?? 25000000,
      max_players_per_team: data.max_players_per_team ?? 12,
      max_overs: data.max_overs ?? 12,
      max_bowler_overs: data.max_bowler_overs ?? 3,
      rules_json: data.rules_json || null,
    };
    const { error } = await this.supabase
      .from('seasons')
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return (await this.getSeasonById(id))!;
  }

  async updateSeason(id: string, data: Partial<Season>): Promise<Season> {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
    if (keys.length) {
      const obj: Record<string, any> = {};
      for (const k of keys) obj[k] = (data as any)[k];
      const { error } = await this.supabase
        .from('seasons')
        .update(obj)
        .eq('id', id);
      if (error) throw new Error(error.message);
    }
    return (await this.getSeasonById(id))!;
  }

  // ─── Players ─────────────────────────────────────────────────────────────────

  async getPlayers(filters: PlayerFilters = {}): Promise<PlayerWithStats[]> {
    if (filters.season_id) {
      const sid = filters.season_id;

      // Build base query joining through season_registrations
      let q = this.supabase
        .from('players')
        .select(`
          *,
          season_registrations!inner(group_number, base_price, season_id),
          auction_purchases(purchase_price, team_id, season_id, teams(name, color_primary))
        `)
        .eq('season_registrations.season_id', sid);

      if (filters.gender) q = q.eq('gender', filters.gender);
      if (filters.player_role) q = q.eq('player_role', filters.player_role);
      if (filters.search) {
        q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
      }

      q = q.order('first_name').order('last_name');

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      return (data ?? []).map((p: any) => {
        const reg = Array.isArray(p.season_registrations) ? p.season_registrations[0] : p.season_registrations;
        const ap = Array.isArray(p.auction_purchases)
          ? p.auction_purchases.find((a: any) => a.season_id === sid)
          : p.auction_purchases;
        const team = ap?.teams;
        const { season_registrations, auction_purchases, ...playerFields } = p;
        return {
          ...playerFields,
          group_number: reg?.group_number ?? null,
          registration_base_price: reg?.base_price ?? null,
          purchase_price: ap?.purchase_price ?? null,
          team_id_from_auction: ap?.team_id ?? null,
          team_name: team?.name ?? null,
          team_color: team?.color_primary ?? null,
        } as PlayerWithStats;
      });
    } else {
      // No season filter — return all players (admin/global view)
      let q = this.supabase
        .from('players')
        .select(`
          *,
          auction_purchases(purchase_price, team_id, teams(name, color_primary))
        `);

      if (filters.gender) q = q.eq('gender', filters.gender);
      if (filters.player_role) q = q.eq('player_role', filters.player_role);
      if (filters.search) {
        q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
      }

      q = q.order('first_name').order('last_name');

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      return (data ?? []).map((p: any) => {
        const ap = Array.isArray(p.auction_purchases) ? p.auction_purchases[0] : p.auction_purchases;
        const team = ap?.teams;
        const { auction_purchases, ...playerFields } = p;
        return {
          ...playerFields,
          purchase_price: ap?.purchase_price ?? null,
          team_id_from_auction: ap?.team_id ?? null,
          team_name: team?.name ?? null,
          team_color: team?.color_primary ?? null,
        } as PlayerWithStats;
      });
    }
  }

  async getPlayerById(id: string): Promise<Player | null> {
    const { data, error } = await this.supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async createPlayer(data: Partial<Player>): Promise<Player> {
    const id = data.id || uuidv4();
    const row = {
      id,
      external_id: data.external_id || null,
      first_name: data.first_name!,
      last_name: data.last_name!,
      gender: data.gender || null,
      photo_url: data.photo_url || null,
      batting_hand: data.batting_hand || null,
      bowling_style: data.bowling_style || null,
      player_role: data.player_role || null,
      name_variants: data.name_variants || null,
    };
    const { error } = await this.supabase
      .from('players')
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return (await this.getPlayerById(id))!;
  }

  async updatePlayer(id: string, data: Partial<Player>): Promise<Player> {
    const allowed = ['first_name', 'last_name', 'gender', 'photo_url', 'batting_hand', 'bowling_style', 'player_role', 'name_variants', 'external_id'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return (await this.getPlayerById(id))!;
    const obj: Record<string, any> = {};
    for (const k of keys) obj[k] = (data as any)[k];
    const { error } = await this.supabase
      .from('players')
      .update(obj)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return (await this.getPlayerById(id))!;
  }

  async bulkImportPlayers(players: Partial<Player>[]): Promise<void> {
    if (!players.length) return;
    const rows = players.map(p => ({
      id: p.id || uuidv4(),
      external_id: p.external_id || null,
      first_name: p.first_name!,
      last_name: p.last_name!,
      gender: p.gender || null,
      photo_url: p.photo_url || null,
      batting_hand: p.batting_hand || null,
      bowling_style: p.bowling_style || null,
      player_role: p.player_role || null,
      name_variants: p.name_variants || null,
    }));
    const { error } = await this.supabase
      .from('players')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }

  // ─── Registrations ───────────────────────────────────────────────────────────

  async clearRegistrations(seasonId: string): Promise<void> {
    const { error } = await this.supabase
      .from('season_registrations')
      .delete()
      .eq('season_id', seasonId)
      .neq('registration_status', 'not_for_sale');
    if (error) throw new Error(error.message);
  }

  async getRegistrations(seasonId: string): Promise<SeasonRegistration[]> {
    const { data, error } = await this.supabase
      .from('season_registrations')
      .select('*')
      .eq('season_id', seasonId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async upsertRegistration(data: Partial<SeasonRegistration>): Promise<void> {
    const id = data.id || uuidv4();
    const row = {
      id,
      season_id: data.season_id!,
      player_id: data.player_id!,
      group_number: data.group_number || null,
      base_price: data.base_price || null,
      is_captain_eligible: data.is_captain_eligible ? 1 : 0,
      registration_status: data.registration_status || 'registered',
    };
    const { error } = await this.supabase
      .from('season_registrations')
      .upsert(row, { onConflict: 'season_id,player_id' });
    if (error) throw new Error(error.message);
  }

  // ─── Teams ───────────────────────────────────────────────────────────────────

  async getTeams(seasonId: string): Promise<Team[]> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('season_id', seasonId)
      .order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getTeamById(id: string): Promise<Team | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async getTeamWithSquad(teamId: string, seasonId?: string): Promise<TeamWithSquad | null> {
    const team = await this.getTeamById(teamId);
    if (!team) return null;
    const sid = seasonId || team.season_id;
    const season = await this.getSeasonById(sid);
    const budget = season?.auction_budget || 25000000;

    // Fetch auction purchases for this team+season with player data
    const { data: apRows, error: apError } = await this.supabase
      .from('auction_purchases')
      .select(`
        purchase_price, group_number, is_captain, team_role, purchase_order,
        player:players!player_id(*)
      `)
      .eq('team_id', teamId)
      .eq('season_id', sid)
      .order('purchase_order');
    if (apError) throw new Error(apError.message);

    // For each player fetch their latest stats
    const playersWithStats = await Promise.all((apRows ?? []).map(async (ap: any) => {
      const p = ap.player;
      const { data: statRows } = await this.supabase
        .from('player_season_stats')
        .select('stat_type, stats_json, season_id')
        .eq('player_id', p.id)
        .order('season_id', { ascending: false });

      const batting = (statRows ?? []).find((r: any) => r.stat_type === 'batting');
      const bowling = (statRows ?? []).find((r: any) => r.stat_type === 'bowling');
      const fielding = (statRows ?? []).find((r: any) => r.stat_type === 'fielding');
      const mvp = (statRows ?? []).find((r: any) => r.stat_type === 'mvp');

      return {
        ...p,
        purchase_price: ap.purchase_price,
        group_number: ap.group_number,
        is_captain: ap.is_captain,
        team_role: ap.team_role,
        batting: batting ? JSON.parse(batting.stats_json) : null,
        bowling: bowling ? JSON.parse(bowling.stats_json) : null,
        fielding: fielding ? JSON.parse(fielding.stats_json) : null,
        mvp: mvp ? JSON.parse(mvp.stats_json) : null,
      };
    }));

    const budget_used = playersWithStats.reduce((s: number, p: any) => s + (p.purchase_price || 0), 0);
    return {
      ...team,
      players: playersWithStats,
      budget_used,
      budget_remaining: budget - budget_used,
    };
  }

  async createTeam(data: Partial<Team>): Promise<Team> {
    const id = data.id || uuidv4();
    const row = {
      id,
      season_id: data.season_id!,
      name: data.name!,
      short_name: data.short_name || null,
      color_primary: data.color_primary || null,
      color_secondary: data.color_secondary || null,
      logo_url: data.logo_url || null,
      captain_id: data.captain_id || null,
    };
    const { error } = await this.supabase
      .from('teams')
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return (await this.getTeamById(id))!;
  }

  async updateTeam(id: string, data: Partial<Team>): Promise<Team> {
    const allowed = ['name', 'short_name', 'color_primary', 'color_secondary', 'logo_url', 'captain_id'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return (await this.getTeamById(id))!;
    const obj: Record<string, any> = {};
    for (const k of keys) obj[k] = (data as any)[k];
    const { error } = await this.supabase
      .from('teams')
      .update(obj)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return (await this.getTeamById(id))!;
  }

  // ─── Auction ─────────────────────────────────────────────────────────────────

  async clearAuctionPurchases(seasonId: string): Promise<void> {
    const { error } = await this.supabase
      .from('auction_purchases')
      .delete()
      .eq('season_id', seasonId)
      .or('team_role.is.null,team_role.eq.player');
    if (error) throw new Error(error.message);
  }

  async recordPurchase(data: Partial<AuctionPurchase> & { team_role?: string }): Promise<AuctionPurchase> {
    const id = data.id || uuidv4();

    // Get max purchase_order for this season
    const { data: maxRow } = await this.supabase
      .from('auction_purchases')
      .select('purchase_order')
      .eq('season_id', data.season_id!)
      .order('purchase_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const maxOrder = maxRow?.purchase_order || 0;

    const row = {
      id,
      season_id: data.season_id!,
      team_id: data.team_id!,
      player_id: data.player_id!,
      purchase_price: data.purchase_price!,
      purchase_order: data.purchase_order || maxOrder + 1,
      group_number: data.group_number || null,
      is_captain: data.is_captain ? 1 : 0,
      team_role: data.team_role || 'player',
    };
    const { error } = await this.supabase
      .from('auction_purchases')
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);

    const { data: result, error: fetchError } = await this.supabase
      .from('auction_purchases')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    return result;
  }

  async deletePurchase(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('auction_purchases')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getTeamBudget(teamId: string, seasonId: string): Promise<BudgetInfo> {
    // Get season budget via teams join
    const { data: teamRow } = await this.supabase
      .from('teams')
      .select('season_id, seasons!inner(auction_budget, max_players_per_team)')
      .eq('id', teamId)
      .maybeSingle();

    const seasonData = (teamRow as any)?.seasons;
    const budget = seasonData?.auction_budget || 25000000;
    const maxPlayers = seasonData?.max_players_per_team || 12;

    const { data: apRows, error: apError } = await this.supabase
      .from('auction_purchases')
      .select('purchase_price')
      .eq('team_id', teamId)
      .eq('season_id', seasonId);
    if (apError) throw new Error(apError.message);

    const rows = apRows ?? [];
    const spent = rows.reduce((s: number, r: any) => s + (Number(r.purchase_price) || 0), 0);
    const bought = rows.length;
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
    const { data, error } = await this.supabase
      .from('auction_purchases')
      .select(`
        *,
        player:players!player_id(first_name, last_name),
        team:teams!team_id(name, color_primary)
      `)
      .eq('season_id', seasonId)
      .order('purchase_order');
    if (error) throw new Error(error.message);

    return (data ?? []).map((ap: any) => {
      const { player, team, ...rest } = ap;
      return {
        ...rest,
        player_name: player ? `${player.first_name} ${player.last_name}` : '',
        team_name: team?.name ?? '',
        team_color: team?.color_primary ?? null,
      };
    });
  }

  async getAvailablePlayers(seasonId: string): Promise<PlayerWithStats[]> {
    // Get all purchased player_ids in this season
    const { data: purchased } = await this.supabase
      .from('auction_purchases')
      .select('player_id')
      .eq('season_id', seasonId);
    const purchasedIds = (purchased ?? []).map((r: any) => r.player_id);

    let q = this.supabase
      .from('players')
      .select(`
        *,
        season_registrations!inner(group_number, base_price, is_captain_eligible, registration_status, season_id)
      `)
      .eq('season_registrations.season_id', seasonId)
      .neq('season_registrations.registration_status', 'not_for_sale');

    if (purchasedIds.length > 0) {
      q = q.not('id', 'in', `(${purchasedIds.join(',')})`);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return await Promise.all((data ?? []).map(async (p: any) => {
      const { season_registrations, ...playerFields } = p;
      const reg = Array.isArray(season_registrations) ? season_registrations[0] : season_registrations;

      const { data: statRows } = await this.supabase
        .from('player_season_stats')
        .select('stat_type, stats_json, season_id')
        .eq('player_id', p.id)
        .order('season_id', { ascending: false });

      const batting = (statRows ?? []).find((r: any) => r.stat_type === 'batting');
      const bowling = (statRows ?? []).find((r: any) => r.stat_type === 'bowling');
      const mvp = (statRows ?? []).find((r: any) => r.stat_type === 'mvp');

      return {
        ...playerFields,
        group_number: reg?.group_number ?? null,
        base_price: reg?.base_price ?? null,
        is_captain_eligible: reg?.is_captain_eligible ?? null,
        registration_status: reg?.registration_status ?? null,
        batting: batting ? JSON.parse(batting.stats_json) : null,
        bowling: bowling ? JSON.parse(bowling.stats_json) : null,
        mvp: mvp ? JSON.parse(mvp.stats_json) : null,
      } as PlayerWithStats;
    }));
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  async clearPlayerStats(seasonId: string, statType: StatType): Promise<void> {
    const { error } = await this.supabase
      .from('player_season_stats')
      .delete()
      .eq('season_id', seasonId)
      .eq('stat_type', statType);
    if (error) throw new Error(error.message);
  }

  async getPlayerStats(playerId: string, seasonId?: string): Promise<Record<string, any>> {
    let q = this.supabase
      .from('player_season_stats')
      .select('*')
      .eq('player_id', playerId);
    if (seasonId) q = q.eq('season_id', seasonId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const result: Record<string, any> = {};
    for (const row of (data ?? []) as PlayerSeasonStats[]) {
      if (!result[row.season_id]) result[row.season_id] = {};
      result[row.season_id][row.stat_type] = JSON.parse(row.stats_json);
    }
    return result;
  }

  async upsertPlayerStats(playerId: string, seasonId: string, statType: StatType, stats: any): Promise<void> {
    const id = uuidv4();
    const { error } = await this.supabase
      .from('player_season_stats')
      .upsert(
        { id, player_id: playerId, season_id: seasonId, stat_type: statType, stats_json: JSON.stringify(stats) },
        { onConflict: 'player_id,season_id,stat_type' }
      );
    if (error) throw new Error(error.message);
  }

  async bulkImportStats(stats: { player_id: string; season_id: string; stat_type: StatType; stats: any }[]): Promise<void> {
    if (!stats.length) return;
    const rows = stats.map(s => ({
      id: uuidv4(),
      player_id: s.player_id,
      season_id: s.season_id,
      stat_type: s.stat_type,
      stats_json: JSON.stringify(s.stats),
    }));
    const { error } = await this.supabase
      .from('player_season_stats')
      .upsert(rows, { onConflict: 'player_id,season_id,stat_type' });
    if (error) throw new Error(error.message);
  }

  async getSeasonLeaderboard(seasonId: string, statType: StatType): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.supabase
      .from('player_season_stats')
      .select(`
        *,
        player:players!player_id(first_name, last_name),
        auction:auction_purchases(team:teams!team_id(name, color_primary))
      `)
      .eq('season_id', seasonId)
      .eq('stat_type', statType);
    if (error) throw new Error(error.message);

    return (data ?? []).map((r: any) => {
      const stats = JSON.parse(r.stats_json);
      let stat_value = 0;
      if (statType === 'batting') stat_value = stats.total_runs || 0;
      if (statType === 'bowling') stat_value = stats.total_wickets || 0;
      if (statType === 'fielding') stat_value = stats.total_dismissal || 0;
      if (statType === 'mvp') stat_value = stats.total_score || 0;

      const player = r.player;
      const auctionArr = Array.isArray(r.auction) ? r.auction : (r.auction ? [r.auction] : []);
      const team = auctionArr[0]?.team;

      return {
        player_id: r.player_id,
        player_name: player ? `${player.first_name} ${player.last_name}` : '',
        team_name: team?.name ?? null,
        season_id: r.season_id,
        stat_value,
        stats,
      };
    }).sort((a: any, b: any) => b.stat_value - a.stat_value);
  }

  // ─── Matches ─────────────────────────────────────────────────────────────────

  async getMatches(seasonId: string): Promise<Match[]> {
    const { data, error } = await this.supabase
      .from('matches')
      .select(`
        *,
        team_a:teams!team_a_id(name, color_primary),
        team_b:teams!team_b_id(name, color_primary),
        winner:teams!winner_id(name)
      `)
      .eq('season_id', seasonId)
      .order('match_date')
      .order('match_number');
    if (error) throw new Error(error.message);

    return (data ?? []).map((m: any) => {
      const { team_a, team_b, winner, ...rest } = m;
      return {
        ...rest,
        team_a_name: team_a?.name ?? null,
        team_a_color: team_a?.color_primary ?? null,
        team_b_name: team_b?.name ?? null,
        team_b_color: team_b?.color_primary ?? null,
        winner_name: winner?.name ?? null,
      } as Match;
    });
  }

  async getMatchById(id: string): Promise<Match | null> {
    const { data, error } = await this.supabase
      .from('matches')
      .select(`
        *,
        team_a:teams!team_a_id(name, color_primary),
        team_b:teams!team_b_id(name, color_primary)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const { team_a, team_b, ...rest } = data as any;
    return {
      ...rest,
      team_a_name: team_a?.name ?? null,
      team_a_color: team_a?.color_primary ?? null,
      team_b_name: team_b?.name ?? null,
      team_b_color: team_b?.color_primary ?? null,
    } as Match;
  }

  async createMatch(data: Partial<Match>): Promise<Match> {
    const id = data.id || uuidv4();
    const row = {
      id,
      season_id: data.season_id!,
      match_number: data.match_number || null,
      match_type: data.match_type || 'league',
      team_a_id: data.team_a_id || null,
      team_b_id: data.team_b_id || null,
      match_date: data.match_date || null,
      venue: data.venue || null,
      status: data.status || 'upcoming',
    };
    const { error } = await this.supabase
      .from('matches')
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return (await this.getMatchById(id))!;
  }

  async updateMatch(id: string, data: Partial<Match>): Promise<Match> {
    const allowed = ['match_number', 'match_type', 'team_a_id', 'team_b_id', 'toss_winner_id', 'toss_decision', 'winner_id', 'match_date', 'venue', 'status', 'result_summary'];
    const keys = Object.keys(data).filter(k => allowed.includes(k));
    if (!keys.length) return (await this.getMatchById(id))!;
    const obj: Record<string, any> = {};
    for (const k of keys) obj[k] = (data as any)[k];
    const { error } = await this.supabase
      .from('matches')
      .update(obj)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return (await this.getMatchById(id))!;
  }

  async deleteMatch(id: string): Promise<void> {
    // Get innings IDs to cascade delete batting/bowling
    const { data: inningsRows } = await this.supabase
      .from('innings')
      .select('id')
      .eq('match_id', id);

    for (const inn of (inningsRows ?? [])) {
      await this.supabase.from('match_batting').delete().eq('innings_id', inn.id);
      await this.supabase.from('match_bowling').delete().eq('innings_id', inn.id);
    }

    // Catch rows linked only by match_id (no innings_id)
    await this.supabase.from('match_batting').delete().eq('match_id', id);
    await this.supabase.from('match_bowling').delete().eq('match_id', id);
    await this.supabase.from('innings').delete().eq('match_id', id);
    await this.supabase.from('match_scorecards').delete().eq('match_id', id);

    const { error } = await this.supabase.from('matches').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ─── Points Table ──────────────────────────────────────────────────────────

  async getPointsTable(seasonId: string): Promise<PointsTableEntry[]> {
    const { data, error } = await this.supabase
      .from('points_table')
      .select(`
        *,
        team:teams!team_id(name, color_primary, short_name)
      `)
      .eq('season_id', seasonId)
      .order('points', { ascending: false })
      .order('net_run_rate', { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((pt: any) => {
      const { team, ...rest } = pt;
      return {
        ...rest,
        team_name: team?.name ?? null,
        team_color: team?.color_primary ?? null,
        team_short_name: team?.short_name ?? null,
      } as PointsTableEntry;
    });
  }

  async upsertPointsTable(seasonId: string, teamId: string, data: Partial<PointsTableEntry>): Promise<void> {
    const row = {
      id: uuidv4(),
      season_id: seasonId,
      team_id: teamId,
      matches_played: data.matches_played || 0,
      wins: data.wins || 0,
      losses: data.losses || 0,
      ties: data.ties || 0,
      no_results: data.no_results || 0,
      points: data.points || 0,
      net_run_rate: data.net_run_rate || 0,
    };
    const { error } = await this.supabase
      .from('points_table')
      .upsert(row, { onConflict: 'season_id,team_id' });
    if (error) throw new Error(error.message);
  }

  // ─── Player Remarks ───────────────────────────────────────────────────────

  async getPlayerRemarks(playerId: string): Promise<PlayerRemark[]> {
    const { data, error } = await this.supabase
      .from('player_remarks')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async createRemark(data: Partial<PlayerRemark>): Promise<PlayerRemark> {
    const id = uuidv4();
    const row = {
      id,
      player_id: data.player_id!,
      season_id: data.season_id || null,
      remark_type: data.remark_type || 'general',
      remark: data.remark!,
      created_by: data.created_by || 'admin',
    };
    const { error } = await this.supabase
      .from('player_remarks')
      .insert(row);
    if (error) throw new Error(error.message);

    const { data: result, error: fetchError } = await this.supabase
      .from('player_remarks')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    return result;
  }

  // ─── Scorecards ───────────────────────────────────────────────────────────

  async getScorecardByMatchId(matchId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('match_scorecards')
      .select('*')
      .eq('match_id', matchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async upsertScorecard(data: {
    match_id: string; season_id?: string; pdf_url?: string;
    raw_text?: string; scorecard_json: string; ai_analysis?: string;
  }): Promise<void> {
    const existing = await this.getScorecardByMatchId(data.match_id);
    if (existing) {
      const { error } = await this.supabase
        .from('match_scorecards')
        .update({
          scorecard_json: data.scorecard_json,
          ai_analysis: data.ai_analysis || null,
          raw_text: data.raw_text || null,
          pdf_url: data.pdf_url || null,
        })
        .eq('match_id', data.match_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await this.supabase
        .from('match_scorecards')
        .insert({
          id: uuidv4(),
          match_id: data.match_id,
          season_id: data.season_id || null,
          pdf_url: data.pdf_url || null,
          raw_text: data.raw_text || null,
          scorecard_json: data.scorecard_json,
          ai_analysis: data.ai_analysis || null,
        });
      if (error) throw new Error(error.message);
    }
  }

  async saveInnings(data: {
    match_id: string; batting_team_id: string | null; bowling_team_id: string | null;
    innings_number: number; total_runs: number; total_wickets: number; total_overs: number; extras_json?: string;
  }): Promise<string> {
    // Delete existing innings for this match+number so we can re-import
    await this.supabase
      .from('innings')
      .delete()
      .eq('match_id', data.match_id)
      .eq('innings_number', data.innings_number);

    const id = uuidv4();
    const { error } = await this.supabase
      .from('innings')
      .insert({
        id,
        match_id: data.match_id,
        batting_team_id: data.batting_team_id,
        bowling_team_id: data.bowling_team_id,
        innings_number: data.innings_number,
        total_runs: data.total_runs,
        total_wickets: data.total_wickets,
        total_overs: data.total_overs,
        extras_json: data.extras_json || null,
      });
    if (error) throw new Error(error.message);
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
    await this.supabase
      .from('match_batting')
      .delete()
      .eq('innings_id', rows[0].innings_id);

    const insertRows = rows.map(r => ({
      id: uuidv4(),
      match_id: r.match_id,
      innings_id: r.innings_id,
      player_id: r.player_id,
      player_name: r.player_name,
      team_id: r.team_id,
      runs_scored: r.runs_scored,
      balls_faced: r.balls_faced,
      fours: r.fours,
      sixes: r.sixes,
      strike_rate: r.strike_rate,
      dismissal_type: r.dismissal_type || null,
      dismissal_bowler_id: r.dismissal_bowler_id || null,
      dismissal_fielder_id: r.dismissal_fielder_id || null,
      batting_position: r.batting_position,
    }));
    const { error } = await this.supabase.from('match_batting').insert(insertRows);
    if (error) throw new Error(error.message);
  }

  async saveMatchBowling(rows: {
    match_id: string; innings_id: string; player_id: string | null; player_name: string;
    team_id: string | null; overs: number; maidens: number; runs_given: number; wickets: number;
    economy: number; dot_balls?: number; wides?: number; no_balls?: number;
  }[]): Promise<void> {
    if (rows.length === 0) return;

    await this.supabase
      .from('match_bowling')
      .delete()
      .eq('innings_id', rows[0].innings_id);

    const insertRows = rows.map(r => ({
      id: uuidv4(),
      match_id: r.match_id,
      innings_id: r.innings_id,
      player_id: r.player_id,
      player_name: r.player_name,
      team_id: r.team_id,
      overs: r.overs,
      maidens: r.maidens,
      runs_given: r.runs_given,
      wickets: r.wickets,
      economy: r.economy,
      dot_balls: r.dot_balls || 0,
      wides: r.wides || 0,
      no_balls: r.no_balls || 0,
    }));
    const { error } = await this.supabase.from('match_bowling').insert(insertRows);
    if (error) throw new Error(error.message);
  }

  async getMatchInningsWithScores(matchId: string): Promise<any[]> {
    const { data: inningsData, error: innError } = await this.supabase
      .from('innings')
      .select('*')
      .eq('match_id', matchId)
      .order('innings_number');
    if (innError) throw new Error(innError.message);

    return await Promise.all((inningsData ?? []).map(async (inn: any) => {
      const { data: batting } = await this.supabase
        .from('match_batting')
        .select('*')
        .eq('innings_id', inn.id)
        .order('batting_position');
      const { data: bowling } = await this.supabase
        .from('match_bowling')
        .select('*')
        .eq('innings_id', inn.id)
        .order('overs', { ascending: false });
      return { ...inn, batting: batting ?? [], bowling: bowling ?? [] };
    }));
  }

  async getPlayerMatchHistory(playerId: string, limit = 10): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('match_batting')
      .select(`
        *,
        match:matches!match_id(match_date, match_type, match_number, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name)),
        team:teams!team_id(name)
      `)
      .eq('player_id', playerId)
      .order('match_id')
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data ?? []).map((mb: any) => {
      const { match, team, ...rest } = mb;
      return {
        ...rest,
        match_date: match?.match_date ?? null,
        match_type: match?.match_type ?? null,
        match_number: match?.match_number ?? null,
        team_a_name: match?.team_a?.name ?? null,
        team_b_name: match?.team_b?.name ?? null,
        batting_team_name: team?.name ?? null,
      };
    });
  }

  async getPlayerBowlingHistory(playerId: string, limit = 10): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('match_bowling')
      .select(`
        *,
        match:matches!match_id(match_date, match_type, match_number, team_a:teams!team_a_id(name), team_b:teams!team_b_id(name))
      `)
      .eq('player_id', playerId)
      .order('match_id')
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data ?? []).map((mb: any) => {
      const { match, ...rest } = mb;
      return {
        ...rest,
        match_date: match?.match_date ?? null,
        match_type: match?.match_type ?? null,
        match_number: match?.match_number ?? null,
        team_a_name: match?.team_a?.name ?? null,
        team_b_name: match?.team_b?.name ?? null,
      };
    });
  }

  // Find player by name (fuzzy) — returns best match or null
  async findPlayerByName(name: string): Promise<Player | null> {
    const cleaned = name.trim().toLowerCase();
    const parts = cleaned.split(/\s+/);

    // Try exact full name match via ilike
    const { data: exactRows } = await this.supabase
      .from('players')
      .select('*');

    const allPlayers: Player[] = exactRows ?? [];

    // Exact full name
    const exact = allPlayers.find(
      p => `${p.first_name} ${p.last_name}`.toLowerCase() === cleaned
    );
    if (exact) return exact;

    // First+last partial
    if (parts.length >= 2) {
      const partial = allPlayers.find(
        p => p.first_name.toLowerCase() === parts[0] && p.last_name.toLowerCase() === parts[parts.length - 1]
      );
      if (partial) return partial;
    }

    // Try name_variants
    for (const p of allPlayers) {
      if (!p.name_variants) continue;
      const variants = p.name_variants.toLowerCase().split(',').map((v: string) => v.trim());
      if (variants.some((v: string) => v === cleaned || v.includes(cleaned) || cleaned.includes(v))) {
        return p;
      }
    }

    // Try first name prefix
    if (parts.length >= 2) {
      const byFirst = allPlayers.find(
        p => p.first_name.toLowerCase().startsWith(parts[0])
      );
      if (byFirst) return byFirst;
    }

    return null;
  }

  // ─── Util ─────────────────────────────────────────────────────────────────

  async rawQuery(sql: string, params: any[] = []): Promise<any[]> {
    // Not supported with JS client — return empty array
    console.warn('rawQuery not supported in Supabase JS adapter');
    return [];
  }

  async rawRun(sql: string, params: any[] = []): Promise<void> {
    console.warn('rawRun not supported in Supabase JS adapter');
  }

  async getDashboardStats(seasonId: string): Promise<{
    totalPlayers: number;
    totalTeams: number;
    totalMatches: number;
    completedMatches: number;
  }> {
    const [p, t, m, cm] = await Promise.all([
      this.supabase.from('season_registrations').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
      this.supabase.from('teams').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
      this.supabase.from('matches').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
      this.supabase.from('matches').select('id', { count: 'exact', head: true }).eq('season_id', seasonId).eq('status', 'completed'),
    ]);
    return {
      totalPlayers: p.count ?? 0,
      totalTeams: t.count ?? 0,
      totalMatches: m.count ?? 0,
      completedMatches: cm.count ?? 0,
    };
  }
}
