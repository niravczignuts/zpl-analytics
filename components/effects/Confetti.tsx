'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface ConfettiHandle {
  fire(x?: number, y?: number): void;
  burst(): void;
}

interface Piece {
  x: number; y: number; vx: number; vy: number;
  rotation: number; rotationSpeed: number;
  color: string; shape: 'rect' | 'circle' | 'triangle';
  w: number; h: number; life: number; gravity: number;
}

const ZPL_CONFETTI = [
  '#FFD700','#FFC200','#FFE566',
  '#1440C0','#2A5CE0','#6B8FFF',
  '#CC1020','#FF2040',
  '#ffffff','#22C55E',
];

let _confettiRef: ConfettiHandle | null = null;
export function getConfetti() { return _confettiRef; }

export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_, ref) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const pieces       = useRef<Piece[]>([]);
  const rafRef       = useRef<number>(0);
  const startLoopRef = useRef<() => void>();

  const spawnAt = useCallback((cx: number, cy: number, count = 60) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;
      pieces.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        color: ZPL_CONFETTI[Math.floor(Math.random() * ZPL_CONFETTI.length)],
        shape: (['rect','rect','circle','triangle'] as const)[Math.floor(Math.random() * 4)],
        w: 6 + Math.random() * 10,
        h: 4 + Math.random() * 8,
        life: 1,
        gravity: 0.2 + Math.random() * 0.15,
      });
    }
    startLoopRef.current?.();
  }, []);

  const handle: ConfettiHandle = {
    fire(x?: number, y?: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      spawnAt(x ?? canvas.width / 2, y ?? canvas.height / 3, 70);
    },
    burst() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 3;
      [cx - 200, cx, cx + 200].forEach((x, i) => {
        setTimeout(() => spawnAt(x, cy, 60), i * 120);
      });
    },
  };

  useImperativeHandle(ref, () => handle);
  useEffect(() => { _confettiRef = handle; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const drawPiece = (p: Piece) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -p.h / 2);
        ctx.lineTo(p.w / 2, p.h / 2);
        ctx.lineTo(-p.w / 2, p.h / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    const animate = () => {
      pieces.current = pieces.current.filter(p => p.life > 0);

      // Stop loop when nothing to draw
      if (pieces.current.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = 0;
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.life -= 0.008;
        drawPiece(p);
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    startLoopRef.current = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9997]"
    />
  );
});
