'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ArrowLeftRight } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function ComparePage() {
  const { currentSeasonId } = useSeason();
  const [teams, setTeams] = useState<any[]>([]);
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [team1, setTeam1] = useState<any>(null);
  const [team2, setTeam2] = useState<any>(null);
  const [comparison, setComparison] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    if (!currentSeasonId) return;
    fetch(`/api/teams?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => { setTeams(Array.isArray(d) ? d : []); setTeamsLoading(false); })
      .catch(() => setTeamsLoading(false));
  }, [currentSeasonId]);

  const loadTeam = async (teamId: string, setter: (v: any) => void) => {
    if (!teamId) { setter(null); return; }
    const data = await fetch(`/api/teams/${teamId}?season_id=${currentSeasonId}`).then(r => r.json());
    setter(data);
  };

  useEffect(() => { loadTeam(team1Id, setTeam1); }, [team1Id, currentSeasonId]);
  useEffect(() => { loadTeam(team2Id, setTeam2); }, [team2Id, currentSeasonId]);

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
      setComparison(data.comparison || '');
    } finally { setLoading(false); }
  };

  // Build radar data
  const buildRadar = (t: any) => {
    if (!t?.players) return [];
    const players = t.players;
    const totalRuns = players.reduce((s: number, p: any) => s + (p.batting?.total_runs || 0), 0);
    const totalWkts = players.reduce((s: number, p: any) => s + (p.bowling?.total_wickets || 0), 0);
    const totalDismissals = players.reduce((s: number, p: any) => s + (p.fielding?.total_dismissal || 0), 0);
    const avgEco = players.filter((p: any) => p.bowling?.economy).reduce((s: number, p: any) => s + p.bowling.economy, 0) / (players.filter((p: any) => p.bowling?.economy).length || 1);
    const avgMvp = players.reduce((s: number, p: any) => s + (p.mvp?.total_score || 0), 0) / (players.length || 1);
    return [
      { subject: 'Batting', value: Math.min(100, totalRuns / 20) },
      { subject: 'Bowling', value: Math.min(100, totalWkts * 6) },
      { subject: 'Fielding', value: Math.min(100, totalDismissals * 5) },
      { subject: 'Economy', value: Math.max(0, 100 - (avgEco - 5) * 15) },
      { subject: 'Depth', value: Math.min(100, players.length * 8) },
      { subject: 'Overall', value: Math.min(100, avgMvp * 2.5) },
    ];
  };

  const radarData1 = buildRadar(team1);
  const radarData2 = buildRadar(team2);

  // Merge radar arrays
  const combinedRadar = radarData1.map((d, i) => ({
    subject: d.subject,
    [team1?.name || 'Team 1']: d.value,
    [team2?.name || 'Team 2']: radarData2[i]?.value || 0,
  }));

  const TeamSummary = ({ t }: { t: any }) => {
    if (!t) return null;
    const totalRuns = t.players?.reduce((s: number, p: any) => s + (p.batting?.total_runs || 0), 0) || 0;
    const totalWkts = t.players?.reduce((s: number, p: any) => s + (p.bowling?.total_wickets || 0), 0) || 0;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color_primary || '#FFD700' }} />
          <h3 className="font-bold text-lg">{t.name}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: 'Players', v: t.players?.length },
            { l: 'Total Runs', v: totalRuns },
            { l: 'Wickets', v: totalWkts },
          ].map(s => (
            <div key={s.l} className="bg-secondary rounded p-2 text-center">
              <p className="font-bold">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {(t.players || []).slice(0, 8).map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate">{p.first_name} {p.last_name}</span>
              {p.batting && <span className="text-blue-400">{p.batting.total_runs}r</span>}
              {p.bowling && <span className="text-red-400">{p.bowling.total_wickets}w</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-display text-[#FFD700]">Head-to-Head Compare</h1>
        <p className="text-muted-foreground text-sm">Compare two teams with AI analysis</p>
      </div>

      {/* Team Selectors */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <select value={team1Id} onChange={e => setTeam1Id(e.target.value)}
          className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
          <option value="">Select Team 1...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <ArrowLeftRight className="w-5 h-5 text-muted-foreground shrink-0 self-center rotate-90 sm:rotate-0" />
        <select value={team2Id} onChange={e => setTeam2Id(e.target.value)}
          className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
          <option value="">Select Team 2...</option>
          {teams.filter(t => t.id !== team1Id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button onClick={handleCompare} disabled={!team1Id || !team2Id || loading}
          className="bg-[#FFD700] text-black hover:bg-[#FFD700]/90 font-bold shrink-0 w-full sm:w-auto">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          AI Compare
        </Button>
      </div>

      {/* Radar Chart */}
      {team1 && team2 && combinedRadar.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Performance Radar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={combinedRadar}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Radar name={team1.name} dataKey={team1.name} stroke={team1.color_primary || '#FFD700'} fill={team1.color_primary || '#FFD700'} fillOpacity={0.15} />
                <Radar name={team2.name} dataKey={team2.name} stroke={team2.color_primary || '#4169E1'} fill={team2.color_primary || '#4169E1'} fillOpacity={0.15} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded px-2 py-1 text-xs space-y-1">
                    {payload.map((p: any, i: number) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)}</p>)}
                  </div>
                ) : null} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side team details */}
      {(team1 || team2) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              {team1 ? <TeamSummary t={team1} /> : <p className="text-muted-foreground text-sm">Select Team 1</p>}
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              {team2 ? <TeamSummary t={team2} /> : <p className="text-muted-foreground text-sm">Select Team 2</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Comparison */}
      {comparison && (
        <Card className="bg-[#FFD700]/5 border-[#FFD700]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#FFD700] flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{comparison}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
