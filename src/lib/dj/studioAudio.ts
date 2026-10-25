import { clipDuration, studioFades, type StudioClip } from "./studio";
import { studioFxPreset } from "./studioFx";

const cache = new WeakMap<AudioBuffer, Map<string, Promise<AudioBuffer>>>();
export function prepareStudioClip(clip: StudioClip): Promise<AudioBuffer> {
  const stretch = clip.stretch ?? 1, pitch = clip.pitch ?? 0, reverse = clip.reverse ?? false;
  if (stretch === 1 && pitch === 0 && !reverse) return Promise.resolve(clip.buffer);
  let entries = cache.get(clip.buffer);
  if (!entries) { entries = new Map(); cache.set(clip.buffer, entries); }
  const key = `${stretch}:${pitch}:${reverse}`, existing = entries.get(key);
  if (existing) return existing;
  const result = new Promise<AudioBuffer>((resolve, reject) => {
    const worker = new Worker(new URL("./studioAudio.worker.ts", import.meta.url), { type: "module" });
    const fail = (reason: string) => { worker.terminate(); entries?.delete(key); reject(new Error(reason)); };
    worker.onerror = () => fail("Audio processing failed");
    worker.onmessage = (event: MessageEvent<{ channels?: Float32Array[]; error?: string }>) => {
      if (!event.data.channels) { fail(event.data.error ?? "Audio processing failed"); return; }
      const channels = event.data.channels;
      const buffer = new AudioBuffer({ numberOfChannels: 2, length: channels[0].length, sampleRate: clip.buffer.sampleRate });
      channels.forEach((channel, index) => buffer.copyToChannel(new Float32Array(channel), index));
      worker.terminate(); resolve(buffer);
    };
    const channels = Array.from({ length: Math.min(2, clip.buffer.numberOfChannels) }, (_, i) => clip.buffer.getChannelData(i).slice());
    worker.postMessage({ channels, stretch, pitch, reverse, sampleRate: clip.buffer.sampleRate }, channels.map(c => c.buffer));
  });
  entries.set(key, result); return result;
}

/** Identical routing for live playback and offline WAV export. */
export function connectStudioFx(ctx: BaseAudioContext, input: AudioNode, output: AudioNode, clip: StudioClip, when = 0, audibleSeconds = clipDuration(clip)): AudioNode[] {
  const gain = ctx.createGain(); gain.gain.value = clip.gain;
  input.connect(gain);
  const nodes: AudioNode[] = [gain];
  // Independent volume fades: ramp the clip's own gain node so the envelope
  // stays identical for live playback, restart-on-edit and offline export.
  const { fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd } = studioFades(clip, audibleSeconds, when);
  if (fadeInEnd > fadeInStart) {
    gain.gain.setValueAtTime(0, fadeInStart);
    gain.gain.linearRampToValueAtTime(clip.gain, fadeInEnd);
  }
  if (fadeOutEnd > fadeOutStart) {
    gain.gain.setValueAtTime(clip.gain, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.0001, fadeOutEnd);
  }
  const preset = studioFxPreset(clip.fx);
  const variant = preset?.variant ?? 0;
  if (preset && ["lowpass", "highpass", "bandpass", "notch"].includes(preset.family)) {
    const filter = ctx.createBiquadFilter();
    filter.type = preset.family as BiquadFilterType;
    filter.frequency.value = 200 * Math.pow(1.65, variant);
    filter.Q.value = 0.7 + variant * 0.8;
    gain.connect(filter).connect(output); nodes.push(filter);
  } else if (preset?.family === "echo") {
    const delay = ctx.createDelay(2), wet = ctx.createGain();
    delay.delayTime.value = 0.0625 * (variant + 1); wet.gain.value = 0.15 + variant * 0.07;
    gain.connect(output); gain.connect(delay).connect(wet).connect(output); nodes.push(delay, wet);
  } else if (preset?.family === "drive") {
    const shape = ctx.createWaveShaper(), curve = new Float32Array(2048);
    const amount = 1.5 + variant;
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i * 2 / (curve.length - 1) - 1) * amount) / Math.tanh(amount);
    shape.curve = curve; shape.oversample = "2x";
    gain.connect(shape).connect(output); nodes.push(shape);
  } else if (preset?.family === "tremolo") {
    const mod = ctx.createGain(), depth = ctx.createGain(), osc = ctx.createOscillator();
    mod.gain.value = 0.65; depth.gain.value = 0.35;
    osc.frequency.value = 1 + variant * 1.5;
    osc.connect(depth).connect(mod.gain); gain.connect(mod).connect(output);
    osc.start(when); osc.stop(when + audibleSeconds + 0.5); nodes.push(mod, depth, osc);
  } else gain.connect(output);
  return nodes;
}
