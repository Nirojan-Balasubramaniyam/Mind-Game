// Sound effects: optional MP3s in public/sounds/, or Web Audio beep fallback.
const SOUNDS = {
  start: '/sounds/start.mp3',
  answer: '/sounds/click.mp3',
  result: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
};

let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

function beep(freq = 440, duration = 0.1, type = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playSound(name) {
  const audio = new Audio(SOUNDS[name]);
  audio.volume = 0.4;
  audio.play().catch(() => {
    // Fallback: simple beeps when no MP3
    if (name === 'start') beep(523, 0.15);
    else if (name === 'answer') beep(400, 0.06);
    else if (name === 'result') { beep(659, 0.12); setTimeout(() => beep(880, 0.15), 120); }
    else if (name === 'error') beep(200, 0.2, 'square');
  });
}
