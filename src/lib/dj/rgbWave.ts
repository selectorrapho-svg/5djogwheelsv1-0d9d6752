import type { BandedPeaks } from "./engine";


// Full-spectrum RGB waveform (algorithm modelled on the classic 3-band RGB
// renderer used by pro DJ software): low → red, mid → green, high → blue.
// Bright nested spectral envelopes preserve actual transients and sustained audio.
//
// Speed: the whole track is rendered ONCE into an offscreen strip, then each
// animation frame just blits the visible slice with drawImage (GPU-scaled).

type StemsOn = Record<"bass" | "drums" | "vocals" | "other", boolean>;

export interface RgbStrip {
  canvas: HTMLCanvasElement;
  tiles: HTMLCanvasElement[];
  bins: number;
  axis: "y" | "x";
}

const STRIP_AMP = 256;
const TILE_BINS = 2048;

export function rgbColumns(peaks: BandedPeaks, stems: StemsOn) {
  const n = peaks.overall.length;
  const low = new Float32Array(n), mid = new Float32Array(n), high = new Float32Array(n);
  let maxAll = 1e-6;
  for (let i = 0; i < n; i++) {
    low[i] = stems.bass ? Math.max(peaks.sub[i], peaks.bass[i]) : 0;
    mid[i] = Math.max(stems.drums ? peaks.lowMid[i] : 0, stems.vocals ? peaks.mid[i] : 0);
    high[i] = stems.other ? Math.max(peaks.presence[i], peaks.high[i]) * 1.6 : 0;
    maxAll = Math.max(maxAll, low[i], mid[i], high[i]);
  }
  return { low, mid, high, maxAll };
}

/** Detailed frequency envelopes, rasterised once in bounded tiles. */
export function buildRgbStrip(peaks: BandedPeaks, stems: StemsOn, axis: "y" | "x"): RgbStrip | null {
  if (typeof document === "undefined" || !peaks.overall.length) return null;
  const bins = peaks.overall.length;
  const { low, mid, high, maxAll } = rgbColumns(peaks, stems);
  const tiles: HTMLCanvasElement[] = [];
  const half = STRIP_AMP / 2;
  for (let start = 0; start < bins; start += TILE_BINS) {
    const count = Math.min(TILE_BINS, bins - start);
    const canvas = document.createElement("canvas");
    canvas.width = axis === "y" ? STRIP_AMP : count;
    canvas.height = axis === "y" ? count : STRIP_AMP;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let b = 0; b < count; b++) {
      const i = start + b;
      const l = low[i] / maxAll, m = mid[i] / maxAll, h = high[i] / maxAll;
      const dominant = Math.max(l, m, h);
      if (dominant <= 0) continue;
      const extent = Math.min(half - 1, dominant * (half - 1));
      // Nested envelopes expose high-frequency hits without inventing triangles.
      for (let k = -Math.ceil(extent); k <= Math.ceil(extent); k++) {
        const distance = Math.abs(k) / (half - 1);
        const bands = [l, m, h];
        let band = l >= m && l >= h ? 0 : m >= h ? 1 : 2;
        for (let j = 0; j < 3; j++) if (distance <= bands[j] && bands[j] > 0) band = j;
        const palette = [[255, 65, 90], [65, 245, 130], [55, 190, 255]];
        const color = palette[band];
        const a = half + k;
        const p = axis === "y" ? (b * STRIP_AMP + a) * 4 : (a * count + b) * 4;
        img.data[p] = color[0]; img.data[p + 1] = color[1]; img.data[p + 2] = color[2];
        img.data[p + 3] = Math.round(Math.min(1, Math.max(0, extent - Math.abs(k) + 1)) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(canvas);
  }
  const canvas = tiles[0];
  if (!canvas) return null;
  return { canvas, tiles, bins, axis };
}

/** Blit only visible slices; no per-frame peak paths or artificial zigzags. */
export function drawRgbStrip(
  ctx: CanvasRenderingContext2D, strip: RgbStrip, duration: number, t: number,
  pxPerSec: number, timeLen: number, centerPx: number, crossStart: number, crossLen: number,
) {
  if (duration <= 0 || pxPerSec <= 0) return;
  const binsPerSec = strip.bins / duration;
  const t0 = t - centerPx / pxPerSec;
  const s0 = Math.max(0, t0 * binsPerSec);
  const s1 = Math.min(strip.bins, (t0 + timeLen / pxPerSec) * binsPerSec);
  if (s1 <= s0) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let tile = Math.floor(s0 / TILE_BINS); tile <= Math.floor((s1 - 1e-6) / TILE_BINS); tile++) {
    const canvas = strip.tiles[tile];
    if (!canvas) continue;
    const start = Math.max(s0, tile * TILE_BINS), end = Math.min(s1, (tile + 1) * TILE_BINS);
    const source = start - tile * TILE_BINS;
    const dest = (start / binsPerSec - t0) * pxPerSec;
    const length = (end - start) / binsPerSec * pxPerSec;
    if (strip.axis === "y") ctx.drawImage(canvas, 0, source, STRIP_AMP, end - start, crossStart, dest, crossLen, length);
    else ctx.drawImage(canvas, source, 0, end - start, STRIP_AMP, dest, crossStart, length, crossLen);
  }
}

export function stemsKey(stems: Record<string, { on: boolean }>) {
  return ["bass", "drums", "vocals", "other"].map((k) => (stems[k]?.on ? 1 : 0)).join("");
}
export function stemsOn(stems: Record<string, { on: boolean }>): StemsOn {
  return {
    bass: !!stems.bass?.on,
    drums: !!stems.drums?.on,
    vocals: !!stems.vocals?.on,
    other: !!stems.other?.on,
  };
}
