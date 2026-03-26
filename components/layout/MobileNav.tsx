'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { unlockAudio, SFX } from '@/lib/sounds';

// Skip SSR for Sidebar — it uses sounds, animations, and browser APIs
// that cause hydration mismatches between server and client renders.
const Sidebar = dynamic(
  () => import('./Sidebar').then(mod => ({ default: mod.Sidebar })),
  {
    ssr: false,
    loading: () => (
      <aside className="relative flex flex-col h-full w-64 shrink-0 border-r border-white/5"
        style={{ background: 'linear-gradient(180deg,#050B1F 0%,#060D28 40%,#080F2E 100%)' }}
      />
    ),
  }
);

export function MobileNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleMobile = () => {
    unlockAudio();
    SFX.click();
    setMobileOpen(o => !o);
  };

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={toggleMobile}
        className="md:hidden fixed top-3 left-3 z-[9998] w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 shadow-lg shadow-black/40"
        style={{ background: 'linear-gradient(135deg, #050B1F, #060D28)' }}
        aria-label="Toggle navigation"
      >
        {mobileOpen
          ? <X className="w-4 h-4 text-white/80" />
          : <Menu className="w-4 h-4 text-white/80" />}
      </button>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[9997] bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, overlay on mobile */}
      <div className={[
        'z-[9998]',
        // Mobile: fixed overlay, slide in/out; desktop: normal flex child with full height
        'fixed md:relative md:h-full inset-y-0 left-0',
        'transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}>
        <Sidebar />
      </div>
    </>
  );
}
