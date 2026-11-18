/**
 * All sound is synthesized in the Web Audio API. Nothing is fetched.
 * The engine stays quiet and low so it is less likely to trip the gate.
 * Loudness is dBFS from the analyser time-domain RMS, not a frequency average.
 */

import { rmsToDbfs } from './gate.js';

const MIC_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
  googEchoCancellation: false,
  googNoiseSuppression: false,
  googAutoGainControl: false,
};

export { MIC_CONSTRAINTS };

function tone(ctx, master, { freq, dur, type, gain, delay = 0, slide }) {
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, now);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), now + dur);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineGain = null;
  let oscGain = null;
  let rumble = null;
  let noiseBuffer = null;
  let analyser = null;
  let timeData = null;
  let stream = null;
  let muted = false;

  function arm() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);

    const length = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.2;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 130;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    source.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    source.start();

    rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 46;
    oscGain = ctx.createGain();
    oscGain.gain.value = 0;
    rumble.connect(oscGain);
    oscGain.connect(master);
    rumble.start();
  }

  function burstNoise(seconds, gainValue, fromHz, toHz) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(fromHz, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), now + seconds);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gainValue, now + 0.03);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(now);
    source.stop(now + seconds + 0.02);
  }

  return {
    arm,
    resume() {
      if (ctx && ctx.state !== 'running') return ctx.resume();
      return Promise.resolve();
    },
    async attachMic(existing) {
      arm();
      const live = existing || (await navigator.mediaDevices.getUserMedia({
        audio: MIC_CONSTRAINTS,
        video: false,
      }));
      stream = live;
      const track = live.getAudioTracks()[0];
      if (track?.applyConstraints) {
        try {
          await track.applyConstraints({
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          });
        } catch {
          /* Some browsers refuse to disable AGC after the fact. The gate still uses a relative floor. */
        }
      }
      const source = ctx.createMediaStreamSource(live);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      return live;
    },
    /** Instantaneous level in dBFS. Silence is about -100; 0 is clipping. */
    dbfs() {
      if (!analyser) return -100;
      const size = analyser.fftSize;
      if (!timeData || timeData.length !== size) timeData = new Float32Array(size);
      analyser.getFloatTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < size; i += 1) sum += timeData[i] * timeData[i];
      return rmsToDbfs(Math.sqrt(sum / size));
    },
    setThrust(thrust, altitude = 0) {
      if (!ctx || !engineGain) return;
      const amount = muted ? 0 : Math.max(0, Math.min(1, thrust));
      const now = ctx.currentTime;
      engineGain.gain.setTargetAtTime(amount * 0.16, now, 0.06);
      oscGain.gain.setTargetAtTime(amount * 0.045, now, 0.06);
      const freq = 42 + amount * 28 + Math.min(36, altitude / 20000);
      rumble.frequency.setTargetAtTime(freq, now, 0.1);
    },
    liftoff() {
      burstNoise(0.65, 0.18, 1600, 140);
      if (!ctx || muted) return;
      tone(ctx, master, { freq: 523, dur: 0.14, type: 'triangle', gain: 0.05 });
      tone(ctx, master, { freq: 784, dur: 0.22, type: 'sine', gain: 0.04, delay: 0.05 });
    },
    milestone(index) {
      if (!ctx || muted) return;
      const notes = [523, 659, 784, 880, 1046, 1318];
      const freq = notes[index % notes.length];
      tone(ctx, master, { freq, dur: 0.16, type: 'triangle', gain: 0.07 });
      tone(ctx, master, { freq: freq * 1.5, dur: 0.28, type: 'sine', gain: 0.04, delay: 0.06 });
    },
    apogee() {
      if (!ctx || muted) return;
      tone(ctx, master, { freq: 880, dur: 0.28, type: 'sine', gain: 0.05, slide: 440 });
      tone(ctx, master, { freq: 660, dur: 0.4, type: 'triangle', gain: 0.03, delay: 0.08, slide: 330 });
    },
    land() {
      burstNoise(0.35, 0.08, 400, 80);
    },
    ui() {
      if (!ctx || muted) return;
      tone(ctx, master, { freq: 660, dur: 0.07, type: 'square', gain: 0.03 });
    },
    stopMic() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    },
  };
}
