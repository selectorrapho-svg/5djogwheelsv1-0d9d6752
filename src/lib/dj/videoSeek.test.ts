import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoSeekController } from "./videoSeek";

function videoStub() {
  return Object.assign(new EventTarget(), { currentTime: 0, duration: 60, seeking: false, readyState: 2, error: null, play: vi.fn().mockResolvedValue(undefined) }) as unknown as HTMLVideoElement;
}
afterEach(() => vi.useRealTimers());
describe("video seek recovery", () => {
  it("retains the latest hot cue while a seek is in flight", () => {
    const v = videoStub(), seek = new VideoSeekController();
    seek.request(v, 10, () => false);
    seek.request(v, 20, () => false);
    expect(v.currentTime).toBe(10);
    v.dispatchEvent(new Event("seeked"));
    expect(v.currentTime).toBe(20);
    seek.dispose();
  });
  it("recovers when scratch seeked events are missing", () => {
    vi.useFakeTimers();
    const v = videoStub(), seek = new VideoSeekController();
    seek.request(v, 10, () => false);
    seek.request(v, 5, () => false);
    vi.advanceTimersByTime(250);
    expect(v.currentTime).toBe(5);
    seek.dispose();
  });
  it("resumes only when transport still wants playback", () => {
    const v = videoStub(), seek = new VideoSeekController();
    let playing = true;
    seek.request(v, 12, () => playing);
    playing = false;
    v.dispatchEvent(new Event("seeked"));
    expect(v.play).not.toHaveBeenCalled();
    seek.request(v, 12, () => true);
    expect(v.play).toHaveBeenCalledTimes(1);
    seek.dispose();
  });
});