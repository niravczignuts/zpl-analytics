import pdfParse from 'pdf-parse';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BattingEntry {
  position: number;
  player_name: string;
  dismissal_type: string;
  dismissal_bowler?: string;
  dismissal_fielder?: string;
  dismissal_raw: string;
  runs: number;
  balls: number;
  minutes: number;
  fours: number;
  sixes: number;
  strike_rate: number;
}

export interface BowlingEntry {
  position: number;
  player_name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  dot_balls: number;
  fours: number;
  sixes: number;
  wides: number;
  no_balls: number;
  economy: number;
}

export interface InningsData {
  innings_number: number;
  batting_team: string;
  bowling_team: string;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  batting: BattingEntry[];
  bowling: BowlingEntry[];
  extras?: Record<string, number>;
  fall_of_wickets?: string;
}

export interface MatchInfo {
  team_a?: string;
  team_b?: string;
  result?: string;
  date?: string;
  toss?: string;
  ground?: string;
}

export interface ParsedScorecard {
  match_info: MatchInfo;
  innings: InningsData[];
  raw_text?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BADGE_RE = /\s*\((RHB|LHB|c|wk|C|WK)\)\s*/gi;

function cleanBadges(name: string): string {
  return name.replace(BADGE_RE, ' ').replace(/\s+/g, ' ').trim();
}

function cleanDagger(name: string): string {
  return name.replace(/†/g, '').trim();
}

/**
 * Given the middle tokens between position and stats, split into player name
 * and dismissal text.
 */
function splitNameDismissal(middle: string): { rawName: string; dismissalRaw: string } {
  // If there's a closing paren, everything up to the last ) is the raw player name
  const lastParen = middle.lastIndexOf(')');
  if (lastParen !== -1) {
    return {
      rawName: middle.slice(0, lastParen + 1).trim(),
      dismissalRaw: middle.slice(lastParen + 1).trim(),
    };
  }

  // Otherwise try to find where the dismissal begins
  const dismissalPatterns = [
    /\bnot out\b/i,
    /\bretired\b/i,
    /\babsent\b/i,
    /\bhit wicket\b/i,
    /\brun out\b/i,
    /\blbw\b/i,
    /\bc (?=\S)/i,
    /\bb (?=\S)/i,
    /\bst (?=\S)/i,
  ];

  for (const pat of dismissalPatterns) {
    const m = pat.exec(middle);
    if (m) {
      return {
        rawName: middle.slice(0, m.index).trim(),
        dismissalRaw: middle.slice(m.index).trim(),
      };
    }
  }

  // Fall back: entire string is player name
  return { rawName: middle, dismissalRaw: '' };
}

function parseDismissal(raw: string): {
  type: string;
  bowler?: string;
  fielder?: string;
} {
  const r = raw.trim();

  if (!r || r === '-') return { type: 'not out' };

  const notOut = /^not out$/i.exec(r);
  if (notOut) return { type: 'not out' };

  const retired = /^retired/i.exec(r);
  if (retired) return { type: 'retired' };

  const absent = /^absent/i.exec(r);
  if (absent) return { type: 'absent' };

  // lbw b X
  const lbw = /^lbw\s+b\s+(.+)$/i.exec(r);
  if (lbw) return { type: 'lbw', bowler: lbw[1].trim() };

  // st †X b Y  or  st X b Y
  const st = /^st\s+†?(.+?)\s+b\s+(.+)$/i.exec(r);
  if (st) return { type: 'stumped', fielder: cleanDagger(st[1].trim()), bowler: st[2].trim() };

  // run out X
  const runOut = /^run out\s*(.*)/i.exec(r);
  if (runOut) {
    const fielderRaw = runOut[1].replace(/\s*\/\s*†.*/, '').trim();
    return { type: 'run out', fielder: cleanDagger(fielderRaw) || undefined };
  }

  // hit wicket b X
  const hw = /^hit wicket\s+b\s+(.+)$/i.exec(r);
  if (hw) return { type: 'hit wicket', bowler: hw[1].trim() };

  // c X b Y
  const caught = /^c\s+(.+?)\s+b\s+(.+)$/i.exec(r);
  if (caught) {
    return {
      type: 'caught',
      fielder: cleanDagger(caught[1].trim()),
      bowler: caught[2].trim(),
    };
  }

  // b X
  const bowled = /^b\s+(.+)$/i.exec(r);
  if (bowled) return { type: 'bowled', bowler: bowled[1].trim() };

  return { type: r };
}

// ── Page renderer: layout-aware row-ordered text ──────────────────────────────

function makePageRenderer() {
  return async function renderPage(pageData: any): Promise<string> {
    const content = await pageData.getTextContent();
    const items: Array<{ x: number; y: number; str: string }> = content.items
      .filter((item: any) => item.str && item.str.trim())
      .map((item: any) => ({
        x: item.transform[4],
        y: item.transform[5],
        str: item.str,
      }));

    // Group by Y with 3-unit tolerance
    const rows: Array<{ y: number; items: typeof items }> = [];
    for (const item of items) {
      const row = rows.find(r => Math.abs(r.y - item.y) <= 3);
      if (row) {
        row.items.push(item);
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    }

    // Sort rows top-to-bottom (descending Y in PDF coords)
    rows.sort((a, b) => b.y - a.y);

    return rows
      .map(row => {
        row.items.sort((a, b) => a.x - b.x);
        return row.items.map(i => i.str).join(' ');
      })
      .join('\n');
  };
}

// ── Parse innings header ──────────────────────────────────────────────────────

const INNINGS_HEADER_RE =
  /^(.+?)\s+(\d+)\/(\d+)\s+\(([\d.]+)\s+Ov\)\s+\((\d+)(?:st|nd|rd|th)\s+Innings\)/i;

// ── Main parser ───────────────────────────────────────────────────────────────

export async function parseCricHeroesPDF(buffer: Buffer): Promise<ParsedScorecard> {
  const renderer = makePageRenderer();

  const data = await pdfParse(buffer, {
    pagerender: renderer,
  });

  const text = data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const match_info: MatchInfo = {};
  const innings: InningsData[] = [];

  // Extract match-level info
  for (const line of lines) {
    const dateM = /Date\s+(\d{4}-\d{2}-\d{2})/.exec(line);
    if (dateM) match_info.date = dateM[1];

    const tossM = /^Toss\s+(.+)$/.exec(line);
    if (tossM) match_info.toss = tossM[1].trim();

    const groundM = /^Ground\s+(.+)$/.exec(line);
    if (groundM) match_info.ground = groundM[1].trim();

    const resultM = /^(.+)\s+won by\s+(.+)$/.exec(line);
    if (resultM) match_info.result = line.trim();
  }

  // Parse innings blocks
  let i = 0;
  while (i < lines.length) {
    const headerMatch = INNINGS_HEADER_RE.exec(lines[i]);
    if (!headerMatch) {
      i++;
      continue;
    }

    const battingTeam = headerMatch[1].trim();
    const totalRuns = parseInt(headerMatch[2], 10);
    const totalWickets = parseInt(headerMatch[3], 10);
    const totalOvers = parseFloat(headerMatch[4]);
    const inningsNumber = parseInt(headerMatch[5], 10);

    // Track all teams to infer bowling team later
    if (!match_info.team_a) match_info.team_a = battingTeam;
    else if (match_info.team_a !== battingTeam && !match_info.team_b)
      match_info.team_b = battingTeam;

    const inn: InningsData = {
      innings_number: inningsNumber,
      batting_team: battingTeam,
      bowling_team: '',
      total_runs: totalRuns,
      total_wickets: totalWickets,
      total_overs: totalOvers,
      batting: [],
      bowling: [],
    };

    i++;

    // Parse sections until next innings header
    let section: 'none' | 'batting' | 'bowling' | 'fow' = 'none';

    while (i < lines.length && !INNINGS_HEADER_RE.exec(lines[i])) {
      const line = lines[i];

      // Section markers
      if (/^Batting\b/i.test(line)) { section = 'batting'; i++; continue; }
      if (/^Bowling\b/i.test(line)) { section = 'bowling'; i++; continue; }
      if (/^Fall of Wickets\b/i.test(line)) {
        section = 'fow';
        i++;
        // collect subsequent lines as fall of wickets
        const fowLines: string[] = [];
        while (i < lines.length && !INNINGS_HEADER_RE.exec(lines[i]) &&
          !/^(Batting|Bowling|Extras|Total)\b/i.test(lines[i])) {
          fowLines.push(lines[i]);
          i++;
        }
        inn.fall_of_wickets = fowLines.join(' ');
        continue;
      }

      // Extras
      const extrasM = /^Extras:\s*(.+)$/.exec(line);
      if (extrasM) {
        const extras: Record<string, number> = {};
        const parts = extrasM[1].matchAll(/(\w+)\s+(\d+)/g);
        for (const p of parts) {
          extras[p[1].toLowerCase()] = parseInt(p[2], 10);
        }
        inn.extras = extras;
        i++;
        continue;
      }

      // Total line (skip)
      if (/^Total:\s*/i.test(line)) { i++; continue; }

      if (section === 'batting') {
        const entry = parseBattingLine(line);
        if (entry) inn.batting.push(entry);
      } else if (section === 'bowling') {
        const entry = parseBowlingLine(line);
        if (entry) inn.bowling.push(entry);
      }

      i++;
    }

    innings.push(inn);
  }

  if (innings.length === 0) {
    throw new Error(
      'Could not parse scorecard: no innings data found. Ensure the PDF is a CricHeroes scorecard.'
    );
  }

  // Infer bowling teams
  const allTeams = [match_info.team_a, match_info.team_b].filter(Boolean) as string[];
  for (const inn of innings) {
    const other = allTeams.find(t => t !== inn.batting_team);
    if (other) inn.bowling_team = other;
  }

  return { match_info, innings, raw_text: text };
}

// ── Row parsers ───────────────────────────────────────────────────────────────

/**
 * Batting row: last 6 tokens are R B M 4s 6s SR (SR has decimal)
 * First token is position number.
 */
function parseBattingLine(line: string): BattingEntry | null {
  const tokens = line.split(/\s+/);
  if (tokens.length < 8) return null;

  // Position: first token must be a number
  if (!/^\d+$/.test(tokens[0])) return null;
  const position = parseInt(tokens[0], 10);

  // Last 6 tokens: R B M 4s 6s SR
  // SR must have a decimal point
  const sr = tokens[tokens.length - 1];
  if (!/^\d+\.\d+$/.test(sr)) return null;

  const sixesT = tokens[tokens.length - 2];
  const foursT = tokens[tokens.length - 3];
  const minutesT = tokens[tokens.length - 4];
  const ballsT = tokens[tokens.length - 5];
  const runsT = tokens[tokens.length - 6];

  if (
    !/^\d+$/.test(sixesT) ||
    !/^\d+$/.test(foursT) ||
    !/^\d+$/.test(minutesT) ||
    !/^\d+$/.test(ballsT) ||
    !/^\d+$/.test(runsT)
  ) return null;

  const middle = tokens.slice(1, tokens.length - 6).join(' ').trim();
  if (!middle) return null;

  const { rawName, dismissalRaw } = splitNameDismissal(middle);
  const playerName = cleanBadges(rawName);
  const dismissal = parseDismissal(dismissalRaw);

  return {
    position,
    player_name: playerName,
    dismissal_type: dismissal.type,
    dismissal_bowler: dismissal.bowler,
    dismissal_fielder: dismissal.fielder,
    dismissal_raw: dismissalRaw,
    runs: parseInt(runsT, 10),
    balls: parseInt(ballsT, 10),
    minutes: parseInt(minutesT, 10),
    fours: parseInt(foursT, 10),
    sixes: parseInt(sixesT, 10),
    strike_rate: parseFloat(sr),
  };
}

/**
 * Bowling row: last 10 tokens are O M R W 0s 4s 6s WD NB Eco (Eco has decimal)
 * First token is position number.
 */
function parseBowlingLine(line: string): BowlingEntry | null {
  const tokens = line.split(/\s+/);
  if (tokens.length < 12) return null;

  if (!/^\d+$/.test(tokens[0])) return null;
  const position = parseInt(tokens[0], 10);

  const eco = tokens[tokens.length - 1];
  if (!/^\d+\.\d+$/.test(eco)) return null;

  const nb = tokens[tokens.length - 2];
  const wd = tokens[tokens.length - 3];
  const sixesT = tokens[tokens.length - 4];
  const foursT = tokens[tokens.length - 5];
  const dotsT = tokens[tokens.length - 6];
  const wicketsT = tokens[tokens.length - 7];
  const runsT = tokens[tokens.length - 8];
  const maidensT = tokens[tokens.length - 9];
  const oversT = tokens[tokens.length - 10];

  if (
    !/^\d+$/.test(nb) ||
    !/^\d+$/.test(wd) ||
    !/^\d+$/.test(sixesT) ||
    !/^\d+$/.test(foursT) ||
    !/^\d+$/.test(dotsT) ||
    !/^\d+$/.test(wicketsT) ||
    !/^\d+$/.test(runsT) ||
    !/^\d+$/.test(maidensT) ||
    !/^[\d.]+$/.test(oversT)
  ) return null;

  const playerName = tokens.slice(1, tokens.length - 10).join(' ').trim();
  if (!playerName) return null;

  return {
    position,
    player_name: playerName,
    overs: parseFloat(oversT),
    maidens: parseInt(maidensT, 10),
    runs: parseInt(runsT, 10),
    wickets: parseInt(wicketsT, 10),
    dot_balls: parseInt(dotsT, 10),
    fours: parseInt(foursT, 10),
    sixes: parseInt(sixesT, 10),
    wides: parseInt(wd, 10),
    no_balls: parseInt(nb, 10),
    economy: parseFloat(eco),
  };
}
