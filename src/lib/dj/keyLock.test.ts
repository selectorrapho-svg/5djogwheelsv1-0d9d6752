import { describe, expect, it } from "vitest";
import { lockedPitch } from "./keyLock";

describe("vocal keylock", () => {
  it("keeps the original vocal pitch when tempo is raised and keylock is on", () => {
    expect(lockedPitch(1.25, true)).toBe(1);
  });
  it("keeps the original vocal pitch when tempo is lowered and keylock is on", () => {
    expect(lockedPitch(0.75, true)).toBe(1);
  });
  it("lets vocal pitch follow the tempo when keylock is off", () => {
    expect(lockedPitch(1.25, false)).toBe(1.25);
  });
});