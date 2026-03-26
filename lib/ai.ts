import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ZPL_SYSTEM_PROMPT = `You are ZPL Analytics AI — an expert cricket analyst for the Zignuts Premier League (ZPL), a corporate T12 cricket tournament at Zignuts Technolab.

You have deep knowledge of every player's historical performance across ZPL 2024 and 2025 seasons.

Tournament Format:
- 12-over format (T12)
- Squad: 12 players, Playing XI: 11
- Max 3 overs per bowler
- Girls' First Over Rule: First over must be bowled by a girl. Only 4 players on field (2 compulsory: keeper + bowler). Runs scored are DOUBLED (except wides/no-balls which count normally)
- Powerplay: First 3 overs
- Impact Player: One substitution allowed mid-match (like IPL)
- DRS: 1 review per team per innings
- At least 2 girls must be in the playing XI

Auction Rules:
- Budget: ₹2.5 Crore (₹25,000,000) per team
- Max 12 players per team
- Players in groups: Group 1 (Star players), Group 2, Group 3, Group 4 (girls/junior)
- Girls must be auctioned first

You analyze cricket data like a professional cricket analyst. Be specific with numbers, reference actual player stats, and give actionable tactical advice.

When providing analysis, always consider the unique ZPL rules especially the girls' first over (runs doubled — this makes a strong girl bowler extremely valuable) and the 12-over format where every ball counts.

Respond in clear, structured format. For JSON requests, respond with valid JSON only.`;

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
    max_tokens: 2048,
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
  const query = `
Pre-Match Strategy Request

YOUR TEAM: ${params.yourTeam.name}
Squad (${params.yourTeam.players?.length || 0} players):
${(params.yourTeam.players || []).map((p: any) => `  - ${p.first_name} ${p.last_name} (${p.player_role || 'Unknown'}) | ${p.batting ? `Bat: ${p.batting.total_runs}r/${p.batting.average}avg` : ''} | ${p.bowling ? `Bowl: ${p.bowling.total_wickets}wkts/${p.bowling.economy}eco` : ''}`).join('\n')}

OPPONENT: ${params.opponentTeam.name}
Squad (${params.opponentTeam.players?.length || 0} players):
${(params.opponentTeam.players || []).map((p: any) => `  - ${p.first_name} ${p.last_name} (${p.player_role || 'Unknown'}) | ${p.batting ? `Bat: ${p.batting.total_runs}r` : ''} | ${p.bowling ? `Bowl: ${p.bowling.total_wickets}wkts` : ''}`).join('\n')}

Provide:
1. Recommended Playing XI (pick 11 from squad, must include at least 2 girls)
2. Batting order (1-11) with reasoning
3. Bowling plan (who bowls which overs, respecting 3-over max)
4. Girls' first over strategy (who bowls, field placement for 4-player restriction)
5. Powerplay strategy (overs 1-3)
6. Death overs plan (overs 10-12)
7. Impact player recommendation
8. Key opposition threats and counter-strategies
9. Win probability assessment`;

  return queryZPLAI({ context: '', query });
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
  const query = `
Head-to-Head Team Comparison

TEAM A: ${params.team1.name}
${JSON.stringify(params.team1.players?.slice(0, 12), null, 2)}

TEAM B: ${params.team2.name}
${JSON.stringify(params.team2.players?.slice(0, 12), null, 2)}

Provide a detailed comparison:
1. Overall strength verdict
2. Batting comparison (depth, power hitters, anchor batters)
3. Bowling comparison (variety, economy, wicket-taking ability)
4. Fielding comparison
5. Girls' over advantage (who has the stronger girl bowler?)
6. Key matchups to watch
7. Predicted winner with reasoning`;

  return queryZPLAI({ context: '', query });
}
