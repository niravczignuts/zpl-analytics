'use client';

import { useEffect, useState } from 'react';
import { onAchievement, type Achievement } from '@/lib/achievements';
import { SFX } from '@/lib/sounds';

interface ToastItem { id: number; ach: Achievement; }

let _tid = 0;

export function AchievementToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onAchievement((ach) => {
      SFX.levelUp();
      const id = _tid++;
      setToasts(prev => [...prev, { id, ach }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none">
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className="achievement-toast"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {/* Shimmer overlay */}
          <div className="achievement-toast-shimmer" />

          <div className="flex items-center gap-3">
            {/* Icon with pulse ring */}
            <div className="relative flex-shrink-0">
              <div className="achievement-icon-ring" style={{ borderColor: t.ach.color }} />
              <span className="text-2xl relative z-10">{t.ach.icon}</span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: t.ach.color }}>
                  Achievement Unlocked
                </span>
                <span className="text-[10px] font-bold text-[#FFD700] bg-[#FFD700]/15 px-1.5 py-0.5 rounded-full">
                  +{t.ach.xp} XP
                </span>
              </div>
              <p className="text-sm font-black text-white leading-tight mt-0.5">{t.ach.title}</p>
              <p className="text-xs text-white/50 mt-0.5 truncate">{t.ach.description}</p>
            </div>
          </div>

          {/* Progress bar that drains */}
          <div className="achievement-progress-bar" style={{ background: t.ach.color }} />
        </div>
      ))}
    </div>
  );
}
