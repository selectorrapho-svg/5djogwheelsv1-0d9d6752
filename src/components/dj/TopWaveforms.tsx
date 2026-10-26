import { useState } from "react";
import type { Deck } from "@/lib/dj/engine";
import { HorizontalWaveform } from "./HorizontalWaveform";
import { X } from "lucide-react";

export function TopWaveforms({ decks }: { decks: Deck[] }) {
  const [full, setFull] = useState<Deck | null>(null);
  return <>
    <div aria-label="Top scratch waveforms" className="grid h-24 shrink-0 grid-rows-2 border-b border-border">
      {decks.slice(0, 2).map((deck, index) => (
        <button key={deck.id} type="button" aria-label={`Expand deck ${deck.id} waveform`} onClick={() => setFull(deck)} className="block min-h-0 w-full border-b border-border p-0 text-left last:border-0">
          <HorizontalWaveform deck={deck} index={index === 0 ? 1 : 2} color={index === 0 ? "var(--accent-orange)" : "var(--accent-blue)"} />
        </button>
      ))}
    </div>
    {full && (
      <div role="dialog" aria-label={`Deck ${full.id} full waveform`} className="fixed inset-0 z-[80] flex flex-col bg-background">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Deck {full.id}</span>
          <button aria-label="Close full waveform" onClick={() => setFull(null)} className="grid size-8 place-items-center rounded-full dj-glass"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1">
          <HorizontalWaveform deck={full} index={full.id === "A" ? 1 : 2} color={full.id === "A" ? "var(--accent-orange)" : "var(--accent-blue)"} />
        </div>
      </div>
    )}
  </>;
}
