import type { ParsedScorecard, BattingEntry, BowlingEntry, InningsData } from '@/lib/parsers/cricheroes';

// ── analyzeMatch ──────────────────────────────────────────────────────────────

export function analyzeMatch(params: {
  scorecardData: ParsedScorecard;
  matchInfo: { team_a: string; team_b: string; match_type?: string };
}): string {
  const { scorecardData, matchInfo } = params;
  const { innings, match_info } = scorecardData;
  const lines: string[] = [];

  // ── Match Summary ────────────────────────────────────────────────────────────
  lines.push('## Match Summary');
  lines.push('');
  const teamA = matchInfo.team_a || match_info.team_a || 'Team A';
  const teamB = matchInfo.team_b || match_info.team_b || 'Team B';
  lines.push(`**${teamA}** vs **${teamB}**`);
  if (matchInfo.match_type) lines.push(`Format: ${matchInfo.match_type}`);
  if (match_info.date) lines.push(`Date: ${match_info.date}`);
  if (match_info.ground) lines.push(`Ground: ${match_info.ground}`);
  if (match_info.toss) lines.push(`Toss: ${match_info.toss}`);
  if (match_info.result) lines.push(`Result: ${match_info.result}`);
  lines.push('');

  for (const inn of innings) {
    const crr = inn.total_overs > 0
      ? (inn.total_runs / inn.total_overs).toFixed(2)
      : '0.00';
    lines.push(
      `- **${inn.batting_team}**: ${inn.total_runs}/${inn.total_wickets} in ${inn.total_overs} overs (CRR: ${crr})`
    );
  }
  lines.push('');

  // ── Batting Analysis ─────────────────────────────────────────────────────────
  lines.push('## Batting Analysis');
  lines.push('');

  for (const inn of innings) {
    lines.push(`### ${inn.batting_team} — Innings ${inn.innings_number}`);
    lines.push('');

    const sorted = [...inn.batting].sort((a, b) => b.runs - a.runs);
    const top3 = sorted.slice(0, 3);
    if (top3.length > 0) {
      lines.push('**Top Scorers:**');
      for (const b of top3) {
        lines.push(
          `- ${b.player_name}: ${b.runs} runs off ${b.balls} balls` +
          ` (SR: ${b.strike_rate.toFixed(2)}, 4s: ${b.fours}, 6s: ${b.sixes})`
        );
      }
      lines.push('');
    }

    const crr = inn.total_overs > 0
      ? (inn.total_runs / inn.total_overs).toFixed(2)
      : '0.00';
    lines.push(`Team Run Rate: **${crr}** runs/over`);
    lines.push('');

    // Highest SR batter (min 10 balls)
    const qualBatters = inn.batting.filter(b => b.balls >= 10);
    if (qualBatters.length > 0) {
      const bestSR = qualBatters.reduce((prev, cur) =>
        cur.strike_rate > prev.strike_rate ? cur : prev
      );
      lines.push(
        `Highest Strike Rate (min 10 balls): **${bestSR.player_name}** — ${bestSR.strike_rate.toFixed(2)} SR (${bestSR.runs} runs off ${bestSR.balls} balls)`
      );
      lines.push('');
    }

    if (inn.extras) {
      const extraParts = Object.entries(inn.extras)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      lines.push(`Extras: ${extraParts}`);
      lines.push('');
    }
  }

  // ── Bowling Analysis ─────────────────────────────────────────────────────────
  lines.push('## Bowling Analysis');
  lines.push('');

  for (const inn of innings) {
    lines.push(`### ${inn.bowling_team || 'Bowling Team'} — vs ${inn.batting_team}`);
    lines.push('');

    const byWickets = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
    if (byWickets.length > 0) {
      lines.push('**Top Wicket Takers:**');
      for (const b of byWickets.filter(b => b.wickets > 0).slice(0, 3)) {
        lines.push(
          `- ${b.player_name}: ${b.wickets}/${b.runs} in ${b.overs} overs (Eco: ${b.economy.toFixed(2)})`
        );
      }
      lines.push('');
    }

    const qualBowlers = inn.bowling.filter(b => b.overs >= 1);
    if (qualBowlers.length > 0) {
      const bestEco = qualBowlers.reduce((prev, cur) =>
        cur.economy < prev.economy ? cur : prev
      );
      lines.push(
        `Best Economy (min 1 over): **${bestEco.player_name}** — ${bestEco.economy.toFixed(2)} Eco (${bestEco.overs} overs, ${bestEco.wickets} wkts)`
      );
      lines.push('');
    }

    const totalDots = inn.bowling.reduce((sum, b) => sum + b.dot_balls, 0);
    if (totalDots > 0) {
      lines.push(`Total Dot Balls: **${totalDots}**`);
      lines.push('');
    }
  }

  // ── Match Turning Point ──────────────────────────────────────────────────────
  lines.push('## Match Turning Point');
  lines.push('');

  if (innings.length >= 2) {
    const firstInn = innings[0];
    const secondInn = innings[1];

    // Find which innings had the most wickets fall quickly
    const firstMiddleWickets = firstInn.batting.filter(b => {
      const dismissal = b.dismissal_type;
      return dismissal !== 'not out' && dismissal !== 'retired' && dismissal !== 'absent';
    }).length;

    const secondWickets = secondInn.total_wickets;
    const target = firstInn.total_runs + 1;
    const secondRuns = secondInn.total_runs;
    const secondOvers = secondInn.total_overs;

    if (secondRuns >= target) {
      lines.push(
        `${secondInn.batting_team} successfully chased down a target of ${target} runs. ` +
        `The chase was completed in ${secondOvers} overs, suggesting ${secondInn.batting_team} batted with confidence throughout.`
      );
    } else {
      const shortfall = target - secondRuns - 1;
      lines.push(
        `${firstInn.batting_team} defended successfully. ${secondInn.batting_team} fell short by ${shortfall} runs, ` +
        `losing ${secondWickets} wickets in the process.`
      );

      // Identify where the bowling/fielding dominated
      if (firstMiddleWickets >= 4) {
        lines.push(
          `The middle-order collapse by ${firstInn.batting_team} in the first innings (${firstMiddleWickets} wickets lost) was the likely turning point.`
        );
      }
    }
  } else if (innings.length === 1) {
    lines.push(`Only one innings recorded. ${innings[0].batting_team} posted ${innings[0].total_runs}/${innings[0].total_wickets}.`);
  }
  lines.push('');

  // ── Player of the Match ──────────────────────────────────────────────────────
  lines.push('## Player of the Match');
  lines.push('');

  // Determine winner
  let winnerTeam: string | undefined;
  if (match_info.result) {
    const winM = /^(.+?)\s+won by/i.exec(match_info.result);
    if (winM) winnerTeam = winM[1].trim();
  }

  interface Candidate {
    name: string;
    team: string;
    score: number;
    statLine: string;
  }
  const candidates: Candidate[] = [];

  for (const inn of innings) {
    for (const b of inn.batting) {
      const sr = b.strike_rate || 0;
      const score = b.runs + (sr > 150 ? 10 : sr > 120 ? 5 : 0) + b.fours * 0.5 + b.sixes * 1;
      candidates.push({
        name: b.player_name,
        team: inn.batting_team,
        score,
        statLine: `${b.runs} runs off ${b.balls} balls (SR: ${b.strike_rate.toFixed(2)}, 4s: ${b.fours}, 6s: ${b.sixes})`,
      });
    }
    for (const b of inn.bowling) {
      const ecoBonus = b.economy < 6 ? 15 : b.economy < 8 ? 8 : 0;
      const score = b.wickets * 20 + ecoBonus;
      candidates.push({
        name: b.player_name,
        team: inn.bowling_team || '',
        score,
        statLine: `${b.wickets}/${b.runs} in ${b.overs} overs (Eco: ${b.economy.toFixed(2)})`,
      });
    }
  }

  // Prefer winner's team
  const winnerCandidates = winnerTeam
    ? candidates.filter(c => c.team && c.team.toLowerCase().includes(winnerTeam!.toLowerCase()))
    : candidates;

  const pool = winnerCandidates.length > 0 ? winnerCandidates : candidates;
  const potm = pool.sort((a, b) => b.score - a.score)[0];

  if (potm) {
    lines.push(`**${potm.name}** (${potm.team})`);
    lines.push(potm.statLine);
    lines.push('');
  } else {
    lines.push('Insufficient data to determine Player of the Match.');
    lines.push('');
  }

  return lines.join('\n');
}

// ── analyzePlayer ─────────────────────────────────────────────────────────────

export function analyzePlayer(params: { player: any; allStats: any }): string {
  const { player, allStats } = params;
  const lines: string[] = [];
  const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown Player';

  lines.push('## Player Profile');
  lines.push('');
  lines.push(`**Name:** ${name}`);
  if (player.player_role) lines.push(`**Role:** ${player.player_role}`);
  if (player.batting_hand) lines.push(`**Batting:** ${player.batting_hand}`);
  if (player.bowling_style) lines.push(`**Bowling:** ${player.bowling_style}`);
  if (player.gender) lines.push(`**Gender:** ${player.gender}`);
  lines.push('');

  // Aggregate batting stats across all seasons
  const statEntries = Object.values(allStats) as any[];
  const battingStats = statEntries.filter(s => s?.batting?.total_runs != null).map(s => s.batting);
  const bowlingStats = statEntries.filter(s => s?.bowling?.total_wickets != null).map(s => s.bowling);

  const totalRuns = battingStats.reduce((sum, b) => sum + (b.total_runs || 0), 0);
  const totalMatches = battingStats.reduce((sum, b) => sum + (b.total_matches || b.total_match || 0), 0);
  const totalWickets = bowlingStats.reduce((sum, b) => sum + (b.total_wickets || 0), 0);
  const totalOvers = bowlingStats.reduce((sum, b) => sum + (Number(b.overs) || 0), 0);

  if (battingStats.length > 0) {
    lines.push('## Batting Stats');
    lines.push('');

    const avgBatAvg = battingStats.reduce((sum, b) => sum + (Number(b.average) || 0), 0) / battingStats.length;
    const avgSR = battingStats.reduce((sum, b) => sum + (Number(b.strike_rate) || 0), 0) / battingStats.length;
    const bestScore = Math.max(...battingStats.map(b => b.highest_run || 0));
    const total50s = battingStats.reduce((sum, b) => sum + (b.fifties || 0), 0);

    lines.push(`- **Total Runs:** ${totalRuns}`);
    lines.push(`- **Matches:** ${totalMatches}`);
    lines.push(`- **Average:** ${avgBatAvg.toFixed(1)}`);
    lines.push(`- **Strike Rate:** ${avgSR.toFixed(1)}`);
    lines.push(`- **Best Score:** ${bestScore}`);
    lines.push(`- **Fifties:** ${total50s}`);
    lines.push('');
  }

  if (bowlingStats.length > 0) {
    lines.push('## Bowling Stats');
    lines.push('');

    const avgEco = bowlingStats.reduce((sum, b) => sum + (Number(b.economy) || 0), 0) / bowlingStats.length;
    const avgBowlAvg = bowlingStats.reduce((sum, b) => sum + (Number(b.avg) || 0), 0) / bowlingStats.length;
    const bestFig = bowlingStats.reduce((best: string, b) => {
      const wkts = b.highest_wicket || b.best_figures || '0';
      return wkts > best ? wkts : best;
    }, '0');

    lines.push(`- **Total Wickets:** ${totalWickets}`);
    lines.push(`- **Overs Bowled:** ${totalOvers.toFixed(1)}`);
    lines.push(`- **Economy:** ${avgEco.toFixed(2)}`);
    lines.push(`- **Average:** ${avgBowlAvg.toFixed(1)}`);
    lines.push(`- **Best Figures:** ${bestFig}`);
    lines.push('');
  }

  // Strengths
  lines.push('## Strengths');
  lines.push('');
  const strengths: string[] = [];

  const avgSR = battingStats.length > 0
    ? battingStats.reduce((sum, b) => sum + (Number(b.strike_rate) || 0), 0) / battingStats.length
    : 0;
  const avgEco = bowlingStats.length > 0
    ? bowlingStats.reduce((sum, b) => sum + (Number(b.economy) || 0), 0) / bowlingStats.length
    : 0;

  if (avgSR > 150) strengths.push('Explosive finisher — exceptional strike rate above 150');
  else if (avgSR > 120) strengths.push('Strong striker — above-average strike rate');

  if (avgEco > 0 && avgEco < 7) strengths.push('Reliable containing bowler — economy below 7 is excellent in T12');
  else if (avgEco > 0 && avgEco < 9) strengths.push('Economical bowler — holds one end up well');

  if (battingStats.length > 0 && bowlingStats.length > 0) strengths.push('Genuine all-rounder — contributes with both bat and ball');

  if (strengths.length === 0) strengths.push('Developing player — building ZPL track record');

  for (const s of strengths) lines.push(`- ${s}`);
  lines.push('');

  // ZPL Value Rating
  lines.push('## ZPL Value Rating');
  lines.push('');

  const runsPerMatch = totalMatches > 0 ? totalRuns / totalMatches : 0;
  const wicketsPerMatch = totalMatches > 0 ? totalWickets / totalMatches : 0;
  const srBonus = avgSR > 150 ? 10 : avgSR > 120 ? 5 : 0;
  const ecoBonus = avgEco > 0 && avgEco < 7 ? 10 : avgEco > 0 && avgEco < 9 ? 5 : 0;
  const rawScore = runsPerMatch * 0.3 + wicketsPerMatch * 15 + srBonus + ecoBonus;
  const rating = Math.min(10, Math.max(1, Math.round(rawScore)));

  lines.push(`**Rating: ${rating}/10**`);
  lines.push('');
  lines.push(
    `Score breakdown: runs_per_match(${runsPerMatch.toFixed(1)}) × 0.3 + wickets_per_match(${wicketsPerMatch.toFixed(2)}) × 15 + SR bonus(${srBonus}) + economy bonus(${ecoBonus}) = ${rawScore.toFixed(1)}`
  );
  lines.push('');

  // Recommendation
  lines.push('## Recommendation');
  lines.push('');
  const role = player.player_role || 'player';
  if (rating >= 8) {
    lines.push(`${name} is a **premium pick** for T12 cricket. As a ${role}, they bring consistent match-winning value.`);
  } else if (rating >= 5) {
    lines.push(`${name} is a **solid squad member** for T12. Best deployed in their primary role as ${role}.`);
  } else {
    lines.push(`${name} is still establishing their ZPL form. Consider for squad depth — especially if they can contribute in multiple areas.`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── compareTeams ─────────────────────────────────────────────────────────────

export function compareTeams(params: { team1: any; team2: any }): string {
  const { team1, team2 } = params;
  const lines: string[] = [];

  function teamTotals(team: any) {
    const players = team.players || [];
    let totalRuns = 0, totalWickets = 0, ecoSum = 0, ecoCount = 0;
    let batAvgSum = 0, batAvgCount = 0;
    for (const p of players) {
      if (p.batting) {
        totalRuns += p.batting.total_runs || 0;
        if (p.batting.average) { batAvgSum += Number(p.batting.average); batAvgCount++; }
      }
      if (p.bowling) {
        totalWickets += p.bowling.total_wickets || 0;
        if (p.bowling.economy) { ecoSum += Number(p.bowling.economy); ecoCount++; }
      }
    }
    return {
      totalRuns,
      totalWickets,
      avgEco: ecoCount > 0 ? ecoSum / ecoCount : 0,
      batAvg: batAvgCount > 0 ? batAvgSum / batAvgCount : 0,
    };
  }

  const t1 = teamTotals(team1);
  const t2 = teamTotals(team2);

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  const runEdge = t1.totalRuns > t2.totalRuns ? team1.name : team2.name;
  const wicketEdge = t1.totalWickets > t2.totalWickets ? team1.name : team2.name;
  const ecoEdge = t1.avgEco > 0 && t2.avgEco > 0
    ? (t1.avgEco < t2.avgEco ? team1.name : team2.name)
    : null;

  lines.push(`**${team1.name}** vs **${team2.name}**`);
  lines.push('');
  lines.push(`- **${runEdge}** has the batting edge with more collective runs.`);
  lines.push(`- **${wicketEdge}** has taken more wickets collectively.`);
  if (ecoEdge) lines.push(`- **${ecoEdge}** has the superior bowling economy.`);
  lines.push('');

  // Batting Comparison
  lines.push('## Batting Comparison');
  lines.push('');
  lines.push(`| Metric | ${team1.name} | ${team2.name} |`);
  lines.push('|--------|------------|------------|');
  lines.push(`| Total Runs | ${t1.totalRuns} | ${t2.totalRuns} |`);
  lines.push(`| Batting Average | ${t1.batAvg.toFixed(1)} | ${t2.batAvg.toFixed(1)} |`);
  lines.push('');

  function topScorers(team: any) {
    return (team.players || [])
      .filter((p: any) => p.batting?.total_runs)
      .sort((a: any, b: any) => (b.batting.total_runs || 0) - (a.batting.total_runs || 0))
      .slice(0, 3);
  }

  const t1Scorers = topScorers(team1);
  const t2Scorers = topScorers(team2);

  if (t1Scorers.length > 0) {
    lines.push(`**${team1.name} Top Scorers:**`);
    for (const p of t1Scorers) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      lines.push(
        `- ${name}: ${p.batting.total_runs} runs, avg ${Number(p.batting.average || 0).toFixed(1)}, SR ${Number(p.batting.strike_rate || 0).toFixed(1)}`
      );
    }
    lines.push('');
  }

  if (t2Scorers.length > 0) {
    lines.push(`**${team2.name} Top Scorers:**`);
    for (const p of t2Scorers) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      lines.push(
        `- ${name}: ${p.batting.total_runs} runs, avg ${Number(p.batting.average || 0).toFixed(1)}, SR ${Number(p.batting.strike_rate || 0).toFixed(1)}`
      );
    }
    lines.push('');
  }

  // Bowling Comparison
  lines.push('## Bowling Comparison');
  lines.push('');
  lines.push(`| Metric | ${team1.name} | ${team2.name} |`);
  lines.push('|--------|------------|------------|');
  lines.push(`| Total Wickets | ${t1.totalWickets} | ${t2.totalWickets} |`);
  lines.push(`| Avg Economy | ${t1.avgEco > 0 ? t1.avgEco.toFixed(2) : 'N/A'} | ${t2.avgEco > 0 ? t2.avgEco.toFixed(2) : 'N/A'} |`);
  lines.push('');

  function topBowlers(team: any) {
    return (team.players || [])
      .filter((p: any) => p.bowling?.total_wickets)
      .sort((a: any, b: any) => (b.bowling.total_wickets || 0) - (a.bowling.total_wickets || 0))
      .slice(0, 3);
  }

  const t1Bowlers = topBowlers(team1);
  const t2Bowlers = topBowlers(team2);

  if (t1Bowlers.length > 0) {
    lines.push(`**${team1.name} Top Bowlers:**`);
    for (const p of t1Bowlers) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      lines.push(
        `- ${name}: ${p.bowling.total_wickets} wkts, eco ${Number(p.bowling.economy || 0).toFixed(2)}`
      );
    }
    lines.push('');
  }

  if (t2Bowlers.length > 0) {
    lines.push(`**${team2.name} Top Bowlers:**`);
    for (const p of t2Bowlers) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      lines.push(
        `- ${name}: ${p.bowling.total_wickets} wkts, eco ${Number(p.bowling.economy || 0).toFixed(2)}`
      );
    }
    lines.push('');
  }

  // Girls' Over Analysis
  lines.push("## Girls' Over Analysis");
  lines.push('');
  lines.push('In ZPL, the first over is bowled by a girl with runs doubled — a critical strategic factor.');
  lines.push('');

  function girlPlayers(team: any) {
    return (team.players || []).filter((p: any) => p.gender === 'Female');
  }

  const t1Girls = girlPlayers(team1);
  const t2Girls = girlPlayers(team2);

  for (const [team, girls] of [[team1, t1Girls], [team2, t2Girls]] as [any, any[]][]) {
    lines.push(`**${team.name} Girl Bowlers:**`);
    if (girls.length === 0) {
      lines.push('- No girl players in squad data');
    } else {
      for (const g of girls) {
        const name = `${g.first_name || ''} ${g.last_name || ''}`.trim();
        if (g.bowling) {
          const eco = Number(g.bowling.economy || 0);
          const doubled = (eco * 2).toFixed(2);
          lines.push(`- ${name}: eco ${eco.toFixed(2)} (doubled impact: ${doubled} effective eco), ${g.bowling.total_wickets || 0} wkts`);
        } else {
          lines.push(`- ${name}: no bowling stats recorded`);
        }
      }
    }
    lines.push('');
  }

  // Key Player Battles
  lines.push('## Key Player Battles');
  lines.push('');

  const t1TopBatter = (team1.players || [])
    .filter((p: any) => p.batting?.total_runs)
    .sort((a: any, b: any) => (b.batting.total_runs || 0) - (a.batting.total_runs || 0))[0];
  const t2TopBatter = (team2.players || [])
    .filter((p: any) => p.batting?.total_runs)
    .sort((a: any, b: any) => (b.batting.total_runs || 0) - (a.batting.total_runs || 0))[0];

  const t1BestBowler = (team1.players || [])
    .filter((p: any) => p.bowling?.total_wickets)
    .sort((a: any, b: any) => (b.bowling.total_wickets || 0) - (a.bowling.total_wickets || 0))[0];
  const t2BestBowler = (team2.players || [])
    .filter((p: any) => p.bowling?.total_wickets)
    .sort((a: any, b: any) => (b.bowling.total_wickets || 0) - (a.bowling.total_wickets || 0))[0];

  if (t1TopBatter && t2BestBowler) {
    const batter = `${t1TopBatter.first_name || ''} ${t1TopBatter.last_name || ''}`.trim();
    const bowler = `${t2BestBowler.first_name || ''} ${t2BestBowler.last_name || ''}`.trim();
    lines.push(
      `- **${batter}** (${team1.name}, ${t1TopBatter.batting?.total_runs} runs) vs **${bowler}** (${team2.name}, ${t2BestBowler.bowling?.total_wickets} wkts)`
    );
  }
  if (t2TopBatter && t1BestBowler) {
    const batter = `${t2TopBatter.first_name || ''} ${t2TopBatter.last_name || ''}`.trim();
    const bowler = `${t1BestBowler.first_name || ''} ${t1BestBowler.last_name || ''}`.trim();
    lines.push(
      `- **${batter}** (${team2.name}, ${t2TopBatter.batting?.total_runs} runs) vs **${bowler}** (${team1.name}, ${t1BestBowler.bowling?.total_wickets} wkts)`
    );
  }
  lines.push('');

  // Predicted Winner
  lines.push('## Predicted Winner');
  lines.push('');

  const t1BatScore = t1.totalRuns * 0.1 + t1.batAvg * 2;
  const t1BowlScore = t1.totalWickets * 3 + (t1.avgEco > 0 ? (12 - t1.avgEco) * 2 : 0);
  const t2BatScore = t2.totalRuns * 0.1 + t2.batAvg * 2;
  const t2BowlScore = t2.totalWickets * 3 + (t2.avgEco > 0 ? (12 - t2.avgEco) * 2 : 0);

  const t1Total = t1BatScore + t1BowlScore;
  const t2Total = t2BatScore + t2BowlScore;
  const combinedTotal = t1Total + t2Total || 1;
  const t1Pct = Math.round((t1Total / combinedTotal) * 100);
  const t2Pct = 100 - t1Pct;

  const predicted = t1Total >= t2Total ? team1.name : team2.name;
  lines.push(`**Predicted Winner: ${predicted}** (${predicted === team1.name ? t1Pct : t2Pct}% win probability based on combined batting + bowling ratings)`);
  lines.push('');
  lines.push(
    `Batting score: ${team1.name} ${t1BatScore.toFixed(1)} | ${team2.name} ${t2BatScore.toFixed(1)}`
  );
  lines.push(
    `Bowling score: ${team1.name} ${t1BowlScore.toFixed(1)} | ${team2.name} ${t2BowlScore.toFixed(1)}`
  );
  lines.push('');

  return lines.join('\n');
}

// ── getMatchStrategy ──────────────────────────────────────────────────────────

export function getMatchStrategy(params: { yourTeam: any; opponentTeam: any }): string {
  const { yourTeam, opponentTeam } = params;
  const lines: string[] = [];
  const players: any[] = yourTeam.players || [];

  // Score players for XI selection
  function playerScore(p: any): number {
    const runs = p.batting?.total_runs || 0;
    const wkts = p.bowling?.total_wickets || 0;
    const eco = Number(p.bowling?.economy || 0);
    const sr = Number(p.batting?.strike_rate || 0);
    return (
      runs * 0.2 +
      wkts * 8 +
      (eco > 0 && eco < 7 ? 10 : eco > 0 && eco < 9 ? 5 : 0) +
      (sr > 150 ? 8 : sr > 120 ? 4 : 0)
    );
  }

  function roleOrder(role: string): number {
    const r = (role || '').toLowerCase();
    if (r.includes('all')) return 0;
    if (r.includes('bat')) return 1;
    if (r.includes('bowl')) return 2;
    if (r.includes('wicket') || r.includes('keeper') || r.includes('wk')) return 3;
    return 4;
  }

  // Sort by role importance then by score
  const sortedByRole = [...players].sort((a, b) => {
    const roleDiff = roleOrder(a.player_role) - roleOrder(b.player_role);
    if (roleDiff !== 0) return roleDiff;
    return playerScore(b) - playerScore(a);
  });

  // Must include ≥2 girls
  const girls = sortedByRole.filter(p => p.gender === 'Female');
  const nonGirls = sortedByRole.filter(p => p.gender !== 'Female');

  const xi: any[] = [];
  // Pick 2 girls first
  xi.push(...girls.slice(0, 2));
  // Fill remaining spots with non-girls, then more girls if needed
  const remaining = 11 - xi.length;
  xi.push(...nonGirls.slice(0, remaining));
  if (xi.length < 11) xi.push(...girls.slice(2, 11 - xi.length + 2));
  const selectedXI = xi.slice(0, 11);

  const bench = players.filter(p => !selectedXI.includes(p));

  // Recommended Playing XI
  lines.push('## Recommended Playing XI');
  lines.push('');
  selectedXI.forEach((p, idx) => {
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const role = p.player_role || 'Player';
    const gender = p.gender === 'Female' ? ' ♀' : '';
    lines.push(`${idx + 1}. **${name}**${gender} — ${role}`);
  });
  lines.push('');

  // Batting Order
  lines.push('## Batting Order');
  lines.push('');
  const batters = [...selectedXI].sort((a, b) => {
    const srA = Number(a.batting?.strike_rate || 0);
    const srB = Number(b.batting?.strike_rate || 0);
    return srB - srA;
  });
  batters.forEach((p, idx) => {
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const sr = Number(p.batting?.strike_rate || 0);
    let rationale = '';
    if (idx < 3) rationale = sr > 130 ? 'aggressive top-order striker' : 'anchor the innings early';
    else if (idx < 7) rationale = 'middle-order consolidator';
    else rationale = 'lower-order aggressor';
    lines.push(`${idx + 1}. ${name} (SR: ${sr.toFixed(1)}) — ${rationale}`);
  });
  lines.push('');

  // Bowling Plan
  lines.push('## Bowling Plan');
  lines.push('');
  const bowlers = selectedXI
    .filter(p => p.bowling?.total_wickets || p.player_role?.toLowerCase().includes('bowl') || p.bowling?.economy)
    .sort((a, b) => {
      const eA = Number(a.bowling?.economy || 99);
      const eB = Number(b.bowling?.economy || 99);
      return eA - eB;
    });

  // Girls first over rule
  const girlBowlers = bowlers.filter(p => p.gender === 'Female');
  if (girlBowlers.length > 0) {
    const firstOver = girlBowlers[0];
    const name = `${firstOver.first_name || ''} ${firstOver.last_name || ''}`.trim();
    lines.push(`**Girls' First Over (mandatory):** ${name}`);
    lines.push('');
  }

  let oversAssigned = 0;
  const assignments: Array<{ name: string; overs: number; eco: number }> = [];
  const maxPerBowler = 3;
  const totalOvers = 12;

  for (const b of bowlers) {
    if (oversAssigned >= totalOvers) break;
    const name = `${b.first_name || ''} ${b.last_name || ''}`.trim();
    const eco = Number(b.bowling?.economy || 0);
    const toAssign = assignments.length === 0 ? 3 : assignments.length === 1 ? 2 : 1;
    const actual = Math.min(toAssign, maxPerBowler, totalOvers - oversAssigned);
    if (actual <= 0) continue;
    assignments.push({ name, overs: actual, eco });
    oversAssigned += actual;
  }

  for (const a of assignments) {
    lines.push(`- **${a.name}**: ${a.overs} overs (economy: ${a.eco > 0 ? a.eco.toFixed(2) : 'N/A'})`);
  }
  if (oversAssigned < totalOvers) {
    lines.push(`- Remaining ${totalOvers - oversAssigned} overs to be shared among part-time bowlers`);
  }
  lines.push('');

  // Girls' First Over Strategy
  lines.push("## Girls' First Over Strategy");
  lines.push('');
  if (girlBowlers.length > 0) {
    const best = girlBowlers[0];
    const name = `${best.first_name || ''} ${best.last_name || ''}`.trim();
    const eco = Number(best.bowling?.economy || 0);
    lines.push(`**Recommended: ${name}** (Eco: ${eco > 0 ? eco.toFixed(2) : 'N/A'})`);
    lines.push('');
    lines.push('Field Setting:');
    lines.push('- Mid-on and mid-off up (saving ones)');
    lines.push('- Fine leg and third man protection from mishits');
    lines.push('- Extra cover to cut off the drive');
    lines.push('');
    lines.push('Recommended lengths: Good length to full — limit boundary exposure since runs are doubled.');
    lines.push('');
  } else {
    lines.push('No girl bowlers identified in squad. Ensure ZPL rules compliance by selecting a girl to bowl first over.');
    lines.push('');
  }

  // Impact Player Options
  lines.push('## Impact Player Option');
  lines.push('');
  const benchSorted = bench.sort((a, b) => playerScore(b) - playerScore(a));
  const impactBat = benchSorted.filter(p => p.batting?.total_runs).slice(0, 1)[0];
  const impactBowl = benchSorted.filter(p => p.bowling?.total_wickets).slice(0, 1)[0];

  if (impactBat) {
    const name = `${impactBat.first_name || ''} ${impactBat.last_name || ''}`.trim();
    lines.push(`**Best Batting Impact:** ${name} (${impactBat.batting?.total_runs} runs, SR: ${Number(impactBat.batting?.strike_rate || 0).toFixed(1)})`);
  }
  if (impactBowl) {
    const name = `${impactBowl.first_name || ''} ${impactBowl.last_name || ''}`.trim();
    lines.push(`**Best Bowling Impact:** ${name} (${impactBowl.bowling?.total_wickets} wkts, Eco: ${Number(impactBowl.bowling?.economy || 0).toFixed(2)})`);
  }
  if (!impactBat && !impactBowl) lines.push('No bench players with recorded stats available for impact role.');
  lines.push('');

  // Opposition Threat Analysis
  lines.push('## Opposition Threat Analysis');
  lines.push('');
  const oppPlayers = opponentTeam.players || [];

  interface ThreatPlayer {
    name: string;
    threat: number;
    statLine: string;
  }

  const threats: ThreatPlayer[] = oppPlayers.map((p: any) => {
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const runs = p.batting?.total_runs || 0;
    const wkts = p.bowling?.total_wickets || 0;
    const threat = runs * 0.3 + wkts * 12;
    const parts: string[] = [];
    if (runs) parts.push(`${runs} runs`);
    if (wkts) parts.push(`${wkts} wkts`);
    return { name, threat, statLine: parts.join(', ') || 'no stats' };
  }).sort((a: ThreatPlayer, b: ThreatPlayer) => b.threat - a.threat).slice(0, 3);

  if (threats.length > 0) {
    lines.push('**Top 3 Opposition Threats:**');
    for (const t of threats) {
      lines.push(`- **${t.name}** (${t.statLine})`);
      if (t.statLine.includes('runs')) lines.push(`  Counter: use best economy bowler; attack early with short balls`);
      if (t.statLine.includes('wkts')) lines.push(`  Counter: bat aggressively early before they settle; use power hitters`);
    }
  } else {
    lines.push('No opposition stats available for threat analysis.');
  }
  lines.push('');

  return lines.join('\n');
}

// ── getAuctionSuggestion ──────────────────────────────────────────────────────

export function getAuctionSuggestion(params: {
  teamName: string;
  remainingBudget: number;
  playersCount: number;
  maxPlayers: number;
  currentSquad: any[];
  availablePlayers: any[];
  otherTeams: any[];
}): any {
  const {
    teamName,
    remainingBudget,
    playersCount,
    maxPlayers,
    currentSquad,
    availablePlayers,
    otherTeams,
  } = params;

  function playerScore(p: any): number {
    const runs = p.batting?.total_runs || 0;
    const matches = p.batting?.total_matches || p.batting?.total_match || 1;
    const wkts = p.bowling?.total_wickets || 0;
    const eco = Number(p.bowling?.economy || 0);
    const sr = Number(p.batting?.strike_rate || 0);

    const runsPerMatch = runs / matches;
    const wicketsPerMatch = wkts / matches;

    return (
      runsPerMatch * 0.5 +
      wicketsPerMatch * 10 +
      (eco > 0 && eco < 7 ? 10 : eco > 0 && eco < 9 ? 5 : 0) +
      (sr > 150 ? 10 : sr > 120 ? 5 : 0)
    );
  }

  // Assess squad balance
  const slotsLeft = maxPlayers - playersCount;
  const budgetPerSlot = slotsLeft > 0 ? remainingBudget / slotsLeft : 0;

  const squadRoles = currentSquad.reduce((acc: Record<string, number>, p: any) => {
    const r = (p.player_role || 'Unknown').toLowerCase();
    const key = r.includes('all') ? 'all-rounders' :
      r.includes('bat') ? 'batters' :
      r.includes('bowl') ? 'bowlers' :
      r.includes('wk') || r.includes('keeper') ? 'keepers' : 'others';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const femaleCount = currentSquad.filter(p => p.gender === 'Female').length;

  const gaps: string[] = [];
  if ((squadRoles.batters || 0) < 3) gaps.push('Need more batters');
  if ((squadRoles.bowlers || 0) < 3) gaps.push('Need more bowlers');
  if ((squadRoles['all-rounders'] || 0) < 2) gaps.push('Need all-rounders');
  if (femaleCount < 2) gaps.push('Need more female players (ZPL minimum: 2 in XI)');
  if ((squadRoles.keepers || 0) < 1) gaps.push('No wicketkeeper in squad');

  // Find best available player not in current squad
  const currentIds = new Set(currentSquad.map(p => p.id));
  const candidates = availablePlayers
    .filter(p => !currentIds.has(p.id))
    .map(p => ({ ...p, _score: playerScore(p) }))
    .sort((a, b) => b._score - a._score);

  const topPick = candidates[0];
  const alternatives = candidates.slice(1, 4);

  let recommendation: any = null;
  if (topPick) {
    const score = topPick._score;
    const priority = score > 20 ? 'high' : score > 10 ? 'medium' : 'low';
    const name = `${topPick.first_name || ''} ${topPick.last_name || ''}`.trim();
    const minBid = Math.round(budgetPerSlot * 0.5);
    const maxBid = Math.min(Math.round(budgetPerSlot * 1.5), remainingBudget);

    recommendation = {
      player_name: name,
      reason: buildRecommendationReason(topPick, gaps, femaleCount),
      price_range: { min: minBid, max: maxBid },
      priority,
    };
  }

  const batting_strength = (squadRoles.batters || 0) + (squadRoles['all-rounders'] || 0) >= 4 ? 'strong'
    : (squadRoles.batters || 0) + (squadRoles['all-rounders'] || 0) >= 2 ? 'moderate' : 'weak';

  const bowling_strength = (squadRoles.bowlers || 0) + (squadRoles['all-rounders'] || 0) >= 4 ? 'strong'
    : (squadRoles.bowlers || 0) + (squadRoles['all-rounders'] || 0) >= 2 ? 'moderate' : 'weak';

  return {
    recommendation,
    alternative_targets: alternatives.map(p => ({
      player_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      reason: buildRecommendationReason(p, gaps, femaleCount),
    })),
    team_balance: {
      assessment: `${teamName} has ${playersCount}/${maxPlayers} players. ${gaps.length === 0 ? 'Squad looks balanced.' : 'Key gaps: ' + gaps.join('; ')}`,
      batting_strength,
      bowling_strength,
      gaps,
    },
    risks: buildRisks(remainingBudget, slotsLeft, budgetPerSlot, femaleCount),
    budget_advice: `₹${(remainingBudget / 100000).toFixed(2)}L remaining for ${slotsLeft} slot(s) — avg ₹${(budgetPerSlot / 100000).toFixed(2)}L per slot.`,
  };
}

function buildRecommendationReason(p: any, gaps: string[], femaleCount: number): string {
  const parts: string[] = [];
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const role = p.player_role || 'player';

  if (p.bowling?.total_wickets && p.batting?.total_runs) {
    parts.push(`${name} is a genuine all-rounder (${p.batting.total_runs} runs, ${p.bowling.total_wickets} wkts)`);
  } else if (p.batting?.total_runs) {
    parts.push(`${name} is a reliable batter with ${p.batting.total_runs} runs`);
  } else if (p.bowling?.total_wickets) {
    parts.push(`${name} is a key bowler with ${p.bowling.total_wickets} wickets`);
  } else {
    parts.push(`${name} (${role}) adds squad depth`);
  }

  if (p.gender === 'Female' && femaleCount < 2) {
    parts.push('Also helps meet the minimum 2 female player requirement');
  }

  return parts.join('. ') + '.';
}

function buildRisks(remainingBudget: number, slotsLeft: number, budgetPerSlot: number, femaleCount: number): string[] {
  const risks: string[] = [];
  if (remainingBudget < budgetPerSlot * slotsLeft * 0.5) {
    risks.push('Budget is tight — overspending on one player could leave the squad incomplete');
  }
  if (femaleCount < 2) {
    risks.push('Must acquire female players soon to meet ZPL minimum of 2 in playing XI');
  }
  if (slotsLeft <= 2) {
    risks.push('Very few slots remaining — be selective, only bid on must-have players');
  }
  if (risks.length === 0) risks.push('No critical risks at this stage — squad composition is on track');
  return risks;
}

// ── getPlayerBidRecommendation ────────────────────────────────────────────────

export function getPlayerBidRecommendation(params: {
  player: any;
  playerStats: any;
  ssTeam: any;
  ssBudget: any;
  marketPurchases: any[];
  otherTeamsBudgets: any[];
}): any {
  const { player, playerStats, ssTeam, ssBudget, marketPurchases } = params;

  const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Player';
  const isFemale = player.gender === 'Female';
  const role = player.player_role || 'Unknown';

  // Compute player score
  const statEntries = Object.values(playerStats) as any[];
  const battingAll = statEntries.filter(s => s?.batting?.total_runs != null).map(s => s.batting);
  const bowlingAll = statEntries.filter(s => s?.bowling?.total_wickets != null).map(s => s.bowling);

  const totalRuns = battingAll.reduce((sum, b) => sum + (b.total_runs || 0), 0);
  const totalMatches = battingAll.reduce((sum, b) => sum + (b.total_matches || b.total_match || 0), 0) || 1;
  const totalWickets = bowlingAll.reduce((sum, b) => sum + (b.total_wickets || 0), 0);
  const avgSR = battingAll.length > 0
    ? battingAll.reduce((sum, b) => sum + Number(b.strike_rate || 0), 0) / battingAll.length
    : 0;
  const avgEco = bowlingAll.length > 0
    ? bowlingAll.reduce((sum, b) => sum + Number(b.economy || 0), 0) / bowlingAll.length
    : 0;

  const runsPerMatch = totalRuns / totalMatches;
  const wicketsPerMatch = totalWickets / totalMatches;
  const srBonus = avgSR > 150 ? 10 : avgSR > 120 ? 5 : 0;
  const ecoBonus = avgEco > 0 && avgEco < 7 ? 10 : avgEco > 0 && avgEco < 9 ? 5 : 0;
  const playerScore = runsPerMatch * 0.5 + wicketsPerMatch * 10 + srBonus + ecoBonus;

  // Squad analysis
  const squad: any[] = ssTeam.squad || [];
  const remaining = ssBudget.remaining || 0;
  const slotsLeft = (ssBudget.max_players || 12) - (ssBudget.players_bought || 0);
  const budgetPerSlot = slotsLeft > 0 ? remaining / slotsLeft : 0;
  const femaleCount = squad.filter((p: any) => p.gender === 'Female').length;
  const needsGirl = femaleCount < 2 && isFemale;

  // Market comparison
  const avgMarket = marketPurchases.length > 0
    ? marketPurchases.reduce((sum: number, p: any) => sum + (p.purchase_price || 0), 0) / marketPurchases.length
    : budgetPerSlot;

  // Compute max bid
  const valueFactor = playerScore > 25 ? 1.5 : playerScore > 15 ? 1.2 : playerScore > 8 ? 1.0 : 0.7;
  const girlPremium = needsGirl ? 1.3 : 1.0;
  let maxBid = Math.round(avgMarket * valueFactor * girlPremium);
  maxBid = Math.min(maxBid, remaining - budgetPerSlot * (slotsLeft - 1));
  maxBid = Math.max(maxBid, 0);

  const recommend = playerScore > 5 && maxBid > 0 && (slotsLeft > 0);
  const verdict = !recommend
    ? 'PASS'
    : maxBid > avgMarket * 1.2
    ? `BUY at ₹${maxBid.toLocaleString()}`
    : `BUY CAUTIOUSLY up to ₹${maxBid.toLocaleString()}`;

  // Build reason
  const reasonParts: string[] = [];
  if (totalRuns > 0) reasonParts.push(`${totalRuns} runs at SR ${avgSR.toFixed(1)}`);
  if (totalWickets > 0) reasonParts.push(`${totalWickets} wickets at Eco ${avgEco.toFixed(2)}`);
  if (reasonParts.length === 0) reasonParts.push('limited ZPL track record');
  const reason = `${name} has ${reasonParts.join(' and ')} across ${totalMatches} match(es). ` +
    (needsGirl ? 'As a female player, they also help meet the mandatory 2-girl rule. ' : '') +
    (playerScore > 15 ? 'Strong performer — worth securing early.' : playerScore > 8 ? 'Decent contributor — monitor auction dynamics before committing.' : 'Limited data — bid cautiously.');

  const gaps: string[] = [];
  const squadRoles = squad.reduce((acc: Record<string, number>, p: any) => {
    const r = (p.player_role || '').toLowerCase();
    const key = r.includes('all') ? 'all-rounders' : r.includes('bat') ? 'batters' : r.includes('bowl') ? 'bowlers' : 'others';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  if ((squadRoles.batters || 0) < 3) gaps.push('batters');
  if ((squadRoles.bowlers || 0) < 3) gaps.push('bowlers');
  if (femaleCount < 2) gaps.push('female players');

  const roleNeed = role.toLowerCase().includes('bat') ? 'batter'
    : role.toLowerCase().includes('bowl') ? 'bowler'
    : role.toLowerCase().includes('all') ? 'all-rounder' : role;

  const squadFit = gaps.some(g => roleNeed.includes(g.replace('s', '')))
    ? `${name} directly fills a gap — squad needs more ${gaps.join(', ')}`
    : `${name} adds depth to ${ssTeam.name}'s ${roleNeed} options`;

  const afterRemaining = remaining - maxBid;
  const afterSlots = slotsLeft - 1;

  return {
    recommend,
    verdict,
    reason,
    max_bid: maxBid,
    squad_fit: squadFit,
    value_assessment: maxBid > avgMarket
      ? `Above market rate — justified by their track record and squad need`
      : `At or below market rate (avg paid: ₹${avgMarket.toLocaleString()}) — good value`,
    risks: buildBidRisks(player, playerScore, slotsLeft, femaleCount, remaining, budgetPerSlot),
    budget_impact: `After this purchase: ₹${(afterRemaining / 100000).toFixed(2)}L left for ${afterSlots} slot(s) = ₹${afterSlots > 0 ? (afterRemaining / afterSlots / 100000).toFixed(2) : '0.00'}L avg per slot`,
  };
}

function buildBidRisks(
  player: any,
  score: number,
  slotsLeft: number,
  femaleCount: number,
  remaining: number,
  budgetPerSlot: number
): string[] {
  const risks: string[] = [];
  if (score < 5) risks.push('Low historical performance — may not contribute meaningfully');
  if (slotsLeft <= 2) risks.push('Few slots left — this purchase limits future flexibility');
  if (femaleCount >= 2 && player.gender === 'Female') risks.push('Female quota already met — no mandatory bonus for this player');
  if (remaining < budgetPerSlot * slotsLeft * 0.6) risks.push('Budget is stretched — overpaying could leave gaps in squad');
  if (risks.length === 0) risks.push('No significant risks identified');
  return risks;
}
