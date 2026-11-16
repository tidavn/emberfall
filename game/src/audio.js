// Synthesised sound effects with the Web Audio API. No audio files are
// loaded; every sound is built from oscillators and filtered noise, so the
// game stays fully offline. All calls are safe before any user gesture:
// the context is created lazily and failures are swallowed.

let ctx = null;
let muted = false;

function audio() {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(value) {
  muted = value;
}
export function isMuted() {
  return muted;
}

function tone(freq, duration, type, volume, slideTo) {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const now = ac.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Sound is garnish; never let it break the game.
  }
}

function noise(duration, volume, filterFreq) {
  const ac = audio();
  if (!ac) return;
  try {
    const length = Math.max(1, Math.floor(ac.sampleRate * duration));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
  } catch {
    // Sound is garnish; never let it break the game.
  }
}

export const sfx = {
  shoot() { tone(720, 0.07, 'square', 0.05, 340); },
  hit() { tone(220, 0.05, 'triangle', 0.06, 160); },
  kill() { noise(0.16, 0.16, 900); tone(320, 0.12, 'sawtooth', 0.05, 70); },
  hurt() { tone(140, 0.22, 'sawtooth', 0.14, 60); noise(0.12, 0.1, 500); },
  pickup() { tone(880, 0.09, 'sine', 0.08, 1320); },
  heart() { tone(520, 0.12, 'sine', 0.1, 780); tone(780, 0.14, 'sine', 0.08, 1040); },
  wave() { tone(196, 0.35, 'triangle', 0.12, 392); tone(294, 0.35, 'triangle', 0.08, 392); },
  upgrade() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.09), i * 70)); },
  boss() { tone(98, 0.6, 'sawtooth', 0.16, 49); noise(0.4, 0.12, 300); },
  victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.1), i * 110)); },
  defeat() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.1), i * 130)); },
  click() { tone(600, 0.05, 'sine', 0.06, 500); },
};
