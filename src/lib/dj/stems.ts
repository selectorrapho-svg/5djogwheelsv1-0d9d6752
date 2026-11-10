// Real AI stem separation using HTDemucs v4. Model and engine are cached on
// this device so separation can continue offline after initial preparation.
import wasmAsset from "@/assets/wasm/demucs_wasm_bg.wasm.asset.json";
import modelAsset from "@/assets/models/htdemucs.safetensors.asset.json";
import { canRunStemSeparation, hasOfflineStemAssets } from "./stemAvailability";
import type { StemKey } from "./engine";

const MODEL_ID = "htdemucs";
const WASM_ID = "demucs-wasm";
const WORKER_ID = "demucs-worker";
const WORKER_URL = "/wasm/demucs/worker.js";
const DB = "demucs-models";
const STORE = "weights";

export type StemResult = { stems: Record<StemKey, [Float32Array, Float32Array]>; sampleRate: number };

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
let queue: Promise<unknown> = Promise.resolve();
let modelBytes: Promise<Uint8Array> | null = null;
let wasmBytes: Promise<Uint8Array> | null = null;

export function stemsSupported() {
  return typeof window !== "undefined" && canRunStemSeparation({
    hasWorker: typeof Worker !== "undefined",
    hasWebGpu: "gpu" in navigator,
    channels: 2,
  });
}

function send(type: string, data: Record<string, unknown>, transfer: Transferable[] = []) {
  const id = ++seq;
  return new Promise<any>((res, rej) => {
    pending.set(id, { res, rej });
    if (!worker) { pending.delete(id); rej(new Error("Stem worker unavailable")); return; }
    worker.postMessage({ type, id, ...data }, transfer);
  });
}

function ensureWorker(wasm: Uint8Array, workerSource: Uint8Array) {
  if (ready) return ready;
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  worker = new Worker(workerUrl);
  worker.onmessage = (e) => {
    const { id, type, error } = e.data;
    if (type === "progress") return;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (type === "error") p.rej(new Error(error));
    else p.res(e.data);
  };
  const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
  ready = send("init", { wasmUrl }).then(() => undefined).finally(() => {
    URL.revokeObjectURL(wasmUrl);
    URL.revokeObjectURL(workerUrl);
  });
  ready.catch(() => {
    ready = null;
    worker?.terminate();
    worker = null;
  });
  return ready;
}

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function readCachedAsset(key: string): Promise<ArrayBuffer | undefined> {
  const db = await idb();
  const cached = await new Promise<ArrayBuffer | undefined>((res) => {
    const q = db.transaction(STORE).objectStore(STORE).get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => res(undefined);
  });
  db.close();
  return cached;
}

async function writeCachedAsset(key: string, bytes: ArrayBuffer): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(bytes, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the stem model"));
    tx.onabort = () => reject(tx.error ?? new Error("Could not save the stem model"));
  });
  db.close();
}

async function loadAsset(key: string, url: string): Promise<Uint8Array> {
  const cached = await readCachedAsset(key);
  if (cached) return new Uint8Array(cached);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Stem asset download failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  await writeCachedAsset(key, bytes);
  return new Uint8Array(bytes);
}

async function loadModel(): Promise<Uint8Array> {
  return loadAsset(MODEL_ID, modelAsset.url);
}

async function loadWasm(): Promise<Uint8Array> {
  return loadAsset(WASM_ID, wasmAsset.url);
}

async function loadWorker(): Promise<Uint8Array> {
  return loadAsset(WORKER_ID, WORKER_URL);
}

export async function stemAssetsReady(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const [model, wasm, workerScript] = await Promise.all([
      readCachedAsset(MODEL_ID),
      readCachedAsset(WASM_ID),
      readCachedAsset(WORKER_ID),
    ]);
    return hasOfflineStemAssets(Boolean(model), Boolean(wasm), Boolean(workerScript));
  } catch {
    return false;
  }
}

/** Download and persist the model and engine before offline use. */
export async function prepareStemAssets(): Promise<void> {
  if (typeof Worker === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("This browser cannot store the offline stem model.");
  }
  modelBytes ??= loadModel().catch((error) => { modelBytes = null; throw error; });
  wasmBytes ??= loadWasm().catch((error) => { wasmBytes = null; throw error; });
  await loadWorker();
  await Promise.all([modelBytes, wasmBytes]);
}

/** Separate a decoded track into drums/bass/other/vocals. Resolves null when unsupported. */
export function separateStems(buffer: AudioBuffer): Promise<StemResult | null> {
  if (!canRunStemSeparation({ hasWorker: typeof Worker !== "undefined", hasWebGpu: typeof navigator !== "undefined" && "gpu" in navigator, channels: buffer.numberOfChannels })) return Promise.resolve(null);
  const job = queue.then(async () => {
    modelBytes ??= loadModel().catch((e) => { modelBytes = null; throw e; });
    wasmBytes ??= loadWasm().catch((e) => { wasmBytes = null; throw e; });
    const [bytes, wasm, workerScript] = await Promise.all([modelBytes, wasmBytes, loadWorker()]);
    await ensureWorker(wasm, workerScript);
    const left = buffer.getChannelData(0).slice();
    const right = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice();
    const out = await send("separate", {
      modelBytes: bytes.slice(), modelId: MODEL_ID,
      stems: ["drums", "bass", "other", "vocals"],
      left, right, sampleRate: buffer.sampleRate,
    }, [left.buffer, right.buffer]);
    const audio: Float32Array = out.audio;
    const n: number = out.nSamples;
    const names: string[] = out.stemNames;
    const stems = {} as StemResult["stems"];
    names.forEach((name, i) => {
      const base = i * 2 * n;
      stems[name as StemKey] = [audio.subarray(base, base + n), audio.subarray(base + n, base + 2 * n)];
    });
    if (!stems.drums || !stems.bass || !stems.other || !stems.vocals) return null;
    return { stems, sampleRate: buffer.sampleRate };
  });
  queue = job.catch(() => null);
  return job;
}
