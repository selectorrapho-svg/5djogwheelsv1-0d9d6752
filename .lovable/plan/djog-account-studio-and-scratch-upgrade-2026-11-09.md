# DJog account, Studio and scratch upgrade

## Real offline stems
- Make the existing four-way AI source separation available in Free mode; do not relabel frequency filters as separated stems.
- Add a preparation action that downloads and persistently caches the model and WASM engine, then make the app load both from local storage when offline.
- Show readiness and processing limitations clearly; keep separation in a background worker and preserve playback while it runs.
- Add focused tests for free-tier access and offline asset readiness behavior.

### Technical details
- Reuse `src/lib/dj/stems.ts`, `src/lib/dj/engine.ts`, and `StemsPanel`; keep the existing worker/WASM and four-stem output path.
- Persist both model and WASM bytes in IndexedDB, await writes, and pass cached WASM bytes to the worker for initialization.
- WebGPU remains a device requirement. First preparation requires downloading the approximately 96 MB model/runtime bundle; subsequently cached assets can be used offline.

## Accounts and Pro
- Replace device-only account checks with secure Lovable Cloud accounts, profiles and separately assigned admin permissions.
- Remember sign-ins and support the device password manager without storing readable passwords. Existing local accounts cannot establish admin authority or verified payment; use verified account creation/recovery instead.
- Add admin code durations of 1–7 months and one year, enforce device limits centrally, and verify offline entitlements using signed codes without exposing a signing secret.
- Keep mixing and local Studio editing usable offline. First sign-in and issuing/redeeming codes require internet.

## Offline Studio and recordings
- Save complete editable projects, including source audio and arrangement settings, and reopen them from a project browser.
- Save Android files to the requested **duigsstudio** folder through device storage access; use local browser storage with project download/import where direct folder access is unavailable.
- Make undo/redo cover splits, cuts, paste, delete, trim/stretch, movement and property changes. Add clear delete/eraser controls and track/event effects with over 70 working presets, shared by playback and export.
- Save finished recordings locally and connect native audio recording rather than presenting browser-only recording as APK support.

## Scratch and waveform clarity
- Refine baby scratches, chirps and flings in both the browser and Android paths: continuous hand tracking, click-safe reversals, precise cuts and correctly timed release.
- Remove jogwheel scratch settings without disabling scratching.
- Sharpen full-spectrum RGB detail, preserve transients when zooming, prevent excessive zoom-out and add an independent dark/light waveform background in both settings locations.
- Reference-video matching remains pending: the attached files are three still images. Android headphone listening is required before claiming sound matches real DJ software.

## Reference-inspired appearance
- Use the uploaded images as design references, not screenshots embedded in the app; retain DJog branding.
- Add a dimensional vinyl platter appearance without changing touch/audio behavior, compact performance icons, and refined gray/light glass controls and library.
- Make SYNC blink blue without showing BPM in the button, respect reduced motion, and replace orange accents with the neutral/blue palette.

## Technical approach and verification
- Preserve shared DJ components and audio modules. Keep audio processing independent of rendering and use the existing AudioWorklet/Oboe routes.
- Keep profiles owner-scoped, roles separate and all admin code issuance server-authorized. Do not trust legacy local phone numbers, entitlement records or embedded signing keys.
- Implement in focused parallel groups: accounts/licensing; offline projects/history/effects; scratch; waveform/control styling.
- Add regression tests for durations, permissions, project round-trips, undoable edits and scratch timing; exercise real loaded tracks and saved projects in the preview.
- Check portrait and landscape controls. Report APK storage, native recording and scratch listening as unverified until tested on an installed Android build; source changes do not update existing APKs automatically.