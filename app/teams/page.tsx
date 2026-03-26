'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/calculations';
import Link from 'next/link';
import { Shield } from 'lucide-react';

interface Team {
  id: string; name: string; short_name: string; color_primary: string;
  logo_url: string | null;
  spent: number; remaining: number; total_budget: number; players_bought: number; max_players: number;
}

// Readable text color on a given bg color
function textOnColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000000' : '#FFFFFF';
}

export default function TeamsPage() {
  const { currentSeasonId, setCurrentSeasonId, seasons } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSeasonId) return;
    setLoading(true);
    fetch(`/api/teams?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => { setTeams(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentSeasonId]);

  if (loading) return (
    <div className="flex justify-center items-center h-full">
      <div className="w-8 h-8 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-display text-[#FFD700]">Teams</h1>
        <p className="text-muted-foreground text-sm">{teams.length} teams this season</p>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-semibold mb-1">No teams for this season yet</p>
          <p className="text-sm mb-4">Teams and auction data exist for ZPL 2025.</p>
          {seasons.find(s => s.id === 'season-2025') && (
            <button
              onClick={() => setCurrentSeasonId('season-2025')}
              className="px-4 py-2 bg-[#FFD700] text-black rounded-md text-sm font-bold hover:bg-[#FFD700]/90 transition-colors"
            >
              Switch to ZPL 2025
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teams.map(team => {
            const pct = team.total_budget > 0 ? (team.spent / team.total_budget) * 100 : 0;
            const color = team.color_primary || '#1B3A8C';
            const onColor = textOnColor(color);
            return (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <Card className="overflow-hidden border-2 hover:scale-[1.02] transition-all cursor-pointer"
                  style={{ borderColor: color + '40' }}>
                  {/* Color header band */}
                  <div className="h-20 flex items-center justify-center gap-3 px-4 relative overflow-hidden"
                    style={{ backgroundColor: color }}>
                    {/* Subtle glow overlay */}
                    <div className="absolute inset-0 opacity-20"
                      style={{ background: 'radial-gradient(circle at 50% 0%, white 0%, transparent 70%)' }} />
                    {/* Team logo or initials */}
                    <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center font-black text-base shrink-0 overflow-hidden border-2 border-white/30">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name}
                          className="w-full h-full object-contain p-1" />
                      ) : (
                        <span style={{ color: onColor }}>
                          {(team.short_name || team.name).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="font-black text-sm leading-tight relative z-10" style={{ color: onColor }}>
                      {team.name}
                    </span>
                  </div>

                  <CardContent className="p-4 bg-card">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>{team.players_bought} / {team.max_players} players</span>
                      <span className="text-green-400 font-medium">{formatCurrency(team.remaining || 0)} left</span>
                    </div>
                    {/* Budget bar */}
                    <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Spent: <span className="text-foreground font-semibold">{formatCurrency(team.spent || 0)}</span>
                      </span>
                      <span className="font-semibold" style={{ color }}>
                        {pct.toFixed(0)}% used
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
