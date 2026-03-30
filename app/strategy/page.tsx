'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIContent } from '@/components/ui/AIContent';
import {
  Sparkles, Loader2, Brain, Download, ChevronRight, Shield,
  Users, Zap, Swords, Target, TrendingUp, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Section config ──────────────────────────────────────────────────────────
const SECTION_META: Record<string, { icon: string; color: string; accent: string }> = {
  'Recommended Playing XI':       { icon: '👥', color: 'border-[#FFD700]/30 bg-[#FFD700]/5',  accent: '#FFD700' },
  'Batting Order':                { icon: '🏏', color: 'border-blue-500/30 bg-blue-500/5',    accent: '#3b82f6' },
  'Bowling Plan':                 { icon: '🎳', color: 'border-red-500/30 bg-red-500/5',      accent: '#ef4444' },
  "Girls' First Over Strategy":  { icon: '⚡', color: 'border-pink-500/30 bg-pink-500/5',    accent: '#ec4899' },
  "Girls' Over":                  { icon: '⚡', color: 'border-pink-500/30 bg-pink-500/5',    accent: '#ec4899' },
  'Powerplay Strategy':           { icon: '🚀', color: 'border-orange-500/30 bg-orange-500/5',accent: '#f97316' },
  'Death Overs':                  { icon: '💀', color: 'border-zinc-500/30 bg-zinc-500/5',    accent: '#71717a' },
  'Impact Player':                { icon: '🔄', color: 'border-violet-500/30 bg-violet-500/5',accent: '#8b5cf6' },
  'Opposition Threat':            { icon: '🎯', color: 'border-emerald-500/30 bg-emerald-500/5',accent: '#10b981' },
  'Win Probability':              { icon: '📊', color: 'border-cyan-500/30 bg-cyan-500/5',    accent: '#06b6d4' },
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
  return key ? SECTION_META[key] : { icon: '📌', color: 'border-border bg-card/60', accent: '#6b7280' };
}

// ── PDF Download ─────────────────────────────────────────────────────────────
function downloadPDF(params: {
  yourTeamName: string; opponentName: string;
  sections: { title: string; content: string }[];
  generatedAt: string;
}) {
  const sectionHtml = params.sections.map(s => `
    <div class="section">
      <h2>${s.title}</h2>
      <div class="content">${s.content
        .replace(/\n/g, '<br/>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>ZPL Strategy: ${params.yourTeamName} vs ${params.opponentName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, serif; max-width: 820px; margin: 0 auto; padding: 36px; color: #111; line-height: 1.7; }
  .header { border-bottom: 3px solid #1B3A8C; padding-bottom: 18px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; margin: 0 0 4px; color: #1B3A8C; }
  .header .sub { font-size: 14px; color: #444; font-weight: bold; margin: 0 0 4px; }
  .header .meta { font-size: 12px; color: #888; }
  .section { margin-bottom: 26px; page-break-inside: avoid; }
  h2 { font-size: 15px; color: #1B3A8C; border-left: 4px solid #FFD700; padding-left: 10px; margin: 0 0 8px; }
  .content { font-size: 13px; color: #333; }
  .footer { margin-top: 36px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #888; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <h1>ZPL Match Strategy Dossier</h1>
  <p class="sub">${params.yourTeamName} vs ${params.opponentName}</p>
  <p class="meta">Generated ${params.generatedAt} · ZPL Analytics</p>
</div>
${sectionHtml}
<div class="footer">ZPL Analytics — Zignuts Premier League 2026 · AI Senior Analyst Dossier</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ── ZPL Rules pills ──────────────────────────────────────────────────────────
const ZPL_RULES = [
  { emoji: '⚡', label: "Girls' 1st Over", desc: 'Runs ×2 · 4 fielders', color: 'border-pink-500/30 bg-pink-500/5 text-pink-300' },
  { emoji: '🏏', label: 'T12 Format',      desc: '12 overs · max 3/bowler', color: 'border-blue-500/30 bg-blue-500/5 text-blue-300' },
  { emoji: '🔄', label: 'Impact Player',   desc: '1 sub per innings', color: 'border-violet-500/30 bg-violet-500/5 text-violet-300' },
  { emoji: '📺', label: 'DRS',             desc: '1 review per innings', color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' },
  { emoji: '👩', label: '2 Girls Min',     desc: 'In playing XI', color: 'border-orange-500/30 bg-orange-500/5 text-orange-300' },
];

// ── Team selector card ───────────────────────────────────────────────────────
function TeamPill({ team, label, color }: { team: any; label: string; color: string }) {
  if (!team) return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border bg-card/40 min-h-[48px]">
      <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center">
        <Users className="w-3.5 h-3.5 text-muted-foreground/40" />
      </div>
      <span className="text-xs text-muted-foreground/50">{label}</span>
    </div>
  );
  const tc = team.color_primary || '#FFD700';
  const girls  = (team.players || []).filter((p: any) => p.gender === 'Female').length;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
      style={{ borderColor: `${tc}40`, background: `${tc}0a` }}>
      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-black border-2 shrink-0 text-xs"
        style={{ borderColor: tc, backgroundColor: `${tc}20`, color: tc }}>
        {team.logo_url
          ? <img src={team.logo_url} alt={team.name} className="w-full h-full object-contain p-0.5" />
          : (team.short_name || team.name).slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: tc }}>{team.name}</p>
        <p className="text-[10px] text-muted-foreground">{team.players?.length ?? 0} players · {girls} girls</p>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const { currentSeasonId } = useSeason();
  const [teams,       setTeams]       = useState<any[]>([]);
  const [yourTeamId,  setYourTeamId]  = useState('');
  const [opponentId,  setOpponentId]  = useState('');
  const [yourTeam,    setYourTeam]    = useState<any>(null);
  const [opponent,    setOpponent]    = useState<any>(null);
  const [strategy,    setStrategy]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    if (!currentSeasonId) return;
    fetch(`/api/teams?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => setTeams(Array.isArray(d) ? d : []))
      .catch(console.error);
  }, [currentSeasonId]);

  // Load full squad when team selected
  useEffect(() => {
    if (!yourTeamId || !currentSeasonId) { setYourTeam(null); return; }
    fetch(`/api/teams/${yourTeamId}?season_id=${currentSeasonId}`)
      .then(r => r.json()).then(setYourTeam).catch(() => setYourTeam(null));
  }, [yourTeamId, currentSeasonId]);

  useEffect(() => {
    if (!opponentId || !currentSeasonId) { setOpponent(null); return; }
    fetch(`/api/teams/${opponentId}?season_id=${currentSeasonId}`)
      .then(r => r.json()).then(setOpponent).catch(() => setOpponent(null));
  }, [opponentId, currentSeasonId]);

  const handleStrategy = async () => {
    if (!yourTeamId || !opponentId) return;
    setLoading(true);
    setStrategy('');
    try {
      const res = await fetch('/api/ai/match-strategy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: yourTeamId, opponent_id: opponentId, season_id: currentSeasonId }),
      });
      const data = await res.json();
      setStrategy(data.strategy || data.error || '');
      setGeneratedAt(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    } finally { setLoading(false); }
  };

  const sections = strategy ? parseSections(strategy) : [];
  const yourColor = yourTeam?.color_primary || '#FFD700';
  const oppColor  = opponent?.color_primary || '#ef4444';

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black font-display text-[#FFD700] flex items-center gap-2">
            <Brain className="w-6 h-6" /> Match Strategy Advisor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pre-match dossier · Playing XI · Bowling plan · Tactical analysis</p>
        </div>
        {strategy && (
          <Button variant="outline" size="sm"
            className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 gap-1.5 shrink-0"
            onClick={() => downloadPDF({ yourTeamName: yourTeam?.name || 'Your Team', opponentName: opponent?.name || 'Opponent', sections, generatedAt })}>
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
        )}
      </div>

      {/* ── Setup card ── */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700]/20" />
        <CardContent className="p-5 space-y-5">
          {/* Team selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Your Team
              </label>
              <select value={yourTeamId} onChange={e => setYourTeamId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40 font-medium">
                <option value="">Select your team…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <TeamPill team={yourTeam} label="Select your team above" color={yourColor} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Swords className="w-3 h-3" /> Opposition
              </label>
              <select value={opponentId} onChange={e => setOpponentId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40 font-medium">
                <option value="">Select opponent…</option>
                {teams.filter(t => t.id !== yourTeamId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <TeamPill team={opponent} label="Select opponent above" color={oppColor} />
            </div>
          </div>

          {/* Generate button */}
          <Button onClick={handleStrategy} disabled={!yourTeamId || !opponentId || loading}
            className="w-full h-12 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:opacity-90 text-[#1B3A8C] font-black text-[15px] rounded-xl shadow-lg shadow-[#FFD700]/20 gap-2.5">
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating match strategy dossier…</>
              : <><Sparkles className="w-5 h-5" />{strategy ? 'Regenerate Strategy' : 'Generate Match Strategy'}<ChevronRight className="w-4 h-4 ml-auto" /></>}
          </Button>
        </CardContent>
      </Card>

      {/* ── ZPL Rules pills ── */}
      <div className="flex flex-wrap gap-2">
        {ZPL_RULES.map(r => (
          <div key={r.label} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs', r.color)}>
            <span className="text-sm">{r.emoji}</span>
            <div>
              <span className="font-bold">{r.label}</span>
              <span className="text-inherit/60 ml-1 opacity-70">{r.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/5 p-5 text-center space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-[#FFD700]/10 flex items-center justify-center">
                <Brain className="w-6 h-6 text-[#FFD700] animate-pulse" />
              </div>
            </div>
            <p className="text-sm font-semibold text-[#FFD700]">Generating match strategy dossier…</p>
            <p className="text-xs text-muted-foreground">Analyzing squads, historical stats, ZPL rules, and tactical matchups</p>
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 p-4 animate-pulse">
              <div className="h-3.5 bg-muted/50 rounded w-1/3 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-muted/30 rounded w-full" />
                <div className="h-3 bg-muted/30 rounded w-4/5" />
                <div className="h-3 bg-muted/30 rounded w-3/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Strategy sections ── */}
      {!loading && sections.length > 0 && (
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 rounded-full bg-[#FFD700]" />
              <h2 className="font-black text-lg">Strategy Dossier</h2>
              {yourTeam && opponent && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold" style={{ color: yourColor }}>{yourTeam.name}</span>
                  <span>vs</span>
                  <span className="font-semibold" style={{ color: oppColor }}>{opponent.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                onClick={handleStrategy} disabled={loading}>
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
              <Button variant="ghost" size="sm"
                className="text-[#FFD700]/70 hover:text-[#FFD700] hover:bg-[#FFD700]/10 gap-1.5 text-xs"
                onClick={() => downloadPDF({ yourTeamName: yourTeam?.name || 'Your Team', opponentName: opponent?.name || 'Opponent', sections, generatedAt })}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            </div>
          </div>

          {/* Section cards */}
          <div className="grid grid-cols-1 gap-4">
            {sections.map((section, i) => {
              const meta = getSectionMeta(section.title);
              return (
                <div key={i} className={cn('rounded-2xl border p-5 space-y-3', meta.color)}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none">{meta.icon}</span>
                    <h3 className="font-black text-sm text-foreground">{section.title}</h3>
                    <div className="ml-auto h-px flex-1 rounded-full opacity-30" style={{ backgroundColor: meta.accent }} />
                  </div>
                  <AIContent text={section.content} />
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground/40 text-center pt-1">
            Generated {generatedAt} · Based on live ZPL player stats and squad data
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!strategy && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-4">
            <Brain className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground font-semibold text-sm">Ready to build your strategy</p>
          <p className="text-xs text-muted-foreground/50 mt-1 max-w-xs">
            Select your team and opponent above to get a complete pre-match tactical dossier including Playing XI, bowling rotation, and win probability.
          </p>
        </div>
      )}
    </div>
  );
}
