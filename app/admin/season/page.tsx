'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, CheckCircle2, Copy, Loader2, AlertCircle } from 'lucide-react';

export default function SeasonManagementPage() {
  const { seasons, currentSeasonId, setCurrentSeasonId } = useSeason();
  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Clone state
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [cloneTargetId, setCloneTargetId] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState('');

  // Init 2026 state
  const [initing, setIniting] = useState(false);
  const [initLog, setInitLog] = useState<string[]>([]);
  const [initError, setInitError] = useState('');

  // Pre-select most recent season as clone source
  useEffect(() => {
    if (seasons.length > 0 && !cloneSourceId) {
      setCloneSourceId(seasons[0].id);
    }
  }, [seasons]);

  const createSeason = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch('/api/seasons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, year: newYear, status: 'upcoming' }),
    });
    const season = await res.json();
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
    // Set as clone target automatically
    if (season?.id) setCloneTargetId(season.id);
    window.location.reload();
  };

  const handleClone = async () => {
    if (!cloneSourceId || !cloneTargetId) {
      setCloneError('Select both a source and target season.');
      return;
    }
    if (cloneSourceId === cloneTargetId) {
      setCloneError('Source and target must be different seasons.');
      return;
    }
    setCloning(true);
    setCloneResult(null);
    setCloneError('');
    try {
      const res = await fetch('/api/seasons/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_season_id: cloneSourceId, target_season_id: cloneTargetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clone failed');
      setCloneResult(`Done! ${data.teams_created} teams and ${data.registrations_copied} player registrations copied.`);
    } catch (e: any) {
      setCloneError(e.message);
    } finally {
      setCloning(false);
    }
  };

  const handleInit2026 = async () => {
    setIniting(true);
    setInitLog([]);
    setInitError('');
    try {
      const res = await fetch('/api/admin/init-2026', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Init failed');
      setInitLog(data.log || []);
    } catch (e: any) {
      setInitError(e.message);
    } finally {
      setIniting(false);
    }
  };

  const statusColor = (s: string) =>
    s === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
    s === 'league' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    s === 'auction' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    s === 'registration' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
    'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black font-display text-[#FFD700]">Season Management</h1>
        <p className="text-muted-foreground text-sm">Manage tournament seasons</p>
      </div>

      {/* Existing Seasons */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm">Seasons</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {seasons.map(s => {
            const isActive = s.id === currentSeasonId;
            return (
              <div key={s.id} className={cn(
                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                isActive ? 'bg-[#FFD700]/10 border-[#FFD700]/40' : 'bg-secondary border-transparent'
              )}>
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {s.name}
                    {isActive && <span className="text-[10px] font-bold bg-[#FFD700] text-black px-1.5 py-0.5 rounded">ACTIVE</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-xs', statusColor(s.status))}>{s.status}</Badge>
                  {isActive ? (
                    <Button size="sm" disabled className="text-xs bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40 cursor-default">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setCurrentSeasonId(s.id)}
                      className="text-xs border-[#FFD700]/30 hover:bg-[#FFD700]/10">
                      Select
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {seasons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No seasons yet</p>
          )}
        </CardContent>
      </Card>

      {/* Create New Season */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Create New Season</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Season Name</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="ZPL 2026"
              className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Year</label>
            <Input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))}
              className="bg-secondary border-border w-32" />
          </div>
          <Button onClick={createSeason} disabled={!newName.trim() || saving}
            className="bg-[#FFD700] text-black hover:bg-[#FFD700]/90 font-bold">
            {saved ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved!</> : 'Create Season'}
          </Button>
        </CardContent>
      </Card>

      {/* Initialize Season 2026 */}
      <Card className="bg-card border-border border-amber-400/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span>🏏</span> Initialize Season 2026
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Sets the 3 CR budget, 13 players per team, assigns all 8 captains with their fixed valuations and team managers.
            Run this once after importing the 2026 player spreadsheet.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {initError && (
            <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {initError}
            </div>
          )}
          {initLog.length > 0 && (
            <div className="bg-black/40 border border-border rounded-md p-3 max-h-48 overflow-y-auto space-y-0.5">
              {initLog.map((line, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">{line}</p>
              ))}
            </div>
          )}
          <Button
            onClick={handleInit2026}
            disabled={initing}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-400/30 font-semibold gap-2"
          >
            {initing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Initializing…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Run 2026 Initialization</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Clone Teams & Registrations */}
      {seasons.length >= 1 && (
        <Card className="bg-card border-border border-[#FFD700]/10">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Copy className="w-4 h-4 text-[#FFD700]" /> Copy Teams to New Season
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Copy the same 8 teams (names + colors) from a previous season into the new season. Player registrations are <strong>not</strong> copied — upload the 2026 player spreadsheet separately via Import Data.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Copy FROM (source)</label>
                <select
                  value={cloneSourceId}
                  onChange={e => setCloneSourceId(e.target.value)}
                  className="w-full bg-background border border-border text-sm rounded-md px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                >
                  <option value="">Select source season…</option>
                  {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Copy TO (target)</label>
                <select
                  value={cloneTargetId}
                  onChange={e => setCloneTargetId(e.target.value)}
                  className="w-full bg-background border border-border text-sm rounded-md px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                >
                  <option value="">Select target season…</option>
                  {seasons.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                  ))}
                </select>
              </div>
            </div>

            {cloneError && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {cloneError}
              </div>
            )}

            {cloneResult && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{cloneResult}</span>
                </div>
                <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Next step: Go to <strong>Admin → Import Data</strong> and upload the 2026 player registration spreadsheet to register players for the new season.</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleClone}
              disabled={!cloneSourceId || !cloneTargetId || cloning}
              className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/80 text-white font-semibold gap-2"
            >
              {cloning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Copying…</>
              ) : (
                <><Copy className="w-4 h-4" /> Copy Teams & Registrations</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
