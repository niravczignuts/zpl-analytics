import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// ── Column header aliases accepted from the CSV/XLSX ────────────────────────
const FIELD_MAP: Record<string, string> = {
  'first_name': 'first_name', 'firstname': 'first_name', 'first name': 'first_name',
  'last_name':  'last_name',  'lastname':  'last_name',  'last name':  'last_name',
  'name':       'full_name',  'player name': 'full_name', 'playername': 'full_name',
  'gender':     'gender',
  'role':       'player_role', 'player_role': 'player_role', 'player role': 'player_role',
  'batting_hand': 'batting_hand', 'batting hand': 'batting_hand', 'batting': 'batting_hand',
  'bowling_style': 'bowling_style', 'bowling style': 'bowling_style', 'bowling': 'bowling_style',
  'strong_buy': 'is_strong_buy', 'is_strong_buy': 'is_strong_buy', 'strong buy': 'is_strong_buy',
  'budget_range': 'budget_range', 'budget range': 'budget_range', 'budget': 'budget_range',
  'jersey_number': 'jersey_number', 'jersey': 'jersey_number', 'jersey number': 'jersey_number',
  'nationality': 'nationality',
  'age': 'age',
  'experience': 'experience_years', 'experience_years': 'experience_years',
  'notes': 'notes', 'bio': 'notes',
};

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/[^a-z0-9 _]/g, '');
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const headers    = rawHeaders.map(normalizeKey);
  return lines.slice(1).map(line => {
    const cols: string[] = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    let rows: Record<string, string>[] = [];

    if (ext === 'csv') {
      const text = await file.text();
      rows = parseCSV(text);
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Use xlsx library
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
      rows = raw.map(r => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) out[normalizeKey(k)] = String(v ?? '').trim();
        return out;
      });
    } else {
      return NextResponse.json({ error: 'Only .csv, .xlsx, .xls files are supported' }, { status: 400 });
    }

    if (rows.length === 0) return NextResponse.json({ error: 'File is empty or could not be parsed' }, { status: 400 });

    const db = getDB();
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const rawRow of rows) {
      // Map raw column keys → normalised field names
      const row: Record<string, string> = {};
      for (const [rawKey, val] of Object.entries(rawRow)) {
        const mapped = FIELD_MAP[rawKey];
        if (mapped) row[mapped] = val;
      }

      // Resolve first/last name
      let firstName = row.first_name?.trim() || '';
      let lastName  = row.last_name?.trim()  || '';
      if (!firstName && row.full_name) {
        const parts = row.full_name.trim().split(/\s+/);
        firstName = parts[0];
        lastName  = parts.slice(1).join(' ') || '.';
      }
      if (!firstName) { skipped++; continue; }

      const isStrongBuy = ['1', 'yes', 'true', 'y'].includes((row.is_strong_buy || '').toLowerCase()) ? 1 : 0;

      const fields = {
        first_name:       firstName,
        last_name:        lastName || '.',
        gender:           row.gender           || null,
        player_role:      row.player_role       || null,
        batting_hand:     row.batting_hand      || null,
        bowling_style:    row.bowling_style     || null,
        is_strong_buy:    isStrongBuy,
        budget_range:     row.budget_range      || null,
        jersey_number:    row.jersey_number     || null,
        nationality:      row.nationality       || null,
        age:              row.age ? parseInt(row.age) || null : null,
        experience_years: row.experience_years ? parseInt(row.experience_years) || null : null,
        notes:            row.notes             || null,
      };

      // Try to find existing player by name
      const existing = await db.findPlayerByName(`${firstName} ${lastName}`);

      if (existing) {
        // Update existing player — only overwrite non-empty values
        const updateParts: string[] = [];
        const updateVals: any[]     = [];
        for (const [k, v] of Object.entries(fields)) {
          if (k === 'first_name' || k === 'last_name') continue;
          if (v !== null && v !== '') { updateParts.push(`${k} = ?`); updateVals.push(v); }
        }
        if (updateParts.length > 0) {
          await db.rawRun(`UPDATE players SET ${updateParts.join(', ')} WHERE id = ?`, [...updateVals, existing.id]);
        }
        updated++;
      } else {
        // Create new player
        const newId = uuidv4();
        await db.rawRun(
          `INSERT INTO players (id, first_name, last_name, gender, player_role, batting_hand, bowling_style,
            is_strong_buy, budget_range, jersey_number, nationality, age, experience_years, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId, fields.first_name, fields.last_name, fields.gender, fields.player_role,
            fields.batting_hand, fields.bowling_style, fields.is_strong_buy, fields.budget_range,
            fields.jersey_number, fields.nationality, fields.age, fields.experience_years, fields.notes,
          ]
        );
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: { total: rows.length, created, updated, skipped, errors: errors.slice(0, 10) },
    });
  } catch (e: any) {
    console.error('[Bulk Import]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
