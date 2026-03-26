'use client';

import { useEffect, useRef } from 'react';
import { SFX, unlockAudio } from '@/lib/sounds';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  id: number;
}

const COLORS = [
  '#FFD700', '#FFC200', '#FFE566',  // gold shades
  '#1440C0', '#2A5CE0', '#5B8AFF',  // blue shades
  '#CC1020', '#FF2040',              // red shades
  '#ffffff',                          // white spark
];

let _id = 0;

export function ClickParticles() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const particles  = useRef<Particle[]>([]);
  const rafRef     = useRef<number>(0);
  const animateRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const startLoop = () => {
      if (!rafRef.current && animateRef.current) {
        rafRef.current = requestAnimationFrame(animateRef.current);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      unlockAudio();
      if (e.target === canvas) return;
      const count = 12 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const speed = 2 + Math.random() * 5;
        particles.current.push({
          id: _id++,
          x: e.clientX, y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          life: 1, maxLife: 0.6 + Math.random() * 0.4,
          size: 3 + Math.random() * 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
      startLoop();
    };

    const onMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const isNav = el.closest('aside') && el.closest('a');
      if (!isNav) return;
      if (Math.random() > 0.3) return;
      particles.current.push({
        id: _id++,
        x: e.clientX + (Math.random() - 0.5) * 10,
        y: e.clientY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random() * 2,
        life: 1, maxLife: 0.4 + Math.random() * 0.3,
        size: 1.5 + Math.random() * 2,
        color: COLORS[Math.floor(Math.random() * 3)],
      });
      startLoop();
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const animate = () => {
      particles.current = particles.current.filter(p => p.life > 0);

      // Stop loop when nothing left to draw
      if (particles.current.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = 0;
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles.current) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.15;
        p.vx *= 0.97;
        p.life -= 0.025 / p.maxLife;

        const alpha = Math.max(0, p.life);
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
      rafRef.current  = requestAnimationFrame(animate);
    };
    animateRef.current = animate;

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
