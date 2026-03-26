'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';

interface OwnerData {
  batting_stars: number | null;
  bowling_stars: number | null;
  fielding_stars: number | null;
  owner_note: string;
}

interface Props {
  playerId: string;
  playerName: string;
  onClose: () => void;
  onSaved?: (data: OwnerData) => void;
}

export function PlayerRatingPopup({ playerId, playerName, onClose, onSaved }: Props) {
  const [data, setData] = useState<OwnerData>({ batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/player-owner-data/${playerId}`)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) setData({ batting_stars: d.batting_stars ?? null, bowling_stars: d.bowling_stars ?? null, fielding_stars: d.fielding_stars ?? null, owner_note: d.owner_note || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playerId]);

  const save = async (updated: OwnerData) => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/player-owner-data/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setSaved(true);
      onSaved?.(updated);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleStar = (key: keyof Omit<OwnerData, 'owner_note'>, star: number) => {
    const updated = { ...data, [key]: data[key] === star ? null : star };
    setData(updated);
    save(updated);
  };

  const categories = [
    { key: 'batting_stars' as const, icon: '🏏', label: 'Batting' },
    { key: 'bowling_stars' as const, icon: '🎳', label: 'Bowling' },
    { key: 'fielding_stars' as const, icon: '🤸', label: 'Fielding' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, floating card on desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:absolute sm:bottom-auto sm:left-auto sm:right-auto sm:top-full sm:mt-1 sm:w-72">
        <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Assessment</p>
              <p className="text-sm font-bold text-foreground leading-tight">{playerName}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#FFD700]" />
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Star rows */}
              {categories.map(({ key, icon, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{icon} {label}</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button
                        key={s}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleStar(key, s)}
                        className="text-[22px] leading-none text-[#FFD700] hover:scale-110 active:scale-125 transition-transform select-none"
                      >
                        {(data[key] ?? 0) >= s ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground min-w-[24px]">
                    {data[key] != null ? `${data[key]}/5` : '–'}
                  </span>
                </div>
              ))}

              {/* Divider */}
              <div className="border-t border-border/60" />

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground font-medium">📝 My Note</label>
                <textarea
                  ref={noteRef}
                  value={data.owner_note}
                  onChange={e => setData(prev => ({ ...prev, owner_note: e.target.value.slice(0, 300) }))}
                  onBlur={() => save(data)}
                  placeholder='e.g. "max 50L", "must have", "avoid if price > 40L"…'
                  rows={3}
                  className="w-full text-xs bg-background/60 border border-border/60 rounded-lg px-3 py-2 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50 placeholder:text-muted-foreground/40"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground/40">{data.owner_note.length}/300</span>
                  <button
                    onClick={() => save(data)}
                    disabled={saving}
                    className="text-[11px] px-3 py-1 rounded-md bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50 font-medium"
                  >
                    {saved ? '✓ Saved' : saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
