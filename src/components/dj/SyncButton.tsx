import { Button } from "@/components/ui/button";
// Serato-style dark glass oval button. When synced it blinks blue and shows
// just "SYNC" — no tempo readout.
export function SyncButton({
  onClick,
  active,
  label = "SYNC",
  width = 62,
  height = 26,
}: {
  onClick: () => void;
  active?: boolean;
  label?: string;
  width?: number;
  height?: number;
  accent?: string;
  /** Kept for API compatibility; the tempo is no longer shown while synced. */
  bpm?: number;
}) {
  return (
    <Button variant="ghost" aria-pressed={!!active} aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center leading-none p-0 rounded-full active:scale-[0.97] transition-transform ${
        active ? "sync-active" : "dj-glass"
      }`}
      style={{
        width,
        height,
        boxShadow: active ? "var(--sync-shadow)" : undefined,
      }}
    >
      <span
        className="font-semibold"
        style={{
          fontSize: Math.max(8, height * 0.38),
          letterSpacing: "0.12em",
          color: active ? "var(--control-blue)" : "var(--foreground)",
        }}
      >
        {label}
      </span>
    </Button>
  );
}
