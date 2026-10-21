import { useRef, useState } from "react";
import { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const PAD_COLORS = ["#ff3b3b", "#ff8a3b", "#ffd23b", "#3bff8a", "#3bd2ff", "#4d7bff", "#c04dff", "#ff4dd2"];
const MODES = ["Hot Cue", "Roll", "Skip"] as const;
const ROLLS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];
const ROLL_LABELS = ["1/16", "1/8", "1/4", "1/2", "1", "2", "4", "8"];
const SKIPS = [-16, -8, -4, -1, 1, 4, 8, 16];

/** Eight professional performance pads (2 rows × 4) at the bottom of each deck. */
export function DeckPads({ deck }: { deck: Deck }) {
  useDeck(deck);
  const [mode, setMode] = useState<(typeof MODES)[number]>("Hot Cue");
  const press = useRef<number | null>(null);
  const longFired = useRef(false);

  const down = (i: number) => {
    longFired.current = false;
    if (mode === "Hot Cue") {
      if (deck.hotCues[i]) {
        press.current = window.setTimeout(() => { longFired.current = true; deck.clearHotCue(i); }, 600);
      }
      return;
    }
    if (mode === "Roll") { if (!deck.loopActive) deck.toggleLoop(ROLLS[i]); else deck.setLoopBeats(ROLLS[i]); return; }
    deck.skipBeats(SKIPS[i]);
  };
  const up = (i: number) => {
    if (press.current) { clearTimeout(press.current); press.current = null; }
    if (mode === "Roll") { if (deck.loopActive) deck.toggleLoop(ROLLS[i]); return; }
    if (mode !== "Hot Cue" || longFired.current) return;
    if (deck.hotCues[i]) deck.triggerHotCue(i); else deck.setHotCue(i);
  };

  const label = (i: number) => {
    if (mode === "Roll") return ROLL_LABELS[i];
    if (mode === "Skip") return `${SKIPS[i] > 0 ? "+" : ""}${SKIPS[i]}`;
    return String(i + 1);
  };

  return (
    <div className="deck-pads w-full shrink-0">
      <div className="mb-1 flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger className="deck-pad-mode" aria-label={`Pad mode deck ${deck.id}`}>
            {mode}<ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-2xl">
            {MODES.map((m) => (
              <DropdownMenuItem key={m} onSelect={() => setMode(m)} className={`rounded-full text-xs ${mode === m ? "text-primary" : ""}`}>{m}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-4 grid-rows-2 gap-1">
        {Array.from({ length: 8 }, (_, i) => {
          const set = mode === "Hot Cue" ? !!deck.hotCues[i] : true;
          return (
            <button key={i}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); down(i); }}
              onPointerUp={() => up(i)}
              onPointerCancel={() => up(i)}
              aria-label={`Pad ${i + 1} ${mode} deck ${deck.id}`}
              className={`deck-pad ${set ? "deck-pad-lit" : ""}`}
              style={{ "--pad-color": PAD_COLORS[i] } as React.CSSProperties}
            >
              {label(i)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
