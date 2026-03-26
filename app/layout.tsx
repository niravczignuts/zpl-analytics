import type { Metadata } from 'next';
import { Outfit, DM_Sans } from 'next/font/google';
import './globals.css';
import { MobileNav } from '@/components/layout/MobileNav';
import { SeasonProvider } from '@/components/providers/SeasonProvider';
import { ClickParticles } from '@/components/effects/ClickParticles';
import { CursorGlow } from '@/components/effects/CursorGlow';
import { Confetti } from '@/components/effects/Confetti';
import { KonamiEaster } from '@/components/effects/KonamiEaster';
import { SoundPanel } from '@/components/effects/SoundPanel';
import { PageTheme } from '@/components/effects/PageTheme';
import { InputSounds } from '@/components/effects/InputSounds';
import { ScreenFX } from '@/components/effects/ScreenFX';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', weight: ['400','600','700','900'] });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: 'ZPL Analytics — Zignuts Premier League',
  description: 'Zignuts Premier League — Next-Generation Cricket Analytics Platform',
  icons: { icon: [{ url: '/zpl-logo.png', type: 'image/png' }], apple: '/zpl-logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={`${outfit.variable} ${dmSans.variable} font-body antialiased bg-background text-foreground`}
      >
        <SeasonProvider>
          {/* ── Layer 0: Page ambient theme overlay ── */}
          <PageTheme />

          {/* ── Layer 1: Physics & particle canvas layers ── */}
          <ClickParticles />
          <CursorGlow />
          <Confetti />

          {/* ── Layer 2: Screen flash/shake effects ── */}
          <ScreenFX />

          {/* ── Layer 3: UI overlays ── */}
          <KonamiEaster />
          <SoundPanel />
          <InputSounds />

          {/* ── Main layout ── */}
          <div className="flex h-screen overflow-hidden relative z-10">
            <MobileNav />
            <main className="flex-1 overflow-y-auto scan-lines grid-bg pt-14 md:pt-0">
              {children}
            </main>
          </div>
        </SeasonProvider>
      </body>
    </html>
  );
}
