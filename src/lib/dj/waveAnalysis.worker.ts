import { computeBandedPeaks } from "./peaks";

self.onmessage = (event: MessageEvent<{ id: number; channels: Float32Array[]; sampleRate: number }>) => {
  const { id, channels, sampleRate } = event.data;
  const first = channels[0];
  if (!first) return;
  const buffer = {
    numberOfChannels: channels.length,
    length: first.length,
    sampleRate,
    duration: first.length / sampleRate,
    getChannelData: (channel: number) => channels[channel],
  } as AudioBuffer;
  const peaks = computeBandedPeaks(buffer, Math.min(buffer.length, Math.max(4800, Math.ceil(buffer.duration * 800))), progress => self.postMessage({ id, progress }));
  self.postMessage({ id, peaks }, { transfer: Object.values(peaks).map(array => array.buffer) });
};