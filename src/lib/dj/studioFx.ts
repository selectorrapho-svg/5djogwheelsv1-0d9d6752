export type StudioFxFamily = "lowpass" | "highpass" | "bandpass" | "notch" | "echo" | "drive" | "tremolo";
export interface StudioFxPreset { key: string; label: string; family: StudioFxFamily; variant: number; category: string }
const families: [StudioFxFamily, string, string][] = [
  ["lowpass", "Low pass", "Filter"], ["highpass", "High pass", "Filter"],
  ["bandpass", "Band pass", "Filter"], ["notch", "Notch", "Filter"],
  ["echo", "Echo", "Delay"], ["drive", "Drive", "Distortion"], ["tremolo", "Tremolo", "Modulation"],
];
export const STUDIO_FX: StudioFxPreset[] = families.flatMap(([family, label, category]) =>
  Array.from({ length: 8 }, (_, variant) => ({ key: `${family}-${variant}`, label: `${label} ${variant + 1}`, family, variant, category })),
);
export function studioFxPreset(key: string | undefined) {
  return STUDIO_FX.find(p => p.key === key) ?? STUDIO_FX.find(p => p.family === key && p.variant === 3);
}