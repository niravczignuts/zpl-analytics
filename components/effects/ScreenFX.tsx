'use client';

import { useEffect, useState } from 'react';

type FXType = 'success' | 'error' | 'levelup';

interface FXEvent { type: FXType; id: number; }

let _fireFX: ((t: FXType) => void) | null = null;
export function fireScreenFX(type: FXType) { _fireFX?.(type); }

export function ScreenFX() {
  const [effects, setEffects] = useState<FXEvent[]>([]);
  let _id = 0;

  useEffect(() => {
    _fireFX = (type: FXType) => {
      const id = _id++;
      setEffects(prev => [...prev, { type, id }]);
      setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 800);
    };
    return () => { _fireFX = null; };
  }, []);

  return (
    <>
      {effects.map(fx => (
        <div key={fx.id} className="fixed inset-0 pointer-events-none z-[9995]">
          {fx.type === 'success' && (
            <div className="absolute inset-0 animate-screen-flash-green"
              style={{ background: 'radial-gradient(circle at center, rgba(34,197,94,0.12) 0%, transparent 60%)' }} />
          )}
          {fx.type === 'error' && (
            <div className="absolute inset-0 animate-screen-shake"
              style={{ background: 'radial-gradient(circle at center, rgba(204,16,32,0.15) 0%, transparent 60%)' }} />
          )}
          {fx.type === 'levelup' && (
            <div className="absolute inset-0 animate-screen-flash-gold"
              style={{ background: 'radial-gradient(circle at center, rgba(255,215,0,0.10) 0%, transparent 50%)' }} />
          )}
        </div>
      ))}
    </>
  );
}
