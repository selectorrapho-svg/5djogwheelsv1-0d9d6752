export type StemRuntimeCapabilities = {
  hasWorker: boolean;
  hasWebGpu: boolean;
  channels: number;
};

export function canRunStemSeparation({ hasWorker, hasWebGpu, channels }: StemRuntimeCapabilities) {
  return hasWorker && hasWebGpu && channels > 0 && channels <= 2;
}

export function hasOfflineStemAssets(model: boolean, wasm: boolean, worker: boolean) {
  return model && wasm && worker;
}