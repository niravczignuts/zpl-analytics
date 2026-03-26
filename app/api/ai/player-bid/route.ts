import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { queryZPLAI } from '@/lib/ai';

const L = (n: number) => `₹${(n / 100000).toFixed(2)}L`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { player_id, season_id } = body;

    if (!player_id || !season_id) {
      return NextResponse.json({ error: 'player_id and season_id required' }, { status: 400 });
    }

    const db = getDB();
    const player = await db.getPlayerById(player_id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    // ── Find Super Smashers in this season ──────────────────────────────────
    const allTeams = await db.getTeams(season_id);
    const ssTeam = allTeams.find(t =>
      t.name.toLowerCase().includes('super') && t.name.toLowerCase().includes('smash')
    ) || allTeams.find(t => t.name.toLowerCase().includes('smash'));

    if (!ssTeam) {
      return NextResponse.json({ error: 'Super Smashers team not found for this season.' }, { status: 404 });
    }

    // ── Super Smashers budget + squad ───────────────────────────────────────
    const ssBudget = await db.getTeamBudget(ssTeam.id, season_id);
    const ssSquad = await db.getTeamWithSquad(ssTeam.id, season_id);

    const ssSquadSummary = (ssSquad?.players || []).map((p: any) => {
      const roles = [];
      if (p.batting) roles.push(`bat:${p.batting.total_runs ?? 0}r avg${Number(p.batting.average ?? 0).toFixed(1)}`);
      if (p.bowling) roles.push(`bowl:${p.bowling.total_wickets ?? 0}wkts eco${Number(p.bowling.economy ?? 0).toFixed(2)}`);
      return `  • ${p.first_name} ${p.last_name} (${p.player_role || 'Unknown'}, ${p.gender || '?'}) — paid ${L(p.purchase_price || 0)} [${roles.join(', ') || 'no stats'}]`;
    }).join('\n') || '  (no players bought yet)';

    // Count current squad composition
    const ssPlayers = ssSquad?.players || [];
    const ssRoleCounts = ssPlayers.reduce((acc: Record<string, number>, p: any) => {
      const r = p.player_role || 'Unknown';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const ssFemaleCount = ssPlayers.filter((p: any) => p.gender === 'Female').length;
    const ssSlotsLeft = ssBudget.max_players - ssBudget.players_bought;

    // ── Player full historical stats ────────────────────────────────────────
    const allStats = await db.getPlayerStats(player_id); // all seasons
    const remarks = await db.getPlayerRemarks(player_id);
    const reg = (await db.getRegistrations(season_id)).find(r => r.player_id === player_id);
    const basePrice = reg?.base_price || 0;
    const playerName = `${player.first_name} ${player.last_name}`;

    const statsBlock = Object.keys(allStats).length > 0
      ? Object.entries(allStats)
          .sort(([a], [b]) => b.localeCompare(a)) // newest first
          .map(([sid, s]: [string, any]) => {
            const lines: string[] = [`  Season ${sid}:`];
            if (s.batting) lines.push(
              `    Batting: ${s.batting.total_matches ?? s.batting.total_match ?? 0} matches, ` +
              `${s.batting.total_runs ?? 0} runs, avg ${Number(s.batting.average ?? 0).toFixed(1)}, ` +
              `SR ${Number(s.batting.strike_rate ?? 0).toFixed(1)}, HS ${s.batting.highest_run ?? 0}, ` +
              `${s.batting.fifties ?? 0} fifties, ${s.batting.sixes ?? 0} sixes`
            );
            if (s.bowling) lines.push(
              `    Bowling: ${s.bowling.total_wickets ?? 0} wickets in ${s.bowling.overs ?? 0} overs, ` +
              `eco ${Number(s.bowling.economy ?? 0).toFixed(2)}, avg ${Number(s.bowling.avg ?? 0).toFixed(1)}, ` +
              `best ${s.bowling.highest_wicket ?? '0'}`
            );
            if (s.fielding) lines.push(
              `    Fielding: ${s.fielding.catches ?? 0} catches, ${s.fielding.run_outs ?? 0} run-outs, ` +
              `${s.fielding.stumpings ?? 0} stumpings`
            );
            if (s.mvp) lines.push(
              `    MVP Score: ${Number(s.mvp.total_score ?? 0).toFixed(2)} ` +
              `(bat:${Number(s.mvp.batting_score ?? 0).toFixed(2)}, ` +
              `bowl:${Number(s.mvp.bowling_score ?? 0).toFixed(2)}, ` +
              `field:${Number(s.mvp.fielding_score ?? 0).toFixed(2)})`
            );
            return lines.join('\n');
          }).join('\n')
      : '  No historical stats available (new or untracked player)';

    const remarksBlock = remarks.length > 0
      ? remarks.map(r => `  [${r.remark_type?.toUpperCase()}] ${r.remark}`).join('\n')
      : '  No admin notes.';

    // ── Market intelligence: what other teams paid for similar-role players ─
    const allPurchases = await db.getAuctionPurchases(season_id) as any[];
    const playerRole = player.player_role || '';
    const similarPurchases = allPurchases.filter(p =>
      p.team_id !== ssTeam.id &&
      p.purchase_price > 0 &&
      p.team_role === 'player' // exclude captains/managers
    );

    const marketBlock = similarPurchases.length > 0
      ? similarPurchases.map(p =>
          `  ${p.player_name} → ${p.team_name}: ${L(p.purchase_price)}`
        ).join('\n')
      : '  No auction purchases recorded yet this season.';

    // ── Other teams budget status ───────────────────────────────────────────
    const otherTeamsBudgets = (await Promise.all(allTeams
      .filter(t => t.id !== ssTeam.id)
      .map(async t => {
        const b = await db.getTeamBudget(t.id, season_id);
        return `  ${t.name}: ${L(b.remaining)} remaining, ${b.players_bought}/${b.max_players} players bought`;
      }))).join('\n');

    // ── Build the analyst prompt ────────────────────────────────────────────
    const query = `
You are the SENIOR CRICKET ANALYST for Super Smashers in the ZPL (Zignuts Premier League) auction.
Your ONLY job is to advise Super Smashers on whether to bid on this player and exactly how much to pay.

═══════════════════════════════════════════════════════════
SUPER SMASHERS — CURRENT STATUS
═══════════════════════════════════════════════════════════
Budget remaining: ${L(ssBudget.remaining)} of ${L(ssBudget.total_budget)}
Players bought: ${ssBudget.players_bought}/${ssBudget.max_players} (${ssSlotsLeft} slots left)
Avg budget per remaining slot: ${L(ssBudget.avg_per_remaining_slot)}
Female players in squad: ${ssFemaleCount} (ZPL rule: minimum 2 in playing XI)
Current squad role breakdown: ${JSON.stringify(ssRoleCounts)}

Current squad:
${ssSquadSummary}

═══════════════════════════════════════════════════════════
PLAYER UNDER CONSIDERATION
═══════════════════════════════════════════════════════════
Name: ${playerName}
Role: ${playerRole || 'Unknown'}
Gender: ${player.gender || 'Unknown'}
Batting: ${player.batting_hand || 'N/A'} | Bowling: ${player.bowling_style || 'N/A'}
Base Price: ${L(basePrice)}
Auction Group: ${reg?.group_number ?? 'Unknown'}

Historical Performance (ZPL 2024 & 2025):
${statsBlock}

Admin Scouting Notes:
${remarksBlock}

═══════════════════════════════════════════════════════════
MARKET INTELLIGENCE
═══════════════════════════════════════════════════════════
What other teams have paid for players this auction:
${marketBlock}

Other teams' remaining budgets:
${otherTeamsBudgets}

═══════════════════════════════════════════════════════════
ZPL FORMAT REMINDER
═══════════════════════════════════════════════════════════
- T12 format (12 overs) — every ball counts, SR and economy are critical
- Girls' First Over Rule: first over by a girl, runs DOUBLED — a strong girl bowler is extremely valuable
- Powerplay: overs 1-3
- Max 3 overs per bowler
- Squad: 12 players, playing XI: 11 (at least 2 girls)
- Impact Player substitution allowed

═══════════════════════════════════════════════════════════
YOUR ANALYSIS TASK
═══════════════════════════════════════════════════════════
As Super Smashers' senior analyst:
1. Assess this player's ACTUAL value to Super Smashers specifically (does the squad need this role/skill?)
2. Set a SPECIFIC max bid price based on: their ZPL track record, the squad gap they fill, what rivals are paying, and Super Smashers' remaining budget strategy
3. Consider how many slots are left and how much budget needs to be reserved for remaining slots
4. If this is a girl player, weight the girls' first over rule — a quality girl bowler can be worth a premium
5. Be direct and specific — no vague advice

Respond with ONLY this JSON (no markdown, no extra text):
{
  "recommend": true or false,
  "verdict": "BUY at ₹X | BUY CAUTIOUSLY up to ₹X | PASS",
  "reason": "2-3 specific sentences referencing their actual stats and Super Smashers' squad needs",
  "max_bid": number in rupees (0 if pass),
  "squad_fit": "how this player fills a specific gap in current Super Smashers squad",
  "value_assessment": "comparison to market rate — are they underpriced or a risk",
  "risks": ["specific risk 1", "specific risk 2"],
  "budget_impact": "after this purchase: Super Smashers would have ₹X left for Y slots = ₹Z avg per slot"
}`;

    const response = await queryZPLAI({ context: '', query, responseFormat: 'json' });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
      return NextResponse.json({ ...result, ss_team_name: ssTeam.name });
    } catch {
      return NextResponse.json({ raw: response });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
