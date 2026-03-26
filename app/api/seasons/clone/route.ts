import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// POST /api/seasons/clone
// Clones only TEAMS (name, colors, short_name) from a source season into a target season.
// Player registrations are NOT copied — 2026 players must be imported from the new spreadsheet.
export async function POST(req: NextRequest) {
  try {
    const db = getDB();
    const { source_season_id, target_season_id } = await req.json();

    if (!source_season_id || !target_season_id) {
      return NextResponse.json({ error: 'source_season_id and target_season_id required' }, { status: 400 });
    }
    if (source_season_id === target_season_id) {
      return NextResponse.json({ error: 'Source and target must be different seasons' }, { status: 400 });
    }

    const sourceTeams = await db.getTeams(source_season_id);
    if (sourceTeams.length === 0) {
      return NextResponse.json({ error: 'No teams found in source season' }, { status: 404 });
    }

    // Only clone team structure — NOT player registrations
    const createdTeams = await Promise.all(sourceTeams.map(t =>
      db.createTeam({
        season_id: target_season_id,
        name: t.name,
        short_name: t.short_name || undefined,
        color_primary: t.color_primary || undefined,
        color_secondary: t.color_secondary || undefined,
        logo_url: t.logo_url || undefined,
      })
    ));

    return NextResponse.json({
      teams_created: createdTeams.length,
      note: 'Teams copied. Player registrations were NOT copied — import 2026 players from the new spreadsheet via Admin → Import.',
      teams: createdTeams,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
