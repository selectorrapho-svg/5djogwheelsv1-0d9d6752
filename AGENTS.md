<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Scale entire mixer knobs rather than constraining their wrappers, because SVG rings and labels must stay aligned at short viewport heights.
- Keep portrait pitch in the shared deck slider's fixed-pitch presentation, because landscape mode selection must not change portrait controls.
- Keep the uploaded DJ mixer in `src/components/dj` with its audio engine in `src/lib/dj`, because the interface and playback logic are shared across desktop and portrait layouts.
- Render the full-size deck waveforms in the orientation chosen in Settings (default vertical) in both center-column and portrait layouts, because the mixer should show upright scrolling tracks.
- Keep one per-deck performance-tools entry point in the landscape strip, because separate cues, FX, and sampler triggers crowd narrow phones.
- Render performance tabs inline inside one deck-anchored drawer and top waveforms through shared existing scratch canvases, because nested floating tools obscure waveforms and duplicate playback logic.
- Keep Settings grouped into mobile-friendly sections, because portrait phones and tablets are the primary controls and long multi-column forms bury playback options.
- Keep scratch audio sourced from the track without synthetic vinyl hiss, because stopped or slow platters should not add background noise.
- Read embedded album artwork when media enters the library and pass it through the deck model, because the same real cover must appear in the library, headers, and loaded jogwheels.

- Keep landscape side video previews independently toggled inside DeckPanel and the master compositor mounted in CenterColumn, so hiding a preview never interrupts mixed output.
- Treat Mixxx as an algorithmic reference only; do not import its native GPL source into the web application without an explicit licensing and native integration decision.
- Retain spectral analysis once per track and lazily rasterise bounded zoom-specific RGB tiles, because enlarged whole-track bitmaps blur and per-frame paths overload phones.
- Use time-stamped coalesced hand paths for browser waveform scratching and match release to the worklet's adaptive delay, because frame-only velocity updates lose fast reversals and early release truncates gestures.
- Keep sync tempo lock separate from phase alignment and re-anchor the playback clock before rate changes, because feedback pitch changes and retroactive clock scaling cause hunting and stutters.
- Define parameterized visual/transition families in `src/lib/dj/videoPresets.ts` and composite them on the existing master canvas, because output recording and hidden deck previews must share the same picture.
- Use a shared searchable effect browser for deck slots and master video selections, because small native selects cannot fit the full library on phones.

- Calculate spectral peaks in per-load browser workers and store them on the deck model, because analysis must not block decoded-track playback or run inside waveform rendering.
- Streaming service selection is an availability-only library view until approved playback integrations exist, because consumer subscriptions do not grant DJ playback APIs.
- Studio clips retain source audio with independent lane, stretch, pitch and reverse metadata; prepare transformed PCM in browser workers and share FX routing for playback/export, because editing must not block audio callbacks or change export timing.
- Prepare genuine stem models explicitly, verify both cached assets by their own keys, and run separation from cached assets after preparation, because first-use downloads are large and offline readiness must be truthful.
