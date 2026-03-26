'use client';

import { useEffect, useState } from 'react';
import { SFX, unlockAudio } from '@/lib/sounds';
import { getConfetti } from './Confetti';

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

export function KonamiEaster() {
  const [seq, setSeq]       = useState<string[]>([]);
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      unlockAudio();
      setSeq(prev => {
        const next = [...prev, e.key].slice(-KONAMI.length);
        const matchCount = next.filter((k, i) => k === KONAMI[KONAMI.length - next.length + i]).length;
        setProgress(Math.round((matchCount / KONAMI.length) * 100));

        if (next.join(',') === KONAMI.join(',')) {
          // KONAMI CODE!
          SFX.powerUp();
          getConfetti()?.burst();
          setActive(true);
          setTimeout(() => { setActive(false); setProgress(0); }, 5000);
          return [];
        }
        return next;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[10001] pointer-events-none flex items-center justify-center">
      {/* Radial flash */}
      <div className="absolute inset-0 animate-konami-flash" style={{
        background: 'radial-gradient(circle at center, rgba(255,215,0,0.15) 0%, rgba(20,64,192,0.08) 50%, transparent 70%)',
      }} />

      {/* Main text */}
      <div className="text-center animate-konami-text select-none">
        <div className="text-6xl mb-2">🎮</div>
        <div className="text-4xl font-black tracking-widest mb-1" style={{
          background: 'linear-gradient(135deg, #FFD700, #FFC200, #FFE566)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))',
        }}>
          TOURNAMENT MODE
        </div>
        <div className="text-sm tracking-[0.5em] uppercase text-white/60 font-semibold">
          ↑↑↓↓←→←→BA — ACTIVATED
        </div>
        <div className="mt-3 text-[#FFD700] font-bold text-lg">+100 XP</div>
      </div>

      {/* Corner flashes */}
      {[0,1,2,3].map(i => (
        <div key={i} className="absolute w-32 h-32 pointer-events-none" style={{
          top: i < 2 ? 0 : 'auto', bottom: i >= 2 ? 0 : 'auto',
          left: i % 2 === 0 ? 0 : 'auto', right: i % 2 === 1 ? 0 : 'auto',
          background: `radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)`,
          animation: 'pulse 0.5s ease-in-out infinite alternate',
        }} />
      ))}
    </div>
  );
}
