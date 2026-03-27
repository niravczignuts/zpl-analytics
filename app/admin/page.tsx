'use client';

import Link from 'next/link';

const ADMIN_SECTIONS = [
  {
    href: '/admin/import',
    icon: '📥',
    title: 'Import Data',
    desc: 'Upload CSV/XLSX files to import player stats, registrations, and auction data',
    color: '#1440C0',
    glow: 'rgba(20,64,192,0.3)',
  },
  {
    href: '/admin/season',
    icon: '📅',
    title: 'Season Management',
    desc: 'Create and manage seasons, configure rules and budget settings',
    color: '#9333EA',
    glow: 'rgba(147,51,234,0.3)',
  },
  {
    href: '/admin/players',
    icon: '👤',
    title: 'Player Management',
    desc: 'Upload player photos, set roles (batsman/bowler/all-rounder/WK) and batting/bowling styles',
    color: '#16A34A',
    glow: 'rgba(22,163,74,0.3)',
  },
  {
    href: '/admin/teams',
    icon: '🛡️',
    title: 'Team Branding',
    desc: 'Upload team logos and set primary/secondary brand colors for each team',
    color: '#F97316',
    glow: 'rgba(249,115,22,0.3)',
  },
  {
    href: '/admin/matches/new',
    icon: '🏏',
    title: 'Schedule Match',
    desc: 'Create new match fixtures, set date, venue and teams for upcoming league games or knockouts',
    color: '#CC1020',
    glow: 'rgba(204,16,32,0.3)',
  },
];

export default function AdminPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="page-header -mx-6 -mt-6 px-6 pt-6 pb-5 mb-2">
        <h1 className="text-2xl font-black font-display gradient-gold">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage ZPL data, settings and branding</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="group block">
            <div
              className="glass-card rounded-xl p-5 h-full transition-all duration-200 group-hover:scale-[1.02] cursor-pointer"
              style={{
                borderLeft: `3px solid ${s.color}60`,
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-all group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${s.color}22, ${s.color}11)`,
                  border: `1px solid ${s.color}30`,
                  boxShadow: `0 4px 16px ${s.glow}`,
                }}
              >
                {s.icon}
              </div>

              <h2
                className="font-bold text-base mb-1.5 transition-colors"
                style={{ color: s.color }}
              >
                {s.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>

              {/* Arrow indicator */}
              <div className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: s.color }}>
                Open →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick stats strip */}
      <div className="glass-card rounded-xl p-4 mt-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">
          Quick Tips
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-[#FFD700] shrink-0 mt-0.5">💡</span>
            <span>Upload team logos as PNG (transparent background recommended) in <strong className="text-foreground/70">Team Branding</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#16A34A] shrink-0 mt-0.5">💡</span>
            <span>Set player roles before the auction so AI advice reflects actual playing positions</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#1440C0] shrink-0 mt-0.5">💡</span>
            <span>Assign Captains & Managers first — they are auto-excluded from the auction pool</span>
          </div>
        </div>
      </div>
    </div>
  );
}
