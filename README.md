# Piano Practice

A browser practice tool for piano and violin. Open a MIDI or MusicXML file, slow it to 60%, loop the four bars that keep falling apart, and watch the notes fall onto the keys.

**[Open the app →](https://hen-ml.github.io/piano/)**

![The practice tool playing Lightly Row at 60% tempo with a loop set](docs/hero.png)

## What it does

- **Your own MIDI and MusicXML files.** Standard `.mid`, `.musicxml` and compressed `.mxl` files play locally in the tab — nothing is uploaded anywhere.
- **Tempo and loop.** 40–150% speed, seek anywhere, loop a range until the passage holds together.
- **USB MIDI keyboard.** Web MIDI in Chrome and Edge; no driver, no install.
- **Computer keyboard.** A–L play the white keys, W–U the sharps, Z/X shift octaves, and Space sustains — no hardware needed.
- **Violin mode.** Labels the first-position notes on the keys and falling bars by string and finger — in string colours. On by default — hit 🎻 to switch it off.
- **Works offline.** Install it to your home screen; the service worker keeps it running without a network.
- **Record and export.** Capture what you played and download it as a `.mid`.

Falling notes and violin fingering are both on by default. Labels, violin mode and your preference for falling notes are remembered on the device.

MusicXML import handles chords, ties, voices, tempo changes and sustain pedal. Repeats and endings are not expanded yet — the score plays through once.

## Violin mode

The piano is the accompaniment, but the notes are still piano notes. Violin mode is on by default — keys and falling bars are labelled the way a violinist thinks: **G1**, **D3**, **A0** — string, then finger (hit 🎻 to switch it off). Notes outside first position stay unlabelled rather than inventing a shift that isn't there.

![Violin mode: falling notes labelled by string and finger; the piano accompaniment splits green (right hand) and purple (left hand)](docs/hero-violin.png)

First position is four notes per string — open string plus three fingers — not every chromatic key in between. On the A string that's A0 = A, A1 = B, A2 = C#, A3 = D; on the E string E0 = E, E1 = F#, E2 = G, E3 = A, and likewise G0–G3 and D0–D3 below them. Only those sixteen notes are labelled: the sharps that belong to the position (C#, F#) keep their labels, while the other black keys stay blank instead of borrowing a neighbour's finger number. It doesn't choose fingerings for you or read sheet music — it shows where the note sits, and you decide how to play it.

The built-in pieces are arranged for duet: the violin line sounds through its own bowed synth (slow attack, vibrato, sawtooth stack), never lights the piano keys, and falls in cyan bars. Piano bars are split by hand using the score's grand staff — green for the treble staff (right hand), purple for the bass staff (left hand). MusicXML imports get the same treatment automatically: violin parts (by part/instrument name or GM program 41) are tagged as the bowed voice, and a part declaring `<staves>2</staves>` has its hands split the same way. Single-staff scores fall back to a middle-C split. At pitches both parts share, the violin takes the note under the bow.

## Run it locally

No build step, no dependencies. Serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` directly from disk mostly works, but the service worker and MIDI loading expect `http://`.

## How it's built

One HTML file with inline CSS and JavaScript, plus a manifest and a service worker. Audio is synthesized with the Web Audio API; MIDI and MusicXML parsing are hand-rolled. No frameworks, no bundler, no network calls.

## Built-in pieces

All built-ins are transcriptions from MusicXML scores, public domain:

- **Lightly Row** (trad. American, Suzuki Violin Bk 1) — violin & piano duet
- **Long, Long Ago** (T.H. Bayly) — violin & piano duet
- **Canon in D** (Johann Pachelbel) — violin & piano duet

Otherwise the app ships no songbook: it accepts any MIDI or MusicXML file you own (compressed `.mxl` included).

## License

**Code:** [MIT](LICENSE) © Ming-Hen (Henry) Tsai · **Built-in song note data:** CC0 1.0 Public Domain Dedication — the melodies (Bayly, Pachelbel, traditional) are public domain, and the transcribed note events are dedicated to the public domain too.

## More experiments

The browser games and other one-file experiments live at [hen-ml/html_games](https://github.com/hen-ml/html_games).
