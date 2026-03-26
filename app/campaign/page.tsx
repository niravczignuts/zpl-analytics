'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Megaphone, Sparkles, Upload, X, Copy, Download,
  TrendingUp, BarChart3, Zap, Globe, Hash, Video,
  Star, RefreshCw, Settings, Eye, ThumbsUp,
  MessageCircle, Share2, Loader2, AlertCircle,
  CheckCircle, Plus, ChevronDown, ChevronUp,
  BookOpen, Flame, Check, ArrowRight, Camera, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SFX, unlockAudio } from '@/lib/sounds';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandMemory {
  teamName: string;
  teamNickname: string;
  primaryColor: string;
  tone: string[];
  playerNames: string;
  seasonContext: string;
  accountHandle: string;
}

interface Concept {
  id: string;
  title: string;
  angle: string;
  format: string;
  tone: string;
  caption: string;
  hashtags: string[];
  storyVersion: string;
  reelScript: string;
  imagePrompt: string;
  imageUrls: string[];
  engagementPrediction: 'High' | 'Medium' | 'Low';
  whyItWorks: string;
}

interface MarketContext {
  trendingHashtags: string[];
  keyInsights: string;
}

interface SavedPost {
  id: string;
  date: string;
  brief: string;
  concept: Concept;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['brief', 'concepts', 'ready', 'dashboard'] as const;
type Tab = (typeof TABS)[number];

const STORAGE_BRAND = 'zpl_campaign_brand';
const STORAGE_POSTS = 'zpl_campaign_posts';

const DEFAULT_BRAND: BrandMemory = {
  teamName: 'Super Smashers',
  teamNickname: 'The Smashers',
  primaryColor: '#FFD700',
  tone: ['inspirational', 'aggressive'],
  playerNames: '',
  seasonContext: 'ZPL 2025 Season',
  accountHandle: '@supersmasherscricket',
};

const TONE_OPTIONS = ['inspirational', 'aggressive', 'fun', 'dramatic', 'hype'];

const PRED_COLOR: Record<string, string> = {
  High: '#22C55E',
  Medium: '#FFD700',
  Low: '#FF4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadBrand(): BrandMemory {
  try {
    const s = localStorage.getItem(STORAGE_BRAND);
    return s ? { ...DEFAULT_BRAND, ...JSON.parse(s) } : DEFAULT_BRAND;
  } catch { return DEFAULT_BRAND; }
}

function loadPosts(): SavedPost[] {
  try {
    const s = localStorage.getItem(STORAGE_POSTS);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function savePosts(posts: SavedPost[]) {
  localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onChange, hasResult }: {
  active: Tab; onChange: (t: Tab) => void; hasResult: boolean;
}) {
  const labels: Record<Tab, { label: string; icon: React.ReactNode }> = {
    brief:     { label: 'Brief',     icon: <Megaphone className="w-3.5 h-3.5" /> },
    concepts:  { label: 'Concepts',  icon: <Sparkles className="w-3.5 h-3.5" /> },
    ready:     { label: 'Ready',     icon: <CheckCircle className="w-3.5 h-3.5" /> },
    dashboard: { label: 'Dashboard', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  };
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {TABS.map(t => {
        const locked = (t === 'concepts' || t === 'ready') && !hasResult;
        return (
          <button
            key={t}
            disabled={locked}
            onClick={() => { unlockAudio(); SFX.click(); onChange(t); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
              active === t
                ? 'text-[#060D28]'
                : locked
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/50 hover:text-white/80',
            )}
            style={active === t ? {
              background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 100%)',
              boxShadow: '0 2px 12px rgba(255,215,0,0.35)',
            } : {}}
          >
            {labels[t].icon}
            <span className="hidden sm:inline">{labels[t].label}</span>
          </button>
        );
      })}
    </div>
  );
}

function GlassCard({ children, className, style, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      className={cn('rounded-2xl border', className)}
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        borderColor: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    unlockAudio(); SFX.success();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,215,0,0.1)',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,215,0,0.25)'}`,
        color: copied ? '#22C55E' : '#FFD700',
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Format-specific composite layouts ───────────────────────────────────────

const FORMAT_COMPOSITE: Record<string, {
  bgFilter: string;
  overlayPosition: string;
  overlaySize: string;
  overlayShape: string;
  overlayBlend: string;
  overlayBorder: string;
  accentColor: string;
  treatment: React.CSSProperties;
}> = {
  'Cinematic Recap': {
    bgFilter: 'brightness(0.55) contrast(1.15) saturate(0.9)',
    overlayPosition: 'inset-0',
    overlaySize: 'w-full h-full',
    overlayShape: '',
    overlayBlend: 'mix-blend-luminosity opacity-55',
    overlayBorder: '',
    accentColor: '#FFD700',
    treatment: { background: 'linear-gradient(180deg,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.65) 100%)' },
  },
  'Player Spotlight': {
    bgFilter: 'brightness(0.25) blur(6px) saturate(0.6)',
    overlayPosition: 'inset-0 flex items-center justify-center',
    overlaySize: 'w-[62%] h-[62%]',
    overlayShape: 'rounded-full',
    overlayBlend: '',
    overlayBorder: 'border-[3px] border-[#FFD700]',
    accentColor: '#FFD700',
    treatment: { background: 'radial-gradient(ellipse 70% 70% at 50% 50%,rgba(255,215,0,0.06) 0%,transparent 70%)' },
  },
  'Fan Energy Hype': {
    bgFilter: 'brightness(0.75) saturate(1.5)',
    overlayPosition: 'bottom-3 right-3',
    overlaySize: 'w-[38%] h-[38%]',
    overlayShape: 'rounded-xl',
    overlayBlend: '',
    overlayBorder: 'border-2 border-white',
    accentColor: '#FF4444',
    treatment: { background: 'linear-gradient(135deg,rgba(255,68,68,0.18) 0%,transparent 60%,rgba(0,0,0,0.5) 100%)' },
  },
  'Stats-Led': {
    bgFilter: 'brightness(0.4) saturate(0.4)',
    overlayPosition: 'top-3 left-3',
    overlaySize: 'w-[40%] h-[40%]',
    overlayShape: 'rounded-lg',
    overlayBlend: '',
    overlayBorder: 'border-2 border-[#06B6D4]',
    accentColor: '#06B6D4',
    treatment: { background: 'linear-gradient(135deg,transparent 40%,rgba(6,182,212,0.12) 100%)' },
  },
  'Behind the Scenes': {
    bgFilter: 'brightness(0.6) saturate(0.8)',
    overlayPosition: 'bottom-3 left-3',
    overlaySize: 'w-[36%] h-[36%]',
    overlayShape: 'rounded-lg',
    overlayBlend: '',
    overlayBorder: 'border-4 border-white',
    accentColor: '#22C55E',
    treatment: { background: 'linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,0.7) 100%)' },
  },
  'Motivational': {
    bgFilter: 'brightness(0.6) saturate(1.3) sepia(0.25)',
    overlayPosition: 'inset-0',
    overlaySize: 'w-full h-full',
    overlayShape: '',
    overlayBlend: 'mix-blend-overlay opacity-40',
    overlayBorder: '',
    accentColor: '#F97316',
    treatment: { background: 'linear-gradient(180deg,rgba(249,115,22,0.15) 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.6) 100%)' },
  },
};

const DEFAULT_COMPOSITE = FORMAT_COMPOSITE['Cinematic Recap'];

// ─── ConceptImage: cricket background + uploaded image composite ──────────────

function ConceptImage({ url, format, uploadedPreview, className, imagePrompt }: {
  url: string;
  format?: string;
  uploadedPreview?: string;
  className?: string;
  imagePrompt?: string;
}) {
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgError, setBgError] = useState(false);
  const cfg = FORMAT_COMPOSITE[format || ''] || DEFAULT_COMPOSITE;

  useEffect(() => { setBgLoaded(false); setBgError(false); }, [url]);

  const isFullOverlay = cfg.overlayPosition === 'inset-0' || cfg.overlayPosition === 'inset-0 flex items-center justify-center';
  const isSpotlight = format === 'Player Spotlight';

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[#060D28]', className)}>

      {/* ── Loading ── */}
      {!bgLoaded && !bgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#FFD700] animate-spin" />
          <span className="text-[10px] text-white/30">Loading…</span>
        </div>
      )}

      {/* ── Layer 1: Cricket background photo ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="cricket background"
        className={cn('absolute inset-0 w-full h-full object-cover transition-opacity duration-700', bgLoaded ? 'opacity-100' : 'opacity-0')}
        style={{ filter: cfg.bgFilter }}
        onLoad={() => setBgLoaded(true)}
        onError={() => setBgError(true)}
        crossOrigin="anonymous"
      />

      {/* ── Error fallback ── */}
      {bgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#060D28,#0a1535)' }}>
          <div className="text-4xl">🏏</div>
          <span className="text-[10px] text-white/25">Cricket content</span>
        </div>
      )}

      {/* ── Layer 2: Uploaded image composited per format ── */}
      {uploadedPreview && bgLoaded && (
        <>
          {isSpotlight ? (
            /* Circular spotlight with gold ring glow */
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Gold glow ring behind image */}
                <div className="absolute inset-[-8px] rounded-full"
                  style={{ background: `radial-gradient(circle,${cfg.accentColor}50 0%,transparent 70%)`, filter: 'blur(8px)' }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedPreview} alt="your photo"
                  className={cn('relative z-10 object-cover', cfg.overlaySize, cfg.overlayShape, cfg.overlayBorder)}
                  style={{ boxShadow: `0 0 32px ${cfg.accentColor}80, 0 0 64px ${cfg.accentColor}30` }}
                />
              </div>
            </div>
          ) : isFullOverlay ? (
            /* Full-frame blend overlay */
            <div className={cn('absolute', cfg.overlayPosition)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedPreview} alt="your photo"
                className={cn('object-cover', cfg.overlaySize, cfg.overlayShape, cfg.overlayBlend)}
              />
            </div>
          ) : (
            /* Corner / panel card */
            <div className={cn('absolute', cfg.overlayPosition)}>
              <div className="relative w-full h-full">
                {/* Accent shadow behind card */}
                <div className="absolute inset-0 rounded-xl"
                  style={{ boxShadow: `0 8px 32px ${cfg.accentColor}60, 0 2px 8px rgba(0,0,0,0.6)`, transform: 'scale(1.06)', borderRadius: 'inherit' }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadedPreview} alt="your photo"
                  className={cn('relative z-10 w-full h-full object-cover', cfg.overlayShape, cfg.overlayBorder)}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Layer 3: Format treatment (gradient/vignette) ── */}
      <div className="absolute inset-0 pointer-events-none z-20" style={cfg.treatment} />

      {/* ── Layer 4: Accent color corner flash ── */}
      <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none z-20"
        style={{ background: `radial-gradient(circle at top right,${cfg.accentColor}20 0%,transparent 70%)` }} />

      {/* ── Bottom gradient for badge readability ── */}
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-20"
        style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.6) 0%,transparent 100%)' }} />

      {/* ── No image hint ── */}
      {!uploadedPreview && bgLoaded && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
          <span className="text-[9px] text-white/25 bg-black/40 px-2 py-0.5 rounded-full">
            Upload a photo to composite
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Brand Setup Modal ────────────────────────────────────────────────────────

function BrandSetupModal({ brand, onSave, onClose }: {
  brand: BrandMemory;
  onSave: (b: BrandMemory) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BrandMemory>(brand);
  const set = (k: keyof BrandMemory, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleTone = (t: string) => {
    set('tone', form.tone.includes(t) ? form.tone.filter(x => x !== t) : [...form.tone, t]);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#060D28' }}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="font-black text-lg text-[#FFD700]">Brand Setup</h2>
            <p className="text-xs text-white/40 mt-0.5">One-time setup — saved to your device</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 block">Team Name</label>
              <input value={form.teamName} onChange={e => set('teamName', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/40" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 block">Nickname</label>
              <input value={form.teamNickname} onChange={e => set('teamNickname', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 block">Instagram Handle</label>
              <input value={form.accountHandle} onChange={e => set('accountHandle', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/40" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 block">Season Context</label>
              <input value={form.seasonContext} onChange={e => set('seasonContext', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/40" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 block">Key Players (comma-separated)</label>
            <input value={form.playerNames} onChange={e => set('playerNames', e.target.value)}
              placeholder="Virat, Rohit, Dhoni..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/40 placeholder:text-white/20" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-widest mb-2 block">Tone of Voice</label>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map(t => (
                <button key={t} onClick={() => toggleTone(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                  style={{
                    background: form.tone.includes(t) ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${form.tone.includes(t) ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: form.tone.includes(t) ? '#FFD700' : 'rgba(255,255,255,0.5)',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white border border-white/10 hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose(); unlockAudio(); SFX.success(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#060D28] transition-all"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFC200)' }}
          >
            Save Brand
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Concept Card ─────────────────────────────────────────────────────────────

function ConceptCard({
  concept, approved, onApprove, selectedImg, onToggleImg, uploadedPreview,
}: {
  concept: Concept;
  approved: boolean;
  onApprove: () => void;
  selectedImg: number;
  onToggleImg: () => void;
  uploadedPreview?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const formatBadgeColor = {
    'Cinematic Recap': '#A855F7',
    'Player Spotlight': '#22C55E',
    'Fan Energy Hype': '#FF4444',
    'Stats-Led': '#06B6D4',
    'Behind the Scenes': '#F97316',
    'Motivational': '#FFD700',
  }[concept.format] || '#FFD700';

  return (
    <div
      className="flex flex-col rounded-2xl border overflow-hidden transition-all duration-300"
      style={{
        borderColor: approved ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.07)',
        background: approved
          ? 'linear-gradient(180deg, rgba(255,215,0,0.06) 0%, rgba(255,215,0,0.02) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: approved ? '0 0 30px rgba(255,215,0,0.15)' : 'none',
      }}
    >
      {/* Image */}
      <div className="relative">
        <ConceptImage
          url={concept.imageUrls?.[selectedImg] ?? ''}
          format={concept.format}
          uploadedPreview={uploadedPreview}
          className="w-full aspect-square"
          imagePrompt={concept.imagePrompt}
        />
        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[#060D28]"
            style={{ background: formatBadgeColor }}>
            {concept.format}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: PRED_COLOR[concept.engagementPrediction] + '30', color: PRED_COLOR[concept.engagementPrediction], border: `1px solid ${PRED_COLOR[concept.engagementPrediction]}50` }}>
            {concept.engagementPrediction} reach
          </span>
        </div>
        {/* Concept ID badge */}
        <div className="absolute bottom-2 left-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
            style={{ background: '#FFD700', color: '#060D28' }}>
            {concept.id}
          </span>
        </div>
        {/* Alt image toggle */}
        {concept.imageUrls?.length > 1 && (
          <button onClick={onToggleImg}
            className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[10px] font-semibold text-white/70 hover:text-white transition-all"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            Alt image
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <h3 className="font-black text-base text-white">{concept.title}</h3>
          <p className="text-xs text-white/50 mt-0.5 italic">{concept.angle}</p>
        </div>

        {/* Tone chip */}
        <span className="self-start px-2 py-0.5 rounded-md text-[10px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
          {concept.tone}
        </span>

        {/* Caption preview */}
        <p className="text-xs text-white/60 leading-relaxed line-clamp-3">
          {concept.caption}
        </p>

        {/* Hashtag count */}
        <div className="flex items-center gap-1 text-xs text-white/40">
          <Hash className="w-3 h-3" />
          <span>{concept.hashtags?.length || 0} hashtags</span>
          <span className="mx-1">·</span>
          <Zap className="w-3 h-3 text-[#FFD700]" />
          <span className="text-[#FFD700] font-semibold">{concept.whyItWorks?.slice(0, 50)}…</span>
        </div>

        {/* Expand / collapse */}
        <button
          onClick={() => { setExpanded(e => !e); unlockAudio(); SFX.click(); }}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-all self-start"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less' : 'Full package'}
        </button>

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            {/* Full caption */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Caption</span>
                <CopyButton text={concept.caption} label="Copy" />
              </div>
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap bg-white/3 rounded-lg p-2.5">
                {concept.caption}
              </p>
            </div>

            {/* Story */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Story Version</span>
                <CopyButton text={concept.storyVersion} label="Copy" />
              </div>
              <p className="text-xs text-white/70 bg-white/3 rounded-lg p-2.5">{concept.storyVersion}</p>
            </div>

            {/* Reel script */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Reel Script (15s)</span>
                <CopyButton text={concept.reelScript} label="Copy" />
              </div>
              <p className="text-xs text-white/70 bg-white/3 rounded-lg p-2.5 whitespace-pre-wrap">{concept.reelScript}</p>
            </div>

            {/* Hashtags */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Hashtags</span>
                <CopyButton text={concept.hashtags?.map(h => `#${h}`).join(' ') ?? ''} label="Copy all" />
              </div>
              <div className="flex flex-wrap gap-1">
                {concept.hashtags?.map(h => (
                  <span key={h} className="px-1.5 py-0.5 rounded text-[10px] text-white/50"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    #{h}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Approve button */}
        <button
          onClick={() => { onApprove(); unlockAudio(); SFX.success(); }}
          className="mt-auto w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
          style={approved ? {
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
          } : {
            background: 'linear-gradient(135deg, #FFD700, #FFC200)',
            color: '#060D28',
            boxShadow: '0 4px 16px rgba(255,215,0,0.25)',
          }}
        >
          {approved ? '✓ Approved' : 'Approve This Concept'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignPage() {
  const [activeTab, setActiveTab] = useState<Tab>('brief');
  const [brand, setBrand] = useState<BrandMemory>(DEFAULT_BRAND);
  const [showBrandSetup, setShowBrandSetup] = useState(false);
  const [brief, setBrief] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; type: string; preview: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState<Record<string, number>>({});
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [saving, setSaving] = useState(false);
  const [engagementForm, setEngagementForm] = useState<Record<string, { likes: string; comments: string; shares: string; reach: string }>>({});
  const [showInsights, setShowInsights] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load persisted data
  useEffect(() => {
    setBrand(loadBrand());
    setSavedPosts(loadPosts());
  }, []);

  const saveBrand = (b: BrandMemory) => {
    setBrand(b);
    localStorage.setItem(STORAGE_BRAND, JSON.stringify(b));
  };

  const approvedConcept = concepts.find(c => c.id === approvedId) || null;

  // ── Image upload ────────────────────────────────────────────────────────────

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setUploadedImage({ base64, type: file.type, preview: dataUrl });
      unlockAudio(); SFX.success();
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!brief.trim()) return;
    setGenerating(true);
    setGenError('');
    setConcepts([]);
    setApprovedId(null);
    unlockAudio(); SFX.powerUp?.();

    const pastPerformance = savedPosts
      .filter(p => p.likes)
      .map(p => ({
        format: p.concept.format,
        engagementPrediction: p.concept.engagementPrediction,
        likes: p.likes,
        comments: p.comments,
      }));

    try {
      const res = await fetch('/api/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          brandMemory: brand,
          pastPerformance,
          imageBase64: uploadedImage?.base64 || null,
          imageType: uploadedImage?.type || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setMarketContext(data.marketContext || null);
      setConcepts(data.concepts || []);
      setActiveTab('concepts');
      unlockAudio(); SFX.trophy?.();
    } catch (err: any) {
      setGenError(err.message);
      unlockAudio(); SFX.error();
    } finally {
      setGenerating(false);
    }
  };

  // ── Save to dashboard ───────────────────────────────────────────────────────

  const handleSave = () => {
    if (!approvedConcept) return;
    setSaving(true);
    const post: SavedPost = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      brief: brief.slice(0, 120),
      concept: approvedConcept,
    };
    const updated = [post, ...savedPosts];
    setSavedPosts(updated);
    savePosts(updated);
    setSaving(false);
    setActiveTab('dashboard');
    unlockAudio(); SFX.success();
  };

  const handleEngagementSave = (postId: string) => {
    const form = engagementForm[postId];
    if (!form) return;
    const updated = savedPosts.map(p =>
      p.id === postId
        ? { ...p, likes: +form.likes || 0, comments: +form.comments || 0, shares: +form.shares || 0, reach: +form.reach || 0 }
        : p
    );
    setSavedPosts(updated);
    savePosts(updated);
    unlockAudio(); SFX.success();
  };

  const deletePost = (postId: string) => {
    const updated = savedPosts.filter(p => p.id !== postId);
    setSavedPosts(updated);
    savePosts(updated);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        <div>
          <h1 className="text-2xl font-black font-display flex items-center gap-2.5"
            style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FF6B35 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            <Megaphone className="w-7 h-7 text-[#FFD700]" />
            Campaign Creator
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI-powered · Market-aware · One click to viral
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBrandSetup(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/50 hover:text-white transition-all border border-white/10 hover:bg-white/5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Brand Setup</span>
          </button>
          <TabBar active={activeTab} onChange={setActiveTab} hasResult={concepts.length > 0} />
        </div>
      </div>

      {/* ── Brand Banner (if default) ── */}
      {brand.teamName === DEFAULT_BRAND.teamName && activeTab === 'brief' && (
        <GlassCard className="p-3 flex items-center gap-3 cursor-pointer hover:border-[#FFD700]/30 transition-all"
          style={{ borderColor: 'rgba(255,215,0,0.2)' }}
          onClick={() => setShowBrandSetup(true)}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,215,0,0.15)' }}>
            <Star className="w-4 h-4 text-[#FFD700]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#FFD700]">Set up your team brand</p>
            <p className="text-xs text-white/40">Add team name, players, and tone for better AI generation</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/30 shrink-0" />
        </GlassCard>
      )}

      {/* ════════════════════════════════ BRIEF TAB ════════════════════════════════ */}
      {activeTab === 'brief' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main input */}
          <div className="lg:col-span-2 space-y-4">
            <GlassCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#FFD700]" />
                <span className="text-sm font-bold text-white">Today&apos;s Brief</span>
                <span className="text-xs text-white/30">— paste stats, describe a moment, type your idea</span>
              </div>

              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder={`Examples:\n• We won by 6 wickets chasing 134. Rohit hit 3 sixes in the last over.\n• Celebrating our captain's 100th match. He's scored 1200 runs for us.\n• Match preview vs Thunder XI tomorrow at 3pm.\n• Post-loss motivational — we fight back next week.`}
                rows={7}
                className="w-full bg-white/3 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-[#FFD700]/30 resize-none leading-relaxed"
              />

              {/* Image upload */}
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="relative rounded-xl border border-dashed border-white/15 hover:border-[#FFD700]/30 transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                {uploadedImage ? (
                  <div className="flex items-center gap-3 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadedImage.preview} alt="Upload" className="w-14 h-14 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white/70">Image uploaded</p>
                      <p className="text-[10px] text-white/30">AI will use this as visual anchor</p>
                    </div>
                    <button onClick={() => setUploadedImage(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 py-5 cursor-pointer">
                    <Upload className="w-5 h-5 text-white/25" />
                    <span className="text-xs text-white/30">Drag & drop image or <span className="text-[#FFD700]/60 underline">browse</span></span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
                  </label>
                )}
              </div>

              {genError && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', color: '#FF6B6B' }}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {genError}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || !brief.trim()}
                className="w-full py-3.5 rounded-xl font-black text-base transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FF6B35 100%)',
                  color: '#060D28',
                  boxShadow: generating ? 'none' : '0 4px 24px rgba(255,215,0,0.35)',
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Researching market + Generating 3 concepts…
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5" />
                    Generate Campaign
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </GlassCard>
          </div>

          {/* Info panel */}
          <div className="space-y-3">
            <GlassCard className="p-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Intelligence Loop</p>
              {[
                { icon: <Globe className="w-3.5 h-3.5" />, color: '#06B6D4', text: 'Live web search — trending hashtags & formats today' },
                { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#A855F7', text: '3 completely different creative concepts, not variations' },
                { icon: <Camera className="w-3.5 h-3.5" />, color: '#F97316', text: 'Your uploaded photo composited onto cricket background per concept format' },
                { icon: <BookOpen className="w-3.5 h-3.5" />, color: '#22C55E', text: 'Full post: caption + story + reel script + hashtags' },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, color: '#FFD700', text: 'Learns from your past posts to bias future generation' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-2.5 last:mb-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: item.color + '20', color: item.color }}>
                    {item.icon}
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </GlassCard>

            <GlassCard className="p-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">What you can give it</p>
              {[
                ['Stats only', 'Full creative brief from scratch'],
                ['Text idea', 'Expands into 3 different concepts'],
                ['Image only', 'Builds concept around your visual'],
                ['Stats + image', 'Uses image as anchor, stats as story'],
                ['Anything', 'Always gets market research first'],
              ].map(([input, output]) => (
                <div key={input} className="flex items-center justify-between mb-2 last:mb-0">
                  <span className="text-[11px] font-semibold text-[#FFD700]">{input}</span>
                  <span className="text-[10px] text-white/35 text-right max-w-[55%]">{output}</span>
                </div>
              ))}
            </GlassCard>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ CONCEPTS TAB ════════════════════════════ */}
      {activeTab === 'concepts' && (
        <div className="space-y-4">
          {/* Market context banner */}
          {marketContext && (
            <GlassCard className="p-4" style={{ borderColor: 'rgba(6,182,212,0.2)' }}>
              <button
                onClick={() => setShowInsights(i => !i)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#06B6D4]" />
                  <span className="text-sm font-bold text-[#06B6D4]">Live Market Intelligence</span>
                  <span className="text-xs text-white/30">— searched before generating</span>
                </div>
                {showInsights ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
              </button>
              {showInsights && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                  <p className="text-xs text-white/60 leading-relaxed">{marketContext.keyInsights}</p>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Trending Hashtags Found</p>
                    <div className="flex flex-wrap gap-1.5">
                      {marketContext.trendingHashtags?.map(h => (
                        <span key={h} className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: 'rgba(6,182,212,0.12)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)' }}>
                          #{h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Regenerate button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/50">
              {approvedId ? '✓ Concept approved — go to Ready tab' : 'Review all 3 concepts, then approve one'}
            </p>
            <div className="flex gap-2">
              {approvedId && (
                <button
                  onClick={() => setActiveTab('ready')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: '#fff', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
                >
                  Go to Ready <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { setActiveTab('brief'); unlockAudio(); SFX.click(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>

          {/* 3 concept cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {concepts.map(concept => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                approved={approvedId === concept.id}
                onApprove={() => setApprovedId(approvedId === concept.id ? null : concept.id)}
                selectedImg={selectedImgIdx[concept.id] ?? 0}
                onToggleImg={() => setSelectedImgIdx(prev => ({ ...prev, [concept.id]: (prev[concept.id] ?? 0) === 0 ? 1 : 0 }))}
                uploadedPreview={uploadedImage?.preview}
              />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════ READY TAB ═══════════════════════════════ */}
      {activeTab === 'ready' && (
        <div className="space-y-4">
          {!approvedConcept ? (
            <GlassCard className="p-12 text-center">
              <CheckCircle className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No concept approved yet</p>
              <button onClick={() => setActiveTab('concepts')} className="mt-3 text-[#FFD700] text-sm underline">
                Go back to concepts
              </button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: image */}
              <div className="space-y-3">
                <GlassCard className="overflow-hidden">
                  <ConceptImage
                    url={approvedConcept.imageUrls?.[selectedImgIdx[approvedConcept.id] ?? 0] ?? ''}
                    format={approvedConcept.format}
                    uploadedPreview={uploadedImage?.preview}
                    className="w-full aspect-square"
                    imagePrompt={approvedConcept.imagePrompt}
                  />
                </GlassCard>
                <div className="flex gap-2">
                  {approvedConcept.imageUrls?.map((url, i) => (
                    <button key={i}
                      onClick={() => setSelectedImgIdx(prev => ({ ...prev, [approvedConcept.id]: i }))}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                      style={{
                        borderColor: (selectedImgIdx[approvedConcept.id] ?? 0) === i ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)',
                        background: (selectedImgIdx[approvedConcept.id] ?? 0) === i ? 'rgba(255,215,0,0.1)' : 'transparent',
                        color: (selectedImgIdx[approvedConcept.id] ?? 0) === i ? '#FFD700' : 'rgba(255,255,255,0.4)',
                      }}>
                      Image {i + 1}
                    </button>
                  ))}
                </div>
                <a
                  href={approvedConcept.imageUrls?.[selectedImgIdx[approvedConcept.id] ?? 0]}
                  download="campaign-image.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download Image
                </a>

                {/* Concept meta */}
                <GlassCard className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Format</span>
                    <span className="text-xs font-semibold text-white/70">{approvedConcept.format}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Tone</span>
                    <span className="text-xs font-semibold text-white/70">{approvedConcept.tone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Predicted reach</span>
                    <span className="text-xs font-bold" style={{ color: PRED_COLOR[approvedConcept.engagementPrediction] }}>
                      {approvedConcept.engagementPrediction}
                    </span>
                  </div>
                </GlassCard>
              </div>

              {/* Right: copy blocks */}
              <div className="lg:col-span-2 space-y-3">
                {/* Caption */}
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#FFD700]" />
                      <span className="text-sm font-bold text-white">Instagram Caption</span>
                    </div>
                    <CopyButton text={approvedConcept.caption} label="Copy Caption" />
                  </div>
                  <div className="bg-white/3 rounded-xl p-4">
                    <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{approvedConcept.caption}</p>
                  </div>
                </GlassCard>

                {/* Hashtags */}
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-[#06B6D4]" />
                      <span className="text-sm font-bold text-white">Hashtag Block</span>
                      <span className="text-xs text-white/30">{approvedConcept.hashtags?.length} tags</span>
                    </div>
                    <CopyButton text={approvedConcept.hashtags?.map(h => `#${h}`).join(' ') ?? ''} label="Copy All" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {approvedConcept.hashtags?.map(h => (
                      <span key={h} className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.15)' }}>
                        #{h}
                      </span>
                    ))}
                  </div>
                </GlassCard>

                {/* Story */}
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-[#F97316]" />
                      <span className="text-sm font-bold text-white">Story Version</span>
                    </div>
                    <CopyButton text={approvedConcept.storyVersion} label="Copy Story" />
                  </div>
                  <div className="bg-white/3 rounded-xl p-4">
                    <p className="text-sm text-white/75">{approvedConcept.storyVersion}</p>
                  </div>
                </GlassCard>

                {/* Reel Script */}
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#A855F7]" />
                      <span className="text-sm font-bold text-white">Reel Script (15s)</span>
                    </div>
                    <CopyButton text={approvedConcept.reelScript} label="Copy Script" />
                  </div>
                  <div className="bg-white/3 rounded-xl p-4">
                    <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{approvedConcept.reelScript}</p>
                  </div>
                </GlassCard>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #1440C0, #1440C0cc)',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(20,64,192,0.4)',
                    border: '1px solid rgba(20,64,192,0.5)',
                  }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save to Dashboard &amp; Track Performance
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════ DASHBOARD TAB ═══════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Summary stats */}
          {savedPosts.length > 0 && (() => {
            const withEngagement = savedPosts.filter(p => p.likes);
            const totalLikes = withEngagement.reduce((s, p) => s + (p.likes || 0), 0);
            const totalReach = withEngagement.reduce((s, p) => s + (p.reach || 0), 0);
            const avgEngRate = withEngagement.length > 0
              ? withEngagement.reduce((s, p) => s + ((p.likes || 0) + (p.comments || 0) + (p.shares || 0)) / Math.max(p.reach || 1, 1) * 100, 0) / withEngagement.length
              : 0;
            const highPerf = savedPosts.filter(p => p.concept.engagementPrediction === 'High').length;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Posts', value: savedPosts.length, icon: <BookOpen className="w-4 h-4" />, color: '#FFD700' },
                  { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: <ThumbsUp className="w-4 h-4" />, color: '#22C55E' },
                  { label: 'Total Reach', value: totalReach > 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach.toString(), icon: <Eye className="w-4 h-4" />, color: '#06B6D4' },
                  { label: 'Avg Eng Rate', value: avgEngRate > 0 ? `${avgEngRate.toFixed(1)}%` : '—', icon: <TrendingUp className="w-4 h-4" />, color: '#A855F7' },
                ].map(stat => (
                  <GlassCard key={stat.label} className="p-4">
                    <div className="flex items-center gap-2 mb-1" style={{ color: stat.color }}>
                      {stat.icon}
                      <span className="text-[10px] uppercase tracking-widest text-white/40">{stat.label}</span>
                    </div>
                    <p className="text-xl font-black" style={{ color: stat.color }}>{stat.value}</p>
                  </GlassCard>
                ))}
              </div>
            );
          })()}

          {savedPosts.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <BarChart3 className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No campaigns saved yet</p>
              <p className="text-white/25 text-xs mt-1">Generate a campaign and save it to start tracking</p>
              <button
                onClick={() => setActiveTab('brief')}
                className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFC200)', color: '#060D28' }}
              >
                Create First Campaign
              </button>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/30 uppercase tracking-widest">Campaign History</p>
              {savedPosts.map(post => {
                const hasEng = !!post.likes;
                const engForm = engagementForm[post.id] || { likes: '', comments: '', shares: '', reach: '' };
                const setEngField = (field: string, value: string) =>
                  setEngagementForm(prev => ({ ...prev, [post.id]: { ...prev[post.id] || { likes: '', comments: '', shares: '', reach: '' }, [field]: value } }));

                return (
                  <GlassCard key={post.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Thumbnail */}
                      <div className="w-full sm:w-16 h-32 sm:h-16 shrink-0 rounded-xl overflow-hidden bg-white/5">
                        {post.concept.imageUrls?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.concept.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-white">{post.concept.title}</p>
                            <p className="text-xs text-white/40 mt-0.5">{post.brief}…</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-white/30">
                              {new Date(post.date).toLocaleDateString()}
                            </span>
                            <button onClick={() => deletePost(post.id)} className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                            {post.concept.format}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{ color: PRED_COLOR[post.concept.engagementPrediction], background: PRED_COLOR[post.concept.engagementPrediction] + '18' }}>
                            {post.concept.engagementPrediction} reach predicted
                          </span>
                          {hasEng && (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="flex items-center gap-1 text-[#22C55E]"><ThumbsUp className="w-3 h-3" />{post.likes?.toLocaleString()}</span>
                              <span className="flex items-center gap-1 text-[#06B6D4]"><MessageCircle className="w-3 h-3" />{post.comments?.toLocaleString()}</span>
                              <span className="flex items-center gap-1 text-[#A855F7]"><Share2 className="w-3 h-3" />{post.shares?.toLocaleString()}</span>
                              <span className="flex items-center gap-1 text-white/40"><Eye className="w-3 h-3" />{post.reach?.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Engagement entry */}
                        {!hasEng && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Enter real engagement</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { key: 'likes', icon: <ThumbsUp className="w-3 h-3" />, placeholder: 'Likes' },
                                { key: 'comments', icon: <MessageCircle className="w-3 h-3" />, placeholder: 'Comments' },
                                { key: 'shares', icon: <Share2 className="w-3 h-3" />, placeholder: 'Shares' },
                                { key: 'reach', icon: <Eye className="w-3 h-3" />, placeholder: 'Reach' },
                              ].map(field => (
                                <div key={field.key} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
                                  <span className="text-white/30">{field.icon}</span>
                                  <input
                                    type="number"
                                    placeholder={field.placeholder}
                                    value={(engForm as any)[field.key]}
                                    onChange={e => setEngField(field.key, e.target.value)}
                                    className="w-16 bg-transparent text-xs text-white/70 focus:outline-none placeholder:text-white/20"
                                  />
                                </div>
                              ))}
                              <button
                                onClick={() => handleEngagementSave(post.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#FFD700' }}
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Brand Setup Modal ── */}
      {showBrandSetup && (
        <BrandSetupModal brand={brand} onSave={saveBrand} onClose={() => setShowBrandSetup(false)} />
      )}
    </div>
  );
}
