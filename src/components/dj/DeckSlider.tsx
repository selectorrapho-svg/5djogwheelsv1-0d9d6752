import { useState } from "react";
import { ChevronDown, Music2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Deck } from "@/lib/dj/engine";
import { useDeck } from "@/lib/dj/useMixer";
import { Fader } from "./Fader";
import { LevelMeter } from "./LevelMeter";
import { LockKeyhole } from "lucide-react";

/** Landscape can switch modes; portrait keeps pitch permanently visible. */
export function DeckSlider({ deck, height = 120, pitchOnly = false }: { deck: Deck; height?: number; pitchOnly?: boolean }) {
  useDeck(deck);
  const [mode, setMode] = useState<"pitch" | "volume">("pitch");
  const [open, setOpen] = useState(false);
  const currentMode = pitchOnly ? "pitch" : mode;
  return <div className="flex shrink-0 flex-col items-center gap-1">
    {pitchOnly ? <Button variant="ghost" className="h-7 px-1 text-[10px] tabular-nums" aria-label={`Reset pitch deck ${deck.id}`} onClick={() => deck.setPitch(0)}>{deck.pitch > 0 ? "+" : ""}{deck.pitch.toFixed(1)}%</Button> : <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost" className="h-7 gap-0.5 px-1 text-[10px]" aria-label={`Slider mode deck ${deck.id}`}><span>{currentMode === "pitch" ? "Pitch" : "Volume"}</span><ChevronDown className="size-3" /></Button></PopoverTrigger>
      <PopoverContent className="reference-menu w-36 p-1" side="top">
        {(["pitch", "volume"] as const).map(m => <Button key={m} variant="ghost" className="h-9 w-full justify-start" aria-pressed={mode === m} onClick={() => { setMode(m); setOpen(false); }}>{m === "pitch" ? <Music2 /> : <Volume2 />}{m === "pitch" ? "Pitch" : "Volume"}</Button>)}
      </PopoverContent>
    </Popover>}
    <div className="flex items-stretch gap-1" style={{ height }}>
    <Fader marks={false} label={`${currentMode === "pitch" ? "Pitch" : "Volume"} deck ${deck.id}`} height={height} value={currentMode === "pitch" ? 1 - (deck.pitch + 25) / 50 : deck.volume} onChange={v => currentMode === "pitch" ? deck.setPitch((1 - v) * 50 - 25) : deck.setVolume(v)} />
    {currentMode === "volume" && <LevelMeter compact deck={deck} label={`Deck ${deck.id}`} />}
    </div>
    {currentMode === "pitch" && <Button variant="ghost" aria-label={`Keylock deck ${deck.id}`} title={deck.keyLockReady ? "Keep vocals in key" : "Keylock unavailable on this device"} disabled={!deck.keyLockReady} aria-pressed={deck.keyLock} onClick={() => deck.setKeyLock(!deck.keyLock)} className={`size-6 rounded-full p-0 ${deck.keyLock ? "keylock-active" : "text-muted-foreground"}`}><LockKeyhole className="size-3.5" /></Button>}
  </div>;
}