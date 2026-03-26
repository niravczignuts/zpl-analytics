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
}

function pick(row: any, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  }
  return '';
}

function parseGroupNumber(raw: string | number | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Accept "1", "Group 1", "G1", "Star", etc.
  const match = s.match(/\d/);
  if (match) return Number(match[0]);
  if (/star/i.test(s)) return 1;
  if (/girl|female|f\b|jr|junior/i.test(s)) return 4;
  return null;
}

function parseBasePriceValue(raw: any): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}

export function parseRegistrationXlsx(input: string | Buffer): RegistrationPlayer[] {
  const wb = typeof input === 'string' ? XLSX.readFile(input) : XLSX.read(input, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

  const players: RegistrationPlayer[] = [];
  for (const row of rows) {
    const firstName = pick(row,
      'First Name', 'first_name', 'FirstName', 'FIRST NAME', 'first name'
    );
    const lastName = pick(row,
      'Last Name', 'last_name', 'LastName', 'LAST NAME', 'last name', 'Surname', 'surname'
    );
    // Single-column name fallback
    const singleName = pick(row,
      'Name', 'name', 'Player Name', 'player_name', 'PlayerName', 'PLAYER NAME', 'Full Name', 'full_name'
    );

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

    const gender = pick(row, 'Gender', 'gender', 'GENDER', 'Sex', 'sex') || 'Male';
    const groupRaw = pick(row, 'Group', 'group', 'Group Number', 'group_number', 'GroupNumber', 'Player Group', 'Category');
    const basePriceRaw = pick(row, 'Base Price', 'base_price', 'BasePrice', 'BASE PRICE', 'Price', 'price', 'Min Price');
    const captainRaw = pick(row, 'Captain', 'captain', 'Is Captain', 'is_captain', 'Captain Eligible');

    players.push({
      first_name: fn,
      last_name: ln,
      full_name: fullName,
      gender: gender || 'Male',
      group_number: parseGroupNumber(groupRaw),
      base_price: parseBasePriceValue(basePriceRaw),
      is_captain_eligible: /yes|true|1/i.test(captainRaw),
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
