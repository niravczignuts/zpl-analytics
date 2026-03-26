import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { parseRegistrationXlsx, parseAuctionXlsx } from '@/lib/import/xlsx-parser';
import { parseBattingCsv, parseBowlingCsv, parseFieldingCsv, parseMvpCsv } from '@/lib/import/csv-parser';
import { findBestMatch } from '@/lib/import/name-matcher';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('type') as string;
    const seasonId = formData.get('season_id') as string;

    if (!file || !fileType || !seasonId) {
      return NextResponse.json({ error: 'file, type, and season_id are required' }, { status: 400 });
    }

    const db = getDB();

    const season = await db.getSeasonById(seasonId);
    if (!season) {
      return NextResponse.json({ error: `Season not found: ${seasonId}` }, { status: 404 });
    }

    // Read file into memory — no temp files, avoids Windows short-path issues
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = {
      imported: 0,
      skipped: 0,
      created: 0,
      matched: 0,
      errors: [] as string[],
      skipped_names: [] as string[],
    };

    // ── Registration XLSX ────────────────────────────────────────────────────
    if (fileType === 'registration') {
      const players = parseRegistrationXlsx(buffer);
      if (players.length === 0) {
        return NextResponse.json({
          error: 'No players found. Check column names: First Name + Last Name (or Name/Player Name), Gender, Group, Base Price',
        }, { status: 422 });
      }

      // Clear existing registrations for this season so the count always matches the file
      await db.clearRegistrations(seasonId);

      const existingPlayers = await db.rawQuery('SELECT id, first_name, last_name FROM players', []);
      const candidates = existingPlayers.map((p: any) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
      }));

      for (const rp of players) {
        if (!rp.full_name.trim()) continue;
        try {
          const match = findBestMatch(rp.full_name, candidates, 0.78);
          let playerId: string;

          if (match) {
            if (rp.gender) await db.updatePlayer(match.id, { gender: rp.gender });
            playerId = match.id;
            result.matched++;
          } else {
            const parts = rp.full_name.trim().split(/\s+/);
            playerId = uuidv4();
            await db.createPlayer({
              id: playerId,
              first_name: parts[0],
              last_name: parts.slice(1).join(' ') || '',
              gender: rp.gender || 'Male',
            });
            candidates.push({ id: playerId, name: rp.full_name });
            result.created++;
          }

          await db.upsertRegistration({
            season_id: seasonId,
            player_id: playerId,
            group_number: rp.group_number ?? undefined,
            base_price: rp.base_price ?? undefined,
            is_captain_eligible: rp.is_captain_eligible ?? false,
            registration_status: 'verified',
          });
          result.imported++;
        } catch (e: any) {
          result.errors.push(`${rp.full_name}: ${e.message}`);
        }
      }

    // ── Auction XLSX ─────────────────────────────────────────────────────────
    } else if (fileType === 'auction') {
      const { teams } = parseAuctionXlsx(buffer);
      if (teams.length === 0) {
        return NextResponse.json({
          error: 'No teams found. Ensure each sheet tab is named after a team.',
        }, { status: 422 });
      }

      // Clear all existing auction purchases for this season so re-import is idempotent
      await db.clearAuctionPurchases(seasonId);

      const allPlayers = await db.rawQuery('SELECT id, first_name, last_name FROM players', []);
      const candidates = allPlayers.map((p: any) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
      }));

      for (const teamData of teams) {
        const existingTeams = await db.getTeams(seasonId);
        let team = existingTeams.find(t => t.name.toLowerCase() === teamData.name.toLowerCase());
        if (!team) {
          team = await db.createTeam({
            season_id: seasonId,
            name: teamData.name,
            color_primary: teamData.color_primary,
          });
        }

        for (const ap of teamData.players) {
          try {
            const match = findBestMatch(ap.player_name, candidates, 0.78);
            if (!match) {
              result.skipped++;
              result.skipped_names.push(ap.player_name);
              continue;
            }
            await db.upsertRegistration({
              season_id: seasonId,
              player_id: match.id,
              group_number: ap.group_number,
              base_price: ap.purchase_price,
              registration_status: 'verified',
            });
            await db.recordPurchase({
              season_id: seasonId,
              team_id: team.id,
              player_id: match.id,
              purchase_price: ap.purchase_price,
              group_number: ap.group_number,
              is_captain: ap.is_captain,
            });
            result.imported++;
            result.matched++;
          } catch (e: any) {
            result.errors.push(`${ap.player_name}: ${e.message}`);
          }
        }
      }

    // ── Stats CSVs ───────────────────────────────────────────────────────────
    } else {
      const allPlayers = await db.rawQuery('SELECT id, first_name, last_name, external_id FROM players', []);
      if (allPlayers.length === 0) {
        return NextResponse.json({
          error: 'No players in database. Import Player Registration first before importing stats.',
        }, { status: 422 });
      }

      const candidates = allPlayers.map((p: any) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
        external_id: p.external_id,
      }));

      const csvText = buffer.toString('utf-8');

      const findPlayer = async (extId: string, name: string): Promise<string | null> => {
        if (extId) {
          const byExt = allPlayers.find((p: any) => p.external_id === extId);
          if (byExt) return byExt.id;
        }
        const match = findBestMatch(name, candidates, 0.78);
        if (match) {
          if (extId) await db.updatePlayer(match.id, { external_id: extId });
          return match.id;
        }
        return null;
      };

      if (fileType === 'batting') {
        const rows = parseBattingCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No batting rows found. Check CSV format.' }, { status: 422 });
        await db.clearPlayerStats(seasonId, 'batting');
        for (const r of rows) {
          const pid = await findPlayer(r.external_id, r.name);
          if (pid) { await db.upsertPlayerStats(pid, seasonId, 'batting', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else if (fileType === 'bowling') {
        const rows = parseBowlingCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No bowling rows found. Check CSV format.' }, { status: 422 });
        await db.clearPlayerStats(seasonId, 'bowling');
        for (const r of rows) {
          const pid = await findPlayer(r.external_id, r.name);
          if (pid) { await db.upsertPlayerStats(pid, seasonId, 'bowling', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else if (fileType === 'fielding') {
        const rows = parseFieldingCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No fielding rows found. Check CSV format.' }, { status: 422 });
        await db.clearPlayerStats(seasonId, 'fielding');
        for (const r of rows) {
          const pid = await findPlayer(r.external_id, r.name);
          if (pid) { await db.upsertPlayerStats(pid, seasonId, 'fielding', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else if (fileType === 'mvp') {
        const rows = parseMvpCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No MVP rows found. Expected columns: Player Name, Total.' }, { status: 422 });
        await db.clearPlayerStats(seasonId, 'mvp');
        for (const r of rows) {
          const pid = await findPlayer('', r.name);
          if (pid) { await db.upsertPlayerStats(pid, seasonId, 'mvp', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else {
        return NextResponse.json({ error: `Unknown file type: ${fileType}` }, { status: 400 });
      }
    }

    return NextResponse.json({
      ...result,
      // Total registered = imported (matches the file exactly after clear+reimport)
      total_registered: result.imported,
    });
  } catch (e: any) {
    console.error('[Import Error]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
