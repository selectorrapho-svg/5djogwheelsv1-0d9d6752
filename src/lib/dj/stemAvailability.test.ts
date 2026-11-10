import { describe, expect, it } from "vitest";
import { canRunStemSeparation, hasOfflineStemAssets } from "./stemAvailability";

describe("offline real stem availability", () => {
  it("allows the four-stem workflow without a Pro or account requirement", () => {
    expect(canRunStemSeparation({ hasWorker: true, hasWebGpu: true, channels: 2 })).toBe(true);
  });

  it("requires both model weights and the local processing engine for offline use", () => {
    expect(hasOfflineStemAssets(true, true, true)).toBe(true);
    expect(hasOfflineStemAssets(true, true, false)).toBe(false);
    expect(hasOfflineStemAssets(true, false, true)).toBe(false);
    expect(hasOfflineStemAssets(false, true, true)).toBe(false);
  });

  it("only runs on supported stereo or mono browser audio", () => {
    expect(canRunStemSeparation({ hasWorker: true, hasWebGpu: true, channels: 1 })).toBe(true);
    expect(canRunStemSeparation({ hasWorker: true, hasWebGpu: true, channels: 3 })).toBe(false);
    expect(canRunStemSeparation({ hasWorker: true, hasWebGpu: false, channels: 2 })).toBe(false);
  });
});