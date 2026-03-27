'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, getRoleIcon, getRoleBadgeColor } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, Target, Shield,
  Zap, Users, Trophy, Activity, ChevronDown, ChevronUp, Star,
  BarChart2, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

interface Player {
  id: string; first_name: string; last_name: string; photo_url: string | null;
  player_role: string; gender: string; purchase_price: number; group_number: number;
  is_captain: number; team_role?: string;
  batting?: {
    total_runs: number; total_matches: number; average: number; strike_rate: number;
    highest_score: number; fifties: number; hundreds: number; fours: number; sixes: number;
  };
  bowling?: {
    total_wickets: number; total_matches: number; economy: number; average: number;
    best_figures: string; five_wickets: number; maidens: number;
  };
  mvp?: { mvp_score: number };
}

interface TeamDetail {
  id: string; name: string; color_primary: string; short_name: string; logo_url: string | null;
  budget_used: number; budget_remaining: number;
  players: Player[];
}

const PIE_COLORS = ['#FFD700', '#4169E1', '#DC143C', '#6A0DAD', '#228B22', '#FF6B35', '#06B6D4'];

function KPICard({ label, value, sub, icon: Icon, color = '#FFD700', trend }: {
  label: string; value: string | number; sub?: string;
  icon?: any; color?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="relative rounded-xl p-4 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 blur-xl"
        style={{ background: color, transform: 'translate(30%,-30%)' }} />
      <div className="flex items-start justify-between mb-2">
        {Icon && <Icon className="w-4 h-4 opacity-60" style={{ color }} />}
        {trend && (
          trend === 'up'   ? <TrendingUp   className="w-3.5 h-3.5 text-green-400" /> :
          trend === 'down' ? <TrendingDown className="w-3.5 h-3.5 text-red-400"   /> : null
        )}
      </div>
      <p className="text-xl font-black font-display" style={{ color }}>{value}</p>
      <p className="text-xs text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TeamDetailPage() {
  const { id }              = useParams() as { id: string };
  const { currentSeasonId } = useSeason();
  const [team, setTeam]     = useState<TeamDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [ratingsMap, setRatingsMap] = useState<Record<string, any>>({});
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiReport, setAiReport]     = useState('');
  const [showAI, setShowAI]         = useState(false);
  const [showSquad, setShowSquad]   = useState(true);

  useEffect(() => {
    if (!currentSeasonId) return;
    setLoading(true);
    fetch(`/api/teams/${id}?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => {
        setTeam(d);
        setLoading(false);
        if (d.players?.length) {
          const ids = d.players.map((p: any) => p.id).join(',');
          fetch(`/api/player-owner-data?ids=${ids}`)
            .then(r => r.json())
            .then(rm => { if (!rm.error) setRatingsMap(rm); })
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));
  }, [id, currentSeasonId]);

  // ── Computed analytics ─────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!team?.players?.length) return null;
    const P = team.players;

    // Batting
    const batters = P.filter(p => p.batting && p.batting.total_matches > 0);
    const totalRuns    = batters.reduce((s, p) => s + (p.batting?.total_runs || 0), 0);
    const avgTeamBA    = batters.length ? batters.reduce((s, p) => s + (p.batting?.average || 0), 0) / batters.length : 0;
    const avgTeamSR    = batters.length ? batters.reduce((s, p) => s + (p.batting?.strike_rate || 0), 0) / batters.length : 0;
    const topScorer    = batters.sort((a, b) => (b.batting?.total_runs || 0) - (a.batting?.total_runs || 0))[0];
    const bestAvg      = [...batters].sort((a, b) => (b.batting?.average || 0) - (a.batting?.average || 0))[0];
    const bestSR       = [...batters].sort((a, b) => (b.batting?.strike_rate || 0) - (a.batting?.strike_rate || 0))[0];
    const totalBoundaries = batters.reduce((s, p) => s + (p.batting?.fours || 0) + (p.batting?.sixes || 0), 0);
    const totalSixes   = batters.reduce((s, p) => s + (p.batting?.sixes || 0), 0);

    // Bowling
    const bowlers  = P.filter(p => p.bowling && p.bowling.total_matches > 0);
    const totalWkts    = bowlers.reduce((s, p) => s + (p.bowling?.total_wickets || 0), 0);
    const avgEco       = bowlers.length ? bowlers.reduce((s, p) => s + (p.bowling?.economy || 0), 0) / bowlers.length : 0;
    const topWicketTaker = bowlers.sort((a, b) => (b.bowling?.total_wickets || 0) - (a.bowling?.total_wickets || 0))[0];
    const bestEco    = [...bowlers].sort((a, b) => (a.bowling?.economy || 99) - (b.bowling?.economy || 99))[0];

    // Girls analysis (ZPL rule: girls first over = runs doubled)
    const girls = P.filter(p => p.gender === 'Female');
    const girlBowlers = girls.filter(p => p.bowling && p.bowling.total_wickets > 0);

    // Squad depth
    const roles: Record<string, number> = {};
    P.forEach(p => { const r = p.player_role || 'Unknown'; roles[r] = (roles[r] || 0) + 1; });
    const pieData = Object.entries(roles).map(([name, value]) => ({ name, value }));

    // Value for money (runs or wickets per lakh spent)
    const valueData = P
      .filter(p => (p.purchase_price || 0) > 0)
      .map(p => ({
        name: `${p.first_name} ${p.last_name}`.split(' ').map(w => w[0]).join(''),
        fullName: `${p.first_name} ${p.last_name}`,
        price: p.purchase_price / 100000,
        runs: p.batting?.total_runs || 0,
        wickets: p.bowling?.total_wickets || 0,
        score: ((p.batting?.total_runs || 0) * 0.6 + (p.bowling?.total_wickets || 0) * 25) /
               Math.max(1, (p.purchase_price / 100000)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Radar chart data (out of 100)
    const radarData = [
      { subject: 'Batting', A: Math.min(100, avgTeamSR / 1.5) },
      { subject: 'Bowling', A: Math.min(100, Math.max(0, (12 - avgEco) * 10)) },
      { subject: 'Firepower', A: Math.min(100, (totalSixes / Math.max(1, batters.length)) * 10) },
      { subject: 'Depth',   A: Math.min(100, (batters.length / Math.max(1, P.length)) * 100) },
      { subject: 'Girls Adv', A: Math.min(100, girlBowlers.length * 25) },
      { subject: 'Value',   A: Math.min(100, (valueData[0]?.score || 0) * 5) },
    ];

    // Batting depth — players with avg > 15
    const depthPlayers = batters.filter(p => (p.batting?.average || 0) > 15);

    // Top performers by MVP score
    const mvpRanked = [...P].filter(p => p.mvp?.mvp_score).sort((a, b) => (b.mvp?.mvp_score || 0) - (a.mvp?.mvp_score || 0)).slice(0, 5);

    const totalBudget = (team.budget_used || 0) + (team.budget_remaining || 0);

    return {
      totalRuns, avgTeamBA, avgTeamSR, topScorer, bestAvg, bestSR,
      totalBoundaries, totalSixes,
      totalWkts, avgEco, topWicketTaker, bestEco,
      girls, girlBowlers,
      roles, pieData, radarData, valueData,
      depthPlayers, mvpRanked, totalBudget,
      battersCount: batters.length, bowlersCount: bowlers.length,
    };
  }, [team]);

  const handleAIAnalysis = async () => {
    if (!team || !currentSeasonId) return;
    setAiLoading(true);
    setAiReport('');
    setShowAI(true);
    try {
      const res = await fetch('/api/ai/match-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: id, opponent_id: id, season_id: currentSeasonId, mode: 'team_analysis' }),
      });
      const data = await res.json();
      setAiReport(data.strategy || data.error || 'No analysis available.');
    } catch {
      setAiReport('AI analysis failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
    </div>
  );
  if (!team || (team as any).error) return <div className="p-6 text-muted-foreground">Team not found</div>;

  const A           = analytics;
  const accent      = team.color_primary || '#FFD700';
  const sorted      = [...team.players].sort((a, b) => (b.purchase_price || 0) - (a.purchase_price || 0));
  const totalBudget = (team.budget_used || 0) + (team.budget_remaining || 0);
  const spentPct    = totalBudget > 0 ? ((team.budget_used || 0) / totalBudget) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/teams" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-lg border-2 overflow-hidden shrink-0"
          style={{ backgroundColor: accent, borderColor: accent + '60' }}>
          {team.logo_url
            ? <img src={team.logo_url} alt={team.name} className="w-full h-full object-contain p-1" />
            : <span className="text-white">{(team.short_name || team.name).slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black font-display truncate" style={{ color: accent }}>{team.name}</h1>
          <p className="text-muted-foreground text-sm">{team.players.length} players · ZPL T12</p>
        </div>
        <Button
          onClick={handleAIAnalysis}
          disabled={aiLoading}
          className="gap-2 font-bold text-black"
          style={{ background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none' }}
        >
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI Deep Analysis
        </Button>
      </div>

      {/* ── Budget Bar ── */}
      <div className="rounded-xl p-4 space-y-3"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Budget</span>
          <span style={{ color: accent }} className="font-bold">
            {formatCurrency(team.budget_used || 0)} / {formatCurrency(totalBudget)}
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(spentPct, 100)}%`, backgroundColor: accent }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div><p className="font-bold" style={{ color: accent }}>{formatCurrency(team.budget_used || 0)}</p><p className="text-muted-foreground">Spent</p></div>
          <div><p className="font-bold text-green-400">{formatCurrency(team.budget_remaining || 0)}</p><p className="text-muted-foreground">Remaining</p></div>
          <div><p className={cn('font-bold', spentPct > 85 ? 'text-red-400' : 'text-blue-400')}>{spentPct.toFixed(1)}%</p><p className="text-muted-foreground">Utilised</p></div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      {A && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5" /> Performance KPIs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <KPICard label="Team Runs" value={A.totalRuns} icon={TrendingUp} color={accent} />
            <KPICard label="Team Wickets" value={A.totalWkts} icon={Target} color="#DC143C" />
            <KPICard label="Avg Batting SR" value={A.avgTeamSR > 0 ? A.avgTeamSR.toFixed(1) : '—'} icon={Zap} color="#06B6D4" sub="Strike rate" />
            <KPICard label="Avg Economy" value={A.avgEco > 0 ? A.avgEco.toFixed(2) : '—'} icon={Shield} color="#22C55E" sub="Runs/over" />
            <KPICard label="Batting Avg" value={A.avgTeamBA > 0 ? A.avgTeamBA.toFixed(1) : '—'} icon={Activity} color="#F97316" />
            <KPICard label="Boundaries" value={A.totalBoundaries} icon={Star} color="#FFD700" sub={`${A.totalSixes} sixes`} />
            <KPICard label="Girls in Squad" value={A.girls.length} icon={Users} color="#EC4899" sub={`${A.girlBowlers.length} bowl`} />
            <KPICard label="Batting Depth" value={A.depthPlayers.length} icon={Trophy} color="#8B5CF6" sub="Avg > 15" />
          </div>
        </div>
      )}

      {/* ── Charts Row ── */}
      {A && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Squad Composition Pie */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Squad Composition</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={A.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {A.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => active && payload?.length
                    ? <div className="bg-card border border-border rounded px-2 py-1 text-xs">{payload[0].name}: {payload[0].value}</div>
                    : null} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Team Radar */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Team Strengths Radar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={A.radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                  <Radar name="Team" dataKey="A" stroke={accent} fill={accent} fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Value for Money */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Value-for-Money Score</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={A.valueData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} width={22} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length
                      ? <div className="bg-card border border-border rounded px-2 py-1 text-xs">
                          <p className="font-bold">{(payload[0].payload as any).fullName}</p>
                          <p>Score: {(payload[0].value as number).toFixed(1)}</p>
                          <p>Price: ₹{(payload[0].payload as any).price.toFixed(1)}L</p>
                        </div>
                      : null}
                  />
                  <Bar dataKey="score" fill={accent} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Key Player Spotlights ── */}
      {A && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Star className="w-3.5 h-3.5" /> Key Players
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Top Scorer */}
            {A.topScorer && (
              <Link href={`/players/${A.topScorer.id}`}>
                <div className="rounded-xl p-4 border border-[#FFD700]/20 bg-[#FFD700]/5 hover:border-[#FFD700]/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-[#FFD700]" />
                    <span className="text-[10px] text-[#FFD700] font-bold uppercase tracking-wider">Top Scorer</span>
                  </div>
                  <p className="font-black text-sm">{A.topScorer.first_name} {A.topScorer.last_name}</p>
                  <p className="text-2xl font-black text-[#FFD700]">{A.topScorer.batting?.total_runs || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg {A.topScorer.batting?.average?.toFixed(1) || '—'} · SR {A.topScorer.batting?.strike_rate?.toFixed(1) || '—'}
                  </p>
                </div>
              </Link>
            )}

            {/* Top Wicket Taker */}
            {A.topWicketTaker && (
              <Link href={`/players/${A.topWicketTaker.id}`}>
                <div className="rounded-xl p-4 border border-red-500/20 bg-red-500/5 hover:border-red-500/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Top Wicket Taker</span>
                  </div>
                  <p className="font-black text-sm">{A.topWicketTaker.first_name} {A.topWicketTaker.last_name}</p>
                  <p className="text-2xl font-black text-red-400">{A.topWicketTaker.bowling?.total_wickets || 0} wkts</p>
                  <p className="text-xs text-muted-foreground">
                    Eco {A.topWicketTaker.bowling?.economy?.toFixed(2) || '—'} · {A.topWicketTaker.bowling?.best_figures || '—'}
                  </p>
                </div>
              </Link>
            )}

            {/* Best Economy */}
            {A.bestEco && (
              <Link href={`/players/${A.bestEco.id}`}>
                <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5 hover:border-green-500/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Best Economy</span>
                  </div>
                  <p className="font-black text-sm">{A.bestEco.first_name} {A.bestEco.last_name}</p>
                  <p className="text-2xl font-black text-green-400">{A.bestEco.bowling?.economy?.toFixed(2) || '—'}</p>
                  <p className="text-xs text-muted-foreground">{A.bestEco.bowling?.total_wickets || 0} wkts · {A.bestEco.bowling?.maidens || 0} maidens</p>
                </div>
              </Link>
            )}

            {/* Best Strike Rate */}
            {A.bestSR && (
              <Link href={`/players/${A.bestSR.id}`}>
                <div className="rounded-xl p-4 border border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Best Strike Rate</span>
                  </div>
                  <p className="font-black text-sm">{A.bestSR.first_name} {A.bestSR.last_name}</p>
                  <p className="text-2xl font-black text-cyan-400">{A.bestSR.batting?.strike_rate?.toFixed(1) || '—'}</p>
                  <p className="text-xs text-muted-foreground">{A.bestSR.batting?.total_runs || 0} runs · {A.bestSR.batting?.sixes || 0} sixes</p>
                </div>
              </Link>
            )}

            {/* Girls First-Over Asset */}
            {A.girlBowlers.length > 0 && (
              <Link href={`/players/${A.girlBowlers[0].id}`}>
                <div className="rounded-xl p-4 border border-pink-500/20 bg-pink-500/5 hover:border-pink-500/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs">⚡</span>
                    <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">Girls First Over</span>
                  </div>
                  <p className="font-black text-sm">{A.girlBowlers[0].first_name} {A.girlBowlers[0].last_name}</p>
                  <p className="text-2xl font-black text-pink-400">{A.girlBowlers[0].bowling?.economy?.toFixed(2) || '—'} eco</p>
                  <p className="text-xs text-muted-foreground">
                    Runs doubled in over 1 · {A.girlBowlers.length} girl bowlers
                  </p>
                </div>
              </Link>
            )}

            {/* MVP */}
            {A.mvpRanked[0] && (
              <Link href={`/players/${A.mvpRanked[0].id}`}>
                <div className="rounded-xl p-4 border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">MVP</span>
                  </div>
                  <p className="font-black text-sm">{A.mvpRanked[0].first_name} {A.mvpRanked[0].last_name}</p>
                  <p className="text-2xl font-black text-purple-400">{A.mvpRanked[0].mvp?.mvp_score?.toFixed(0) || '—'}</p>
                  <p className="text-xs text-muted-foreground">MVP Score</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Tactical Insights ── */}
      {A && (
        <Card className="border-[#FFD700]/15 bg-[#FFD700]/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#FFD700]" />
              Tactical Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: 'Batting Depth',
                  value: A.depthPlayers.length >= 5 ? '✅ Strong' : A.depthPlayers.length >= 3 ? '⚠️ Moderate' : '❌ Thin',
                  detail: `${A.depthPlayers.length} players with avg > 15`,
                  color: A.depthPlayers.length >= 5 ? 'text-green-400' : A.depthPlayers.length >= 3 ? 'text-yellow-400' : 'text-red-400',
                },
                {
                  label: 'Bowling Attack',
                  value: A.avgEco < 8 ? '✅ Economical' : A.avgEco < 10 ? '⚠️ Average' : '❌ Expensive',
                  detail: `Team eco: ${A.avgEco.toFixed(2)}`,
                  color: A.avgEco < 8 ? 'text-green-400' : A.avgEco < 10 ? 'text-yellow-400' : 'text-red-400',
                },
                {
                  label: 'Girls First Over',
                  value: A.girlBowlers.length >= 2 ? '✅ Advantage' : A.girlBowlers.length === 1 ? '⚠️ Limited' : '❌ Risk',
                  detail: `${A.girlBowlers.length} girl bowler(s) — over 1 runs doubled`,
                  color: A.girlBowlers.length >= 2 ? 'text-green-400' : A.girlBowlers.length === 1 ? 'text-yellow-400' : 'text-red-400',
                },
                {
                  label: 'Power Hitters',
                  value: A.totalSixes > 20 ? '✅ Explosive' : A.totalSixes > 10 ? '⚠️ Moderate' : '❌ Low',
                  detail: `${A.totalSixes} sixes · ${A.totalBoundaries} boundaries total`,
                  color: A.totalSixes > 20 ? 'text-green-400' : A.totalSixes > 10 ? 'text-yellow-400' : 'text-red-400',
                },
              ].map(insight => (
                <div key={insight.label} className="rounded-lg p-3 bg-card/50 border border-border/50">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-muted-foreground">{insight.label}</span>
                    <span className={cn('text-xs font-bold', insight.color)}>{insight.value}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{insight.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── AI Deep Analysis ── */}
      {showAI && (
        <Card className="border-[#FFD700]/20 bg-[#FFD700]/3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
                AI Cricket Analysis
              </CardTitle>
              <button onClick={() => setShowAI(false)} className="text-muted-foreground hover:text-foreground">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {aiLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#FFD700]" />
                Running deep cricket analysis…
              </div>
            ) : (
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono text-xs bg-background/30 rounded-lg p-4 border border-border/30">
                {aiReport}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Full Squad ── */}
      <div className="space-y-2">
        <button
          className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider py-1"
          onClick={() => setShowSquad(v => !v)}
        >
          <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Full Squad ({team.players.length})</span>
          {showSquad ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSquad && sorted.map((p, i) => (
          <Link key={p.id} href={`/players/${p.id}`}>
            <div className="flex items-center gap-3 bg-card rounded-lg px-3 py-2.5 border border-border hover:border-[#FFD700]/30 transition-colors">
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
              <div className="w-9 h-9 rounded-full bg-[#1B3A8C] flex items-center justify-center text-sm shrink-0 overflow-hidden border border-white/10">
                {p.photo_url
                  ? <img src={p.photo_url} alt={`${p.first_name}`} className="w-full h-full object-cover" />
                  : <span>{p.gender === 'Female' ? '👩' : '👨'}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold text-sm">{p.first_name} {p.last_name}</span>
                  {(p.is_captain === 1 || p.team_role === 'captain') && (
                    <Badge className="bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30 text-[10px] py-0">C</Badge>
                  )}
                  {p.gender === 'Female' && <span className="text-pink-400 text-xs">♀</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', getRoleBadgeColor(p.player_role))}>
                    {getRoleIcon(p.player_role)} {p.player_role || '—'}
                  </span>
                </div>
                {ratingsMap[p.id] && (() => {
                  const r = ratingsMap[p.id];
                  const hasStars = r.batting_stars != null || r.bowling_stars != null || r.fielding_stars != null;
                  const hasScout = r.overall_rating != null || r.grade || r.should_buy != null;
                  if (!hasStars && !hasScout) return null;
                  return (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {r.batting_stars != null && <span className="text-[9px] text-[#FFD700]/70">🏏{'★'.repeat(r.batting_stars)}{'☆'.repeat(5-r.batting_stars)}</span>}
                      {r.bowling_stars != null && <span className="text-[9px] text-[#FFD700]/70">🎳{'★'.repeat(r.bowling_stars)}{'☆'.repeat(5-r.bowling_stars)}</span>}
                      {r.fielding_stars != null && <span className="text-[9px] text-[#FFD700]/70">🤸{'★'.repeat(r.fielding_stars)}{'☆'.repeat(5-r.fielding_stars)}</span>}
                      {(hasStars || hasScout) && (r.grade || r.overall_rating != null || r.should_buy != null) && (
                        <span className="text-border/40 text-[9px]">·</span>
                      )}
                      {r.overall_rating != null && <span className="text-[9px] text-[#FFD700]/80 font-semibold">{r.overall_rating}★</span>}
                      {r.grade && <span className="text-[9px] bg-[#1B3A8C]/20 text-blue-300 px-1 rounded font-bold">{r.grade}</span>}
                      {r.should_buy === true && <span className="text-[9px] text-green-400 font-semibold">✓Buy</span>}
                      {r.should_buy === false && <span className="text-[9px] text-red-400/70">✗Skip</span>}
                    </div>
                  );
                })()}
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                {p.purchase_price > 0 && <p className="text-xs font-bold text-[#FFD700]">{formatCurrency(p.purchase_price)}</p>}
                <div className="flex gap-2 text-[10px] text-muted-foreground justify-end">
                  {p.batting && <span>{p.batting.total_runs}r</span>}
                  {p.bowling && <span>{p.bowling.total_wickets}w</span>}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
