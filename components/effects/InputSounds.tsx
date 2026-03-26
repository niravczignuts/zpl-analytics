'use client';

import { useEffect } from 'react';
import { SFX, unlockAudio } from '@/lib/sounds';

export function InputSounds() {
  useEffect(() => {
    let lastKey = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      if (!isInput) return;
      if (!e.key || e.key.length > 1) return; // Only printable chars
      const now = Date.now();
      if (now - lastKey < 30) return; // Throttle
      lastKey = now;
      unlockAudio();
      SFX.type();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
