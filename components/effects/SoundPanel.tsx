'use client';

import { useState, useEffect } from 'react';
import {
  SFX, getMuted, setMuted, getVolume, setVolume,
  startAmbient, stopAmbient, isAmbientActive, unlockAudio,
} from '@/lib/sounds';

export function SoundPanel() {
  const [open,    setOpen]    = useState(false);
  const [muted,   setMutedS]  = useState(false);
  const [volume,  setVolumeS] = useState(0.7);
  const [ambient, setAmbient] = useState(false);
  const [bars,    setBars]    = useState([3,5,4,7,6,4,5,3]);
  // Animate equalizer bars at ~7fps — plenty for a visual equalizer, avoids 60fps RAF
  useEffect(() => {
    if (muted) return;
    const timer = setInterval(() => {
      setBars(prev => prev.map(b =>
        Math.max(2, Math.min(10, b + (Math.random() - 0.5) * 3))
      ));
    }, 140);
    return () => clearInterval(timer);
  }, [muted]);

  const toggleMute = () => {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setMutedS(next);
    if (!next) SFX.click();
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    setVolumeS(v);
    SFX.hover();
  };

  const toggleAmbient = () => {
    unlockAudio();
    if (ambient) { stopAmbient(); setAmbient(false); }
    else { startAmbient(); setAmbient(true); SFX.select(); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9996] flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div className="sound-panel animate-slide-up">
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3 font-semibold">Sound Control</p>

          {/* Equalizer visualization */}
          <div className="flex items-end gap-0.5 h-8 mb-3 justify-center">
            {bars.map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: `${muted ? 2 : h * 3}px`,
                  background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#1440C0' : '#CC1020',
                  opacity: muted ? 0.2 : 0.85,
                }}
              />
            ))}
          </div>

          {/* Volume slider */}
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-[10px] text-white/40">
              <span>Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => handleVolume(Number(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-[#FFD700]"
              style={{ accentColor: '#FFD700' }}
            />
          </div>

          {/* Ambient toggle */}
          <button
            onClick={toggleAmbient}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all mb-2 ${
              ambient
                ? 'bg-[#1440C0]/30 border-[#1440C0]/50 text-blue-300'
                : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
            }`}
          >
            🏟️ Stadium Ambience {ambient ? 'ON' : 'OFF'}
          </button>

          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
              muted
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]'
            }`}
          >
            {muted ? '🔇 Unmute' : '🔊 Mute All'}
          </button>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => { unlockAudio(); SFX.click(); setOpen(o => !o); }}
        className="sound-toggle-btn group"
        title="Sound Settings"
      >
        {/* Mini equalizer bars */}
        <div className="flex items-end gap-0.5 h-4">
          {bars.slice(0,4).map((h, i) => (
            <div key={i} className="w-0.5 rounded-full transition-all duration-75"
              style={{
                height: `${muted ? 2 : Math.min(16, h*1.5)}px`,
                background: i % 2 === 0 ? '#FFD700' : '#1440C0',
                opacity: muted ? 0.3 : 0.9,
              }}
            />
          ))}
        </div>
        {muted && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] flex items-center justify-center">✕</span>
        )}
      </button>
    </div>
  );
}
