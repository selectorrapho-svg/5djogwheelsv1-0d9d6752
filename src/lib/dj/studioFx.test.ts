import { describe, expect, it } from "vitest";
import { STUDIO_FX, studioFxPreset } from "./studioFx";
describe("Studio effect library", () => {
  it("has over 50 distinct parameterized track/event effects", () => {
    expect(STUDIO_FX.length).toBeGreaterThan(50);
    expect(new Set(STUDIO_FX.map(p => p.key)).size).toBe(56);
    expect(new Set(STUDIO_FX.map(p => `${p.family}:${p.variant}`)).size).toBe(56);
  });
  it("preserves effects on saved older projects", () => {
    expect(studioFxPreset("echo")?.family).toBe("echo");
    expect(studioFxPreset("drive")?.family).toBe("drive");
    expect(studioFxPreset("none")).toBeUndefined();
  });
});