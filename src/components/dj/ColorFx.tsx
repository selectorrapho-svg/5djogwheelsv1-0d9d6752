import { useState } from "react";
import { Deck, type FxKey } from "@/lib/dj/engine";
import { Knob } from "./Knob";

// Pioneer-style Colour FX: one knob, centre = off.
export const COLOR_FX: { id: string; label: string; fx: FxKey | null; color: string }[] = [
  { id: "filter", label: "Filter", fx: null, color: "#3bd2ff" },
  { id: "space", label: "Space", fx: "reverb_hall" as FxKey, color: "#c04dff" },
  { id: "echo", label: "Echo", fx: "echo_1_2" as FxKey, color: "#3bff8a" },
  { id: "crush", label: "Crush", fx: "bitcrush" as FxKey, color: "#ff8a3b" },
  { id: "jet", label: "Jet", fx: "flanger_jet" as FxKey, color: "#ffd23b" },
  { id: "sweep", label: "Sweep", fx: "sweep_up" as FxKey, color: "#ff4dd2" },
];

export function ColorFxPanel({ deck }: { deck: Deck }) {
  const [style, setStyle] = useState(COLOR_FX[0]);
  const [v, setV] = useState(0);
  const apply = (val: number, s = style) => {
    if (!s.fx) { deck.setFilter(val); return; }
    deck.setFilter(val * 0.5);
    const a = Math.abs(val);
    if (a < 0.03) { if (deck.activeFx === s.fx) deck.setFx(null); return; }
    if (deck.activeFx !== s.fx) deck.setFx(s.fx, a); else deck.setFxAmount(a);
  };
  const pick = (s: (typeof COLOR_FX)[number]) => {
    if (style.fx && deck.activeFx === style.fx) deck.setFx(null);
    setStyle(s); apply(v, s);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid w-full grid-cols-3 gap-1" role="group" aria-label="Colour FX">
        {COLOR_FX.map((c) => (
          <button key={c.id} onClick={() => pick(c)} aria-pressed={style.id === c.id}
            className={`color-fx-chip ${style.id === c.id ? "color-fx-chip-on" : ""}`}
            style={{ "--fx-color": c.color } as React.CSSProperties}>{c.label}</button>
        ))}
      </div>
      <Knob value={v} min={-1} max={1} size={72} color={style.color} label={style.label}
        onDoubleClick={() => { setV(0); apply(0); }}
        onChange={(x) => { setV(x); apply(x); }} />
    </div>
  );
}
