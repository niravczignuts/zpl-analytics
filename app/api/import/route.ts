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

    // Season resolution: try exact ID, then by year, then auto-create if year-like
    let season = await db.getSeasonById(seasonId);
    if (!season) {
      // Try to find by year (e.g. "2024" → season with year=2024)
      const yearNum = parseInt(seasonId, 10);
      const isYear = /^\d{4}$/.test(seasonId.trim()) && yearNum >= 2000 && yearNum <= 2100;
      if (isYear) {
        const allSeasons = await db.getSeasons();
        season = allSeasons.find(s => s.year === yearNum) || null;
        if (!season) {
          // Auto-create the season so stats can be imported
          season = await db.createSeason({
            id: `season-${yearNum}`,
            name: `ZPL ${yearNum}`,
            year: yearNum,
            status: 'completed',
          });
          console.log(`[Import] Auto-created season: ${season.id}`);
        }
      }
    }
    if (!season) {
      return NextResponse.json({ error: `Season not found: ${seasonId}` }, { status: 404 });
    }

    // Use the resolved season ID (may differ from the submitted seasonId, e.g. "2024" → "season-2024")
    const resolvedSeasonId = season.id;

    // Read file into memory — no temp files, avoids Windows short-path issues
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = {
      imported: 0,
      skipped: 0,
      created: 0,
      matched: 0,
      with_base_price: 0,
      errors: [] as string[],
      skipped_names: [] as string[],
    };

    // ── Registration XLSX ────────────────────────────────────────────────────
    if (fileType === 'registration') {
      const players = parseRegistrationXlsx(buffer);
      // Debug: log first 3 parsed players to server console
      console.log('[Import] First 3 parsed players:', JSON.stringify(players.slice(0, 3), null, 2));
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
            const playerUpdate: any = {};
            if (rp.gender) playerUpdate.gender = rp.gender;
            if (rp.role) playerUpdate.player_role = rp.role;
            if (Object.keys(playerUpdate).length) await db.updatePlayer(match.id, playerUpdate);
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
              ...(rp.role ? { player_role: rp.role } : {}),
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

          // Save owner assessment data from registration file
          if (rp.overall_rating != null || rp.grade || rp.should_buy != null || rp.note) {
            await db.upsertPlayerOwnerData({
              player_id: playerId,
              ...(rp.overall_rating != null ? { overall_rating: rp.overall_rating } : {}),
              ...(rp.grade ? { grade: rp.grade } : {}),
              ...(rp.should_buy != null ? { should_buy: rp.should_buy } : {}),
              ...(rp.note ? { owner_note: rp.note } : {}),
            });
          }

          if (rp.base_price != null) result.with_base_price++;
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

      const candidates = allPlayers.map((p: any) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
        external_id: p.external_id,
      }));

      const csvText = buffer.toString('utf-8');

      const findPlayer = async (
        extId: string,
        name: string,
        extra?: { batting_hand?: string; bowling_style?: string }
      ): Promise<string | null> => {
        // Normalize name: trim whitespace
        const nameTrim = name ? name.trim().replace(/\s+/g, ' ') : '';

        // 1. Try by external_id first (most reliable) — check in-memory array
        if (extId) {
          const byExt = allPlayers.find((p: any) => p.external_id === extId);
          if (byExt) return byExt.id;
          // Also do a direct DB query in case in-memory is stale
          const dbRows = await db.rawQuery('SELECT id, first_name, last_name, external_id FROM players WHERE external_id = ?', [extId]);
          if (dbRows.length > 0) {
            const p = dbRows[0];
            // Sync into in-memory cache
            if (!allPlayers.find((x: any) => x.id === p.id)) {
              allPlayers.push(p);
              candidates.push({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim(), external_id: p.external_id });
            }
            return p.id;
          }
        }

        // 2. Try fuzzy name match — also try first-name-only if single token
        let match = findBestMatch(nameTrim, candidates, 0.78);
        if (!match && nameTrim && !nameTrim.includes(' ')) {
          // Single-word name: try matching against first_name only
          const firstNameCandidates = allPlayers.map((p: any) => ({
            id: p.id,
            name: p.first_name ? p.first_name.trim() : '',
          })).filter((c: any) => c.name);
          match = findBestMatch(nameTrim, firstNameCandidates, 0.85);
        }

        if (match) {
          const updates: any = {};
          if (extId) updates.external_id = extId;
          // Fill in batting/bowling info if not already set
          if (extra?.batting_hand && extra.batting_hand !== '-') updates.batting_hand = extra.batting_hand;
          if (extra?.bowling_style && extra.bowling_style !== '-') updates.bowling_style = extra.bowling_style;
          if (Object.keys(updates).length) await db.updatePlayer(match.id, updates);
          if (extId) {
            const found = allPlayers.find((p: any) => p.id === match!.id);
            if (found) found.external_id = extId;
          }
          return match.id;
        }

        // 3. Not found — auto-create as historical player so past stats are preserved
        if (!nameTrim) return null;
        const parts = nameTrim.split(/\s+/);
        const newId = uuidv4();
        await db.createPlayer({
          id: newId,
          first_name: parts[0],
          last_name: parts.slice(1).join(' ') || '',
          external_id: extId || null,
          batting_hand: (extra?.batting_hand && extra.batting_hand !== '-') ? extra.batting_hand : null,
          bowling_style: (extra?.bowling_style && extra.bowling_style !== '-') ? extra.bowling_style : null,
        });
        allPlayers.push({ id: newId, first_name: parts[0], last_name: parts.slice(1).join(' ') || '', external_id: extId || null });
        candidates.push({ id: newId, name: nameTrim, external_id: extId || null });
        result.created++;
        return newId;
      };

      if (fileType === 'batting') {
        const rows = parseBattingCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No batting rows found. Check CSV format.' }, { status: 422 });
        await db.clearPlayerStats(resolvedSeasonId, 'batting');
        for (const r of rows) {
          const pid = await findPlayer(r.external_id, r.name, { batting_hand: r.stats.batting_hand });
          if (pid) { await db.upsertPlayerStats(pid, resolvedSeasonId, 'batting', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else if (fileType === 'bowling') {
        const rows = parseBowlingCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No bowling rows found. Check CSV format.' }, { status: 422 });
        await db.clearPlayerStats(resolvedSeasonId, 'bowling');
        for (const r of rows) {
          const pid = await findPlayer(r.external_id, r.name, { bowling_style: r.stats.bowling_style });
          if (pid) { await db.upsertPlayerStats(pid, resolvedSeasonId, 'bowling', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else if (fileType === 'fielding') {
        const rows = parseFieldingCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No fielding rows found. Check CSV format.' }, { status: 422 });
        await db.clearPlayerStats(resolvedSeasonId, 'fielding');
        for (const r of rows) {
          const pid = await findPlayer(r.external_id, r.name);
          if (pid) { await db.upsertPlayerStats(pid, resolvedSeasonId, 'fielding', r.stats); result.imported++; result.matched++; }
          else { result.skipped++; result.skipped_names.push(r.name); }
        }
      } else if (fileType === 'mvp') {
        const rows = parseMvpCsv(csvText);
        if (rows.length === 0) return NextResponse.json({ error: 'No MVP rows found. Expected columns: Player Name, Total.' }, { status: 422 });
        await db.clearPlayerStats(resolvedSeasonId, 'mvp');
        for (const r of rows) {
          const pid = await findPlayer('', r.name, { batting_hand: r.stats.batting_hand, bowling_style: r.stats.bowling_style });
          if (pid) { await db.upsertPlayerStats(pid, resolvedSeasonId, 'mvp', r.stats); result.imported++; result.matched++; }
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
