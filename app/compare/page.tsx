'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchJSON } from '@/lib/fetch';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIContent } from '@/components/ui/AIContent';
import {
  Sparkles, Loader2, ArrowLeftRight, Download, Target,
  Trophy, ChevronRight, BarChart3, Swords,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

// ── Section config ──────────────────────────────────────────────────────────
const SECTION_META: Record<string, { icon: string; color: string }> = {
  'Executive Summary':        { icon: '📋', color: 'border-[#FFD700]/30 bg-[#FFD700]/5' },
  'Batting Comparison':       { icon: '🏏', color: 'border-blue-500/30 bg-blue-500/5' },
  'Bowling Comparison':       { icon: '🎳', color: 'border-red-500/30 bg-red-500/5' },
  "Girls' Over Analysis":     { icon: '⚡', color: 'border-pink-500/30 bg-pink-500/5' },
  'Key Player Battles':       { icon: '⚔️', color: 'border-orange-500/30 bg-orange-500/5' },
  'Tactical Strengths':       { icon: '🎯', color: 'border-emerald-500/30 bg-emerald-500/5' },
  'Squad Depth':              { icon: '👥', color: 'border-violet-500/30 bg-violet-500/5' },
  'Predicted Winner':         { icon: '🏆', color: 'border-[#FFD700]/50 bg-[#FFD700]/10' },
};

function parseSections(text: string) {
  const sections: { title: string; content: string }[] = [];
  const lines = text.split('\n');
  let cur: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (cur) sections.push({ title: cur.title, content: cur.lines.join('\n').trim() });
      cur = { title: line.slice(3).trim(), lines: [] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) sections.push({ title: cur.title, content: cur.lines.join('\n').trim() });
  return sections.filter(s => s.content.length > 0);
}

function getSectionMeta(title: string) {
  const key = Object.keys(SECTION_META).find(k => title.includes(k));
  return key ? SECTION_META[key] : { icon: '📌', color: 'border-border bg-card/60' };
}

// ── PDF download ────────────────────────────────────────────────────────────
function downloadPDF(params: {
  team1Name: string; team2Name: string;
  sections: { title: string; content: string }[];
  generatedAt: string;
}) {
  const sectionHtml = params.sections.map(s => `
    <div class="section">
      <h2>${s.title}</h2>
      <div class="content">${s.content
        .replace(/\n/g, '<br/>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^  •\s/gm, '&nbsp;&nbsp;• ')}</div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>ZPL Analysis: ${params.team1Name} vs ${params.team2Name}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, serif; max-width: 820px; margin: 0 auto; padding: 36px; color: #111; line-height: 1.7; }
  .header { border-bottom: 3px solid #1B3A8C; padding-bottom: 18px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; margin: 0 0 6px; color: #1B3A8C; letter-spacing: -0.5px; }
  .header .meta { font-size: 12px; color: #666; }
  .section { margin-bottom: 26px; page-break-inside: avoid; }
  h2 { font-size: 15px; color: #1B3A8C; border-left: 4px solid #FFD700; padding-left: 10px; margin: 0 0 8px; }
  .content { font-size: 13px; color: #333; }
  .footer { margin-top: 36px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #888; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <h1>ZPL Head-to-Head Analysis</h1>
  <p class="meta"><strong>${params.team1Name}</strong> vs <strong>${params.team2Name}</strong> &nbsp;·&nbsp; Generated ${params.generatedAt}</p>
</div>
${sectionHtml}
<div class="footer">ZPL Analytics — Zignuts Premier League 2026 · AI Senior Analyst Report</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ── Radar helpers ───────────────────────────────────────────────────────────
function buildRadar(t: any) {
  if (!t?.players) return [];
  const ps = t.players;
  const totalRuns  = ps.reduce((s: number, p: any) => s + (p.batting?.total_runs || 0), 0);
  const totalWkts  = ps.reduce((s: number, p: any) => s + (p.bowling?.total_wickets || 0), 0);
  const dismissals = ps.reduce((s: number, p: any) => s + (p.fielding?.total_dismissal || 0), 0);
  const ecoBowlers = ps.filter((p: any) => p.bowling?.economy > 0);
  const avgEco     = ecoBowlers.length ? ecoBowlers.reduce((s: number, p: any) => s + p.bowling.economy, 0) / ecoBowlers.length : 8;
  const avgMvp     = ps.reduce((s: number, p: any) => s + (p.mvp?.total_score || 0), 0) / (ps.length || 1);
  const girlScore  = ps.filter((p: any) => p.gender === 'Female' && (p.bowling?.total_wickets || 0) > 0).length * 25;
  return [
    { subject: 'Batting',    value: Math.min(100, totalRuns / 30) },
    { subject: 'Bowling',    value: Math.min(100, totalWkts * 5) },
    { subject: 'Economy',    value: Math.max(0, 100 - (avgEco - 5) * 14) },
    { subject: 'Fielding',   value: Math.min(100, dismissals * 6) },
    { subject: "Girls' Over",value: Math.min(100, girlScore) },
    { subject: 'MVP Score',  value: Math.min(100, avgMvp * 3) },
  ];
}

// ── Stat comparison bar ──────────────────────────────────────────────────────
function StatBar({ label, v1, v2, c1, c2, fmt }: {
  label: string; v1: number; v2: number;
  c1: string; c2: string;
  fmt?: (n: number) => string;
}) {
  const total = (v1 + v2) || 1;
  const p1 = Math.round((v1 / total) * 100);
  const f = fmt ?? ((n: number) => n.toLocaleString());
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-medium">
        <span className="font-bold" style={{ color: c1 }}>{f(v1)}</span>
        <span className="text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="font-bold" style={{ color: c2 }}>{f(v2)}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
        <div className="h-full transition-all duration-700" style={{ width: `${p1}%`, backgroundColor: c1 }} />
        <div className="h-full transition-all duration-700" style={{ width: `${100 - p1}%`, backgroundColor: c2 }} />
      </div>
    </div>
  );
}

// ── Team hero card ──────────────────────────────────────────────────────────
function TeamCard({ t, side }: { t: any; side: 'left' | 'right' }) {
  const color  = t.color_primary || '#FFD700';
  const girls  = (t.players || []).filter((p: any) => p.gender === 'Female').length;
  const totalR = (t.players || []).reduce((s: number, p: any) => s + (p.batting?.total_runs || 0), 0);
  const totalW = (t.players || []).reduce((s: number, p: any) => s + (p.bowling?.total_wickets || 0), 0);
  const girlB  = (t.players || []).filter((p: any) => p.gender === 'Female' && (p.bowling?.total_wickets || 0) > 0).length;
  return (
    <div className={cn('rounded-2xl border p-4 relative overflow-hidden h-full')}
      style={{ borderColor: `${color}50`, background: `linear-gradient(135deg, ${color}0a 0%, transparent 70%)` }}
    >
      <div className={cn('absolute w-28 h-28 rounded-full opacity-[0.06] -top-6', side === 'left' ? '-left-6' : '-right-6')}
        style={{ backgroundColor: color }} />
      <div className={cn('flex items-center gap-2.5 mb-3', side === 'right' && 'flex-row-reverse')}>
        <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-black border-2 shrink-0"
          style={{ borderColor: color, backgroundColor: `${color}18` }}>
          {t.logo_url
            ? <img src={t.logo_url} alt={t.name} className="w-full h-full object-contain p-0.5" />
            : <span className="text-xs" style={{ color }}>{(t.short_name || t.name).slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className={side === 'right' ? 'text-right' : ''}>
          <p className="font-black text-sm leading-tight" style={{ color }}>{t.name}</p>
          <p className="text-[10px] text-muted-foreground">{t.players?.length ?? 0} players · {girls} girls</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {[
          { l: 'Runs',      v: totalR >= 1000 ? `${(totalR/1000).toFixed(1)}k` : totalR },
          { l: 'Wickets',   v: totalW },
          { l: 'Girls',     v: girls },
          { l: '♀ Bowlers', v: girlB },
        ].map(s => (
          <div key={s.l} className="rounded-lg py-1.5 text-center" style={{ backgroundColor: `${color}15` }}>
            <p className="font-black text-sm" style={{ color }}>{s.v}</p>
            <p className="text-[8px] text-muted-foreground uppercase tracking-wide leading-tight mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const { currentSeasonId } = useSeason();
  const [teams,        setTeams]        = useState<any[]>([]);
  const [team1Id,      setTeam1Id]      = useState('');
  const [team2Id,      setTeam2Id]      = useState('');
  const [team1,        setTeam1]        = useState<any>(null);
  const [team2,        setTeam2]        = useState<any>(null);
  const [comparison,   setComparison]   = useState('');
  const [loading,      setLoading]      = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [generatedAt,  setGeneratedAt]  = useState('');

  useEffect(() => {
    if (!currentSeasonId) return;
    fetchJSON<any[]>(`/api/teams?season_id=${currentSeasonId}`)
      .then(d => { setTeams(Array.isArray(d) ? d : []); setTeamsLoading(false); })
      .catch(() => setTeamsLoading(false));
  }, [currentSeasonId]);

  const loadTeam = useCallback(async (teamId: string, setter: (v: any) => void) => {
    if (!teamId) { setter(null); return; }
    try {
      const data = await fetchJSON<any>(`/api/teams/${teamId}?season_id=${currentSeasonId}`);
      setter(data);
    } catch { setter(null); }
  }, [currentSeasonId]);

  useEffect(() => { loadTeam(team1Id, setTeam1); }, [team1Id, loadTeam]);
  useEffect(() => { loadTeam(team2Id, setTeam2); }, [team2Id, loadTeam]);

  const handleCompare = async () => {
    if (!team1Id || !team2Id) return;
    setLoading(true);
    setComparison('');
    try {
      const res = await fetch('/api/ai/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team1_id: team1Id, team2_id: team2Id, season_id: currentSeasonId }),
      });
      const data = await res.json();
      setComparison(data.comparison || data.error || '');
      setGeneratedAt(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    } finally { setLoading(false); }
  };

  const sections = comparison ? parseSections(comparison) : [];
  const radar1   = buildRadar(team1);
  const radar2   = buildRadar(team2);
  const t1Color  = team1?.color_primary || '#FFD700';
  const t2Color  = team2?.color_primary || '#4F8EF7';

  const combinedRadar = radar1.map((d, i) => ({
    subject: d.subject,
    [team1?.name || 'Team 1']: d.value,
    [team2?.name || 'Team 2']: radar2[i]?.value ?? 0,
  }));

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black font-display text-[#FFD700] flex items-center gap-2">
            <Swords className="w-6 h-6" /> Head-to-Head Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Senior analyst report · AI-powered · ZPL 2026 data</p>
        </div>
        {comparison && (
          <Button variant="outline" size="sm"
            className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 gap-1.5 shrink-0"
            onClick={() => downloadPDF({ team1Name: team1?.name || 'Team 1', team2Name: team2?.name || 'Team 2', sections, generatedAt })}>
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
        )}
      </div>

      {/* ── Team Selectors ── */}
      <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-3">
        <select value={team1Id} onChange={e => setTeam1Id(e.target.value)} disabled={teamsLoading}
          className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40 font-medium">
          <option value="">{teamsLoading ? 'Loading…' : 'Select Team 1…'}</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">vs</span>
        </div>
        <select value={team2Id} onChange={e => setTeam2Id(e.target.value)} disabled={teamsLoading}
          className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40 font-medium">
          <option value="">{teamsLoading ? 'Loading…' : 'Select Team 2…'}</option>
          {teams.filter(t => t.id !== team1Id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* ── Team hero cards ── */}
      {(team1 || team2) && (
        <div className="grid grid-cols-2 gap-3">
          {team1
            ? <TeamCard t={team1} side="left" />
            : <div className="rounded-2xl border border-dashed border-border flex items-center justify-center p-8 text-muted-foreground/30 text-xs">Select Team 1</div>}
          {team2
            ? <TeamCard t={team2} side="right" />
            : <div className="rounded-2xl border border-dashed border-border flex items-center justify-center p-8 text-muted-foreground/30 text-xs">Select Team 2</div>}
        </div>
      )}

      {/* ── Stat bars + radar side by side ── */}
      {team1 && team2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Stat bars */}
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Statistical Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t1Color }} /><span style={{ color: t1Color }}>{team1.name}</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t2Color }} /><span style={{ color: t2Color }}>{team2.name}</span></span>
              </div>
              <StatBar label="Total Runs"
                v1={(team1.players || []).reduce((s: number, p: any) => s + (p.batting?.total_runs || 0), 0)}
                v2={(team2.players || []).reduce((s: number, p: any) => s + (p.batting?.total_runs || 0), 0)}
                c1={t1Color} c2={t2Color} />
              <StatBar label="Total Wickets"
                v1={(team1.players || []).reduce((s: number, p: any) => s + (p.bowling?.total_wickets || 0), 0)}
                v2={(team2.players || []).reduce((s: number, p: any) => s + (p.bowling?.total_wickets || 0), 0)}
                c1={t1Color} c2={t2Color} />
              <StatBar label="Girl Bowlers"
                v1={(team1.players || []).filter((p: any) => p.gender === 'Female' && (p.bowling?.total_wickets || 0) > 0).length}
                v2={(team2.players || []).filter((p: any) => p.gender === 'Female' && (p.bowling?.total_wickets || 0) > 0).length}
                c1={t1Color} c2={t2Color} />
              <StatBar label="Squad Size"
                v1={team1.players?.length || 0}
                v2={team2.players?.length || 0}
                c1={t1Color} c2={t2Color} />
            </CardContent>
          </Card>

          {/* Radar */}
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Performance Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={combinedRadar} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.07)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }} />
                  <Radar name={team1.name} dataKey={team1.name}
                    stroke={t1Color} fill={t1Color} fillOpacity={0.18} strokeWidth={2} />
                  <Radar name={team2.name} dataKey={team2.name}
                    stroke={t2Color} fill={t2Color} fillOpacity={0.18} strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-xl space-y-1">
                      <p className="text-muted-foreground font-semibold">{payload[0]?.payload?.subject}</p>
                      {payload.map((p: any, i: number) => (
                        <p key={i} className="font-medium" style={{ color: p.color }}>{p.name}: {Number(p.value).toFixed(1)}</p>
                      ))}
                    </div>
                  ) : null} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Generate CTA ── */}
      {team1 && team2 && (
        <Button onClick={handleCompare} disabled={loading}
          className="w-full h-13 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:opacity-90 text-[#1B3A8C] font-black text-[15px] rounded-xl shadow-lg shadow-[#FFD700]/20 gap-3 py-3">
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating senior analyst report…</>
            : <><Sparkles className="w-5 h-5" />{comparison ? 'Regenerate Analysis' : 'Generate AI Analysis'}<ChevronRight className="w-4 h-4 ml-auto" /></>}
        </Button>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 p-4">
              <div className="h-4 bg-muted/50 rounded w-1/3 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-muted/30 rounded w-full" />
                <div className="h-3 bg-muted/30 rounded w-4/5" />
                <div className="h-3 bg-muted/30 rounded w-3/5" />
              </div>
            </div>
          ))}
          <p className="text-center text-xs text-muted-foreground/50 animate-pulse">
            Analyzing squads, stats, and tactical matchups…
          </p>
        </div>
      )}

      {/* ── Analysis sections ── */}
      {!loading && sections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 rounded-full bg-[#FFD700]" />
              <h2 className="font-black text-lg">Analyst Report</h2>
              <Badge variant="outline" className="border-[#FFD700]/30 text-[#FFD700]/80 text-[10px] hidden sm:inline-flex">
                {team1?.name} vs {team2?.name}
              </Badge>
            </div>
            <Button variant="ghost" size="sm"
              className="text-[#FFD700]/70 hover:text-[#FFD700] hover:bg-[#FFD700]/10 gap-1.5 text-xs"
              onClick={() => downloadPDF({ team1Name: team1?.name || 'Team 1', team2Name: team2?.name || 'Team 2', sections, generatedAt })}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </div>

          {sections.map((section, i) => {
            const meta = getSectionMeta(section.title);
            return (
              <div key={i} className={cn('rounded-2xl border p-5 space-y-3 transition-all', meta.color)}>
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{meta.icon}</span>
                  <h3 className="font-black text-sm text-foreground">{section.title}</h3>
                </div>
                <AIContent text={section.content} />
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground/40 text-center pt-1">
            Generated {generatedAt} · Based on live ZPL player stats
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!team1 && !team2 && !teamsLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FFD700]/10 flex items-center justify-center mb-4">
            <Swords className="w-8 h-8 text-[#FFD700]/30" />
          </div>
          <p className="text-muted-foreground font-semibold">Select two teams to begin</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Get a senior analyst report with tactical insights, stat comparisons, and win prediction</p>
        </div>
      )}
    </div>
  );
}
