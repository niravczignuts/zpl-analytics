'use client';

import { useEffect, useRef } from 'react';

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const pos     = useRef({ x: -200, y: -200 });
  const cur     = useRef({ x: -200, y: -200 });
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      cur.current.x += (pos.current.x - cur.current.x) * 0.12;
      cur.current.y += (pos.current.y - cur.current.y) * 0.12;
      if (glowRef.current) {
        glowRef.current.style.transform =
          `translate(${cur.current.x - 150}px, ${cur.current.y - 150}px)`;
      }
      // Stop the loop once the glow has caught up (< 0.5px delta)
      const dx = Math.abs(pos.current.x - cur.current.x);
      const dy = Math.abs(pos.current.y - cur.current.y);
      if (dx > 0.5 || dy > 0.5) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = 0;
      }
    };

    const onMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      // Only kick off the loop if it isn't already running
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      className="fixed top-0 left-0 w-[300px] h-[300px] pointer-events-none z-[9998]"
      style={{
        background: 'radial-gradient(circle, rgba(20,64,192,0.07) 0%, rgba(255,215,0,0.03) 40%, transparent 70%)',
        borderRadius: '50%',
      }}
    />
  );
}
