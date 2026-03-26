'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Shield, Activity } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface DashboardData {
  seasonId: string;
  stats: { totalPlayers: number; totalTeams: number; totalMatches: number; completedMatches: number };
  topBatters: any[];
  topBowlers: any[];
  topMvp: any[];
  pointsTable: any[];
  upcomingMatches: any[];
  recentMatches: any[];
}

export default function DashboardPage() {
  const { currentSeasonId } = useSeason();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSeasonId) return;
    setLoading(true);
    fetch(`/api/dashboard?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentSeasonId]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading ZPL Analytics...</p>
      </div>
    </div>
  );

  if (!data || (data as any).error) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-4xl mb-4">🏏</p>
        <h2 className="text-xl font-bold mb-2">No data found</h2>
        <p className="text-muted-foreground mb-4">Copy your data files to data/seed/ and run:</p>
        <code className="bg-card px-3 py-2 rounded text-sm font-mono block">npx tsx scripts/seed.ts</code>
      </div>
    </div>
  );

  const batterData = (data.topBatters || []).map(b => ({
    name: b.player_name?.split(' ')[0] || '?',
    runs: b.stats?.total_runs || 0,
  }));

  const bowlerData = (data.topBowlers || []).map(b => ({
    name: b.player_name?.split(' ')[0] || '?',
    wickets: b.stats?.total_wickets || 0,
  }));

  const seasonLabel = currentSeasonId?.includes('2026') ? 'ZPL 2026' :
                      currentSeasonId?.includes('2025') ? 'ZPL 2025' : 'ZPL 2024';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black font-display" style={{ color: '#FFD700' }}>ZPL Analytics</h1>
          <p className="text-muted-foreground">Zignuts Premier League — {seasonLabel}</p>
        </div>
        <Badge className="bg-[#FFD700]/15 border-[#FFD700]/30 text-sm px-3 py-1" style={{ color: '#FFD700' }}>
          {data.stats.completedMatches > 0 ? `${data.stats.completedMatches} matches played` : 'Season Preview'}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Registered Players', value: data.stats.totalPlayers, icon: Users, color: '#60a5fa' },
          { label: 'Teams', value: data.stats.totalTeams, icon: Shield, color: '#34d399' },
          { label: 'Matches Scheduled', value: data.stats.totalMatches, icon: Trophy, color: '#FFD700' },
          { label: 'Completed', value: data.stats.completedMatches, icon: Activity, color: '#a78bfa' },
        ].map(stat => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: stat.color + '20' }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-2xl font-black font-display">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Batters */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">🏏 Top Run Scorers</CardTitle>
          </CardHeader>
          <CardContent>
            {batterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={batterData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-card border border-border rounded px-2 py-1 text-xs">
                        <p className="text-[#FFD700]">{payload[0].value} runs</p>
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="runs" radius={[0, 4, 4, 0]}>
                    {batterData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${45 - i * 3}, 100%, ${65 - i * 5}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Bowlers */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">⚡ Top Wicket Takers</CardTitle>
          </CardHeader>
          <CardContent>
            {bowlerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={bowlerData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-card border border-border rounded px-2 py-1 text-xs">
                        <p className="text-blue-400">{payload[0].value} wickets</p>
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="wickets" radius={[0, 4, 4, 0]}>
                    {bowlerData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${220 + i * 8}, 80%, ${60 - i * 4}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* MVP Leaders */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">⭐ MVP Leaders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data.topMvp || []).slice(0, 5).map((p, i) => (
                <div key={p.player_id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/players/${p.player_id}`} className="text-sm font-semibold truncate block hover:text-[#FFD700]">
                      {p.player_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.team_name || '—'}</p>
                  </div>
                  <span className="text-sm font-bold text-[#FFD700]">
                    {p.stats?.total_score?.toFixed(1) || '0.0'}
                  </span>
                </div>
              ))}
              {(data.topMvp || []).length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">No MVP data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Points Table */}
      {(data.pointsTable || []).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FFD700]" /> Points Table
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border text-xs uppercase tracking-wide">
                    <th className="text-left py-2 font-medium w-8">#</th>
                    <th className="text-left py-2 font-medium">Team</th>
                    <th className="text-center py-2 font-medium w-12">P</th>
                    <th className="text-center py-2 font-medium w-12">W</th>
                    <th className="text-center py-2 font-medium w-12">L</th>
                    <th className="text-center py-2 font-medium w-12">Pts</th>
                    <th className="text-center py-2 font-medium w-16">NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pointsTable.map((row: any, i) => (
                    <tr key={row.team_id} className="border-b border-border/40 hover:bg-muted/10">
                      <td className="py-2 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="py-2">
                        <Link href={`/teams/${row.team_id}`} className="flex items-center gap-2 hover:text-[#FFD700]">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.team_color || '#FFD700' }} />
                          <span className="font-medium">{row.team_name}</span>
                        </Link>
                      </td>
                      <td className="py-2 text-center">{row.matches_played}</td>
                      <td className="py-2 text-center text-green-400 font-medium">{row.wins}</td>
                      <td className="py-2 text-center text-red-400">{row.losses}</td>
                      <td className="py-2 text-center font-bold text-[#FFD700]">{row.points}</td>
                      <td className="py-2 text-center text-xs">{(row.net_run_rate || 0).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/auction', emoji: '🔨', label: 'Auction Board', desc: 'Live draft interface' },
          { href: '/players', emoji: '👤', label: 'Players', desc: 'Browse & analyze players' },
          { href: '/teams', emoji: '🏏', label: 'Teams', desc: 'View all squads' },
          { href: '/strategy', emoji: '🧠', label: 'AI Strategy', desc: 'Match analysis' },
        ].map(link => (
          <Link key={link.href} href={link.href}>
            <Card className="bg-card border-border hover:border-[#FFD700]/30 hover:bg-[#FFD700]/5 transition-all cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="text-2xl mb-2">{link.emoji}</div>
                <p className="font-semibold text-sm">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
