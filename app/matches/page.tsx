'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trophy, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Match {
  id: string; match_number: number; match_type: string; status: string;
  team_a_name: string; team_b_name: string; team_a_color: string; team_b_color: string;
  winner_name: string; result_summary: string; match_date: string; venue: string;
}

export default function MatchesPage() {
  const { currentSeasonId } = useSeason();
  const [matches, setMatches]           = useState<Match[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteErr, setDeleteErr]       = useState('');

  useEffect(() => {
    if (!currentSeasonId) return;
    setLoading(true);
    fetch(`/api/matches?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then(d => { setMatches(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentSeasonId]);

  const filtered = matches.filter(m => {
    if (filter === 'upcoming') return m.status === 'upcoming';
    if (filter === 'completed') return m.status === 'completed';
    if (filter === 'live') return m.status === 'live';
    return true;
  });

  const handleDelete = async (matchId: string) => {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setMatches(prev => prev.filter(m => m.id !== matchId));
      setConfirmDeleteId(null);
    } catch (e: any) {
      setDeleteErr(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const statusColor = (s: string) =>
    s === 'live' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    s === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-display text-[#FFD700]">Matches</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} matches</p>
        </div>
        <Link href="/admin/matches/new" prefetch={false}>
          <Button className="bg-[#FFD700] text-black hover:bg-[#FFD700]/90 text-sm font-bold">
            <Plus className="w-4 h-4 mr-1" /> Schedule Match
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['all','All'],['upcoming','Upcoming'],['live','Live'],['completed','Completed']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={cn('px-3 py-1.5 rounded-md text-sm transition-colors',
              filter === v ? 'bg-[#FFD700] text-black font-bold' : 'bg-card border border-border hover:border-[#FFD700]/30')}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No matches scheduled yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id}>
              <Card className={cn(
                'bg-card border-border transition-all',
                confirmDeleteId === m.id ? 'border-red-500/40' : 'hover:border-[#FFD700]/30'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-muted-foreground w-12 shrink-0 text-center">
                      {m.match_type === 'league' ? `M${m.match_number || '?'}` : m.match_type?.toUpperCase()}
                    </div>

                    <Link href={`/matches/${m.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.team_a_color || '#1B3A8C' }} />
                        <span className={cn('font-semibold truncate', m.winner_name === m.team_a_name && 'text-[#FFD700]')}>
                          {m.team_a_name || 'TBD'}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-sm font-medium shrink-0">vs</span>
                      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                        <span className={cn('font-semibold truncate', m.winner_name === m.team_b_name && 'text-[#FFD700]')}>
                          {m.team_b_name || 'TBD'}
                        </span>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.team_b_color || '#DC143C' }} />
                      </div>
                    </Link>

                    <div className="text-right shrink-0 space-y-1">
                      <Badge className={cn('text-xs', statusColor(m.status))}>{m.status}</Badge>
                      {m.result_summary && <p className="text-xs text-muted-foreground">{m.result_summary}</p>}
                      {m.match_date && <p className="text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString()}</p>}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={e => {
                        e.preventDefault();
                        setConfirmDeleteId(confirmDeleteId === m.id ? null : m.id);
                        setDeleteErr('');
                      }}
                      className="ml-1 p-1.5 rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      title="Delete match"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inline delete confirmation */}
                  {confirmDeleteId === m.id && (
                    <div className="mt-3 pt-3 border-t border-red-500/20 space-y-2">
                      <p className="text-xs text-red-400 font-medium">
                        Delete this match and all its data (scorecard, innings, performances)?
                      </p>
                      {deleteErr && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3 shrink-0" /> {deleteErr}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setConfirmDeleteId(null); setDeleteErr(''); }}
                          disabled={deleting}
                          className="px-3 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          disabled={deleting}
                          className="px-3 py-1 text-xs rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {deleting
                            ? <><Loader2 className="w-3 h-3 animate-spin" />Deleting…</>
                            : <><Trash2 className="w-3 h-3" />Confirm Delete</>}
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
