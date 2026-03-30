import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ZPL_SYSTEM_PROMPT = `You are ZPL Analytics AI — a SENIOR CRICKET ANALYST for the Zignuts Premier League (ZPL), a corporate T12 cricket tournament at Zignuts Technolab. You write like an ESPNCricinfo senior analyst — precise, data-driven, and tactically astute.

You have deep knowledge of every player's historical performance across ZPL 2024, 2025, and 2026 seasons.

ZPL 2026 Tournament Format:
- T12 format (12 overs per innings)
- Squad: 13 players, Playing XI: 11
- Max 3 overs per bowler
- Girls' First Over Rule: The 1st over MUST be bowled by a girl. Only 4 fielders allowed (2 compulsory: keeper + bowler). ALL runs scored are DOUBLED (except wides/no-balls which count normally). A girl conceding 10 real runs = 20 on the scoreboard — this single over can swing a match.
- Powerplay: Overs 1–3
- Impact Player: One substitution allowed per innings (like IPL impact player)
- DRS: 1 review per team per innings
- At least 2 girls must be in the playing XI
- 8 teams compete in league format

Auction (2026):
- Budget: ₹3 Crore (₹30,000,000) per team
- 13 players per squad
- Captain values are pre-fixed and deducted from budget
- Player groups: Group A – Star, Group B – Good, Group C – Average, Group D – Poor, No Group
- Girls are auctioned first

When you analyze, ALWAYS:
1. Reference specific player stats by name (runs, wickets, economy, average, strike rate)
2. In T12, economy and strike rate matter MORE than raw averages — be explicit about this
3. The girls' first over is the highest-leverage moment of the match — analyse it carefully
4. Be professional, tactical, and specific — write like a senior analyst, not a chatbot
5. Use ONLY the data provided — never invent or fabricate statistics
6. Format with clear Markdown headings (##) and bullet points

For JSON requests, respond with valid JSON only.`;

export interface AISuggestionParams {
  context: string;
  query: string;
  data?: any;
  responseFormat?: 'text' | 'json';
}

export async function queryZPLAI(params: AISuggestionParams): Promise<string> {
  const userMessage = params.data
    ? `${params.query}\n\nData:\n${JSON.stringify(params.data, null, 2)}`
    : params.query;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: ZPL_SYSTEM_PROMPT + (params.context ? `\n\nAdditional Context:\n${params.context}` : ''),
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  return content.text;
}

export async function getAuctionSuggestion(params: {
  teamName: string;
  remainingBudget: number;
  playersCount: number;
  maxPlayers: number;
  currentSquad: any[];
  availablePlayers: any[];
  otherTeams: any[];
}): Promise<any> {
  const query = `
Auction Strategy Request for team: ${params.teamName}

Budget remaining: ₹${(params.remainingBudget / 100000).toFixed(1)} Lakhs
Players bought: ${params.playersCount}/${params.maxPlayers}
Avg budget per remaining slot: ₹${((params.remainingBudget / Math.max(1, params.maxPlayers - params.playersCount)) / 100000).toFixed(1)} Lakhs

Current squad: ${JSON.stringify(params.currentSquad.map(p => ({
    name: `${p.first_name} ${p.last_name}`,
    role: p.player_role,
    price: p.purchase_price,
    batting: p.batting ? `${p.batting.total_runs} runs, ${p.batting.average} avg` : 'No batting data',
    bowling: p.bowling ? `${p.bowling.total_wickets} wkts, ${p.bowling.economy} eco` : 'No bowling data',
  })))}

Available players in pool (top candidates): ${JSON.stringify(params.availablePlayers.slice(0, 30).map(p => ({
    name: `${p.first_name} ${p.last_name}`,
    role: p.player_role,
    group: p.group_number,
    basePrice: p.base_price,
    batting: p.batting ? `${p.batting.total_runs} runs, avg ${p.batting.average}` : null,
    bowling: p.bowling ? `${p.bowling.total_wickets} wkts, eco ${p.bowling.economy}` : null,
    mvp: p.mvp ? `MVP: ${p.mvp.total_score}` : null,
  })))}

Other teams summary: ${JSON.stringify(params.otherTeams.map(t => ({
    name: t.name,
    players: t.players_count,
    spent: t.budget_used,
    remaining: t.budget_remaining,
  })))}

Provide auction strategy recommendation in JSON format:
{
  "recommendation": {
    "player_name": "string",
    "reason": "string",
    "price_range": { "min": number, "max": number },
    "priority": "high|medium|low"
  },
  "alternative_targets": [{ "player_name": "string", "reason": "string" }],
  "team_balance": {
    "assessment": "string",
    "batting_strength": "weak|moderate|strong",
    "bowling_strength": "weak|moderate|strong",
    "gaps": ["string"]
  },
  "risks": ["string"],
  "budget_advice": "string"
}`;

  const response = await queryZPLAI({ context: '', query, responseFormat: 'json' });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
  } catch {
    return { raw: response };
  }
}

export async function getMatchStrategy(params: {
  yourTeam: any;
  opponentTeam: any;
  seasonRules?: any;
}): Promise<string> {
  const fmtPlayer = (p: any) => {
    const gender = p.gender === 'Female' ? ' ♀' : '';
    const bat = p.batting
      ? `${p.batting.total_runs ?? 0}r / avg ${Number(p.batting.average ?? 0).toFixed(1)} / SR ${Number(p.batting.strike_rate ?? 0).toFixed(0)}`
      : 'No bat data';
    const bowl = p.bowling
      ? `${p.bowling.total_wickets ?? 0}wkts / eco ${Number(p.bowling.economy ?? 0).toFixed(2)}`
      : 'No bowl data';
    return `  • ${p.first_name} ${p.last_name}${gender} | ${p.player_role || 'Unknown'} | Bat: ${bat} | Bowl: ${bowl}`;
  };

  const girlsYour = (params.yourTeam.players || []).filter((p: any) => p.gender === 'Female');
  const girlsOpp  = (params.opponentTeam.players || []).filter((p: any) => p.gender === 'Female');
  const girlBowlersOpp = girlsOpp.filter((p: any) => (p.bowling?.total_wickets ?? 0) > 0);

  const query = `
## PRE-MATCH STRATEGY DOSSIER REQUEST
You are a SENIOR ZPL MATCH ANALYST. Produce an exhaustive, actionable pre-match strategy dossier.

═══ YOUR TEAM: ${params.yourTeam.name?.toUpperCase()} (${params.yourTeam.players?.length ?? 0} players) ═══
Girls in squad (${girlsYour.length}): ${girlsYour.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ') || 'None'}
${(params.yourTeam.players || []).map(fmtPlayer).join('\n')}

═══ OPPOSITION: ${params.opponentTeam.name?.toUpperCase()} (${params.opponentTeam.players?.length ?? 0} players) ═══
Girls in squad (${girlsOpp.length}): ${girlsOpp.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ') || 'None'}
Opposition girl bowlers (first-over threat): ${girlBowlersOpp.map((p: any) => `${p.first_name} ${p.last_name} (${p.bowling.total_wickets}wkts, eco ${Number(p.bowling.economy ?? 0).toFixed(2)})`).join(', ') || 'None known'}
${(params.opponentTeam.players || []).map(fmtPlayer).join('\n')}

---
Write a COMPLETE PRE-MATCH STRATEGY DOSSIER for ${params.yourTeam.name}. Use these EXACT section headings (##):

## Recommended Playing XI
List all 11 players with role. Explain why each was picked. Must include ≥2 girls. Who sits out and why?

## Batting Order (1–11)
Name each slot with batting style + rationale. Who opens? Who anchors the middle? Who finishes?

## Bowling Plan
List the over-by-over bowling rotation. For each bowler: name, phase (powerplay/middle/death), overs allocated, reason. Max 3 overs each.

## Girls' First Over Strategy
Name the girl bowler. Field set (4 fielders: keeper + bowler + 2 others — where do they stand?). What line and length to bowl? How to minimise the double-run damage?

## Powerplay Strategy (Overs 1–3)
Batting approach (attack or consolidate?). Bowling choices. Field settings.

## Death Overs Plan (Overs 10–12)
Who bowls the final overs? Specific deliveries (yorkers, slower balls, wide yorkers). Batting targets.

## Impact Player Option
Name 2 potential impact players for batting and bowling scenarios. When do you bring them in?

## Opposition Threat Analysis
Identify the top 3 opposition threats by name with their stats. Specific counter-strategies for each.

## Win Probability Assessment
Give a % win estimate. Explain the key factors that determine the outcome — specifically the girls' over, powerplay result, and death bowling.`;

  return queryZPLAI({ context: '', query, responseFormat: 'text' });
}

export async function getPlayerAnalysis(params: {
  player: any;
  allStats: any;
}): Promise<string> {
  const query = `
Player Analysis Request

Player: ${params.player.first_name} ${params.player.last_name}
Role: ${params.player.player_role || 'Unknown'}
Batting Hand: ${params.player.batting_hand || 'Unknown'}
Bowling Style: ${params.player.bowling_style || 'Unknown'}

Career Statistics:
${JSON.stringify(params.allStats, null, 2)}

Provide:
1. Playing style assessment
2. Key strengths (with stat evidence)
3. Weaknesses or areas to improve
4. Best role in a T12 lineup
5. Ideal batting position (if batter)
6. Bowling role (if bowler)
7. ZPL value rating (1-10) with reasoning
8. Comparison to player type (e.g., "impact lower-order hitter", "economic spinner")`;

  return queryZPLAI({ context: '', query });
}

export async function parseScorecard(pdfBase64: string): Promise<any> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64,
          },
        } as any,
        {
          type: 'text',
          text: `Parse this cricket scorecard PDF and extract all match data. Return ONLY valid JSON in this exact format:
{
  "match_info": {
    "team_a": "string (first batting team name)",
    "team_b": "string (second batting team name)",
    "result": "string (match result summary)",
    "venue": "string or null",
    "date": "string or null"
  },
  "innings": [
    {
      "innings_number": 1,
      "batting_team": "string",
      "bowling_team": "string",
      "total_runs": number,
      "total_wickets": number,
      "total_overs": number,
      "extras": { "wides": number, "no_balls": number, "byes": number, "leg_byes": number, "total": number },
      "batting": [
        {
          "position": number,
          "player_name": "string",
          "runs": number,
          "balls": number,
          "fours": number,
          "sixes": number,
          "strike_rate": number,
          "dismissal_type": "string (bowled/caught/lbw/run out/stumped/not out/retired)",
          "bowler": "string or null",
          "fielder": "string or null"
        }
      ],
      "bowling": [
        {
          "player_name": "string",
          "overs": number,
          "maidens": number,
          "runs": number,
          "wickets": number,
          "economy": number,
          "wides": number,
          "no_balls": number
        }
      ],
      "fall_of_wickets": "string or null"
    }
  ]
}

Extract ALL batsmen (including not-out) and ALL bowlers. Be precise with numbers. Return ONLY the JSON object, no other text.`,
        },
      ],
    }],
  } as any, {
    headers: { 'anthropic-beta': 'pdfs-2024-09-25' },
  } as any);

  const text = (response.content[0] as any).text as string;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse scorecard: no JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

export async function analyzeMatchScorecard(params: {
  scorecardData: any;
  matchInfo: { team_a: string; team_b: string; season_name?: string; match_type?: string };
}): Promise<string> {
  const query = `
You are acting as a SENIOR CRICKET ANALYST for the Zignuts Premier League (ZPL).

Match: ${params.matchInfo.team_a} vs ${params.matchInfo.team_b}
${params.matchInfo.season_name ? `Season: ${params.matchInfo.season_name}` : ''}
${params.matchInfo.match_type ? `Match Type: ${params.matchInfo.match_type}` : ''}

Complete Scorecard:
${JSON.stringify(params.scorecardData, null, 2)}

Provide a comprehensive senior cricket analyst match report covering:

## Match Summary
Brief overview of how the match unfolded

## Batting Analysis
- Star performer(s) with specific stats
- Key partnerships
- Batting collapses or momentum shifts
- Strike rates and their impact in T12 format

## Bowling Analysis
- Best bowling figures and why they were decisive
- Economy rates and their importance
- Death bowling effectiveness (overs 10-12)

## Fielding Highlights
- Catches, run-outs, or stumpings that changed the game

## Match Turning Point
The single moment that decided the match outcome

## Player of the Match
Your pick with detailed justification backed by numbers

## Individual Recommendations
For each standout performer (positive or negative), give specific advice:
- What they did well
- What they should improve
- Specific technical recommendations for ZPL T12 format

## Team-Level Insights
Tactical strengths/weaknesses exposed in this match for each team

Be specific, use actual numbers from the scorecard, and give actionable insights relevant to the ZPL T12 format.`;

  return queryZPLAI({ context: '', query });
}

export async function getTeamComparison(params: {
  team1: any;
  team2: any;
}): Promise<string> {
  const fmtPlayer = (p: any) => {
    const gender = p.gender === 'Female' ? ' ♀' : '';
    const price = p.purchase_price ? ` [₹${(p.purchase_price / 100000).toFixed(0)}L]` : '';
    const bat = p.batting
      ? `${p.batting.total_runs ?? 0}r / avg ${Number(p.batting.average ?? 0).toFixed(1)} / SR ${Number(p.batting.strike_rate ?? 0).toFixed(0)}`
      : '—';
    const bowl = p.bowling
      ? `${p.bowling.total_wickets ?? 0}wkts / eco ${Number(p.bowling.economy ?? 0).toFixed(2)} / avg ${Number(p.bowling.average ?? 0).toFixed(1)}`
      : '—';
    const mvp = p.mvp ? ` / MVP ${Number(p.mvp.total_score ?? 0).toFixed(1)}` : '';
    return `  • ${p.first_name} ${p.last_name}${gender}${price} | ${p.player_role || 'Unknown'} | Bat: ${bat} | Bowl: ${bowl}${mvp}`;
  };

  const teamSummary = (t: any) => {
    const ps = t.players || [];
    const girls = ps.filter((p: any) => p.gender === 'Female');
    const girlBowlers = girls.filter((p: any) => (p.bowling?.total_wickets ?? 0) > 0);
    const allRuns = ps.reduce((s: number, p: any) => s + (p.batting?.total_runs ?? 0), 0);
    const allWkts = ps.reduce((s: number, p: any) => s + (p.bowling?.total_wickets ?? 0), 0);
    const ecoBowlers = ps.filter((p: any) => (p.bowling?.economy ?? 0) > 0);
    const avgEco = ecoBowlers.length
      ? (ecoBowlers.reduce((s: number, p: any) => s + p.bowling.economy, 0) / ecoBowlers.length).toFixed(2)
      : 'N/A';
    const topBatter = [...ps].sort((a, b) => (b.batting?.total_runs ?? 0) - (a.batting?.total_runs ?? 0))[0];
    const topBowler = [...ps].sort((a, b) => (b.bowling?.total_wickets ?? 0) - (a.bowling?.total_wickets ?? 0))[0];
    const topEco    = [...ecoBowlers].sort((a, b) => (a.bowling?.economy ?? 99) - (b.bowling?.economy ?? 99))[0];
    return { girls, girlBowlers, allRuns, allWkts, avgEco, topBatter, topBowler, topEco };
  };

  const s1 = teamSummary(params.team1);
  const s2 = teamSummary(params.team2);

  const query = `
## HEAD-TO-HEAD COMPARISON REQUEST
You are a SENIOR ZPL ANALYST. Write an authoritative, data-driven comparison report.

═══ ${params.team1.name?.toUpperCase()} (${params.team1.players?.length ?? 0} players) ═══
Total career runs: ${s1.allRuns} | Total wickets: ${s1.allWkts} | Avg economy: ${s1.avgEco}
Girls (${s1.girls.length}): ${s1.girls.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ') || 'None'}
Girl bowlers (1st over candidates): ${s1.girlBowlers.map((p: any) => `${p.first_name} ${p.last_name} — ${p.bowling.total_wickets}wkts, eco ${Number(p.bowling.economy ?? 0).toFixed(2)}`).join(' | ') || 'None'}
Top batter: ${s1.topBatter ? `${s1.topBatter.first_name} ${s1.topBatter.last_name} (${s1.topBatter.batting?.total_runs ?? 0}r, avg ${Number(s1.topBatter.batting?.average ?? 0).toFixed(1)}, SR ${Number(s1.topBatter.batting?.strike_rate ?? 0).toFixed(0)})` : 'N/A'}
Top wicket-taker: ${s1.topBowler ? `${s1.topBowler.first_name} ${s1.topBowler.last_name} (${s1.topBowler.bowling?.total_wickets ?? 0}wkts, eco ${Number(s1.topBowler.bowling?.economy ?? 0).toFixed(2)})` : 'N/A'}
Most economical: ${s1.topEco ? `${s1.topEco.first_name} ${s1.topEco.last_name} (eco ${Number(s1.topEco.bowling?.economy ?? 0).toFixed(2)})` : 'N/A'}
Full squad:
${(params.team1.players || []).map(fmtPlayer).join('\n')}

═══ ${params.team2.name?.toUpperCase()} (${params.team2.players?.length ?? 0} players) ═══
Total career runs: ${s2.allRuns} | Total wickets: ${s2.allWkts} | Avg economy: ${s2.avgEco}
Girls (${s2.girls.length}): ${s2.girls.map((p: any) => `${p.first_name} ${p.last_name}`).join(', ') || 'None'}
Girl bowlers (1st over candidates): ${s2.girlBowlers.map((p: any) => `${p.first_name} ${p.last_name} — ${p.bowling.total_wickets}wkts, eco ${Number(p.bowling.economy ?? 0).toFixed(2)}`).join(' | ') || 'None'}
Top batter: ${s2.topBatter ? `${s2.topBatter.first_name} ${s2.topBatter.last_name} (${s2.topBatter.batting?.total_runs ?? 0}r, avg ${Number(s2.topBatter.batting?.average ?? 0).toFixed(1)}, SR ${Number(s2.topBatter.batting?.strike_rate ?? 0).toFixed(0)})` : 'N/A'}
Top wicket-taker: ${s2.topBowler ? `${s2.topBowler.first_name} ${s2.topBowler.last_name} (${s2.topBowler.bowling?.total_wickets ?? 0}wkts, eco ${Number(s2.topBowler.bowling?.economy ?? 0).toFixed(2)})` : 'N/A'}
Most economical: ${s2.topEco ? `${s2.topEco.first_name} ${s2.topEco.last_name} (eco ${Number(s2.topEco.bowling?.economy ?? 0).toFixed(2)})` : 'N/A'}
Full squad:
${(params.team2.players || []).map(fmtPlayer).join('\n')}

---
Write a COMPREHENSIVE HEAD-TO-HEAD ANALYST REPORT. Use these EXACT section headings (##):

## Executive Summary
2–3 decisive sentences: who looks stronger and why.

## Batting Comparison
Compare T12 strike rates, run-scorers, power hitters, and anchors. Name players with stats. Who has the batting edge?

## Bowling Comparison
Economy rates, wicket-taking threats, pace vs spin variety. Who wins the bowling battle?

## Girls' Over Analysis
The match's highest-leverage moment. Who has the better girl bowler? Estimate how many "real runs" each girl bowler concedes per over, then show the doubled impact on the scoreboard.

## Key Player Battles
3 specific head-to-head player match-ups to watch, backed by stats.

## Tactical Strengths & Weaknesses
Each team's structural advantages and exploitable weaknesses.

## Squad Depth & Flexibility
Bench quality, all-rounders, and impact player options for each side.

## Predicted Winner
Name the winner, provide a win % estimate, and justify with specific statistical reasoning.`;

  return queryZPLAI({ context: '', query, responseFormat: 'text' });
}
