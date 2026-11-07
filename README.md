# Piano Practice

A browser practice tool for piano and violin. Open a MIDI or MusicXML file, slow it to 60%, loop the four bars that keep falling apart, and watch the notes fall onto the keys.

**[Open the app →](https://hen-ml.github.io/piano/)**

![The practice tool playing May Song at 60% tempo with a loop set](docs/hero.png)

## What it does

- **Your own MIDI and MusicXML files.** Standard `.mid`, `.musicxml` and compressed `.mxl` files play locally in the tab — nothing is uploaded anywhere.
- **Tempo and loop.** 40–150% speed, seek anywhere, loop a range until the passage holds together.
- **USB MIDI keyboard.** Web MIDI in Chrome and Edge; no driver, no install.
- **Computer keyboard.** A–L play the white keys, W–U the sharps, Z/X shift octaves, and Space sustains — no hardware needed.
- **Violin mode.** Labels every key and falling note by string and finger, first position, colour-coded per string. On by default — hit 🎻 to switch it off.
- **Works offline.** Install it to your home screen; the service worker keeps it running without a network.
- **Record and export.** Capture what you played and download it as a `.mid`.

Falling notes and violin fingering are both on by default. Labels, violin mode and your preference for falling notes are remembered on the device.

MusicXML import handles chords, ties, voices, tempo changes and sustain pedal. Repeats and endings are not expanded yet — the score plays through once.

## Violin mode

The piano is the accompaniment, but the notes are still piano notes. Violin mode is on by default — every key and falling bar is labelled the way a violinist thinks: **G1**, **D3**, **A0** — string, then finger (hit 🎻 to switch it off). Notes outside first position stay unlabelled rather than inventing a shift that isn't there.

![Violin mode: falling notes coloured by string with labels like G1, D1 and A0](docs/hero-violin.png)

It shows first position only. It doesn't choose fingerings for you or read sheet music — it shows where the note sits, and you decide how to play it.

Built-in **Lightly Row** is the exception arranged for duet: the violin line sounds through its own bowed synth (slow attack, vibrato, sawtooth stack), never lights the piano keys, and falls in cyan bars. Piano bars are split by hand at middle C — bright purple for the right hand, deep for the left. At pitches both parts share, the violin takes the note under the bow.

## Run it locally

No build step, no dependencies. Serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` directly from disk mostly works, but the service worker and MIDI loading expect `http://`.

## How it's built

One HTML file with inline CSS and JavaScript, plus a manifest and a service worker. Audio is synthesized with the Web Audio API; MIDI and MusicXML parsing are hand-rolled. No frameworks, no bundler, no network calls.

## Built-in pieces

May Song, Long, Long Ago, Lightly Row (violin & piano duet), Clair de Lune, and Canon in D. Copyrighted arrangements are hidden by default; the app ships public-domain pieces and accepts any MIDI file you own.

## More experiments

The browser games and other one-file experiments live at [hen-ml/html_games](https://github.com/hen-ml/html_games).
