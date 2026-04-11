import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { parseCricHeroesPDF } from '@/lib/parsers/cricheroes';
import { analyzeMatch } from '@/lib/analysis/engine';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id } = await params;
    const scorecard = await db.getScorecardByMatchId(id);
    if (!scorecard) return NextResponse.json({ exists: false }, { status: 200 });
    const innings = await db.getMatchInningsWithScores(id);
    return NextResponse.json({
      exists: true,
      scorecard: {
        ...scorecard,
        scorecard_parsed: scorecard.scorecard_json ? JSON.parse(scorecard.scorecard_json) : null,
      },
      innings,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDB();
    const { id: matchId } = await params;

    // Verify match exists
    const match = await db.getMatchById(matchId);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 });
    }

    // Upload PDF to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${matchId}.pdf`;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { error: uploadError } = await supabase.storage
      .from('scorecards')
      .upload(filename, buffer, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    const { data: { publicUrl } } = supabase.storage.from('scorecards').getPublicUrl(filename);
    const pdfUrl = publicUrl;

    // Parse scorecard
    let parsed: any;
    try {
      parsed = await parseCricHeroesPDF(buffer);
    } catch (e: any) {
      return NextResponse.json({ error: `Scorecard parsing failed: ${e.message}` }, { status: 422 });
    }

    // Get teams for this match so we can try to match team names → team IDs
    const teams = [
      { id: (match as any).team_a_id, name: (match as any).team_a_name },
      { id: (match as any).team_b_id, name: (match as any).team_b_name },
    ].filter(t => t.id && t.name);

    function findTeamId(teamName: string): string | null {
      if (!teamName) return null;
      const lower = teamName.toLowerCase();
      const found = teams.find(t =>
        t.name!.toLowerCase().includes(lower) || lower.includes(t.name!.toLowerCase())
      );
      return found?.id || null;
    }

    // Save innings + batting + bowling
    const innings = parsed.innings || [];
    for (const inn of innings) {
      const battingTeamId = findTeamId(inn.batting_team);
      const bowlingTeamId = findTeamId(inn.bowling_team);

      const innId = await db.saveInnings({
        match_id: matchId,
        batting_team_id: battingTeamId,
        bowling_team_id: bowlingTeamId,
        innings_number: inn.innings_number,
        total_runs: inn.total_runs || 0,
        total_wickets: inn.total_wickets || 0,
        total_overs: inn.total_overs || 0,
        extras_json: inn.extras ? JSON.stringify(inn.extras) : undefined,
      });

      // Save batting rows — try to find player_id by name
      const battingRows = await Promise.all((inn.batting || []).map(async (b: any, idx: number) => {
        const player = await db.findPlayerByName(b.player_name);
        return {
          match_id: matchId,
          innings_id: innId,
          player_id: player?.id || null,
          player_name: b.player_name,
          team_id: battingTeamId,
          runs_scored: b.runs || 0,
          balls_faced: b.balls || 0,
          fours: b.fours || 0,
          sixes: b.sixes || 0,
          strike_rate: b.strike_rate || 0,
          dismissal_type: b.dismissal_type || null,
          dismissal_bowler_id: null,
          dismissal_fielder_id: null,
          batting_position: b.position || idx + 1,
        };
      }));
      if (battingRows.length > 0) await db.saveMatchBatting(battingRows);

      // Save bowling rows
      const bowlingRows = await Promise.all((inn.bowling || []).map(async (b: any) => {
        const player = await db.findPlayerByName(b.player_name);
        return {
          match_id: matchId,
          innings_id: innId,
          player_id: player?.id || null,
          player_name: b.player_name,
          team_id: bowlingTeamId,
          overs: b.overs || 0,
          maidens: b.maidens || 0,
          runs_given: b.runs || 0,
          wickets: b.wickets || 0,
          economy: b.economy || 0,
          wides: b.wides || 0,
          no_balls: b.no_balls || 0,
          dot_balls: b.dot_balls || 0,
        };
      }));
      if (bowlingRows.length > 0) await db.saveMatchBowling(bowlingRows);
    }

    // Run rule-based analysis
    let analysis = '';
    try {
      analysis = analyzeMatch({
        scorecardData: parsed,
        matchInfo: {
          team_a: parsed.match_info?.team_a || (match as any).team_a_name || 'Team A',
          team_b: parsed.match_info?.team_b || (match as any).team_b_name || 'Team B',
          match_type: (match as any).match_type,
        },
      });
    } catch (e: any) {
      analysis = `Analysis unavailable: ${e.message}`;
    }

    // Upsert scorecard record
    await db.upsertScorecard({
      match_id: matchId,
      season_id: (match as any).season_id,
      pdf_url: pdfUrl,
      scorecard_json: JSON.stringify(parsed),
      ai_analysis: analysis,
    });

    // Mark match as completed if it isn't already
    if ((match as any).status !== 'completed') {
      await db.updateMatch(matchId, { status: 'completed' } as any);
    }

    // Return full data
    const savedInnings = await db.getMatchInningsWithScores(matchId);
    return NextResponse.json({
      success: true,
      scorecard: { scorecard_parsed: parsed, ai_analysis: analysis, pdf_url: pdfUrl },
      innings: savedInnings,
    });
  } catch (e: any) {
    console.error('Scorecard upload error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
