// Plays a soft two-note ascending chime using Web Audio API (no external files).
// AudioContext is created lazily and reused to avoid the "suspended context" warning
// that browsers issue when audio is created before user interaction.
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
  }
  if (_ctx.state === "suspended") {
    _ctx.resume();
  }
  return _ctx;
}

function playNote(ctx: AudioContext, freq: number, startTime: number, duration: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sine";
  osc.frequency.value = freq;

  // Soft attack → exponential decay
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playNotification() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    // C5 → E5 ascending major-third chime, gentle volume
    playNote(ctx, 523.25, now,        0.55, 0.22);
    playNote(ctx, 659.25, now + 0.13, 0.65, 0.18);
  } catch {
    // AudioContext blocked (e.g., HTTPS restriction) — fail silently
  }
}
