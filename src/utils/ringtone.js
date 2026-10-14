/* ---------------------------------------------------------------------------
   Ringtone — synthesised, not a file.

   Two tones rather than an asset: no download, no Cloudinary/Supabase round
   trip, and nothing to go stale in `dist/`. Outgoing is a soft single beep on
   a long cycle; incoming is the familiar two-note double ring.

   Browsers refuse to start an AudioContext before a user gesture. An incoming
   call arrives without one, so `start()` may land in "suspended" — resume() is
   attempted and the failure is swallowed. The call still works; it just rings
   silently until the page has been interacted with.
   --------------------------------------------------------------------------- */

let ctx = null;
let timer = null;
let gain = null;

const ensureContext = () => {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  return ctx;
};

const beep = (frequency, startAt, duration, volume) => {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;

  env.gain.setValueAtTime(0, startAt);
  env.gain.linearRampToValueAtTime(volume, startAt + 0.04);
  env.gain.setValueAtTime(volume, startAt + duration - 0.06);
  env.gain.linearRampToValueAtTime(0, startAt + duration);

  osc.connect(env);
  env.connect(gain);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
};

const patterns = {
  /* caller side — quiet, once every 3s */
  outgoing: { period: 3000, play: (t) => beep(440, t, 0.9, 0.05) },
  /* callee side — two notes, then a gap */
  incoming: {
    period: 2600,
    play: (t) => {
      beep(660, t, 0.35, 0.09);
      beep(560, t + 0.45, 0.35, 0.09);
    },
  },
};

export const startRingtone = (kind = "incoming") => {
  stopRingtone();

  const audio = ensureContext();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume().catch(() => {});

  gain = audio.createGain();
  gain.gain.value = 1;
  gain.connect(audio.destination);

  const pattern = patterns[kind] || patterns.incoming;
  const cycle = () => pattern.play(audio.currentTime + 0.02);

  cycle();
  timer = setInterval(cycle, pattern.period);
};

export const stopRingtone = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (gain) {
    try {
      gain.disconnect();
    } catch {
      /* already gone */
    }
    gain = null;
  }
};
