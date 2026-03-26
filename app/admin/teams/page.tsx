'use client';

import { useEffect, useRef, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload, Save, Loader2, CheckCircle2, AlertCircle, Palette, ImagePlus
} from 'lucide-react';

interface Team {
  id: string;
  name: string;
  short_name: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  logo_url: string | null;
}

interface TeamForm {
  name: string;
  short_name: string;
  color_primary: string;
  color_secondary: string;
  logo_url: string;
}

const DEFAULT_COLORS = [
  '#FFD700', '#1440C0', '#CC1020', '#16A34A', '#9333EA',
  '#F97316', '#06B6D4', '#EC4899', '#84CC16', '#F59E0B',
];

export default function AdminTeamsPage() {
  const { currentSeasonId } = useSeason();
  const [teams, setTeams] = useState<Team[]>([]);
  const [forms, setForms] = useState<Record<string, TeamForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved]   = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!currentSeasonId) return;
    fetch(`/api/teams?season_id=${currentSeasonId}`)
      .then(r => r.json())
      .then((data: Team[]) => {
        setTeams(data);
        const f: Record<string, TeamForm> = {};
        data.forEach(t => {
          f[t.id] = {
            name:            t.name,
            short_name:      t.short_name || '',
            color_primary:   t.color_primary || '#1440C0',
            color_secondary: t.color_secondary || '#FFD700',
            logo_url:        t.logo_url || '',
          };
        });
        setForms(f);
      });
  }, [currentSeasonId]);

  const updateForm = (id: string, key: keyof TeamForm, value: string) => {
    setForms(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    setSaved(prev => ({ ...prev, [id]: false }));
  };

  const handleLogoUpload = async (teamId: string, file: File) => {
    setUploading(prev => ({ ...prev, [teamId]: true }));
    setErrors(prev => ({ ...prev, [teamId]: '' }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'logo');
      fd.append('id', teamId);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateForm(teamId, 'logo_url', data.url);
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [teamId]: e.message }));
    } finally {
      setUploading(prev => ({ ...prev, [teamId]: false }));
    }
  };

  const handleSave = async (teamId: string) => {
    setSaving(prev => ({ ...prev, [teamId]: true }));
    setErrors(prev => ({ ...prev, [teamId]: '' }));
    try {
      const body = forms[teamId];
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(prev => ({ ...prev, [teamId]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [teamId]: false })), 2500);
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [teamId]: e.message }));
    } finally {
      setSaving(prev => ({ ...prev, [teamId]: false }));
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="page-header -mx-6 -mt-6 px-6 pt-6 pb-5 mb-6">
        <h1 className="text-2xl font-black font-display gradient-gold">Team Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload team logos and set brand colors for each team
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No teams found for this season</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {teams.map(team => {
            const form = forms[team.id];
            if (!form) return null;
            return (
              <div key={team.id}
                className="glass-card rounded-xl p-5 space-y-4 hover:border-[#FFD700]/15 transition-all"
                style={{ borderLeft: `3px solid ${form.color_primary}` }}
              >
                {/* Team name + logo preview */}
                <div className="flex items-start gap-4">
                  {/* Logo upload area */}
                  <div
                    className="relative w-20 h-20 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden flex-shrink-0 group transition-all hover:border-[#FFD700]/50"
                    style={{ borderColor: `${form.color_primary}50` }}
                    onClick={() => fileRefs.current[team.id]?.click()}
                  >
                    {form.logo_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.logo_url}
                          alt={form.name}
                          className="absolute inset-0 w-full h-full object-contain p-1"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImagePlus className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        {uploading[team.id]
                          ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          : <>
                              <Upload className="w-5 h-5 text-muted-foreground/50" />
                              <span className="text-[10px] text-muted-foreground/50">Logo</span>
                            </>
                        }
                      </div>
                    )}
                    <input
                      ref={el => { fileRefs.current[team.id] = el; }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(team.id, f);
                      }}
                    />
                  </div>

                  {/* Team info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base truncate" style={{ color: form.color_primary }}>
                      {form.name}
                    </div>
                    <div className="space-y-2 mt-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Short Name</Label>
                        <Input
                          value={form.short_name}
                          onChange={e => updateForm(team.id, 'short_name', e.target.value)}
                          placeholder="e.g. SS"
                          maxLength={6}
                          className="h-7 text-xs mt-0.5 bg-background/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colors */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Palette className="w-3 h-3" /> Primary Color
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.color_primary}
                        onChange={e => updateForm(team.id, 'color_primary', e.target.value)}
                        className="w-8 h-8 rounded-md border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={form.color_primary}
                        onChange={e => updateForm(team.id, 'color_primary', e.target.value)}
                        placeholder="#1440C0"
                        className="h-8 text-xs font-mono flex-1 bg-background/50"
                      />
                    </div>
                    {/* Preset swatches */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {DEFAULT_COLORS.map(c => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: form.color_primary === c ? 'white' : 'transparent',
                          }}
                          onClick={() => updateForm(team.id, 'color_primary', c)}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Palette className="w-3 h-3" /> Secondary Color
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.color_secondary}
                        onChange={e => updateForm(team.id, 'color_secondary', e.target.value)}
                        className="w-8 h-8 rounded-md border border-border cursor-pointer bg-transparent"
                      />
                      <Input
                        value={form.color_secondary}
                        onChange={e => updateForm(team.id, 'color_secondary', e.target.value)}
                        placeholder="#FFD700"
                        className="h-8 text-xs font-mono flex-1 bg-background/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Color preview bar */}
                <div className="flex rounded-lg overflow-hidden h-3">
                  <div className="flex-1" style={{ backgroundColor: form.color_primary }} />
                  <div className="flex-1" style={{ backgroundColor: form.color_secondary }} />
                </div>

                {/* Error */}
                {errors[team.id] && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors[team.id]}
                  </div>
                )}

                {/* Save button */}
                <Button
                  onClick={() => handleSave(team.id)}
                  disabled={saving[team.id]}
                  className="w-full h-9 text-sm font-semibold"
                  style={{
                    background: saved[team.id]
                      ? 'linear-gradient(135deg, #16A34A, #15803D)'
                      : `linear-gradient(135deg, ${form.color_primary}, ${form.color_secondary})`,
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  {saving[team.id] ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                  ) : saved[team.id] ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved!</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Save Team</>
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

// Needed for the empty state icon
function Shield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
