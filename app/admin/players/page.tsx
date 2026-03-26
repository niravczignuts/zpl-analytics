'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload, Save, Loader2, CheckCircle2, AlertCircle,
  Search, UserCircle2, ImagePlus, X, ChevronDown, FileSpreadsheet
} from 'lucide-react';

const PLAYER_ROLES = [
  { value: 'Batsman',      label: '🏏 Batsman',           desc: 'Specialist batter' },
  { value: 'Bowler',       label: '🎯 Bowler',             desc: 'Specialist bowler' },
  { value: 'All-rounder',  label: '⚡ All-rounder',       desc: 'Bats and bowls' },
  { value: 'Wicketkeeper', label: '🧤 Wicketkeeper',      desc: 'WK batter' },
  { value: 'WK-Batsman',   label: '🧤🏏 WK-Batsman',     desc: 'Wicketkeeper batter' },
];

const BATTING_HANDS  = ['Right-handed', 'Left-handed'];
const BOWLING_STYLES = [
  'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin',
  'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin',
  'N/A',
];

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  photo_url: string | null;
  batting_hand: string | null;
  bowling_style: string | null;
  player_role: string | null;
}

interface PlayerForm {
  player_role: string;
  batting_hand: string;
  bowling_style: string;
  photo_url: string;
}

export default function AdminPlayersPage() {
  const { currentSeasonId } = useSeason();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filtered, setFiltered] = useState<Player[]>([]);
  const [search, setSearch]     = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [forms, setForms]       = useState<Record<string, PlayerForm>>({});
  const [saving, setSaving]     = useState<Record<string, boolean>>({});
  const [saved, setSaved]       = useState<Record<string, boolean>>({});
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading]   = useState(true);
  const fileRefs    = useRef<Record<string, HTMLInputElement | null>>({});
  const importRef   = useRef<HTMLInputElement>(null);
  const [importing, setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [importErr, setImportErr]   = useState('');

  const handleBulkImport = async (file: File) => {
    setImporting(true);
    setImportErr('');
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/players/bulk-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data.summary);
      // Refresh player list
      if (currentSeasonId) {
        fetch(`/api/players?season_id=${currentSeasonId}`)
          .then(r => r.json())
          .then((d: Player[]) => {
            setPlayers(d);
            const f: Record<string, PlayerForm> = {};
            d.forEach((p: Player) => {
              f[p.id] = { player_role: p.player_role || '', batting_hand: p.batting_hand || '', bowling_style: p.bowling_style || '', photo_url: p.photo_url || '' };
            });
            setForms(f);
          }).catch(() => {});
      }
    } catch (e: any) {
      setImportErr(e.message);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (!currentSeasonId) return;
    setLoading(true);
    fetch(`/api/players?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then((data: Player[]) => {
        setPlayers(data);
        const f: Record<string, PlayerForm> = {};
        data.forEach(p => {
          f[p.id] = {
            player_role:  p.player_role  || '',
            batting_hand: p.batting_hand || '',
            bowling_style: p.bowling_style || '',
            photo_url:    p.photo_url    || '',
          };
        });
        setForms(f);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentSeasonId]);

  // Filter players by search + gender
  useEffect(() => {
    let list = players;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      );
    }
    if (genderFilter) {
      list = list.filter(p => p.gender === genderFilter);
    }
    setFiltered(list);
  }, [players, search, genderFilter]);

  const updateForm = (id: string, key: keyof PlayerForm, value: string) => {
    setForms(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    setSaved(prev => ({ ...prev, [id]: false }));
  };

  const handlePhotoUpload = async (playerId: string, file: File) => {
    setUploading(prev => ({ ...prev, [playerId]: true }));
    setErrors(prev => ({ ...prev, [playerId]: '' }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'player');
      fd.append('id', playerId);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateForm(playerId, 'photo_url', data.url);
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [playerId]: e.message }));
    } finally {
      setUploading(prev => ({ ...prev, [playerId]: false }));
    }
  };

  const handleSave = async (playerId: string) => {
    setSaving(prev => ({ ...prev, [playerId]: true }));
    setErrors(prev => ({ ...prev, [playerId]: '' }));
    try {
      const body = forms[playerId];
      const res = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Update local player list
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, ...body } : p
      ));
      setSaved(prev => ({ ...prev, [playerId]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [playerId]: false })), 2500);
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [playerId]: e.message }));
    } finally {
      setSaving(prev => ({ ...prev, [playerId]: false }));
    }
  };

  const genderIcon = (g: string | null) => g === 'Female' ? '👩' : '👨';
  const roleColor  = (role: string) => {
    const map: Record<string, string> = {
      'Batsman':      '#22C55E',
      'Bowler':       '#EF4444',
      'All-rounder':  '#FFD700',
      'Wicketkeeper': '#06B6D4',
      'WK-Batsman':   '#8B5CF6',
    };
    return map[role] || '#888';
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="page-header -mx-6 -mt-6 px-6 pt-6 pb-5 mb-2">
        <h1 className="text-2xl font-black font-display gradient-gold">Player Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload player photos and set roles, batting hand & bowling style
        </p>
      </div>

      {/* Bulk Import */}
      <div className="rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/3 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#FFD700]" /> Bulk Import Players
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload CSV or Excel file · Columns: name, gender, player_role, batting_hand, bowling_style, strong_buy, budget_range, jersey_number, age
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleBulkImport(f); e.target.value = ''; }} />
            <Button size="sm" variant="outline" disabled={importing}
              onClick={() => importRef.current?.click()}
              className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 gap-2">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {importing ? 'Importing…' : 'Upload File'}
            </Button>
          </div>
        </div>
        {importResult && (
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Import complete · {importResult.created} created · {importResult.updated} updated · {importResult.skipped} skipped
          </div>
        )}
        {importErr && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {importErr}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players…"
            className="pl-9 h-9 bg-background/50"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={genderFilter}
          onChange={e => setGenderFilter(e.target.value)}
          className="h-9 rounded-lg px-3 text-sm border border-border bg-background/50 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50"
        >
          <option value="">All Genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {players.length} players
        </div>
      </div>

      {/* Player grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 space-y-3 animate-pulse">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-xl bg-muted shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded shimmer w-3/4" />
                  <div className="h-3 bg-muted rounded shimmer w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No players match your search' : 'No players registered for this season'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(player => {
            const form = forms[player.id];
            if (!form) return null;
            const fullName = `${player.first_name} ${player.last_name}`;
            return (
              <div key={player.id}
                className="glass-card rounded-xl p-4 space-y-3 hover:border-[#FFD700]/15 transition-all"
                style={{
                  borderLeft: form.player_role
                    ? `3px solid ${roleColor(form.player_role)}`
                    : '3px solid transparent'
                }}
              >
                {/* Photo + Name */}
                <div className="flex items-start gap-3">
                  {/* Photo upload */}
                  <div
                    className="relative w-16 h-16 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden flex-shrink-0 group transition-all hover:border-[#FFD700]/40"
                    style={{ borderColor: 'oklch(1 0 0 / 12%)' }}
                    onClick={() => fileRefs.current[player.id]?.click()}
                  >
                    {form.photo_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.photo_url}
                          alt={fullName}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImagePlus className="w-4 h-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted/30">
                        {uploading[player.id]
                          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          : <>
                              <span className="text-xl">{genderIcon(player.gender)}</span>
                              <Upload className="w-3 h-3 text-muted-foreground/50" />
                            </>
                        }
                      </div>
                    )}
                    <input
                      ref={el => { fileRefs.current[player.id] = el; }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoUpload(player.id, f);
                      }}
                    />
                  </div>

                  {/* Name + gender */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{fullName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {genderIcon(player.gender)} {player.gender || 'Unknown'}
                    </div>
                    {form.player_role && (
                      <span
                        className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${roleColor(form.player_role)}22`,
                          color: roleColor(form.player_role),
                          border: `1px solid ${roleColor(form.player_role)}40`,
                        }}
                      >
                        {form.player_role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role selector */}
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Player Role
                  </Label>
                  <div className="grid grid-cols-1 gap-1 mt-1.5">
                    {PLAYER_ROLES.map(r => (
                      <button
                        key={r.value}
                        onClick={() => updateForm(player.id, 'player_role', r.value)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left"
                        style={{
                          background: form.player_role === r.value
                            ? `${roleColor(r.value)}18`
                            : 'transparent',
                          border: `1px solid ${form.player_role === r.value ? roleColor(r.value) + '50' : 'transparent'}`,
                          color: form.player_role === r.value ? roleColor(r.value) : undefined,
                        }}
                      >
                        <span className="text-sm">{r.label.split(' ')[0]}</span>
                        <span className="flex-1 font-medium">{r.value}</span>
                        <span className="text-muted-foreground text-[10px]">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Batting hand */}
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Batting Hand
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    {BATTING_HANDS.map(h => (
                      <button
                        key={h}
                        onClick={() => updateForm(player.id, 'batting_hand', h)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: form.batting_hand === h
                            ? 'linear-gradient(135deg, #1440C0, #2A52C0)'
                            : 'transparent',
                          border: `1px solid ${form.batting_hand === h ? '#1440C0' : 'oklch(1 0 0 / 10%)'}`,
                          color: form.batting_hand === h ? '#fff' : undefined,
                        }}
                      >
                        {h === 'Right-handed' ? '🏏 Right' : '🏏 Left'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bowling style */}
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Bowling Style
                  </Label>
                  <select
                    value={form.bowling_style}
                    onChange={e => updateForm(player.id, 'bowling_style', e.target.value)}
                    className="w-full mt-1.5 h-8 rounded-lg px-2.5 text-xs border border-border bg-background/50 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50"
                  >
                    <option value="">— Select —</option>
                    {BOWLING_STYLES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Error */}
                {errors[player.id] && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-2.5 py-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors[player.id]}
                  </div>
                )}

                {/* Save button */}
                <Button
                  onClick={() => handleSave(player.id)}
                  disabled={saving[player.id]}
                  className="w-full h-8 text-xs font-semibold"
                  style={{
                    background: saved[player.id]
                      ? 'linear-gradient(135deg, #16A34A, #15803D)'
                      : `linear-gradient(135deg, ${roleColor(form.player_role || '')}cc, ${roleColor(form.player_role || '')}88)`,
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  {saving[player.id] ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
                  ) : saved[player.id] ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Saved!</>
                  ) : (
                    <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Player</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
