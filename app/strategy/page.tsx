'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StrategyPage() {
  const { currentSeasonId } = useSeason();
  const [teams, setTeams] = useState<any[]>([]);
  const [yourTeamId, setYourTeamId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [strategy, setStrategy] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentSeasonId) return;
    fetch(`/api/teams?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => setTeams(Array.isArray(d) ? d : []))
      .catch(console.error);
  }, [currentSeasonId]);

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
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-display text-[#FFD700] flex items-center gap-2">
          <Brain className="w-7 h-7" /> AI Strategy Advisor
        </h1>
        <p className="text-muted-foreground text-sm">Get AI-powered pre-match strategy recommendations</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm">Match Setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 uppercase tracking-wide">Your Team</label>
              <select value={yourTeamId} onChange={e => setYourTeamId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
                <option value="">Select your team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 uppercase tracking-wide">Opposition</label>
              <select value={opponentId} onChange={e => setOpponentId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
                <option value="">Select opponent...</option>
                {teams.filter(t => t.id !== yourTeamId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <Button onClick={handleStrategy} disabled={!yourTeamId || !opponentId || loading}
            className="w-full bg-[#FFD700] text-black hover:bg-[#FFD700]/90 font-bold h-12 text-base">
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyzing matchup...</>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" /> Generate Match Strategy</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ZPL Rules reminder */}
      <Card className="bg-[#1B3A8C]/20 border-[#1B3A8C]/40">
        <CardContent className="p-4">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2">ZPL Format Reminders</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { emoji: '👧', label: 'Girls 1st Over', desc: 'Runs ×2, 4 on field' },
              { emoji: '🏏', label: '12 Overs T12', desc: 'Max 3 overs/bowler' },
              { emoji: '⚡', label: 'Impact Player', desc: '1 sub per innings' },
              { emoji: '📺', label: 'DRS', desc: '1 review per innings' },
            ].map(r => (
              <div key={r.label} className="bg-[#1B3A8C]/20 rounded p-2 text-center">
                <p className="text-lg">{r.emoji}</p>
                <p className="text-xs font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strategy Output */}
      {loading && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-10 h-10 text-[#FFD700] animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">AI is analyzing both squads, historical data, and ZPL rules...</p>
          </CardContent>
        </Card>
      )}

      {strategy && !loading && (
        <Card className="bg-[#FFD700]/5 border-[#FFD700]/20">
          <CardHeader>
            <CardTitle className="text-[#FFD700] flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Match Strategy
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {teams.find(t => t.id === yourTeamId)?.name} vs {teams.find(t => t.id === opponentId)?.name}
            </p>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-body bg-transparent p-0 border-0">{strategy}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
