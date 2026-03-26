'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Gavel, Users, Shield, Trophy, ArrowLeftRight,
  Brain, Settings, PanelLeftClose, PanelLeftOpen, Megaphone, LogOut,
} from 'lucide-react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { useState, useRef, useEffect } from 'react';
import { SFX, unlockAudio } from '@/lib/sounds';

const NAV_ITEMS = [
  { href: '/',         label: 'Dashboard',   icon: LayoutDashboard, color: '#FFD700' },
  { href: '/auction',  label: 'Auction',     icon: Gavel,           color: '#FF4444' },
  { href: '/teams',    label: 'Teams',       icon: Shield,          color: '#1440C0' },
  { href: '/players',  label: 'Players',     icon: Users,           color: '#22C55E' },
  { href: '/matches',  label: 'Matches',     icon: Trophy,          color: '#FFD700' },
  { href: '/compare',  label: 'Compare',     icon: ArrowLeftRight,  color: '#A855F7' },
  { href: '/strategy',  label: 'AI Strategy', icon: Brain,       color: '#06B6D4' },
  { href: '/campaign',  label: 'Campaign',    icon: Megaphone,   color: '#FF6B35' },
  { href: '/admin',     label: 'Admin',       icon: Settings,    color: '#F97316' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentSeasonId, setCurrentSeasonId, seasons } = useSeason();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [clickedIdx, setClickedIdx] = useState<number | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [hydrated, setHydrated]   = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const rippleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const triggerRipple = (idx: number, e: React.MouseEvent) => {
    const el = rippleRefs.current[idx];
    if (!el) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.left    = `${x}px`;
    el.style.top     = `${y}px`;
    el.style.opacity = '1';
    el.style.transform = 'scale(0)';
    // Force reflow
    void el.offsetWidth;
    el.style.transform = 'scale(4)';
    el.style.opacity   = '0';
  };

  const handleNavClick = (idx: number, href: string, e: React.MouseEvent) => {
    unlockAudio();
    SFX.navigate();
    triggerRipple(idx, e);
    setClickedIdx(idx);
    setTimeout(() => setClickedIdx(null), 300);
  };

  const handleHover = (idx: number) => {
    unlockAudio();
    SFX.hover();
    setHoveredIdx(idx);
  };

  const handleLogout = async () => {
    unlockAudio();
    SFX.click();
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full shrink-0 transition-all duration-300 overflow-hidden select-none',
        'border-r border-sidebar-border',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{
        background: 'linear-gradient(180deg, #050B1F 0%, #060D28 40%, #080F2E 100%)',
      }}
    >
      {/* ── Animated background grid ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(20,64,192,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          animation: 'grid-scroll 20s linear infinite',
        }} />
        {/* Top radial glow */}
        <div className="absolute top-0 left-0 right-0 h-48" style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(20,64,192,0.28) 0%, transparent 70%)',
        }} />
        {/* Bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-32" style={{
          background: 'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(255,215,0,0.06) 0%, transparent 70%)',
        }} />
        {/* Right gold accent line */}
        <div className="absolute top-0 right-0 w-px h-full" style={{
          background: 'linear-gradient(180deg, rgba(255,215,0,0.25) 0%, rgba(255,215,0,0.05) 50%, transparent 100%)',
        }} />
      </div>

      {/* ── Logo Header — single row always, toggle always right-aligned ── */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/5 px-3 py-3 min-h-[56px] shrink-0">
        {/* Logo area — hides text when collapsed but stays in row */}
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <div
            className="relative w-8 h-8 shrink-0 flex items-center justify-center"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.35))' }}
          >
            {!collapsed && (
              <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: 'rgba(255,215,0,0.3)', animationDuration: '3s' }} />
            )}
            {hydrated && logoError ? (
              <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                style={{ background: 'linear-gradient(135deg,#1440C0,#060D28)', border: '1.5px solid #FFD700', color: '#FFD700' }}>
                Z
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/zpl-logo.png"
                alt="ZPL"
                width={32}
                height={32}
                className="relative z-10 w-8 h-8 object-contain"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-black text-base leading-none tracking-wider whitespace-nowrap" style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFC200 50%, #FFE566 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>ZPL</div>
              <div className="text-[10px] text-white/30 tracking-widest uppercase mt-0.5 whitespace-nowrap">Analytics</div>
            </div>
          )}
        </div>

        {/* Toggle button — always visible, always on the right, always fully inside */}
        <button
          onClick={() => { unlockAudio(); SFX.click(); setCollapsed(c => !c); }}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Season Selector ── */}
      {!collapsed && seasons.length > 0 && (
        <div className="relative z-10 px-3 py-2.5 border-b border-white/5 shrink-0">
          <label className="text-[10px] text-white/30 mb-1.5 block uppercase tracking-widest font-semibold">
            Season
          </label>
          <div className="relative">
            <select
              value={currentSeasonId}
              onChange={e => setCurrentSeasonId(e.target.value)}
              className="w-full text-xs rounded-lg px-2.5 py-2 border text-white/80 focus:outline-none focus:ring-1 focus:ring-[#FFD700]/40 transition-all cursor-pointer appearance-none"
              style={{
                background: '#0a1230',
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                colorScheme: 'dark',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
              } as React.CSSProperties}
            >
              {seasons.map(s => (
                <option
                  key={s.id} value={s.id}
                  style={{ background: '#0a1230', color: 'rgba(255,255,255,0.85)' }}
                >
                  {s.name}
                </option>
              ))}
            </select>
            {/* Custom chevron */}
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="relative z-10 flex-1 p-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] text-white/20 px-2 pt-1 pb-1.5 uppercase tracking-widest font-semibold">
            Menu
          </p>
        )}

        {NAV_ITEMS.map((item, idx) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const isHovered = hoveredIdx === idx;
          const isClicked = clickedIdx === idx;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={e => handleNavClick(idx, item.href, e)}
              onMouseEnter={() => handleHover(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={cn(
                'relative flex items-center gap-3 rounded-xl text-sm font-medium overflow-hidden',
                'transition-all duration-200',
                collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5',
              )}
              style={{
                background: active
                  ? `linear-gradient(135deg, ${item.color}1A 0%, ${item.color}0D 100%)`
                  : isHovered
                  ? 'rgba(255,255,255,0.04)'
                  : 'transparent',
                border: active
                  ? `1px solid ${item.color}38`
                  : '1px solid transparent',
                boxShadow: active
                  ? `0 0 20px ${item.color}15, inset 0 0 12px ${item.color}08`
                  : 'none',
                transform: isClicked ? 'scale(0.96)' : 'scale(1)',
              }}
              title={collapsed ? item.label : undefined}
            >
              {/* Ripple span */}
              <span
                ref={el => { rippleRefs.current[idx] = el; }}
                className="absolute pointer-events-none rounded-full"
                style={{
                  width: '80px', height: '80px',
                  marginLeft: '-40px', marginTop: '-40px',
                  background: `radial-gradient(circle, ${item.color}40 0%, transparent 70%)`,
                  transition: 'transform 0.4s ease-out, opacity 0.4s ease-out',
                }}
              />

              {/* Animated icon */}
              <span
                className="relative shrink-0 transition-all duration-200"
                style={{
                  transform: isHovered ? 'translateY(-4px) scale(1.25)' : 'translateY(0) scale(1)',
                  filter: active || isHovered ? `drop-shadow(0 0 6px ${item.color}90)` : 'none',
                }}
              >
                <Icon
                  className={cn(collapsed ? 'w-5 h-5' : 'w-4 h-4')}
                  style={{ color: active ? item.color : isHovered ? item.color : 'rgba(255,255,255,0.5)' }}
                />
                {/* Icon orbit ring when active */}
                {active && (
                  <span className="absolute inset-[-6px] rounded-full border opacity-40 animate-spin"
                    style={{ borderColor: item.color, animationDuration: '3s' }} />
                )}
              </span>

              {!collapsed && (
                <>
                  <span
                    className="flex-1 transition-all duration-200"
                    style={{ color: active ? item.color : isHovered ? '#ffffff' : 'rgba(255,255,255,0.55)' }}
                  >
                    {item.label}
                  </span>
                  {/* Active glow dot */}
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                  )}
                </>
              )}

              {/* Collapsed active bar */}
              {collapsed && active && (
                <span className="absolute right-0 w-0.5 h-5 rounded-full"
                  style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
              )}

              {/* Hover glow streak */}
              {isHovered && !active && (
                <span className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${item.color}08, transparent)`,
                    animation: 'shimmer-fast 0.8s ease-in-out',
                  }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="relative z-10 border-t border-white/5 shrink-0">
        {!collapsed ? (
          <div className="p-3 space-y-2">
            <div className="text-center pb-1">
              <p className="text-[10px] text-white/20 uppercase tracking-widest">Zignuts Premier League</p>
              <p className="text-xs font-bold" style={{
                background: 'linear-gradient(135deg, #FFD700, #FFC200)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Season 2026</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Lock &amp; Logout</span>
            </button>
          </div>
        ) : (
          <div className="p-2 flex justify-center">
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
