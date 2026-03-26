'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Shield } from 'lucide-react';

interface TeamRole {
  team_id: string;   // actual DB id — sent to API, no name-matching needed
  team: string;      // display name
  captain: string;
  manager: string;
}

interface RegisteredPlayer {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
}

interface AssignResult {
  assigned: number;
  created: number;
  errors: string[];
  matched: string[];
}

export default function TeamRolesPage() {
  const { currentSeasonId, seasons } = useSeason();
  const [seasonId, setSeasonId] = useState('');
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [allPlayers, setAllPlayers] = useState<RegisteredPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentSeasonId && !seasonId) setSeasonId(currentSeasonId);
  }, [currentSeasonId]);

  // Whenever season changes: load real teams + registered players in parallel,
  // then merge default captain/manager suggestions into rows keyed by team_id
  useEffect(() => {
    if (!seasonId) return;
    setLoadingTeams(true);
    setLoadingPlayers(true);

    Promise.all([
      fetch(`/api/teams?season_id=${seasonId}`).then(r => r.json()),
      fetch(`/api/players?season_id=${seasonId}`).then(r => r.json()),
      fetch('/api/admin/team-roles').then(r => r.json()),
    ]).then(([teamsData, playersData, defaults]: [any[], RegisteredPlayer[], { team: string; captain: string; manager: string }[]]) => {
      // Build roles rows from actual DB teams
      const rows: TeamRole[] = (Array.isArray(teamsData) ? teamsData : []).map((t: any) => {
        // Try to find a matching default suggestion by loose name comparison
        const def = defaults.find(d =>
          t.name.toLowerCase().includes(d.team.toLowerCase()) ||
          d.team.toLowerCase().includes(t.name.toLowerCase())
        );
        return {
          team_id: t.id,
          team: t.name,
          captain: def?.captain ?? '',
          manager: def?.manager ?? '',
        };
      });
      setRoles(rows);

      const sorted = (Array.isArray(playersData) ? playersData : [])
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
      setAllPlayers(sorted);
    }).finally(() => {
      setLoadingTeams(false);
      setLoadingPlayers(false);
    });
  }, [seasonId]);

  const malePlayers = allPlayers.filter(p => p.gender?.toLowerCase() !== 'female');
  const femalePlayers = allPlayers.filter(p => p.gender?.toLowerCase() === 'female');

  const setRole = (rowIndex: number, field: 'captain' | 'manager', value: string) => {
    setRoles(prev => prev.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r));
  };

  const handleAssign = async () => {
    if (!seasonId) return;
    setAssigning(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/admin/team-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: seasonId, roles }),
      });
      const data = await res.json();
      if (!res.ok || data.error) setError(data.error || 'Assignment failed');
      else setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAssigning(false);
    }
  };

  const playerLabel = (p: RegisteredPlayer) => `${p.first_name} ${p.last_name}`.trim();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black font-display text-[#FFD700]">Captains &amp; Managers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Select captains (any player) and managers (female players only) from the registered player list.
          They will be marked <strong>Not For Sale</strong> and excluded from the auction pool.
        </p>
      </div>

      {/* Season selector */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Select Season</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={seasonId}
            onChange={e => { setSeasonId(e.target.value); setResult(null); setError(''); }}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
          >
            <option value="">Choose a season…</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
            ))}
          </select>
          {(loadingPlayers || loadingTeams) && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading teams and players…
            </p>
          )}
          {!loadingPlayers && seasonId && allPlayers.length === 0 && (
            <p className="text-xs text-amber-400 mt-2">
              No registered players found for this season. Import registration first.
            </p>
          )}
          {!loadingPlayers && seasonId && allPlayers.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {allPlayers.length} players · {femalePlayers.length} female (eligible as manager)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Per-team dropdowns */}
      {seasonId && allPlayers.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FFD700]" /> 2. Assign per Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roles.map((row, i) => (
              <div key={row.team} className="bg-secondary rounded-lg p-3 space-y-2">
                <p className="font-semibold text-sm">{row.team}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Captain — all players */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-[#FFD700]/70 font-semibold mb-1 block">
                      Captain
                    </label>
                    <select
                      value={row.captain}
                      onChange={e => setRole(i, 'captain', e.target.value)}
                      className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                    >
                      <option value="">— select captain —</option>
                      {allPlayers.map(p => (
                        <option key={p.id} value={playerLabel(p)}>{playerLabel(p)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Manager — female players only */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-blue-400/70 font-semibold mb-1 block">
                      Manager <span className="text-muted-foreground font-normal normal-case">(female)</span>
                    </label>
                    <select
                      value={row.manager}
                      onChange={e => setRole(i, 'manager', e.target.value)}
                      className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                    >
                      <option value="">— select manager —</option>
                      {femalePlayers.map(p => (
                        <option key={p.id} value={playerLabel(p)}>{playerLabel(p)}</option>
                      ))}
                    </select>
                    {femalePlayers.length === 0 && (
                      <p className="text-[10px] text-amber-400 mt-1">No female players registered</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      {seasonId && allPlayers.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-3">
            <Button
              onClick={handleAssign}
              disabled={assigning || roles.some(r => !r.captain || !r.manager)}
              className="w-full bg-[#FFD700] text-black hover:bg-[#FFD700]/90 font-bold"
            >
              {assigning
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Assigning…</>
                : <><Shield className="w-4 h-4 mr-2" />Assign All Captains &amp; Managers</>
              }
            </Button>
            {roles.some(r => !r.captain || !r.manager) && (
              <p className="text-xs text-amber-400 text-center">
                Select both a captain and manager for every team before assigning.
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Safe to run multiple times — existing assignments are fully replaced.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <p className="font-semibold text-green-400">Assignments complete</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {result.assigned} players assigned · {result.created} new players created
            </p>
            {result.created > 0 && (
              <p className="text-xs text-amber-400">
                ⚠ {result.created} name(s) didn't match any registered player and were newly created.
              </p>
            )}
            {result.matched.length > 0 && (
              <details className="mt-1">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Show name matches ({result.matched.length})
                </summary>
                <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                  {result.matched.map((m, i) => (
                    <p key={i} className="text-xs text-muted-foreground font-mono">{m}</p>
                  ))}
                </div>
              </details>
            )}
            {result.errors.length > 0 && (
              <div className="text-xs text-red-400 space-y-0.5 pt-1">
                {result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
