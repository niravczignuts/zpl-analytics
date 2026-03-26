'use client';

import { useRef, ReactNode, MouseEvent } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  intensity?: number; // 1-20, default 8
  glowColor?: string;
}

export function TiltCard({
  children, className = '', style, intensity = 8, glowColor = '#FFD700'
}: TiltCardProps) {
  const cardRef   = useRef<HTMLDivElement>(null);
  const glowRef   = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    const rx = y * -intensity;
    const ry = x *  intensity;

    card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
    card.style.transition = 'transform 0.1s ease-out';

    // Move inner glow with mouse
    if (glowRef.current) {
      glowRef.current.style.opacity = '1';
      glowRef.current.style.background =
        `radial-gradient(circle at ${(x+0.5)*100}% ${(y+0.5)*100}%, ${glowColor}18 0%, transparent 60%)`;
    }
  };

  const onLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    card.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
    if (glowRef.current) glowRef.current.style.opacity = '0';
  };

  return (
    <div
      ref={cardRef}
      className={`relative ${className}`}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform', ...style }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Holographic inner glow */}
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-300"
        style={{ opacity: 0, zIndex: 1 }}
      />
      {/* Content */}
      <div className="relative" style={{ zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
