# Beta release TODO

Review of `main` at 365f6d6 (2026-11-08). Both test suites pass (`node tests/run_node.js` 41/41, `node --test tests/audio.test.cjs` 10/10).

## Blockers

- [x] **Songs modal can't be closed on a landscape phone.** *(Fixed: the panel is a flex column with a scrolling list inside a scrolling overlay, so Close is always on screen at 844×390; the modal now lives inside `#app` and rotates with it in portrait; backdrop tap and Esc close it too.)*
- [ ] **Licensing: Mariage d'amour.** Paul de Senneville's piece is still under copyright, the score credits Seaweed Melodies for rights, and the arrangement has named arrangers. The full note data ships in `index.html:1214` and `scores/mariage-damour.mxl`. Get permission or remove it from the built-ins (users can still import their own copy). Also confirm where the Jingle Bells and Long, Long Ago arrangements came from, and whether the Suzuki Book 1 piano accompaniments (Lightly Row, May Song) can be redistributed.
- [x] **No A–B loop.** *(Fixed: 🔁 reveals A/B/Clear in the transport. A and B snap to measure starts from MusicXML `<measure>`s and MIDI time-signature events, falling back to the nearest note onset for built-ins and recordings; the range is shown in the transport and looped by the song clock. `parseMusicXML`/`parseMIDI` now return a `bars` array, kept with imported songs across reloads.)*
- [x] **Missed notes play in a burst after the app is backgrounded.** *(Fixed: a hidden tab pauses the song and a visible one resumes it; a tick gap over 250 ms re-seeks instead of replaying every missed strike.)*
- [x] **iPhone silent switch mutes Web Audio.** *(Fixed: `ensureAudio` sets `navigator.audioSession.type = 'playback'` where the API exists.)*
- [x] **Stuck notes from the computer keyboard.** *(Fixed: a `Map` remembers the midi each key struck, so keyup releases the right pitch even after Z/X; window blur and tab hide release everything.)*

## Sound

### Compared with a real performance (May Song)

May Song was rendered with the real `index.html` code (offline in headless Chrome, all samples loaded), aligned note by note to a phone recording of a real violin & piano performance, and compared over the same 12 bars. The real performance doesn't take the repeat.

| | Real recording | App |
|---|---|---|
| Loudness | −17 LUFS | −24 LUFS |
| Bar-to-bar dynamics | −2.6 to +3.2 dB, following the score's f / mf / p | ±0.5 dB, flat |
| Tempo | 48–88 bpm per bar, average 71 | fixed 80 |
| Melody vs piano chords | (reference) | melody 4–5 dB louder |
| Tone above 500 Hz (vs 250–500 Hz) | (reference) | 5–12 dB brighter; 3–6 dB less below 125 Hz |
| Final note fades 20 dB in | 3.2 s | 1.3 s |
| Energy dip between melody notes | −11.7 dB | −10.5 dB (about the same) |

The samples are real instruments and note-to-note articulation is close, so the gap is in performance and room. To close it: *MusicXML dynamics ignored* (the biggest gap), *Violin too loud*, *Overall output is quiet*, *Synthetic reverb* and *No sustain pedal* in the next list, plus the items below.

- [ ] **Keep the piano's right hand when it doubles the violin.** The importer's unison de-dupe gives shared (time, pitch) notes to the violin, so May Song's piano treble staff (44 notes, identical to the violin line) disappears. A real accompanist plays it, and with the violin muted for practice the piano should still carry the tune. Only de-dupe within one instrument.
- [ ] **Make it sound further away.** Besides a longer, darker reverb (see *Synthetic reverb*), add a gentle high-frequency cut (about −6 dB above 2 kHz) and a little low-end warmth on the master. Part of the recording's darkness is the phone mic, so aim halfway, not a full match.
- [ ] **Gentle tempo shaping.** Slow 10–15% at phrase ends and about 25% over the last bar instead of a fixed clock. Keep it subtle; some of the real performance's slow bars are stretched long notes, not something to copy.
- [ ] **Decide May Song's repeat.** The built-in expands the repeat (24 bars, 72 s); the real performance plays the 12 bars once.
- [ ] **Check in the offline renderer.** A small harness that serves `index.html`, swaps in an `OfflineAudioContext`, steps `songTickFn` every 20 ms with `ctx.suspend()` and posts back a WAV renders a song exactly as the app plays it, faster than real time. Keeping it in `tools/` lets sound changes be measured (loudness, balance, tone, decay) instead of judged once by ear.

### Bundled samples and mix

Measured from the bundled MP3s and an approximate re-render of the built-in songs (same gains, envelopes and voicing as `noteOn`/`violinNoteOn`/`computeVoicing`; leaves out filters, reverb and the compressor). These are numbers, not listening tests; confirm by ear.

What's fine: the recordings are long enough (violin sustains 10–14 s, so slowed-down held notes don't run out), and violin attacks are fast (10–80 ms to full level), so short notes still sound.

- [ ] **Decoded-sample cache is too small for the samples.** All bundled recordings decode to ~201 MB at 48 kHz, but `SAMPLE_CACHE_LIMIT` is 64 MiB, so wide-range songs evict and re-decode recordings mid-song. While one reloads, its notes play from a neighbouring recording or the synth, so the timbre wobbles. Trim the silent tails (bass notes run 20–25 s), store mono where it doesn't matter, or raise the limit on desktop.
- [ ] **Uneven piano notes.** Strike loudness (RMS of the first 300 ms) of the `Ds5` sample is **~9 dB below** `C5` and `Fs5`, and `Ds5` plays D5, D♯5 and E5, which are common melody notes in D and A major. The `A2`/`A3`/`A4`/`A5` samples are 3.5–5 dB below their neighbours. Add a per-sample gain trim to `SAMPLE_FILES` (normalise to a smooth curve across the keyboard), and add a test for it.
- [ ] **Violin too loud over the piano.** The violin part is louder than the whole piano part by a median **+5 dB** (Long, Long Ago; Mariage d'amour) to **+9–12 dB** (Lightly Row; Jingle Bells). Against the real May Song recording, the app's melody is 4–5 dB too loud relative to the piano chords. Pull the violin down about 5 dB (`violinNoteOn` peak 0.27 → ~0.15), or add a violin/piano balance slider.
- [ ] **Overall output is quiet.** Mix RMS is about **−30 dBFS** (peaks −10 to −16 dBFS) at the default 70% volume, roughly 15 dB below typical music; the compressor (threshold −18 dB) never engages. Likely too quiet on phone speakers. May Song is −24 LUFS in the app against −17 LUFS in a real phone recording of the piece. Raise the master gain by about 7–10 dB and let the compressor/limiter catch peaks.
- [ ] **No sustain pedal in any built-in song.** All six have `pedal: []`, and the Mariage d'amour score has no pedal markings, so the piano is damped at every written note end. Add an auto-pedal for piano parts without pedal data (e.g. re-pedal on each new bass note or measure), and let the final note ring: in the real May Song recording it takes 3.2 s to fade 20 dB, in the app 1.3 s.
- [x] **MusicXML dynamics ignored.** Every note used to get velocity 90. *(Fixed: `<sound dynamics>` now maps at 0.9 × the value — May Song's 54.44 / 83.33 / 106.67 become p / mf / f at 49 / 75 / 96 — and `<direction><dynamics>` names (ppp–fff, sfz, fp…) set the level when no numeric value is present. Unspecified scores still use 90; dynamics apply per part from where they appear.)* This was the single biggest gap to the real May Song recording, whose bar-to-bar loudness follows the markings (−2.6 to +3.2 dB, quietest at the p in bar 7); worth re-measuring with the fix.
- [x] **Songs never end or loop with Organ or Synth selected.** *(Fixed while making the transport stay up: a hold voice never expires on its own, so the end-of-song condition waited forever. Held voices no longer block the end, and they are cut when the song ends.)*
- [ ] **No violin legato.** 130 slurs in Mariage d'amour are ignored; each violin note restarts its sample, with a fresh bow attack and vibrato. For slurred notes, crossfade (~40 ms) into the next sample, starting past its attack.
- [ ] **Synthetic reverb.** `makeImpulse` (`index.html:338`) is white noise with a power-law decay and no high-frequency damping, which tends to sound hissy. Lowpass the tail over time, or ship a small licensed room impulse response, and aim for about a 2.5–3 s decay with more reverb in the mix; the app's final notes die about 2.5× faster than in the real recording.
- [ ] **One piano velocity layer.** Soft playing is the medium-loud recording turned down and darkened. Known limitation (see `docs/sound-comparison.md`); consider a second layer (e.g. Salamander velocity 4) if size allows.
- [ ] Minor: violin samples are mono and nothing is panned, so both instruments sit dead centre. A slight pan would help separate them.

## Polish

- [x] Remove placeholder UI. *(Fixed: the Freestyle/Chords pill is gone, the banner reads Piano Practice, and ⚙️ opens a help/about panel instead of an alert.)*
- [x] Web MIDI is requested on the first tap anywhere, and Chrome shows a permission prompt for it. *(Fixed: auto-connect only when `permissions.query({name:'midi'})` is already `granted`; otherwise a "Connect MIDI" button requests it on demand.)*
- [x] `apple-touch-icon` is SVG, which iOS ignores. *(Fixed: `icon-180.png`/`icon-192.png`/`icon-512.png`, generated by `tools/make_icons.py` from the SVG shapes, wired into the manifest and the offline cache.)*
- [ ] Accessibility: controls are `<div>`s with emoji. Use `<button aria-label=…>`, and `aria-pressed` on toggles.
- [x] Double-tap-zoom guard cancels the second of two quick taps anywhere, so transpose `+ +` loses a step. *(Fixed: the guard is bound to `#stage` only.)*
- [x] Song end calls `stopSong()` and hides the transport. *(Fixed: `endSong()` stops at the last bar, keeps the transport and lets ▶ replay from the top.)*
- [x] Deleting an imported song (✕) has no confirm or undo. *(Fixed: undo toast, and the song returns to its place in the list.)*

## Beta infrastructure

- [x] Version string in the UI, tied to `CACHE` in `sw.js`. *(Fixed: `APP_VERSION` shows in the help panel; the cache is named `piano-` + that string and a test fails if they drift.)*
- [x] Feedback link (GitHub issue template or form) in the help panel; `window.onerror` toast offering "report this". *(Done, with a once-per-visit guard. There is still no issue template in the repo.)*
- [x] "Update available, reload" toast. *(Fixed: `controllerchange` on the service worker shows a reload toast; the first install is ignored.)*
- [x] CI: GitHub Action running both Node test suites on PRs. *(`.github/workflows/tests.yml`, on pushes and PRs.)*
- [ ] Known-limitations list for testers:
  - MusicXML repeats/endings aren't expanded (likely the top bug report).
  - MIDI import ignores program changes, so MIDI duets get no violin part.
  - Recording drops the sustain pedal; export flattens parts.
  - Imported songs are stored in localStorage (~5 MB cap); consider IndexedDB.
