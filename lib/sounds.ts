/**
 * ZPL Gamification Sound Engine
 * Web Audio API — synthesized, no external files
 */

let ctx: AudioContext | null = null;
let masterVolume = 0.7;
let muted = false;
let ambientNode: AudioNode | null = null;
let ambientGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function playTone(
  freq: number, type: OscillatorType, duration: number,
  volume = 0.08, startDelay = 0, freqEnd?: number,
) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  const t = c.currentTime + startDelay;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume * masterVolume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

export const SFX = {
  hover()    { playTone(900, 'sine', 0.04, 0.04); },
  click()    { playTone(220, 'sine', 0.08, 0.10, 0, 80); playTone(440, 'sine', 0.05, 0.05, 0.01); },
  navigate() { playTone(523,'sine',0.12,0.07,0); playTone(659,'sine',0.10,0.06,0.08); playTone(784,'sine',0.09,0.05,0.16); },
  success()  { playTone(523,'sine',0.10,0.08,0); playTone(659,'sine',0.10,0.08,0.08); playTone(784,'sine',0.14,0.08,0.16); playTone(1047,'sine',0.10,0.07,0.28); },
  error()    { playTone(200,'sawtooth',0.12,0.06,0,100); playTone(150,'sawtooth',0.10,0.05,0.1); },
  bid()      { playTone(440,'triangle',0.08,0.09,0); playTone(880,'sine',0.10,0.08,0.06); },
  trophy()   { [0,0.1,0.2,0.35].forEach((d,i)=>playTone([523,659,784,1047][i],'sine',0.18,0.07,d)); },
  type()     { playTone(600+Math.random()*200,'sine',0.03,0.025); },
  levelUp()  {
    [0,0.08,0.16,0.24,0.36].forEach((d,i)=>{
      playTone([392,523,659,784,1047][i],'sine',0.2,0.06,d);
    });
  },
  powerUp()  {
    for(let i=0;i<8;i++) playTone(200+i*80,'square',0.06,0.04,i*0.04,200+i*80+40);
  },
  select()   { playTone(660,'triangle',0.07,0.06); playTone(880,'triangle',0.07,0.05,0.07); },
  whoosh()   { playTone(800,'sine',0.15,0.05,0,100); },
  coin()     { playTone(1047,'sine',0.08,0.08,0); playTone(1319,'sine',0.06,0.06,0.06); },
};

export function setVolume(v: number) { masterVolume = Math.max(0, Math.min(1, v)); }
export function getVolume() { return masterVolume; }
export function setMuted(m: boolean) { muted = m; if (m) stopAmbient(); }
export function getMuted() { return muted; }
export function unlockAudio() { getCtx(); }

// ─── Ambient Stadium Mode ─────────────────────────────────────────────────
export function startAmbient() {
  if (muted) return;
  const c = getCtx();
  if (!c || ambientNode) return;

  // White noise buffer (crowd hum)
  const bufLen = c.sampleRate * 3;
  const buf    = c.createBuffer(1, bufLen, c.sampleRate);
  const data   = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.12;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  // Filter to make it sound like distant crowd
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 350;
  filter.Q.value = 0.4;

  const gainNode = c.createGain();
  gainNode.gain.value = 0;
  gainNode.gain.linearRampToValueAtTime(0.18 * masterVolume, c.currentTime + 2);

  src.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(c.destination);
  src.start();

  ambientNode = src;
  ambientGain = gainNode;
}

export function stopAmbient() {
  if (!ambientGain || !ambientNode || !ctx) return;
  ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  setTimeout(() => {
    try { (ambientNode as AudioBufferSourceNode).stop(); } catch {}
    ambientNode = null;
    ambientGain = null;
  }, 1600);
}
export function isAmbientActive() { return ambientNode !== null; }
