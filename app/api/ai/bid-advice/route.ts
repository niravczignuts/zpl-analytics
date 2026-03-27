import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { getZPL2025Price, UNSOLD_2025 } from '@/lib/zpl2025-db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const L = (n: number) => `${(n / 100000).toFixed(1)}L`;

// ── System prompt from the ZPL Auction Module AI Integration Guide ─────────
const SYSTEM_PROMPT = `You are an AI auction strategist for ZPL (Zignuts Premier League) 2026 cricket auction.
Your job is to give a team owner a sharp, data-driven bidding recommendation on any player presented.
You will receive a JSON object called PLAYER_CONTEXT. Use it exclusively. Do not hallucinate data.

---

## DECISION FRAMEWORK — apply in this exact order:

### STEP 1 — OWNER NOTES (Highest Priority Override)
Read owner_note carefully.
- Price range mentioned (e.g. "60 to 80 Lakh", "max 50L") → use as hard ceiling for Max Bid.
- "strong buy", "must have", "priority" → upgrade recommendation one level (CAUTIOUS→BID, BID→STRONG BID).
- "avoid", "skip", "overrated" → recommend PASS unless stats are exceptional.
- No note → skip this step silently.

### STEP 2 — OWNER STAR RATINGS (High Priority)
Sum batting + bowling + fielding stars (each 0–5, max 15 total).
- 12–15 → Elite in owner's view → Support aggressive bidding
- 8–11  → Solid pick → Support bidding at or slightly above market
- 4–7   → Utility → Conservative bid only
- 1–3   → Weak → PASS unless price is near base
- Average available ratings if not all three are given.
- No ratings → skip this step silently.

### STEP 3 — ZPL 2025 ANCHOR PRICE
Look up player_name in ZPL_2025_PRICE_DATABASE (case-insensitive, handle minor spelling variants).
- Found → use as your anchor. Fair 2026 value = 2025 price ±20% adjusted for performance.
- Not found → state "New Player — No ZPL 2025 record." Anchor to Group-comparable players.

### STEP 4 — PERFORMANCE STATS
Use performance_stats from PLAYER_CONTEXT.
- Strong stats (high avg, economy, MVPs) → add 10–25% to fair value.
- Weak or no stats → neutral or -10–20%.

### STEP 5 — MARKET CALIBRATION (ZPL 2026 Recent Purchases)
Use recent_purchases_2026 list.
- Identify 2–3 players of the same Group and similar role already sold in ZPL 2026.
- If market is running hot (sold 20%+ above 2025 prices) → factor upward.
- If market is conservative → bid at or below 2025 anchor.

### STEP 6 — BUDGET RISK CHECK
If budget_remaining_lakhs < 30 and recommended price > 50% of remaining budget → add a budget warning.

### STEP 7 — SYNTHESIZE MAX BID
Combine all signals into one Max Bid number.
- Express in Lakhs, rounded to nearest 0.5L.
- If owner note has a price ceiling, never exceed it.

---

## RESPONSE FORMAT — always use this exact structure:

**🏏 Player:** [Name]
**📅 ZPL 2025 Price:** [X.XL — Team Name] OR [New Player — No ZPL 2025 record]

**📊 Recommendation:** [STRONG BID / BID / CAUTIOUS BID / PASS]

**💰 Max Bid Price:** ₹[X.X]L

**🧠 Reasoning:**
[3–5 lines. Be specific. Reference: 2025 anchor, performance signals, market comps, owner note/stars. No padding.]

**⚖️ Key Trade-off:**
[1–2 lines. What you gain vs. what you risk at this price.]

**🔁 Comparable Players:**
[2–3 players with their 2025 or 2026 price and Group for reference.]

---

## ZPL 2025 PRICE DATABASE — your ground truth. Do NOT invent prices outside this list.

GROUP LEGEND:
Group A – Star (typically 50L+) | Group B – Good (25–65L) | Group C – Average (12–25L) | Group D – Poor (1.5–20L) | No Group = Utility/Support (1–10L)

TROJAN HORSE: Nihar Bhatt|G2|37.5L, Apeksha Raval|NoG|15.0L, Mushrat Saiyad|NoG|4.5L, Ravi Jagani|G1|66.0L, Pratham Pathak|G3|34.0L, Vivek Yadav|NoG|7.5L, Ravi Thakor|G2|37.5L, Jasrajsinh Jethwa|G4|15.0L, Jay Patel|NoG|26.5L, Chetan Singadia|NoG|1.0L, Parth Dabhi|NoG|1.0L, Karan Bharakhda|NoG|1.0L
THE MAVERICKS: Ishan Bramhbhatt|G1|31.5L, Rinkal Patel|NoG|33.0L, Rushita Vagasiya|NoG|2.0L, Vishvam Shah|G3|12.0L, Vaibhav Parmar|G3|16.5L, Naitik Vala|NoG|5.5L, Vishal Gadhiya|G2|31.5L, Ashish Kumar Patel|G3|20.5L, Ankit Pithiya|G3|20.5L, Jaychand Maurya|G3|17.5L, Dhrumil Amrutiya|G3|22.5L, Harsh Kanzariya|NoG|1.0L
MARVEL MONSTERS: Parth Trivedi|G2|63.0L, Drashti Kapatel|NoG|4.5L, Ruhi Kansagara|NoG|9.5L, Divyesh Mepal|G2|49.5L, Aman Tiwari|G3|16.5L, Smit Soni|NoG|5.5L, Lovesh Chaudhari|G2|63.0L, Nisarg Chhaniyara|G3|13.5L, Srivasanth Jammula|NoG|1.5L, Divyesh Lagadhir|NoG|1.5L, Vraj Makvana|NoG|1.0L, Keyur Vadagama|NoG|1.0L
RED SQUAD: Gunjan Kalariya|G3|14.0L, Keyuri Patel|NoG|1.5L, Shreya Patel|NoG|22.0L, Harsh Raghavani|G1|85.5L, Akash Singh|G4|1.5L, Ketan Kandoriya|NoG|1.5L, Neel Joshi|G2|50.5L, Darshan Vanol|G2|31.5L, Sarju Dharsandiya|G3|14.0L, Kishan Modi|NoG|25.5L, Mukhtar Suthar|NoG|1.0L, Deep Mistry|NoG|1.0L
SUPER SMASHERS: Nirav Chaudhari|G2|31.0L, Visha Patel|NoG|18.5L, Drashti Mitaliya|NoG|1.0L, Tejas Patel|G2|26.0L, Ravi Patel|G2|31.0L, Jeet Matalia|G3|16.0L, Chirag Sharma|NoG|33.5L, Parth Gupta|G1|75.5L, Rutvik Malaviya|NoG|1.5L, Rohit Parmar|NoG|7.5L, Rohit Vispute|NoG|1.0L, Utsav Darji|NoG|1.0L
STAR STRIKERS: Rahul Joshi|G1|57.5L, Urmila Sondarva|NoG|5.0L, Nidhi Bavadiya|NoG|2.5L, A Venkata|G3|18.0L, Harsh Mistry|G3|14.5L, Jatin Kantariya|NoG|28.0L, Sarthak Rakholiya|G2|57.5L, Virang Kori|G3|16.5L, Dhruv Kakadiya|G3|22.5L, Khush Jadvani|NoG|1.0L, Sarman Dasa|NoG|1.0L, Soujanya Patra|NoG|1.0L
GRAY MIGHTY: Divyesh Patel|G3|20.5L, Rakhee Singh|NoG|4.0L, Zalak Maheshwari|NoG|5.0L, Dharmik Dodiya|G2|47.5L, Hardik Patel|NoG|16.0L, MD Danish|G1|71.5L, Vihang Patel|G4|20.5L, Kevin Barot|NoG|37.0L, Mangesh Vasekar|NoG|8.5L, Meet Shastri|NoG|1.0L, Shubham Brahmbhatt|NoG|1.0L, Himanshu Amin|NoG|1.0L
THE TECH TITANS: Harsh Chauhan|G2|33.5L, Saloni Doshi|NoG|13.5L, Kajal Mandal|NoG|1.0L, Shobhit Shrivastava|G2|33.5L, Abhishek Chavda|G3|9.5L, Deepak Maurya|G4|1.5L, Raviraj Chhasatiya|G1|75.5L, Vishnu Kerasiya|NoG|1.5L, Bhavin Prajapati|NoG|37.5L, Hari Malam|NoG|1.0L, Ravi Raj|NoG|1.0L, Hard Trivedi|NoG|1.0L

UNSOLD IN ZPL 2025 (risky/unproven): Sarman Dasa, Yash Kansagra, Deep Mistry

HARD RULES:
1. Never fabricate a ZPL 2025 price. Not in the database = New Player.
2. Never exceed the owner's note price ceiling.
3. Max Bid is a ceiling — suggest bidding lower if market allows.
4. Keep reasoning under 5 lines. No fluff.
5. Prices are in Lakhs. 1L = ₹1,00,000.

ZPL FORMAT REMINDERS:
- T12 format (12 overs). Girls' First Over Rule: first over bowled by a girl — runs DOUBLED (extremely valuable).
- Squad: 12 players, XI: 11 (min 2 girls). Max 3 overs per bowler. Impact Player allowed.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { player_id, season_id, team_id, current_bid_price, owner_ratings, owner_note } = body;

    if (!player_id || !season_id) {
      return NextResponse.json({ error: 'player_id and season_id required' }, { status: 400 });
    }

    const db = getDB();

    // ── Fetch player data ──────────────────────────────────────────────────────
    const player = await db.getPlayerById(player_id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const playerName = `${player.first_name} ${player.last_name}`;
    const allStats = await db.getPlayerStats(player_id);
    const reg = (await db.getRegistrations(season_id)).find(r => r.player_id === player_id);
    const basePrice = reg?.base_price ?? 0;

    // ── ZPL 2025 historical price ──────────────────────────────────────────────
    const zpl2025 = getZPL2025Price(playerName);
    const isUnsold2025 = UNSOLD_2025.has(playerName.trim().toLowerCase());

    // ── Team budget info ───────────────────────────────────────────────────────
    let teamBudget = null;
    let teamName = 'Your Team';
    if (team_id) {
      const allTeams = await db.getTeams(season_id);
      const team = allTeams.find(t => t.id === team_id);
      if (team) {
        teamName = team.name;
        teamBudget = await db.getTeamBudget(team_id, season_id);
      }
    }

    // ── Recent purchases in 2026 auction (last 15) ─────────────────────────────
    const allPurchases = await db.getAuctionPurchases(season_id) as any[];
    const recentPurchases = allPurchases
      .filter(p => p.team_role === 'player' && p.purchase_price > 0)
      .slice(-15)
      .map(p => ({
        name: p.player_name || 'Unknown',
        group: p.group_number ? `Group ${({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' } as Record<number, string>)[p.group_number] ?? p.group_number}` : 'No Group',
        sold_price_lakhs: Number((p.purchase_price / 100000).toFixed(1)),
      }));

    // ── Build performance stats block ──────────────────────────────────────────
    const perfStats: Record<string, any> = {
      seasons_played: Object.keys(allStats).length,
      additional_notes: isUnsold2025 ? 'UNSOLD in ZPL 2025 — high risk/unproven' : '',
    };
    if (Object.keys(allStats).length > 0) {
      // Aggregate across all seasons
      let totalRuns = 0, totalWickets = 0, matches = 0, mvpScore = 0;
      let battingAvg = 0, strikeRate = 0, economy = 0, catches = 0, mvpCount = 0;
      for (const s of Object.values(allStats) as any[]) {
        if (s.batting) {
          totalRuns += s.batting.total_runs ?? 0;
          battingAvg = s.batting.average ?? battingAvg;
          strikeRate = s.batting.strike_rate ?? strikeRate;
          matches = Math.max(matches, s.batting.total_match ?? 0);
        }
        if (s.bowling) { totalWickets += s.bowling.total_wickets ?? 0; economy = s.bowling.economy ?? economy; }
        if (s.fielding) { catches += s.fielding.catches ?? 0; }
        if (s.mvp) { mvpScore += s.mvp.total_score ?? 0; mvpCount++; }
      }
      perfStats.total_runs = totalRuns > 0 ? totalRuns : null;
      perfStats.batting_avg = battingAvg > 0 ? Number(battingAvg.toFixed(1)) : null;
      perfStats.strike_rate = strikeRate > 0 ? Number(strikeRate.toFixed(1)) : null;
      perfStats.bowling_wickets = totalWickets > 0 ? totalWickets : null;
      perfStats.bowling_economy = economy > 0 ? Number(economy.toFixed(2)) : null;
      perfStats.catches = catches > 0 ? catches : null;
      perfStats.mvp_awards = mvpCount > 0 ? mvpCount : null;
    }

    // ── Build PLAYER_CONTEXT ───────────────────────────────────────────────────
    const playerContext = {
      player_name: playerName,
      current_bid_price_lakhs: current_bid_price ? Number((current_bid_price / 100000).toFixed(1)) : null,
      base_price_lakhs: Number((basePrice / 100000).toFixed(1)),
      zpl_2025_record: zpl2025
        ? { price_lakhs: zpl2025.price, team: zpl2025.team, group: zpl2025.group ? `Group ${zpl2025.group}` : 'No Group' }
        : null,
      owner_ratings: {
        batting: owner_ratings?.batting ?? null,
        bowling: owner_ratings?.bowling ?? null,
        fielding: owner_ratings?.fielding ?? null,
      },
      owner_note: owner_note || '',
      performance_stats: perfStats,
      recent_purchases_2026: recentPurchases,
      my_team_2026: {
        team_name: teamName,
        players_bought_count: teamBudget?.players_bought ?? 0,
        budget_remaining_lakhs: teamBudget ? Number((teamBudget.remaining / 100000).toFixed(1)) : null,
        slots_remaining: teamBudget ? (teamBudget.max_players - teamBudget.players_bought) : null,
      },
    };

    // ── Call AI ────────────────────────────────────────────────────────────────
    const userMessage = `Should I bid on this player? What is my max bid price?\n\nPLAYER_CONTEXT:\n${JSON.stringify(playerContext, null, 2)}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';

    // ── Parse markdown response into structured fields ─────────────────────────
    const extractSection = (label: string, text: string): string => {
      const regex = new RegExp(`\\*\\*${label}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
      return text.match(regex)?.[1]?.trim() ?? '';
    };

    const recommendationRaw = extractSection('📊 Recommendation:', rawText) ||
                               extractSection('Recommendation:', rawText);
    const maxBidRaw = extractSection('💰 Max Bid Price:', rawText) ||
                       extractSection('Max Bid Price:', rawText);
    const reasoning = extractSection('🧠 Reasoning:', rawText) ||
                       extractSection('Reasoning:', rawText);
    const keyTradeoff = extractSection('⚖️ Key Trade-off:', rawText) ||
                         extractSection('Key Trade-off:', rawText);
    const comparables = extractSection('🔁 Comparable Players:', rawText) ||
                         extractSection('Comparable Players:', rawText);

    // Parse max bid in lakhs
    const maxBidMatch = maxBidRaw.match(/[\d.]+/);
    const maxBidLakhs = maxBidMatch ? parseFloat(maxBidMatch[0]) : 0;
    const maxBidRupees = Math.round(maxBidLakhs * 100000);

    // Normalize recommendation
    const recUpper = recommendationRaw.toUpperCase();
    const recommendation = recUpper.includes('STRONG BID') ? 'STRONG BID'
      : recUpper.includes('CAUTIOUS BID') ? 'CAUTIOUS BID'
      : recUpper.includes('BID') ? 'BID'
      : 'PASS';

    const recommend = recommendation !== 'PASS';

    return NextResponse.json({
      // Compatible with existing UI structure:
      recommend,
      verdict: recommendation,
      reason: reasoning,
      max_bid: maxBidRupees,
      squad_fit: keyTradeoff,
      value_assessment: comparables,
      risks: [],
      budget_impact: teamBudget
        ? `After ₹${maxBidLakhs}L: ${teamName} would have ₹${(teamBudget.remaining / 100000 - maxBidLakhs).toFixed(1)}L for ${teamBudget.max_players - teamBudget.players_bought - 1} remaining slots`
        : '',
      // New fields:
      zpl2025_price: zpl2025 ? `₹${zpl2025.price}L — ${zpl2025.team}` : 'New Player — No ZPL 2025 record',
      key_tradeoff: keyTradeoff,
      comparable_players: comparables,
      raw: rawText,
    });

  } catch (e: any) {
    console.error('[bid-advice] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
