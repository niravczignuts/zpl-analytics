'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, Trophy } from 'lucide-react';
import Link from 'next/link';

interface Team { id: string; name: string; color_primary: string | null; short_name: string | null; }

const MATCH_TYPES = [
  { value: 'league',     label: '🏏 League Match' },
  { value: 'semifinal',  label: '⚔️ Semifinal' },
  { value: 'eliminator', label: '💥 Eliminator' },
  { value: 'final',      label: '🏆 Final' },
  { value: 'practice',   label: '🎯 Practice Match' },
];

export default function ScheduleMatchPage() {
  const { currentSeasonId } = useSeason();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);

  const [form, setForm] = useState({
    team_a_id:   '',
    team_b_id:   '',
    match_type:  'league',
    match_number:'',
    match_date:  '',
    venue:       '',
    status:      'upcoming',
  });

  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!currentSeasonId) return;
    fetch(`/api/teams?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => setTeams(Array.isArray(d) ? d : []));
  }, [currentSeasonId]);

  const set = (k: string, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.team_a_id || !form.team_b_id) { setError('Please select both teams'); return; }
    if (form.team_a_id === form.team_b_id)  { setError('Team A and Team B must be different'); return; }
    if (!currentSeasonId) { setError('No season selected'); return; }

    setSaving(true);
    setError('');
    try {
      const body = {
        season_id:    currentSeasonId,
        team_a_id:    form.team_a_id,
        team_b_id:    form.team_b_id,
        match_type:   form.match_type,
        match_number: form.match_number ? parseInt(form.match_number) : null,
        match_date:   form.match_date   || null,
        venue:        form.venue.trim() || null,
        status:       form.status,
      };
      const res  = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create match');
      setSuccess(true);
      setTimeout(() => router.push('/matches'), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const teamA = teams.find(t => t.id === form.team_a_id);
  const teamB = teams.find(t => t.id === form.team_b_id);

  return (
    <div className="p-4 sm:p-6 max-w-xl">
      {/* Header */}
      <div className="page-header -mx-6 -mt-6 px-6 pt-6 pb-5 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/matches"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-black font-display gradient-gold">Schedule Match</h1>
        </div>
        <p className="text-muted-foreground text-sm pl-7">Create a new fixture for the current season</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Match type + number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Match Type</Label>
            <select
              value={form.match_type}
              onChange={e => set('match_type', e.target.value)}
              className="w-full h-10 rounded-lg px-3 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50"
            >
              {MATCH_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {form.match_type === 'league' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Match Number</Label>
              <Input
                type="number"
                min="1"
                value={form.match_number}
                onChange={e => set('match_number', e.target.value)}
                placeholder="e.g. 1"
                className="h-10 bg-card border-border"
              />
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Teams</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Team A</Label>
              <select
                value={form.team_a_id}
                onChange={e => set('team_a_id', e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50"
                required
              >
                <option value="">Select team…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {teamA && (
                <div className="flex items-center gap-1.5 text-xs mt-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamA.color_primary || '#888' }} />
                  <span className="text-muted-foreground">{teamA.short_name || teamA.name}</span>
                </div>
              )}
            </div>

            <div className="text-center font-black text-muted-foreground text-lg sm:pb-5 py-1">vs</div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Team B</Label>
              <select
                value={form.team_b_id}
                onChange={e => set('team_b_id', e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50"
                required
              >
                <option value="">Select team…</option>
                {teams.filter(t => t.id !== form.team_a_id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {teamB && (
                <div className="flex items-center gap-1.5 text-xs mt-1 justify-end">
                  <span className="text-muted-foreground">{teamB.short_name || teamB.name}</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamB.color_primary || '#888' }} />
                </div>
              )}
            </div>
          </div>

          {/* Live preview */}
          {teamA && teamB && (
            <div className="mt-2 py-2 px-3 rounded-lg text-center text-sm font-semibold"
              style={{ background: `linear-gradient(135deg, ${teamA.color_primary || '#1B3A8C'}22, ${teamB.color_primary || '#DC1420'}22)` }}>
              <span style={{ color: teamA.color_primary || '#fff' }}>{teamA.name}</span>
              <span className="mx-2 text-muted-foreground">⚔️</span>
              <span style={{ color: teamB.color_primary || '#fff' }}>{teamB.name}</span>
            </div>
          )}
        </div>

        {/* Date, Venue, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Match Date & Time</Label>
            <Input
              type="datetime-local"
              value={form.match_date}
              onChange={e => set('match_date', e.target.value)}
              className="h-10 bg-card border-border text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full h-10 rounded-lg px-3 text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50"
            >
              <option value="upcoming">🟡 Upcoming</option>
              <option value="live">🟢 Live</option>
              <option value="completed">🔵 Completed</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Venue</Label>
          <Input
            value={form.venue}
            onChange={e => set('venue', e.target.value)}
            placeholder="e.g. Zignuts Ground, Ahmedabad"
            className="h-10 bg-card border-border"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={saving || success}
          className="w-full h-11 text-sm font-bold"
          style={{
            background: success
              ? 'linear-gradient(135deg,#16A34A,#15803D)'
              : 'linear-gradient(135deg,#FFD700,#D4AA00)',
            color: success ? '#fff' : '#000',
            border: 'none',
          }}
        >
          {saving  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling…</> :
           success ? <><CheckCircle2 className="w-4 h-4 mr-2" />Match Scheduled!</> :
                     <><Trophy className="w-4 h-4 mr-2" />Schedule Match</>}
        </Button>
      </form>
    </div>
  );
}
