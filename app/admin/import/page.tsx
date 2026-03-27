'use client';

import { useEffect, useState } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Upload, CheckCircle2, AlertCircle, Loader2, FileText, X,
  ChevronRight, Database, Info, Calendar,
} from 'lucide-react';

const STATS_TYPES = ['batting', 'bowling', 'fielding', 'mvp'];
const SEASON_TYPES = ['registration', 'auction'];

const STAT_YEARS = [2024, 2025, 2026];

const FILE_TYPES = [
  {
    value: 'registration',
    label: 'Player Registration',
    desc: 'XLSX — Player names, gender, group, base price',
    accept: '.xlsx,.xls',
    icon: '📋',
    columns: 'First Name, Last Name (or Name), Gender, Group, Base Price',
  },
  {
    value: 'batting',
    label: 'Batting Stats',
    desc: 'CSV from CricHeroes batting leaderboard',
    accept: '.csv',
    icon: '🏏',
    columns: 'player_id, name, total_runs, innings, average, strike_rate…',
  },
  {
    value: 'bowling',
    label: 'Bowling Stats',
    desc: 'CSV from CricHeroes bowling leaderboard',
    accept: '.csv',
    icon: '⚾',
    columns: 'player_id, name, total_wickets, economy, overs…',
  },
  {
    value: 'fielding',
    label: 'Fielding Stats',
    desc: 'CSV from CricHeroes fielding leaderboard',
    accept: '.csv',
    icon: '🧤',
    columns: 'player_id, name, catches, run_outs, stumpings…',
  },
  {
    value: 'mvp',
    label: 'MVP Scores',
    desc: 'CSV from CricHeroes MVP leaderboard',
    accept: '.csv',
    icon: '⭐',
    columns: 'Player Name, Batting, Bowling, Fielding, Total…',
  },
  {
    value: 'auction',
    label: 'Auction Results',
    desc: 'XLSX — Auction spreadsheet with teams & player prices',
    accept: '.xlsx,.xls',
    icon: '🔨',
    columns: 'Team sheet per tab, Player Name, Purchase Price',
  },
];

interface ImportResult {
  imported: number;
  skipped: number;
  created?: number;
  matched?: number;
  total_registered?: number;
  errors?: string[];
  skipped_names?: string[];
}

export default function ImportPage() {
  const { currentSeasonId, seasons } = useSeason();
  const [fileType, setFileType] = useState('registration');
  const [seasonId, setSeasonId] = useState('');
  const [statYear, setStatYear] = useState<number>(2025);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);

  // Keep seasonId in sync with the context season
  useEffect(() => {
    if (currentSeasonId && !seasonId) setSeasonId(currentSeasonId);
  }, [currentSeasonId]);

  const isStatsType = STATS_TYPES.includes(fileType);
  // The value sent as season_id to the API:
  // - stats types: send the year string (e.g. "2025") — API will auto-find/create
  // - registration/auction: send the full season UUID/id from the dropdown
  const effectiveSeasonId = isStatsType ? String(statYear) : seasonId;

  const handleUpload = async () => {
    if (!file || !fileType || !effectiveSeasonId) return;
    setUploading(true);
    setResult(null);
    setError('');
    setShowSkipped(false);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', fileType);
      form.append('season_id', effectiveSeasonId);
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Import failed');
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const selected = FILE_TYPES.find(t => t.value === fileType)!;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black font-display text-[#FFD700]">Import Data</h1>
        <p className="text-muted-foreground text-sm">Upload CSV or XLSX files to update the database for any season</p>
      </div>

      {/* Step 1 — Select File Type */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFD700] text-black text-xs font-bold flex items-center justify-center">1</span>
            Select File Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FILE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setFileType(t.value); setFile(null); setResult(null); setError(''); }}
                className={cn(
                  'text-left p-3 rounded-lg border transition-all',
                  fileType === t.value
                    ? 'border-[#FFD700] bg-[#FFD700]/10'
                    : 'border-border bg-secondary hover:border-[#FFD700]/30'
                )}
              >
                <p className="font-semibold text-sm flex items-center gap-2">
                  <span>{t.icon}</span> {t.label}
                  {STATS_TYPES.includes(t.value) && (
                    <span className="ml-auto text-[10px] font-normal text-[#FFD700]/60 bg-[#FFD700]/10 px-1.5 py-0.5 rounded">year picker</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Column hint */}
          {selected && (
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-md px-3 py-2 border border-border/50">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#FFD700]/60" />
              <span>Expected columns: <code className="text-[#FFD700]/80">{selected.columns}</code></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — Season or Year picker */}
      <Card className={cn('border', isStatsType ? 'bg-[#FFD700]/5 border-[#FFD700]/30' : 'bg-card border-border')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFD700] text-black text-xs font-bold flex items-center justify-center">2</span>
            {isStatsType ? (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#FFD700]" />
                Select Season Year
                <span className="text-xs font-normal text-[#FFD700]/70">(stats will be linked to this year's season)</span>
              </span>
            ) : 'Select Target Season'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isStatsType ? (
            <div className="flex gap-2">
              {STAT_YEARS.map(year => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setStatYear(year)}
                  className={cn(
                    'flex-1 py-3 rounded-lg border text-sm font-bold transition-all',
                    statYear === year
                      ? 'border-[#FFD700] bg-[#FFD700] text-black'
                      : 'border-border bg-secondary hover:border-[#FFD700]/50 text-foreground'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : (
            <select
              value={seasonId}
              onChange={e => setSeasonId(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            >
              <option value="">Choose a season…</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — Upload File */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFD700] text-black text-xs font-bold flex items-center justify-center">3</span>
            Upload File <span className="text-muted-foreground font-normal">({selected?.accept})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div className={cn(
            'relative overflow-hidden border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            file ? 'border-[#FFD700]/40 bg-[#FFD700]/5' : 'border-border hover:border-[#FFD700]/30 hover:bg-[#FFD700]/5'
          )}>
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-6 h-6 text-[#FFD700]" />
                <div className="text-left">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">Click to select file</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Accepts {selected?.accept}</p>
              </>
            )}
            <input
              type="file"
              key={fileType}
              accept={selected?.accept}
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || (!isStatsType && !seasonId) || uploading}
            className="w-full bg-[#FFD700] text-black hover:bg-[#FFD700]/90 font-bold"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing…</>
              : <><Upload className="w-4 h-4 mr-2" /> Import {selected?.label} {isStatsType ? `(${statYear})` : ''}</>
            }
          </Button>

          {!isStatsType && !seasonId && (
            <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" /> Select a season above before importing
            </p>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-400">Import successful</p>
                <p className="text-sm text-muted-foreground">
                  {result.total_registered != null
                    ? `${result.total_registered} players now registered for this season`
                    : `${result.imported} records imported`}
                  {result.created != null && result.created > 0 && ` · ${result.created} new players created`}
                  {result.skipped > 0 && ` · ${result.skipped} skipped`}
                </p>
              </div>
            </div>

            {result.skipped_names && result.skipped_names.length > 0 && (
              <div>
                <button
                  onClick={() => setShowSkipped(!showSkipped)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ChevronRight className={cn('w-3 h-3 transition-transform', showSkipped && 'rotate-90')} />
                  {result.skipped_names.length} players skipped (no match found)
                </button>
                {showSkipped && (
                  <div className="mt-2 bg-background/60 rounded-md p-2 max-h-40 overflow-y-auto">
                    {result.skipped_names.map((n, i) => (
                      <p key={i} className="text-xs text-muted-foreground py-0.5">{n}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="text-xs text-amber-400 space-y-0.5">
                {result.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Import failed</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reference */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-[#FFD700]" /> Bulk Seed (initial setup)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Copy all 10 source files to <code className="bg-secondary px-1 rounded">data/seed/</code> then run:
          </p>
          <code className="bg-secondary block px-3 py-2 rounded text-sm font-mono">npx tsx scripts/seed.ts</code>
        </CardContent>
      </Card>
    </div>
  );
}
