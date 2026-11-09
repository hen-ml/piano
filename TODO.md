# Beta release TODO

Review of `main` at 365f6d6 (2026-11-08). Both test suites pass (`node tests/run_node.js` 37/37, `node --test tests/audio.test.cjs` 9/9).

## Blockers

- [ ] **Songs modal can't be closed on a landscape phone.** At 844×390 the panel is taller than the screen with only the six built-ins: the header is cut off and Close is off-screen. It has no `max-height`/scroll (and `* { touch-action: none }` blocks touch scrolling), and Close is the only way out: no backdrop tap, no Esc (`index.html:2099`). On a portrait phone, `#songsModal` sits outside the rotated `#app` (`index.html:306`), so it shows sideways relative to the app.
- [ ] **Licensing: Mariage d'amour.** Paul de Senneville's piece is still under copyright, the score credits Seaweed Melodies for rights, and the arrangement has named arrangers. The full note data ships in `index.html:1214` and `scores/mariage-damour.mxl`. Get permission or remove it from the built-ins (users can still import their own copy). Also confirm where the Jingle Bells and Long, Long Ago arrangements came from, and whether the Suzuki Book 1 piano accompaniments (Lightly Row, May Song) can be redistributed.
- [ ] **No A–B loop.** README, `og:description` and the tagline promise "loop any bars", but 🔁 only restarts the whole song at the end (`index.html:1396`). Build set-A/set-B (snap to measures for MusicXML), or change the copy.
- [ ] **Missed notes play in a burst after the app is backgrounded.** The song clock is `performance.now()` (`index.html:1267`); after a screen lock or app switch, `songTickFn` fires every missed strike at once (`index.html:1386`). Pause on `visibilitychange`, and `seekTo(t)` instead of catching up when the tick gap is more than ~250 ms.
- [ ] **iPhone silent switch mutes Web Audio.** Add `if (navigator.audioSession) navigator.audioSession.type = 'playback'`.
- [ ] **Stuck notes from the computer keyboard.** `keyup` works out the note from the *current* octave (`index.html:1041`): hold A, press X, release A, and the first note never releases (forever with Organ/Synth, `hold: true`). Same on window blur. Keep a `Map` from key to midi; release all on `blur`.

## Sound

Measured from the bundled MP3s and an approximate re-render of the built-in songs (same gains, envelopes and voicing as `noteOn`/`violinNoteOn`/`computeVoicing`; leaves out filters, reverb and the compressor). These are numbers, not listening tests; confirm by ear.

What's fine: the recordings are long enough (violin sustains 10–14 s, so slowed-down held notes don't run out), and violin attacks are fast (10–80 ms to full level), so short notes still sound.

- [ ] **Decoded-sample cache is too small for the samples.** All bundled recordings decode to ~201 MB at 48 kHz, but `SAMPLE_CACHE_LIMIT` is 64 MiB, so wide-range songs evict and re-decode recordings mid-song. While one reloads, its notes play from a neighbouring recording or the synth, so the timbre wobbles. Trim the silent tails (bass notes run 20–25 s), store mono where it doesn't matter, or raise the limit on desktop.
- [ ] **Uneven piano notes.** Strike loudness (RMS of the first 300 ms) of the `Ds5` sample is **~9 dB below** `C5` and `Fs5`, and `Ds5` plays D5, D♯5 and E5, which are common melody notes in D and A major. The `A2`/`A3`/`A4`/`A5` samples are 3.5–5 dB below their neighbours. Add a per-sample gain trim to `SAMPLE_FILES` (normalise to a smooth curve across the keyboard), and add a test for it.
- [ ] **Violin probably too loud over the piano.** The violin part is louder than the whole piano part by a median **+5 dB** (Long, Long Ago; Mariage d'amour) to **+9–12 dB** (Lightly Row; Jingle Bells). Try pulling the violin down 4–6 dB, or add a violin/piano balance slider.
- [ ] **Overall output is quiet.** Mix RMS is about **−30 dBFS** (peaks −10 to −16 dBFS) at the default 70% volume, roughly 15 dB below typical music; the compressor (threshold −18 dB) never engages. Likely too quiet on phone speakers. Raise the master gain by about 10 dB and let the compressor/limiter catch peaks.
- [ ] **No sustain pedal in any built-in song.** All six have `pedal: []`, and the Mariage d'amour score has no pedal markings, so the piano is damped at every written note end. Add an auto-pedal for piano parts without pedal data (e.g. re-pedal on each new bass note or measure).
- [ ] **MusicXML dynamics ignored.** Every note gets velocity 90 (`parseMusicXML`). The Mariage d'amour score marks mp → ff (14 markings) and it plays flat. Read `<dynamics>` and `<sound dynamics>`.
- [ ] **No violin legato.** 130 slurs in Mariage d'amour are ignored; each violin note restarts its sample, with a fresh bow attack and vibrato. For slurred notes, crossfade (~40 ms) into the next sample, starting past its attack.
- [ ] **Synthetic reverb.** `makeImpulse` (`index.html:338`) is white noise with a power-law decay and no high-frequency damping, which tends to sound hissy. Lowpass the tail over time, or ship a small licensed room impulse response.
- [ ] **One piano velocity layer.** Soft playing is the medium-loud recording turned down and darkened. Known limitation (see `docs/sound-comparison.md`); consider a second layer (e.g. Salamander velocity 4) if size allows.
- [ ] Minor: violin samples are mono and nothing is panned, so both instruments sit dead centre. A slight pan would help separate them.

## Polish

- [ ] Remove placeholder UI: "Freestyle" (no handler), "Chords" (plays a C chord, `index.html:1105`), "IMPALA-STYLE WEB PIANO" banner (`index.html:298`), ⚙️ `alert()` titled "Web Piano". Use one name, Piano Practice; replace alerts with a small help/about panel.
- [ ] Web MIDI is requested on the first tap anywhere (`index.html:2216`), and Chrome shows a permission prompt for it. Only auto-connect if `navigator.permissions.query({name:'midi'})` is already `granted`; otherwise add a "Connect MIDI keyboard" button.
- [ ] `apple-touch-icon` is SVG, which iOS ignores. Add a 180px PNG, plus 192/512 PNGs in `manifest.json`.
- [ ] Accessibility: controls are `<div>`s with emoji. Use `<button aria-label=…>`, and `aria-pressed` on toggles.
- [ ] Double-tap-zoom guard (`index.html:1133`) cancels the second of two quick taps anywhere, so transpose `+ +` loses a step. Limit it to `#stage`.
- [ ] Song end calls `stopSong()` and hides the transport. Stop at the end and keep the transport visible instead.
- [ ] Deleting an imported song (✕) has no confirm or undo.

## Beta infrastructure

- [ ] Version string in the UI, tied to `CACHE` in `sw.js`.
- [ ] Feedback link (GitHub issue template or form) in the help panel; `window.onerror` toast offering "report this".
- [ ] "Update available, reload" toast. The service worker serves cache first, so fixes reach users one load late.
- [ ] CI: GitHub Action running both Node test suites on PRs.
- [ ] Known-limitations list for testers:
  - MusicXML repeats/endings aren't expanded (likely the top bug report).
  - MIDI import ignores program changes, so MIDI duets get no violin part.
  - Recording drops the sustain pedal; export flattens parts.
  - Imported songs are stored in localStorage (~5 MB cap); consider IndexedDB.
