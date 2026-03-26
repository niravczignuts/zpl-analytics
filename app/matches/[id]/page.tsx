'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchJSON } from '@/lib/fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trophy, Edit2, CheckCircle2, Loader2, AlertCircle, Save, Upload, FileText, ChevronDown, ChevronUp, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface MatchDetail {
  id: string;
  season_id: string;
  match_number: number | null;
  match_type: string;
  status: 'upcoming' | 'live' | 'completed';
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_color: string | null;
  team_b_color: string | null;
  toss_winner_id: string | null;
  toss_decision: string | null;
  winner_id: string | null;
  result_summary: string | null;
  match_notes: string | null;
  match_date: string | null;
  venue: string | null;
}

interface InningsData {
  id: string;
  innings_number: number;
  batting_team_id: string | null;
  bowling_team_id: string | null;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  extras_json: string | null;
  batting: BattingRow[];
  bowling: BowlingRow[];
}

interface BattingRow {
  player_name: string;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  dismissal_type: string | null;
  batting_position: number;
}

interface BowlingRow {
  player_name: string;
  overs: number;
  maidens: number;
  runs_given: number;
  wickets: number;
  economy: number;
  wides: number;
  no_balls: number;
}

const statusStyle = (s: string) =>
  s === 'live'      ? 'bg-green-500/20 text-green-400 border-green-500/40' :
  s === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                      'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

const matchLabel = (m: MatchDetail) =>
  m.match_type === 'league' && m.match_number
    ? `Match ${m.match_number}`
    : (m.match_type || 'Match').replace(/^\w/, c => c.toUpperCase());

export default function MatchDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [match,   setMatch]   = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]                   = useState(false);
  const [deleteErr, setDeleteErr]                 = useState('');

  // Scorecard state
  const [scorecardExists, setScorecardExists] = useState(false);
  const [scorecardData, setScorecardData]     = useState<any>(null);
  const [innings, setInnings]                 = useState<InningsData[]>([]);
  const [aiAnalysis, setAiAnalysis]           = useState('');
  const [showAnalysis, setShowAnalysis]       = useState(false);
  const [uploadingScorecard, setUploadingScorecard] = useState(false);
  const [uploadError, setUploadError]         = useState('');
  const [uploadSuccess, setUploadSuccess]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result form state
  const [form, setForm] = useState({
    status:         'upcoming' as string,
    winner_id:      '',
    toss_winner_id: '',
    toss_decision:  '',
    result_summary: '',
    match_notes:    '',
    match_date:     '',
    venue:          '',
  });
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then(r => r.json())
      .then(d => {
        setMatch(d);
        setForm({
          status:         d.status         || 'upcoming',
          winner_id:      d.winner_id      || '',
          toss_winner_id: d.toss_winner_id || '',
          toss_decision:  d.toss_decision  || '',
          result_summary: d.result_summary || '',
          match_notes:    d.match_notes    || '',
          match_date:     d.match_date     ? d.match_date.slice(0, 16) : '',
          venue:          d.venue          || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Load scorecard if exists
  useEffect(() => {
    fetch(`/api/matches/${id}/scorecard`)
      .then(r => r.json())
      .then(d => {
        if (d.exists) {
          setScorecardExists(true);
          setScorecardData(d.scorecard?.scorecard_parsed || null);
          setAiAnalysis(d.scorecard?.ai_analysis || '');
          setInnings(d.innings || []);
        }
      })
      .catch(() => {});
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      const body: Record<string, any> = {
        status:         form.status,
        winner_id:      form.winner_id      || null,
        toss_winner_id: form.toss_winner_id || null,
        toss_decision:  form.toss_decision  || null,
        result_summary: form.result_summary || null,
        match_notes:    form.match_notes    || null,
        match_date:     form.match_date     || null,
        venue:          form.venue          || null,
      };
      const res  = await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMatch(data);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      router.push('/matches');
    } catch (e: any) {
      setDeleteErr(e.message);
      setDeleting(false);
    }
  };

  const handleScorecardUpload = async (file: File) => {
    setUploadingScorecard(true);
    setUploadError('');
    setUploadSuccess(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/matches/${id}/scorecard`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setScorecardExists(true);
      setScorecardData(data.scorecard?.scorecard_parsed || null);
      setAiAnalysis(data.scorecard?.ai_analysis || '');
      setInnings(data.innings || []);
      setUploadSuccess(true);
      // Refresh match status (may have been set to completed)
      fetchJSON<MatchDetail>(`/api/matches/${id}`).then(d => { if (d) setMatch(d); }).catch(() => {});
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploadingScorecard(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-full">
      <div className="w-8 h-8 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
    </div>
  );
  if (!match || (match as any).error) return (
    <div className="p-6 text-muted-foreground">Match not found</div>
  );

  const teams = [
    { id: match.team_a_id, name: match.team_a_name, color: match.team_a_color },
    { id: match.team_b_id, name: match.team_b_name, color: match.team_b_color },
  ].filter(t => t.id);

  const winnerTeam = teams.find(t => t.id === match.winner_id);
  const tossTeam   = teams.find(t => t.id === match.toss_winner_id);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/matches" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black font-display gradient-gold">{matchLabel(match)}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge className={cn('text-xs', statusStyle(match.status))}>{match.status}</Badge>
            {match.match_type !== 'league' && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                {match.match_type}
              </Badge>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(!editing)}
            className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 text-xs gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {editing ? 'Cancel' : 'Edit Result'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setShowDeleteConfirm(true); setDeleteErr(''); }}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Match card */}
      <Card className="glass-card border-border overflow-hidden">
        {/* Color bar */}
        <div className="h-1 flex">
          <div className="flex-1" style={{ backgroundColor: match.team_a_color || '#1B3A8C' }} />
          <div className="flex-1" style={{ backgroundColor: match.team_b_color || '#DC1420' }} />
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Team A */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full mx-auto border-2 flex items-center justify-center font-black text-sm"
                style={{ backgroundColor: match.team_a_color || '#1B3A8C', borderColor: (match.team_a_color || '#1B3A8C') + '80', color: '#fff' }}>
                {(match.team_a_name || 'A').slice(0, 2).toUpperCase()}
              </div>
              <Link href={`/teams/${match.team_a_id}`}
                className={cn('font-black text-base hover:underline block',
                  match.winner_id === match.team_a_id ? 'text-[#FFD700]' : 'text-foreground')}>
                {match.team_a_name || 'TBD'}
              </Link>
              {match.winner_id === match.team_a_id && (
                <Badge className="bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30 text-xs">
                  🏆 Winner
                </Badge>
              )}
            </div>

            {/* VS */}
            <div className="text-center">
              <div className="text-2xl font-black text-muted-foreground/50">vs</div>
              {match.match_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(match.match_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
              {match.match_date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(match.match_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* Team B */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full mx-auto border-2 flex items-center justify-center font-black text-sm"
                style={{ backgroundColor: match.team_b_color || '#DC1420', borderColor: (match.team_b_color || '#DC1420') + '80', color: '#fff' }}>
                {(match.team_b_name || 'B').slice(0, 2).toUpperCase()}
              </div>
              <Link href={`/teams/${match.team_b_id}`}
                className={cn('font-black text-base hover:underline block',
                  match.winner_id === match.team_b_id ? 'text-[#FFD700]' : 'text-foreground')}>
                {match.team_b_name || 'TBD'}
              </Link>
              {match.winner_id === match.team_b_id && (
                <Badge className="bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30 text-xs">
                  🏆 Winner
                </Badge>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="mt-4 pt-4 border-t border-border/60 space-y-1.5 text-sm text-muted-foreground text-center">
            {match.result_summary && (
              <p className="text-foreground/80 font-medium">{match.result_summary}</p>
            )}
            {tossTeam && (
              <p>🪙 Toss: <span className="text-foreground/70">{tossTeam.name}</span>
                {match.toss_decision && <span> chose to <span className="text-foreground/70">{match.toss_decision}</span></span>}
              </p>
            )}
            {match.venue && <p>📍 {match.venue}</p>}
            {match.match_notes && (
              <div className="mt-3 text-left p-3 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/15">
                <p className="text-[10px] text-[#FFD700]/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Match Notes
                </p>
                <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap">{match.match_notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      {editing && (
        <Card className="glass-card border-[#FFD700]/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm gradient-gold font-bold">Update Match Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['upcoming', 'live', 'completed'] as const).map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn(
                    'py-2 rounded-lg text-xs font-semibold border transition-all',
                    form.status === s
                      ? s === 'live'      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : s === 'completed' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}>
                  {s === 'upcoming' ? '🟡 Upcoming' : s === 'live' ? '🟢 Live' : '🔵 Completed'}
                </button>
              ))}
            </div>

            {/* Winner */}
            {teams.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Winner</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button onClick={() => setForm(f => ({ ...f, winner_id: '' }))}
                    className={cn('py-2 rounded-lg text-xs border transition-all',
                      !form.winner_id ? 'bg-muted border-border text-muted-foreground' : 'border-border text-muted-foreground/50 hover:border-border/80')}>
                    — No Result
                  </button>
                  {teams.map(t => (
                    <button key={t.id!} onClick={() => setForm(f => ({ ...f, winner_id: t.id! }))}
                      className={cn('py-2 rounded-lg text-xs font-semibold border transition-all',
                        form.winner_id === t.id ? 'border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700]' : 'border-border text-muted-foreground hover:border-border/80')}>
                      🏆 {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Toss */}
            {teams.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Toss Won By</Label>
                  <select value={form.toss_winner_id} onChange={e => setForm(f => ({ ...f, toss_winner_id: e.target.value }))}
                    className="w-full h-9 rounded-lg px-3 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50">
                    <option value="">— Select —</option>
                    {teams.map(t => <option key={t.id!} value={t.id!}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Toss Decision</Label>
                  <select value={form.toss_decision} onChange={e => setForm(f => ({ ...f, toss_decision: e.target.value }))}
                    className="w-full h-9 rounded-lg px-3 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50">
                    <option value="">— Select —</option>
                    <option value="bat">Bat</option>
                    <option value="bowl">Bowl</option>
                  </select>
                </div>
              </div>
            )}

            {/* Result summary */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Result Summary</Label>
              <Input
                value={form.result_summary}
                onChange={e => setForm(f => ({ ...f, result_summary: e.target.value }))}
                placeholder="e.g. Super Smashers won by 6 wickets"
                className="h-9 bg-background border-border text-sm"
              />
            </div>

            {/* Match Notes — used by AI strategy, comparison, player analysis */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#FFD700]" />
                Match Notes <span className="text-white/30 font-normal normal-case">· AI uses this for strategy &amp; analysis</span>
              </Label>
              <textarea
                value={form.match_notes}
                onChange={e => setForm(f => ({ ...f, match_notes: e.target.value }))}
                placeholder="Describe key moments, player performances, tactical observations, pitch conditions, weather, injuries, standout plays — anything useful for AI analysis across modules..."
                rows={5}
                className="w-full rounded-lg px-3 py-2.5 bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50 resize-y"
              />
            </div>

            {/* Date & Venue */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.match_date}
                  onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))}
                  className="h-9 bg-background border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Venue</Label>
                <Input
                  value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="Venue name"
                  className="h-9 bg-background border-border text-sm"
                />
              </div>
            </div>

            {saveErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {saveErr}
              </div>
            )}

            <Button onClick={handleSave} disabled={saving}
              className="w-full h-10 font-bold"
              style={{ background: 'linear-gradient(135deg,#FFD700,#D4AA00)', color: '#000', border: 'none' }}>
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                : <><Save className="w-4 h-4 mr-2" />Save Result</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Match result saved successfully
        </div>
      )}

      {/* ── Scorecard Upload Section ── */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FFD700]" />
              Match Scorecard
            </CardTitle>
            {scorecardExists && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                ✓ Uploaded
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload area */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-[#FFD700]/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleScorecardUpload(f);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleScorecardUpload(f);
                e.target.value = '';
              }}
            />
            {uploadingScorecard ? (
              <div className="space-y-2">
                <Loader2 className="w-8 h-8 mx-auto text-[#FFD700] animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing scorecard with AI…</p>
                <p className="text-xs text-muted-foreground">This may take 20–40 seconds</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground/70">
                  {scorecardExists ? 'Re-upload scorecard' : 'Upload CricHeroes scorecard PDF'}
                </p>
                <p className="text-xs text-muted-foreground">Drop PDF here or click to browse</p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Scorecard uploaded and analysed successfully!
            </div>
          )}

          {/* Innings scorecards */}
          {innings.map((inn) => (
            <div key={inn.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground/80">
                  Innings {inn.innings_number} — {inn.total_runs}/{inn.total_wickets} ({inn.total_overs} ov)
                </h3>
                {inn.extras_json && (() => {
                  try {
                    const ex = JSON.parse(inn.extras_json);
                    return <span className="text-xs text-muted-foreground">Extras: {ex.total ?? ''}</span>;
                  } catch { return null; }
                })()}
              </div>

              {/* Batting table */}
              {inn.batting.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Batter</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">R</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">B</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">4s</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">6s</th>
                        <th className="text-right py-1.5 pl-2 text-muted-foreground font-medium">SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inn.batting.map((b, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-white/5">
                          <td className="py-1.5 pr-3">
                            <div className="font-medium text-foreground/90">{b.player_name}</div>
                            {b.dismissal_type && (
                              <div className="text-muted-foreground text-[10px]">{b.dismissal_type}</div>
                            )}
                          </td>
                          <td className="text-right py-1.5 px-2 font-bold text-foreground">{b.runs_scored}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{b.balls_faced}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{b.fours}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{b.sixes}</td>
                          <td className="text-right py-1.5 pl-2 text-muted-foreground">
                            {b.strike_rate ? b.strike_rate.toFixed(1) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bowling table */}
              {inn.bowling.length > 0 && (
                <div className="overflow-x-auto mt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Bowling</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Bowler</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">O</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">M</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">R</th>
                        <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">W</th>
                        <th className="text-right py-1.5 pl-2 text-muted-foreground font-medium">Eco</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inn.bowling.map((b, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-white/5">
                          <td className="py-1.5 pr-3 font-medium text-foreground/90">{b.player_name}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{b.overs}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{b.maidens}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{b.runs_given}</td>
                          <td className="text-right py-1.5 px-2 font-bold text-foreground">{b.wickets}</td>
                          <td className="text-right py-1.5 pl-2 text-muted-foreground">
                            {b.economy ? b.economy.toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Analysis */}
      {aiAnalysis && (
        <Card className="glass-card border-[#FFD700]/15">
          <CardHeader className="pb-3">
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setShowAnalysis(!showAnalysis)}
            >
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
                Senior Cricket Analyst Report
              </CardTitle>
              {showAnalysis
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {showAnalysis && (
            <CardContent>
              <div className="prose prose-invert prose-sm max-w-none text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {aiAnalysis}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="glass-card border-red-500/30 w-full max-w-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete Match?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/80">
                This will permanently delete the match and <span className="text-red-400 font-semibold">all associated data</span>, including:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc">
                <li>Match result & details</li>
                <li>Uploaded scorecard PDF</li>
                <li>All innings records</li>
                <li>All batting & bowling performances</li>
                <li>AI analyst report</li>
              </ul>
              <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                ⚠️ This action cannot be undone. Player match history will also be cleared.
              </p>

              {deleteErr && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {deleteErr}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteErr(''); }}
                  disabled={deleting}
                  className="flex-1 border-border text-muted-foreground hover:text-foreground text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-sm border-none"
                >
                  {deleting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
                    : <><Trash2 className="w-4 h-4 mr-2" />Yes, Delete Match</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
