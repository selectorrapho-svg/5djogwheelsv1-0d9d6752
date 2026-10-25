/** One in-flight decoder seek, latest target wins, with bounded recovery. */
export class VideoSeekController {
  private video: HTMLVideoElement | null = null;
  private target = 0;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resume: () => boolean = () => false;
  private completed = () => {
    this.pending = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.flush();
  };

  request(video: HTMLVideoElement, target: number, resume: () => boolean) {
    if (!Number.isFinite(target)) return;
    if (video !== this.video) {
      this.dispose();
      this.video = video;
      video.addEventListener("seeked", this.completed);
      video.addEventListener("loadeddata", this.completed);
      video.addEventListener("error", this.completed);
    }
    this.target = Math.max(0, Math.min(Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : target, target));
    this.resume = resume;
    this.flush();
  }

  private flush() {
    const video = this.video;
    if (!video || this.pending || video.readyState < 1 || video.error) return;
    if (Math.abs(video.currentTime - this.target) < 0.034 && !video.seeking) {
      if (this.resume()) void video.play().catch(() => {});
      return;
    }
    this.pending = true;
    try { video.currentTime = this.target; }
    catch { this.pending = false; return; }
    // Some WebViews miss seeked. Retry only the latest target, never queue every gesture.
    this.timer = setTimeout(this.completed, 250);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.video?.removeEventListener("seeked", this.completed);
    this.video?.removeEventListener("loadeddata", this.completed);
    this.video?.removeEventListener("error", this.completed);
    this.timer = null;
    this.pending = false;
    this.video = null;
  }
}