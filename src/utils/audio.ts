// Programmatic Web Audio API Synthesizer for AuraVault UX Audio

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const playSound = {
  // Keypress mechanical key click (sine pitch drop + noise click)
  click() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Tone click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);

      // Noise contact click
      const bufferSize = ctx.sampleRate * 0.008; // very short burst
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3000, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.02, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.01);
    } catch (e) {
      console.warn('Audio Context disabled or blocked:', e);
    }
  },

  // Keypad clear button (spring release pitch drop)
  clear() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      console.warn(e);
    }
  },

  // Access Denied (harsh detuned square waves)
  error() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(98, now); // G2
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(95, now); // Detuned

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0.08, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      // Filter detune harshness
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (e) {
      console.warn(e);
    }
  },

  // Access Granted (C Major arpeggio sine chime)
  success() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const playChime = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.05);
      };

      playChime(523.25, now, 0.2); // C5
      playChime(659.25, now + 0.07, 0.2); // E5
      playChime(783.99, now + 0.14, 0.2); // G5
      playChime(1046.50, now + 0.21, 0.5); // C6
    } catch (e) {
      console.warn(e);
    }
  },

  // Vault Door opening pneumatic swoop & motor rumble
  unlockSwoosh() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // 1. Motor rumble
      const rumble = ctx.createOscillator();
      const rumbleGain = ctx.createGain();

      rumble.type = 'triangle';
      rumble.frequency.setValueAtTime(60, now);
      rumble.frequency.linearRampToValueAtTime(32, now + 1.2);

      rumbleGain.gain.setValueAtTime(0.12, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      rumble.connect(rumbleGain);
      rumbleGain.connect(ctx.destination);
      rumble.start(now);
      rumble.stop(now + 1.25);

      // 2. High pressure steam swoosh (noise biquad sweep)
      const bufferSize = ctx.sampleRate * 1.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.0, now);
      filter.frequency.setValueAtTime(100, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(60, now + 1.2);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.06, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 1.25);
    } catch (e) {
      console.warn(e);
    }
  },

  // Soft beep (clipboard copy indicator)
  copy() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn(e);
    }
  },

  // Upload/Save pop (bubble chime)
  pop() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      console.warn(e);
    }
  }
};
