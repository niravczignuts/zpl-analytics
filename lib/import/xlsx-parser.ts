import * as XLSX from 'xlsx';

export function readXlsx(input: string | Buffer): Record<string, any[][]> {
  const wb = typeof input === 'string' ? XLSX.readFile(input) : XLSX.read(input, { type: 'buffer' });
  const result: Record<string, any[][]> = {};
  for (const name of wb.SheetNames) {
    result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  }
  return result;
}

export interface RegistrationPlayer {
  first_name: string;
  last_name: string;
  full_name: string;
  gender: string;
  group_number: number | null;
  base_price: number | null;
  is_captain_eligible: boolean;
  role: string | null;
  overall_rating: number | null;
  grade: string | null;
  should_buy: boolean | null;
  note: string | null;
}

function pick(row: any, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  }
  return '';
}

// Case-insensitive fallback: finds the first row key whose lowercase matches any of the provided lowercase substrings
function pickFuzzy(row: any, ...partials: string[]): string {
  const rowKeys = Object.keys(row);
  for (const partial of partials) {
    const found = rowKeys.find(k => k.toLowerCase().trim() === partial.toLowerCase());
    if (found) {
      const val = row[found];
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
    }
  }
  // Second pass: substring match
  for (const partial of partials) {
    const found = rowKeys.find(k => k.toLowerCase().includes(partial.toLowerCase()));
    if (found) {
      const val = row[found];
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
    }
  }
  return '';
}

function parseGroupNumber(raw: string | number | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Accept letter groups: "A", "Group A", "B", "Group B", "C", "D"
  const letterMatch = s.match(/\bGroup\s*([A-D])\b|\b([A-D])\b/i);
  if (letterMatch) {
    const letter = (letterMatch[1] || letterMatch[2]).toUpperCase();
    return ({ A: 1, B: 2, C: 3, D: 4 } as Record<string, number>)[letter] ?? null;
  }
  // Accept numeric: "1", "Group 1", "G1"
  const numMatch = s.match(/\b([1-4])\b/);
  if (numMatch) return Number(numMatch[1]);
  // Keyword fallbacks
  if (/star/i.test(s)) return 1;
  if (/good/i.test(s)) return 2;
  if (/average/i.test(s)) return 3;
  if (/poor|girl|female|f\b|jr|junior/i.test(s)) return 4;
  return null;
}

function parseBasePriceValue(raw: any): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Handle lakh notation: "5L", "5.5L", "5 lakh", "5 lakhs"
  const lakhMatch = s.match(/^[\s₹]*([\d.]+)\s*(?:L|lakh|lakhs)\b/i);
  if (lakhMatch) return Math.round(parseFloat(lakhMatch[1]) * 100000);
  // Handle crore notation: "1cr", "1 crore"
  const croreMatch = s.match(/^[\s₹]*([\d.]+)\s*(?:cr|crore|crores)\b/i);
  if (croreMatch) return Math.round(parseFloat(croreMatch[1]) * 10000000);
  // Handle plain number with optional currency symbol/commas
  const n = Number(s.replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}

export function parseRegistrationXlsx(input: string | Buffer): RegistrationPlayer[] {
  const wb = typeof input === 'string' ? XLSX.readFile(input) : XLSX.read(input, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
  // Normalize row keys: trim whitespace and strip leading '#' so headers like '#Player Name' or ' Base Price ' work
  const rows = rawRows.map((row: any) => {
    const normalized: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      normalized[key.trim().replace(/^#+/, '')] = row[key];
    }
    return normalized;
  });

  const players: RegistrationPlayer[] = [];
  for (const row of rows) {
    const firstName = pick(row,
      'First Name', 'first_name', 'FirstName', 'FIRST NAME', 'first name'
    );
    const lastName = pick(row,
      'Last Name', 'last_name', 'LastName', 'LAST NAME', 'last name', 'Surname', 'surname'
    );
    // Single-column name fallback (also fuzzy)
    const singleName = pick(row,
      'Name', 'name', 'Player Name', 'player_name', 'PlayerName', 'PLAYER NAME', 'Full Name', 'full_name'
    ) || pickFuzzy(row, 'player name', 'full name', 'name');

    let fullName: string;
    let fn = firstName;
    let ln = lastName;
    if (fn || ln) {
      fullName = `${fn} ${ln}`.trim();
    } else if (singleName) {
      fullName = singleName;
      const parts = singleName.split(/\s+/);
      fn = parts[0];
      ln = parts.slice(1).join(' ');
    } else {
      continue;
    }

    if (!fullName) continue;

    const gender = pick(row, 'Gender', 'gender', 'GENDER', 'Sex', 'sex') || pickFuzzy(row, 'gender', 'sex') || 'Male';
    const groupRaw = pick(row, 'Group', 'group', 'Group Number', 'group_number', 'GroupNumber', 'Player Group', 'Category')
      || pickFuzzy(row, 'group', 'category');
    const basePriceRaw = pick(row, 'Base Price', 'base_price', 'BasePrice', 'BASE PRICE', 'Price', 'price', 'Min Price',
      'Minimum Price', 'minimum_price', 'min_price', 'Base Bid', 'base_bid', 'Min Bid', 'Starting Price', 'starting_price')
      || pickFuzzy(row, 'base price', 'base_price', 'base bid', 'min price', 'min bid', 'starting price');
    const captainRaw = pick(row, 'Captain', 'captain', 'Is Captain', 'is_captain', 'Captain Eligible');
    const roleRaw = pick(row, 'Role', 'role', 'ROLE', 'Player Role', 'Position', 'position')
      || pickFuzzy(row, 'role', 'position');
    const ratingRaw = pick(row, 'Rating', 'rating', 'RATING', 'Overall Rating', 'overall_rating')
      || pickFuzzy(row, 'rating');
    const gradeRaw = pick(row, 'Grade', 'grade', 'GRADE') || pickFuzzy(row, 'grade');
    const buyRaw = pick(row, 'Buy?', 'Buy', 'buy', 'Should Buy', 'should_buy', 'BUY') || pickFuzzy(row, 'buy');
    const noteRaw = pick(row, 'Note', 'note', 'Notes', 'notes', 'NOTE', 'Comment', 'comment')
      || pickFuzzy(row, 'note', 'comment');

    // Skip section-header rows (e.g. "⭐⭐⭐ AVERAGE PERFORMERS", "NEW PLAYERS ...")
    if (/[⭐★*#-]{2,}|AVERAGE PERFORMERS|NEW PLAYERS|SECTION|---/i.test(fullName)) continue;
    if (/^[^a-z]/i.test(fullName) && fullName.length > 30) continue;

    const ratingNum = ratingRaw ? Number(ratingRaw) : null;

    // Map Buy? column: Fixed/Must Buy/Recommended/Consider = true, Skip = false, else null
    let shouldBuy: boolean | null = null;
    if (buyRaw) {
      if (/fixed|must|recommend|consider|yes|true|1\b/i.test(buyRaw)) shouldBuy = true;
      else if (/skip|no|false|0\b/i.test(buyRaw)) shouldBuy = false;
    }

    players.push({
      first_name: fn,
      last_name: ln,
      full_name: fullName,
      gender: gender || 'Male',
      group_number: parseGroupNumber(groupRaw),
      base_price: parseBasePriceValue(basePriceRaw),
      is_captain_eligible: /yes|true|1|captain/i.test(captainRaw) || /captain/i.test(roleRaw),
      role: roleRaw && roleRaw !== '—' ? roleRaw : null,
      overall_rating: ratingRaw && !isNaN(ratingNum!) ? ratingNum : null,
      grade: gradeRaw || null,
      should_buy: shouldBuy,
      note: noteRaw || null,
    });
  }
  return players;
}

export interface AuctionTeam {
  name: string;
  color_primary: string;
  players: AuctionPlayerRow[];
}

export interface AuctionPlayerRow {
  player_name: string;
  group_number: number;
  purchase_price: number;
  is_captain: boolean;
}

// Known team colors from ZPL branding
const TEAM_COLORS: Record<string, string> = {
  'trojan horse': '#8B0000',       // Dark Red / Maroon
  'the mavericks': '#FF6B35',      // Orange
  'mavericks': '#FF6B35',
  'marvel monsters': '#7B1FA2',    // Purple
  'red squad': '#E53935',          // Red
  'super smashers': '#FFD700',     // Yellow
  'star strikers': '#FFA500',      // Orange-Gold
  'gray mighty': '#9E9E9E',        // Grey
  'grey mighty': '#9E9E9E',
  'the tech titans': '#00ACC1',    // Teal
  'tech titans': '#00ACC1',
  'thunder strikers': '#1565C0',   // Blue
  'boundary blazers': '#2E7D32',   // Green
};

export function getTeamColor(teamName: string): string {
  const key = teamName.toLowerCase().trim();
  return TEAM_COLORS[key] || '#1B3A8C';
}

function parsePrice(raw: any): number {
  if (!raw) return 0;
  const s = String(raw).replace(/[₹,\s]/g, '');
  return Number(s) || 0;
}

function cleanPlayerName(raw: string): string {
  // Remove ALL parenthetical content (batting hand, bowling style, keeper note, etc.)
  return raw.replace(/\s*\([^)]*\)/g, '').trim();
}

export function parseAuctionXlsx(input: string | Buffer): { teams: AuctionTeam[] } {
  const wb = typeof input === 'string' ? XLSX.readFile(input) : XLSX.read(input, { type: 'buffer' });
  const teams: AuctionTeam[] = [];

  const skipSheets = ['captains', 'boys selection', 'delivery type', 'practice', 'analysis'];

  for (const sheetName of wb.SheetNames) {
    if (skipSheets.some(s => sheetName.toLowerCase().includes(s))) continue;

    const ws = wb.Sheets[sheetName];
    // Use raw rows (array of arrays) to detect header row
    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawRows.length) continue;

    // Find header row — look for "Player Name" in first column
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const first = String(rawRows[i][0] || '').toLowerCase();
      if (first.includes('player') || first.includes('name')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    // headerRowIdx found — read data rows below it
    const players: AuctionPlayerRow[] = [];
    let isFirstPlayer = true;

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rawName = String(row[0] || '').trim();
      // Stop at section separators
      if (rawName.toLowerCase().includes('bowling analysis') ||
          rawName.toLowerCase().includes('practice match') ||
          rawName.toLowerCase() === 'player name') continue;
      if (!rawName) continue;

      const playerName = cleanPlayerName(rawName);
      if (!playerName) continue;

      const price = parsePrice(row[1]);
      // Group: infer from price bracket (Group 1 > 5L, Group 2 2-5L, Group 3 < 2L, Group 4 < 0.5L)
      let group = 3;
      if (price >= 5000000) group = 1;
      else if (price >= 2000000) group = 2;
      else if (price >= 500000) group = 3;
      else group = 4;

      players.push({
        player_name: playerName,
        group_number: group,
        purchase_price: price,
        is_captain: isFirstPlayer,
      });
      isFirstPlayer = false;
    }

    if (players.length > 0) {
      teams.push({
        name: sheetName,
        color_primary: getTeamColor(sheetName),
        players,
      });
    }
  }

  return { teams };
}
