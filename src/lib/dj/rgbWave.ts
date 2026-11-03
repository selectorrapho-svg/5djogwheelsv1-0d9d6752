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
  columns: ReturnType<typeof rgbColumns>;
  cache: Map<string, HTMLCanvasElement>;
  palette: number[][];
}

const TILE_BINS = 2048;
const PALETTE = [[255, 65, 90], [65, 245, 130], [55, 190, 255]];

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

/** Monotone interpolation rounds envelope edges without inventing overshoot. */
export function envelopeAt(values: Float32Array, position: number): number {
  if (position < 0 || position > values.length - 1) return 0;
  const i = Math.floor(position), f = position - i;
  const a = values[i], b = values[Math.min(i + 1, values.length - 1)];
  return a + (b - a) * f * f * (3 - 2 * f);
}

/** Retain transients when several analysis bins occupy one display pixel. */
export function envelopePeak(values: Float32Array, start: number, end: number): number {
  let peak = 0;
  for (let i = Math.max(0, Math.floor(start)); i < Math.min(values.length, Math.ceil(end)); i++) peak = Math.max(peak, values[i]);
  return peak;
}

/** Analysis is retained; only visible, zoom-specific tiles are rasterised. */
export function buildRgbStrip(peaks: BandedPeaks, stems: StemsOn, axis: "y" | "x"): RgbStrip | null {
  if (typeof document === "undefined" || !peaks.overall.length) return null;
  const canvas = document.createElement("canvas");
  const style = getComputedStyle(document.documentElement);
  const palette = ["--wave-low-rgb", "--wave-mid-rgb", "--wave-high-rgb"].map((token, i) => {
    const color = style.getPropertyValue(token).trim().split(/\s+/).map(Number);
    return color.length === 3 ? color : PALETTE[i];
  });
  return { canvas, tiles: [], bins: peaks.overall.length, axis, columns: rgbColumns(peaks, stems), cache: new Map(), palette };
}

function rasterTile(strip: RgbStrip, tile: number, scale: number, cross: number): HTMLCanvasElement {
  const key = `${scale}:${cross}:${tile}`;
  const cached = strip.cache.get(key);
  if (cached) return cached;
  const count = Math.min(TILE_BINS, Math.ceil(strip.bins * scale) - tile * TILE_BINS);
  const canvas = document.createElement("canvas");
  canvas.width = strip.axis === "y" ? cross : count;
  canvas.height = strip.axis === "y" ? count : cross;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const half = (cross - 1) / 2;
  const { low, mid, high, maxAll } = strip.columns;
  const bands = [low, mid, high];
  for (let b = 0; b < count; b++) {
    const source = (tile * TILE_BINS + b) / scale;
    const amps = bands.map(values => Math.min(1, (scale < 1 ? envelopePeak(values, source, source + 1 / scale) : envelopeAt(values, source)) / maxAll));
    const extent = Math.max(...amps) * half;
    for (let k = Math.max(0, Math.floor(half - extent)); k <= Math.min(cross - 1, Math.ceil(half + extent)); k++) {
      const distance = Math.abs(k - half);
      // Blend only bands present at this amplitude, not rectangular color blocks.
      const weights = amps.map(a => a * Math.min(1, Math.max(0, a * half - distance + 1)));
      const total = weights.reduce((sum, w) => sum + w, 0);
      if (!total) continue;
      const rgb = [0, 1, 2].map(channel => weights.reduce((sum, w, band) => sum + w * strip.palette[band][channel], 0) / total);
      const boost = 255 / Math.max(...rgb);
      const pixel = strip.axis === "y" ? (b * cross + k) * 4 : (k * count + b) * 4;
      for (let c = 0; c < 3; c++) image.data[pixel + c] = Math.round(rgb[c] * boost);
      image.data[pixel + 3] = Math.round(Math.min(1, Math.max(0, extent - distance + 1)) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  strip.cache.set(key, canvas);
  // Bound memory on phones even after repeated zooming and long-track seeking.
  while (strip.cache.size > 6) { const oldest = strip.cache.keys().next().value; if (oldest === undefined) break; strip.cache.delete(oldest); }
  return canvas;
}

/** Pixel-density-aware blits: never enlarge a coarse, whole-track bitmap. */
export function drawRgbStrip(
  ctx: CanvasRenderingContext2D, strip: RgbStrip, duration: number, t: number,
  pxPerSec: number, timeLen: number, centerPx: number, crossStart: number, crossLen: number,
) {
  if (duration <= 0 || pxPerSec <= 0) return;
  const binsPerSec = strip.bins / duration;
  const scale = Math.pow(2, Math.ceil(Math.log2(Math.max(1 / 64, Math.min(8, pxPerSec / binsPerSec)))));
  const cross = Math.min(512, Math.max(64, Math.pow(2, Math.ceil(Math.log2(crossLen)))));
  const t0 = t - centerPx / pxPerSec;
  const s0 = Math.max(0, t0 * binsPerSec * scale);
  const s1 = Math.min(strip.bins * scale, (t0 + timeLen / pxPerSec) * binsPerSec * scale);
  if (s1 <= s0) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let tile = Math.floor(s0 / TILE_BINS); tile <= Math.floor((s1 - 1e-6) / TILE_BINS); tile++) {
    const canvas = rasterTile(strip, tile, scale, cross);
    const start = Math.max(s0, tile * TILE_BINS), end = Math.min(s1, (tile + 1) * TILE_BINS);
    const source = start - tile * TILE_BINS;
    const dest = (start / scale / binsPerSec - t0) * pxPerSec;
    const length = (end - start) / scale / binsPerSec * pxPerSec;
    if (strip.axis === "y") ctx.drawImage(canvas, 0, source, cross, end - start, crossStart, dest, crossLen, length);
    else ctx.drawImage(canvas, source, 0, end - start, cross, dest, crossStart, length, crossLen);
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
