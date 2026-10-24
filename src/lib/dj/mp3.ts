import { Mp3Encoder } from "lamejs";

/** Encode an AudioBuffer to a 192 kbps stereo MP3 blob (chunked so long mixes stay responsive). */
export function bufferToMp3(buffer: AudioBuffer, kbps = 192): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps);
  const left = toInt16(buffer.getChannelData(0));
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : undefined;
  const parts: Int8Array[] = [];
  const block = 1152 * 256;
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const r = right?.subarray(i, i + block);
    const out = channels > 1 ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (out.length) parts.push(out);
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(tail);
  return new Blob(parts.map(p => p.slice().buffer as ArrayBuffer), { type: "audio/mpeg" });
}

function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    out[i] = v * (v < 0 ? 32768 : 32767);
  }
  return out;
}
