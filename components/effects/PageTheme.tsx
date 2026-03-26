'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ROUTE_THEMES: Record<string, { accent: string; glow: string }> = {
  '/':         { accent: 'rgba(255,215,0,0.04)',    glow: 'rgba(255,215,0,0.08)'   },
  '/auction':  { accent: 'rgba(204,16,32,0.05)',    glow: 'rgba(204,16,32,0.1)'    },
  '/teams':    { accent: 'rgba(20,64,192,0.05)',    glow: 'rgba(20,64,192,0.1)'    },
  '/players':  { accent: 'rgba(34,197,94,0.04)',    glow: 'rgba(34,197,94,0.08)'   },
  '/matches':  { accent: 'rgba(255,215,0,0.04)',    glow: 'rgba(255,215,0,0.06)'   },
  '/compare':  { accent: 'rgba(168,85,247,0.04)',   glow: 'rgba(168,85,247,0.08)'  },
  '/strategy': { accent: 'rgba(6,182,212,0.04)',    glow: 'rgba(6,182,212,0.08)'   },
  '/admin':    { accent: 'rgba(249,115,22,0.04)',   glow: 'rgba(249,115,22,0.08)'  },
};

export function PageTheme() {
  const pathname = usePathname();

  useEffect(() => {
    const key = Object.keys(ROUTE_THEMES).find(k =>
      k === '/' ? pathname === '/' : pathname.startsWith(k)
    ) || '/';
    const theme = ROUTE_THEMES[key];

    // Update CSS custom properties on document root for smooth transition
    document.documentElement.style.setProperty('--page-accent', theme.accent);
    document.documentElement.style.setProperty('--page-glow', theme.glow);
  }, [pathname]);

  return (
    // Ambient page-specific overlay
    <div
      className="fixed inset-0 pointer-events-none z-0 transition-all duration-700"
      style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 0%, var(--page-glow, transparent) 0%, transparent 60%)`,
      }}
    />
  );
}
