import { Deck, type StemKey } from "@/lib/dj/engine";
import { X } from "lucide-react";
import { useState } from "react";
import { useDeck } from "@/lib/dj/useMixer";
import { Button } from "@/components/ui/button";
import logo from "@/assets/mix4deejays-logo.jpg.asset.json";
import { DeckFxPanel } from "./DeckFxPanel";
import { useDjSettings } from "@/hooks/useDjSettings";
import { Knob } from "./Knob";
import { HotCuePanel } from "./HotCuePanel";

const STEMS: { key: StemKey; label: string }[] = [
  { key: "drums", label: "Drums" },
  { key: "bass", label: "Bass" },
  { key: "other", label: "Harmonic" },
  { key: "vocals", label: "Vocals" },
];

/** Four stem knobs with a Stems ⇄ EQ switch. */
export function StemsPanel({ deck, onClose, inline = false }: { deck: Deck; accent: string; onClose: () => void; inline?: boolean }) {
  useDeck(deck);
  const [djs, setDjs] = useDjSettings();
  const [eq, setEqState] = useState({ filter: 0, high: 0, mid: 0, low: 0 });
  const [performance, setPerformance] = useState(false);
  const eqMode = djs.stemsEqMode === "eq";
  const status = deck.realStems ? "Separated stems" : deck.stemStatus === "loading" ? "Separating…" : deck.stemStatus === "locked" ? "AI stems · Pro" : "Frequency bands";
  return (
    <div className={`stems-panel flex min-h-0 flex-col overflow-auto border border-border bg-secondary ${inline ? "relative h-full" : "absolute inset-x-0 top-9 bottom-14 z-30"} rounded-md`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
        <img src={logo.url} alt="mix4deejays" className="h-7 w-16 object-contain" />
        <div className="stem-switch" role="group" aria-label="Stems or EQ">
          <button aria-pressed={!eqMode} onClick={() => setDjs({ stemsEqMode: "stems" })}>Stems</button>
          <button aria-pressed={eqMode} onClick={() => setDjs({ stemsEqMode: "eq" })}>EQ</button>
        </div>
        <Button variant="ghost" className="h-7 px-1 text-[9px]" aria-label={`Hot cues and pitch cues deck ${deck.id}`} aria-pressed={performance} onClick={() => setPerformance(v => !v)}>Cues</Button>
        <DeckFxPanel deck={deck} accent="var(--accent-blue)" compact />
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close stems" className="size-7"><X className="size-3.5" /></Button>
      </div>
      {performance ? <HotCuePanel deck={deck} accent="var(--control-blue)" inline /> : <>
      <span role="status" className="px-2 pt-1 text-center text-[9px] text-muted-foreground">{eqMode ? `Deck ${deck.id} · EQ` : `Deck ${deck.id} · ${status}`}</span>
      <div className="grid flex-1 grid-cols-4 place-items-center gap-1 px-1 py-2">
        {eqMode
          ? (["filter", "high", "mid", "low"] as const).map((b) => (
              <Knob key={b} value={eq[b]} min={b === "filter" ? -1 : -24} max={b === "filter" ? 1 : 6} size={50} label={b}
                onChange={(v) => { if (b === "filter") deck.setFilter(v); else deck.setEq(b, v); setEqState((x) => ({ ...x, [b]: v })); }} />
            ))
          : STEMS.map(({ key, label }) => (
              <Knob key={key} value={deck.stemLevels[key]} min={0} max={1} size={50} label={label}
                onChange={(v) => deck.setStemLevel(key, v)} />
            ))}
      </div>
      </>}
    </div>
  );
}
