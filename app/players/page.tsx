'use client';

import { useEffect, useState } from 'react';
import { fetchJSON } from '@/lib/fetch';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRoleIcon, getRoleBadgeColor, formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Search, Users, X, Loader2, ChevronRight, StickyNote, PlusCircle, Pencil, Star } from 'lucide-react';
import Link from 'next/link';

interface Player {
  id: string; first_name: string; last_name: string;
  gender: string; player_role: string; batting_hand: string; bowling_style: string;
  photo_url: string | null;
  purchase_price: number; team_name: string; team_color: string;
}

interface PlayerDetail {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  player_role: string;
  batting_hand: string;
  bowling_style: string;
  photo_url: string | null;
  stats: Record<string, { batting?: any; bowling?: any; fielding?: any; mvp?: any }>;
  remarks: Array<{ id: string; remark_type: string; remark: string; created_at: string }>;
}

export default function PlayersPage() {
  const { currentSeasonId } = useSeason();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Selected player inline detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add note
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Owner ratings state
  const [ownerData, setOwnerData] = useState<{
    batting_stars: number | null;
    bowling_stars: number | null;
    fielding_stars: number | null;
    owner_note: string;
  }>({ batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '' });
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerSaved, setOwnerSaved] = useState(false);

  // Ratings map: playerId → owner data
  const [ratingsMap, setRatingsMap] = useState<Record<string, { batting_stars: number | null; bowling_stars: number | null; fielding_stars: number | null; owner_note: string }>>({});

  // Combined edit modal state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', gender: '', player_role: '', batting_hand: '', bowling_style: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [modalRating, setModalRating] = useState<{ batting_stars: number | null; bowling_stars: number | null; fielding_stars: number | null; owner_note: string }>({ batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '' });
  const [modalRatingSaving, setModalRatingSaving] = useState(false);
  const [modalRatingSaved, setModalRatingSaved] = useState(false);

  const openEdit = (p: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({
      first_name: p.first_name, last_name: p.last_name, gender: p.gender || '',
      player_role: p.player_role || '', batting_hand: p.batting_hand || '', bowling_style: p.bowling_style || '',
    });
    // Pre-fill from ratingsMap if available, then fetch fresh
    const cached = ratingsMap[p.id];
    setModalRating(cached ?? { batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '' });
    setModalRatingSaved(false);
    setEditingPlayer(p);
    fetch(`/api/player-owner-data/${p.id}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setModalRating({ batting_stars: d.batting_stars ?? null, bowling_stars: d.bowling_stars ?? null, fielding_stars: d.fielding_stars ?? null, owner_note: d.owner_note || '' }); })
      .catch(() => {});
  };

  const handleModalStarClick = async (key: 'batting_stars' | 'bowling_stars' | 'fielding_stars', star: number) => {
    if (!editingPlayer) return;
    const updated = { ...modalRating, [key]: modalRating[key] === star ? null : star };
    setModalRating(updated);
    setModalRatingSaving(true);
    try {
      await fetch(`/api/player-owner-data/${editingPlayer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      setRatingsMap(prev => ({ ...prev, [editingPlayer.id]: updated }));
      if (selectedId === editingPlayer.id) setOwnerData(updated);
      setModalRatingSaved(true);
      setTimeout(() => setModalRatingSaved(false), 1500);
    } catch (e) { console.error(e); }
    finally { setModalRatingSaving(false); }
  };

  const handleModalNoteSave = async () => {
    if (!editingPlayer) return;
    setModalRatingSaving(true);
    try {
      await fetch(`/api/player-owner-data/${editingPlayer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modalRating) });
      setRatingsMap(prev => ({ ...prev, [editingPlayer.id]: modalRating }));
      if (selectedId === editingPlayer.id) setOwnerData(modalRating);
      setModalRatingSaved(true);
      setTimeout(() => setModalRatingSaved(false), 1500);
    } catch (e) { console.error(e); }
    finally { setModalRatingSaving(false); }
  };

  const handleEditSave = async () => {
    if (!editingPlayer) return;
    setEditSaving(true);
    try {
      await fetch(`/api/players/${editingPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditSaved(true);
      // Update local state
      setPlayers(prev => prev.map(p => p.id === editingPlayer.id ? { ...p, ...editForm } : p));
      // Also update detail if open
      if (detail && detail.id === editingPlayer.id) {
        setDetail(prev => prev ? { ...prev, ...editForm } : prev);
      }
      setTimeout(() => { setEditSaved(false); setEditingPlayer(null); }, 800);
    } catch (e) { console.error(e); }
    finally { setEditSaving(false); }
  };

  useEffect(() => {
    if (!currentSeasonId) return;
    setLoading(true);
    const params = new URLSearchParams({ season_id: currentSeasonId });
    if (search) params.set('search', search);
    if (roleFilter) params.set('player_role', roleFilter);
    fetchJSON<any[]>(`/api/players?${params}`)
      .then(async d => {
        const list = Array.isArray(d) ? d : [];
        setPlayers(list);
        setLoading(false);
        // Bulk-load ratings
        if (list.length) {
          const ids = list.map((p: any) => p.id).join(',');
          const rm = await fetchJSON<Record<string, any>>(`/api/player-owner-data?ids=${ids}`).catch(() => null);
          if (rm) setRatingsMap(rm);
        }
      })
      .catch(() => setLoading(false));
  }, [currentSeasonId, search, roleFilter]);

  // Fetch player detail + owner data when selected
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    setAddingNote(false);
    setNoteText('');
    setOwnerSaved(false);
    setOwnerData({ batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '' });
    fetchJSON<any>(`/api/players/${selectedId}`)
      .then(d => { if (d) setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
    fetchJSON<any>(`/api/player-owner-data/${selectedId}`)
      .then(d => { if (d) setOwnerData({ batting_stars: d.batting_stars ?? null, bowling_stars: d.bowling_stars ?? null, fielding_stars: d.fielding_stars ?? null, owner_note: d.owner_note || '' }); })
      .catch(() => {});
  }, [selectedId]);

  const handleSaveOwnerData = async (updated?: typeof ownerData) => {
    if (!selectedId) return;
    const payload = updated ?? ownerData;
    setOwnerSaving(true);
    try {
      await fetch(`/api/player-owner-data/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setOwnerSaved(true);
      setTimeout(() => setOwnerSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setOwnerSaving(false); }
  };

  const handleStarClick = (key: 'batting_stars' | 'bowling_stars' | 'fielding_stars', star: number) => {
    const updated = { ...ownerData, [key]: ownerData[key] === star ? null : star };
    setOwnerData(updated);
    handleSaveOwnerData(updated);
    if (selectedId) setRatingsMap(prev => ({ ...prev, [selectedId]: updated }));
  };

  const handleRatingSaved = (playerId: string, data: any) => {
    setRatingsMap(prev => ({ ...prev, [playerId]: data }));
    // Also update detail panel ownerData if this player is selected
    if (selectedId === playerId) {
      setOwnerData(data);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedId) return;
    setSavingNote(true);
    try {
      await fetch(`/api/players/${selectedId}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: noteText, remark_type: 'general', season_id: currentSeasonId }),
      });
      // Refresh detail
      const d = await fetchJSON<any>(`/api/players/${selectedId}`);
      if (d) setDetail(d);
      setNoteText('');
      setAddingNote(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  };

  const filtered = players.filter(p => {
    if (genderFilter === 'Female' && p.gender !== 'Female') return false;
    if (genderFilter === 'Male' && p.gender === 'Female') return false;
    return true;
  });

  const roles = ['All-Rounder', 'Batsman', 'Bowler', 'Wicketkeeper'];
  const hasStats = detail && Object.keys(detail.stats || {}).length > 0;
  const hasRemarks = detail && (detail.remarks || []).length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-display text-[#FFD700]">Players</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} players</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search players..." className="pl-9 bg-card border-border" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['', ...roles].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn('px-3 py-1.5 rounded-md text-sm transition-colors',
                roleFilter === r ? 'bg-[#FFD700] text-black font-bold' : 'bg-card border border-border hover:border-[#FFD700]/30')}>
              {r || 'All Roles'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[['', 'All'], ['Male', 'M'], ['Female', 'F']].map(([val, label]) => (
            <button key={val} onClick={() => setGenderFilter(val)}
              className={cn('px-3 py-1.5 rounded-md text-sm transition-colors',
                genderFilter === val ? 'bg-[#FFD700] text-black font-bold' : 'bg-card border border-border hover:border-[#FFD700]/30')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
        </div>
      ) : (
        <div className={cn(
          'grid gap-4',
          selectedId ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : ''
        )}>
          {/* Player Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start">
            {filtered.map(p => (
              <div key={p.id} className="relative group" style={{ position: 'relative' }}>
                <button
                  onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                  className="text-left w-full"
                >
                  <Card className={cn(
                    'bg-card border-border hover:border-[#FFD700]/40 hover:shadow-lg hover:shadow-[#FFD700]/5 transition-all cursor-pointer h-full',
                    selectedId === p.id && 'border-[#FFD700]/60 shadow-lg shadow-[#FFD700]/10 ring-1 ring-[#FFD700]/30'
                  )}>
                    {p.team_color && <div className="h-1 rounded-t-lg" style={{ backgroundColor: p.team_color }} />}
                    <CardContent className="p-3">
                      <div className="w-12 h-12 rounded-full bg-[#1B3A8C] flex items-center justify-center text-lg mb-2 overflow-hidden shrink-0 border border-white/10">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={`${p.first_name} ${p.last_name}`}
                            className="w-full h-full object-cover" />
                        ) : (
                          <span>{p.gender === 'Female' ? '👩' : '👨'}</span>
                        )}
                      </div>
                      <p className="font-semibold text-sm leading-tight mb-1">
                        {p.first_name} {p.last_name}
                      </p>
                      {p.player_role && (
                        <div className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded mb-1', getRoleBadgeColor(p.player_role), 'text-white')}>
                          {getRoleIcon(p.player_role)} {p.player_role}
                        </div>
                      )}
                      {p.team_name && (
                        <p className="text-xs text-muted-foreground truncate">{p.team_name}</p>
                      )}
                      {p.purchase_price > 0 && (
                        <p className="text-xs text-[#FFD700] font-bold mt-1">{formatCurrency(p.purchase_price)}</p>
                      )}
                    </CardContent>
                  </Card>
                </button>
                {/* Single edit button */}
                <button
                  onClick={e => openEdit(p, e)}
                  className={cn(
                    'w-full mt-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    ratingsMap[p.id] && (ratingsMap[p.id].batting_stars != null || ratingsMap[p.id].bowling_stars != null || ratingsMap[p.id].fielding_stars != null)
                      ? 'bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]'
                      : 'bg-card border-border text-muted-foreground hover:border-[#FFD700]/30 hover:text-[#FFD700]/80'
                  )}
                >
                  <Pencil className="w-2.5 h-2.5" />
                  {ratingsMap[p.id]?.batting_stars != null || ratingsMap[p.id]?.bowling_stars != null || ratingsMap[p.id]?.fielding_stars != null ? 'Edit / Rated ★' : 'Edit / Rate'}
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No players found</p>
              </div>
            )}
          </div>

          {/* Inline Player Detail Panel */}
          {selectedId && (
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col sticky top-6 max-h-[calc(100vh-8rem)]">
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FFD700]" />
                </div>
              ) : detail ? (
                <>
                  {/* Panel Header */}
                  <div className="px-4 pt-4 pb-3 border-b border-border flex items-start justify-between shrink-0">
                    <div className="flex items-start gap-3">
                      {/* Player photo */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#1B3A8C] flex items-center justify-center text-2xl border border-white/10">
                        {detail.photo_url ? (
                          <img src={detail.photo_url} alt={`${detail.first_name} ${detail.last_name}`}
                            className="w-full h-full object-cover" />
                        ) : (
                          <span>{detail.gender === 'Female' ? '👩' : '👨'}</span>
                        )}
                      </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-black text-[#FFD700]">
                          {detail.first_name} {detail.last_name}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {detail.player_role && (
                          <Badge className={cn('text-xs text-white border-0', getRoleBadgeColor(detail.player_role))}>
                            {detail.player_role}
                          </Badge>
                        )}
                        {detail.gender && (
                          <span className="text-xs text-muted-foreground">{detail.gender}</span>
                        )}
                        {detail.batting_hand && (
                          <span className="text-xs text-muted-foreground">Bats: {detail.batting_hand}</span>
                        )}
                        {detail.bowling_style && (
                          <span className="text-xs text-muted-foreground">Bowls: {detail.bowling_style}</span>
                        )}
                      </div>
                    </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/players/${detail.id}`}>
                        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-[#FFD700] gap-1">
                          Full Profile <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                      <button
                        onClick={() => setSelectedId(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Historical Stats */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Past Performance</p>
                      {hasStats ? (
                        <div className="space-y-2">
                          {Object.entries(detail.stats).map(([sid, s]) => (
                            <div key={sid} className="bg-background/60 rounded-lg border border-border/50 px-3 py-2">
                              <p className="text-[10px] text-[#FFD700]/80 font-semibold mb-2 uppercase tracking-wide">{sid.startsWith('season-') ? `ZPL ${sid.slice(7)}` : sid}</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                {s.batting && (
                                  <>
                                    <span className="text-muted-foreground">Runs</span>
                                    <span className="font-medium text-blue-400">
                                      {s.batting.total_runs ?? '–'}
                                      <span className="text-muted-foreground font-normal ml-1">
                                        avg {Number(s.batting.average ?? 0).toFixed(1)} · SR {Number(s.batting.strike_rate ?? 0).toFixed(0)}
                                      </span>
                                    </span>
                                    {s.batting.innings != null && (
                                      <>
                                        <span className="text-muted-foreground">Innings</span>
                                        <span className="font-medium">{s.batting.innings}</span>
                                      </>
                                    )}
                                    {s.batting.highest_score != null && (
                                      <>
                                        <span className="text-muted-foreground">High Score</span>
                                        <span className="font-medium">{s.batting.highest_score}</span>
                                      </>
                                    )}
                                  </>
                                )}
                                {s.bowling && (
                                  <>
                                    <span className="text-muted-foreground">Wickets</span>
                                    <span className="font-medium text-red-400">
                                      {s.bowling.total_wickets ?? '–'}
                                      <span className="text-muted-foreground font-normal ml-1">eco {Number(s.bowling.economy ?? 0).toFixed(2)}</span>
                                    </span>
                                    {s.bowling.overs_bowled != null && (
                                      <>
                                        <span className="text-muted-foreground">Overs</span>
                                        <span className="font-medium">{s.bowling.overs_bowled}</span>
                                      </>
                                    )}
                                  </>
                                )}
                                {s.fielding && (s.fielding.catches > 0 || s.fielding.run_outs > 0) && (
                                  <>
                                    <span className="text-muted-foreground">Catches / RO</span>
                                    <span className="font-medium">{s.fielding.catches ?? 0} / {s.fielding.run_outs ?? 0}</span>
                                  </>
                                )}
                                {s.mvp && (
                                  <>
                                    <span className="text-muted-foreground">MVP Score</span>
                                    <span className="font-bold text-[#FFD700]">{Number(s.mvp.total_score ?? 0).toFixed(1)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/70 italic bg-background/40 rounded-md px-3 py-2">
                          New player — no historical stats available.
                        </p>
                      )}
                    </div>

                    {/* ── Owner Ratings ── */}
                    <div className="rounded-xl border border-border/60 bg-background/40 p-3 space-y-2.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Your Assessment</p>
                      {/* Stars */}
                      {([
                        { key: 'batting_stars' as const, icon: '🏏', label: 'Batting' },
                        { key: 'bowling_stars' as const, icon: '🎳', label: 'Bowling' },
                        { key: 'fielding_stars' as const, icon: '🤸', label: 'Fielding' },
                      ]).map(({ key, icon, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[11px] w-20 text-muted-foreground shrink-0">{icon} {label}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <button
                                key={s}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => handleStarClick(key, s)}
                                className="text-[18px] leading-none text-[#FFD700] transition-transform active:scale-125 select-none hover:scale-110"
                              >
                                {(ownerData[key] ?? 0) >= s ? '★' : '☆'}
                              </button>
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            {ownerData[key] != null ? `${ownerData[key]}/5` : '–'}
                          </span>
                        </div>
                      ))}
                      {/* Note */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted-foreground">📝 My Note</label>
                        <div className="flex gap-1.5">
                          <textarea
                            value={ownerData.owner_note}
                            onChange={e => setOwnerData(prev => ({ ...prev, owner_note: e.target.value.slice(0, 300) }))}
                            onBlur={() => handleSaveOwnerData()}
                            placeholder='e.g. "max 50L", "must have", "avoid if price > 40L"…'
                            rows={2}
                            className="flex-1 text-xs bg-background/60 border border-border/60 rounded-md px-2.5 py-1.5 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50 placeholder:text-muted-foreground/40"
                          />
                          <button
                            onClick={() => handleSaveOwnerData()}
                            disabled={ownerSaving}
                            className="self-end text-[10px] px-2 py-1 rounded bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50 shrink-0"
                          >
                            {ownerSaved ? '✓' : ownerSaving ? '…' : 'Save'}
                          </button>
                        </div>
                        <p className="text-[9px] text-muted-foreground/40 text-right">{ownerData.owner_note.length}/300</p>
                      </div>
                    </div>

                    {/* Notes / Remarks */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <StickyNote className="w-3 h-3" /> Admin Notes
                        </p>
                        <button
                          onClick={() => setAddingNote(!addingNote)}
                          className="text-[10px] text-[#FFD700]/70 hover:text-[#FFD700] flex items-center gap-1 transition-colors"
                        >
                          <PlusCircle className="w-3 h-3" /> Add Note
                        </button>
                      </div>

                      {hasRemarks ? (
                        <div className="space-y-1.5">
                          {detail.remarks.map(r => (
                            <div key={r.id} className="bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2 text-xs">
                              <span className="text-amber-400/70 text-[10px] uppercase font-semibold mr-1">[{r.remark_type}]</span>
                              <span className="text-muted-foreground">{r.remark}</span>
                            </div>
                          ))}
                        </div>
                      ) : !addingNote ? (
                        <button
                          onClick={() => setAddingNote(true)}
                          className="w-full text-center text-xs text-muted-foreground/50 hover:text-[#FFD700]/70 border border-dashed border-border hover:border-[#FFD700]/30 rounded-md py-3 transition-colors flex items-center justify-center gap-2"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          No notes yet — click to add a note
                        </button>
                      ) : null}

                      {addingNote && (
                        <div className="mt-2 space-y-2 bg-background/60 rounded-lg border border-border p-3">
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Enter note about this player..."
                            rows={3}
                            className="w-full bg-background border border-border text-xs rounded-md px-2 py-1.5 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveNote}
                              disabled={!noteText.trim() || savingNote}
                              className="flex-1 bg-[#FFD700] text-black hover:bg-[#FFD700]/90 text-xs font-bold"
                            >
                              {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Note'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setAddingNote(false); setNoteText(''); }}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Combined Edit + Rate Modal ── */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingPlayer(null)}>
          <div
            className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h3 className="font-bold text-base text-foreground">{editingPlayer.first_name} {editingPlayer.last_name}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Edit Profile & Ratings</p>
              </div>
              <button onClick={() => setEditingPlayer(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ── Ratings section ── */}
              <div className="px-5 pt-4 pb-3 space-y-3 border-b border-border/60">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span>★</span> Your Assessment
                  {modalRatingSaved && <span className="text-green-400 normal-case font-normal">✓ Saved</span>}
                  {modalRatingSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                </p>
                {([
                  { key: 'batting_stars' as const, icon: '🏏', label: 'Batting' },
                  { key: 'bowling_stars' as const, icon: '🎳', label: 'Bowling' },
                  { key: 'fielding_stars' as const, icon: '🤸', label: 'Fielding' },
                ]).map(({ key, icon, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-20 shrink-0">{icon} {label}</span>
                    <div className="flex gap-1.5 flex-1">
                      {[1,2,3,4,5].map(s => (
                        <button
                          key={s}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleModalStarClick(key, s)}
                          className="text-2xl leading-none text-[#FFD700] hover:scale-110 active:scale-125 transition-transform select-none touch-manipulation"
                        >
                          {(modalRating[key] ?? 0) >= s ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                      {modalRating[key] != null ? `${modalRating[key]}/5` : '–'}
                    </span>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-medium block">📝 Note</label>
                  <div className="flex gap-2">
                    <textarea
                      value={modalRating.owner_note}
                      onChange={e => setModalRating(prev => ({ ...prev, owner_note: e.target.value.slice(0, 300) }))}
                      onBlur={handleModalNoteSave}
                      placeholder='e.g. "max 50L", "must have", "avoid if > 40L"…'
                      rows={2}
                      className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50 placeholder:text-muted-foreground/40"
                    />
                    <button
                      onClick={handleModalNoteSave}
                      disabled={modalRatingSaving}
                      className="self-end px-3 py-2 rounded-lg bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Profile section ── */}
              <div className="px-5 pt-4 pb-3 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">First Name</label>
                    <Input value={editForm.first_name} onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))}
                      className="h-9 text-sm bg-background border-border" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Last Name</label>
                    <Input value={editForm.last_name} onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))}
                      className="h-9 text-sm bg-background border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Gender</label>
                    <select value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}
                      className="w-full h-9 text-sm bg-background border border-border rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Role</label>
                    <select value={editForm.player_role} onChange={e => setEditForm(p => ({ ...p, player_role: e.target.value }))}
                      className="w-full h-9 text-sm bg-background border border-border rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
                      <option value="">Select</option>
                      <option>Batsman</option>
                      <option>Bowler</option>
                      <option>All-Rounder</option>
                      <option>Wicketkeeper</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Batting Hand</label>
                    <select value={editForm.batting_hand} onChange={e => setEditForm(p => ({ ...p, batting_hand: e.target.value }))}
                      className="w-full h-9 text-sm bg-background border border-border rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
                      <option value="">Select</option>
                      <option>Right</option>
                      <option>Left</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Bowling Style</label>
                    <select value={editForm.bowling_style} onChange={e => setEditForm(p => ({ ...p, bowling_style: e.target.value }))}
                      className="w-full h-9 text-sm bg-background border border-border rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]">
                      <option value="">Select</option>
                      <option>Right Arm Fast</option>
                      <option>Right Arm Medium</option>
                      <option>Right Arm Off Break</option>
                      <option>Right Arm Leg Break</option>
                      <option>Left Arm Fast</option>
                      <option>Left Arm Medium</option>
                      <option>Left Arm Orthodox</option>
                      <option>Left Arm Chinaman</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setEditingPlayer(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#FFD700] text-black hover:bg-[#FFD700]/90 font-bold"
                onClick={handleEditSave}
                disabled={editSaving}
              >
                {editSaved ? '✓ Saved!' : editSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving…</> : 'Save Profile'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
