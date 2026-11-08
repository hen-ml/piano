# Piano Practice

A browser practice tool for piano and violin. Open a MIDI or MusicXML file, slow it to 60%, loop the four bars that keep falling apart, and watch the notes fall onto the keys.

**[Open the app →](https://hen-ml.github.io/piano/)**

![The practice tool playing Lightly Row at 60% tempo with a loop set](docs/hero.png)

## What it does

- **Your own MIDI and MusicXML files.** Standard `.mid`, `.musicxml` and compressed `.mxl` files play locally in the tab — nothing is uploaded anywhere.
- **Tempo and loop.** 40–150% speed, seek anywhere, loop a range until the passage holds together.
- **Play one part yourself.** 🎹 / 🎻 in the transport switch the piano or the violin off mid-song, so you practice your line against the other one. Playback, the falling notes and the keys carry on — only that part's sound stops.
- **USB MIDI keyboard.** Web MIDI in Chrome and Edge; no driver, no install.
- **Computer keyboard.** A–L play the white keys, W–U the sharps, Z/X shift octaves, and Space sustains — no hardware needed.
- **Violin mode.** Labels the first-position notes on the keys and falling bars by string and finger, in the key of the song — in string colours. On by default — hit 🎻 to switch it off, or use the key box to override the detected key.
- **Works offline.** Install it to your home screen; the service worker keeps it running without a network.
- **Record and export.** Capture what you played and download it as a `.mid`.

Falling notes and violin fingering are both on by default. Labels, violin mode, the key override and your preference for falling notes are remembered on the device.

Part mutes are not saved: both parts start on when you open the app, and a mute you set holds while you change tempo, seek, transpose, pause or stop — so setting up "piano off, play it yourself" is one click, not one per take. A part the loaded song doesn't have (a solo piano file has no violin line) shows as unavailable rather than as a button that does nothing.

MusicXML import handles chords, ties, voices, tempo changes and sustain pedal. Repeats and endings are not expanded yet — the score plays through once.

## Violin mode

The piano is the accompaniment, but the notes are still piano notes. Violin mode is on by default — keys and falling bars are labelled the way a violinist thinks: **G1**, **D3**, **A0** — string, then finger (hit 🎻 to switch it off). Notes outside first position stay unlabelled rather than inventing a shift that isn't there.

![Violin mode: falling notes labelled by string and finger; the piano accompaniment splits green (right hand) and purple (left hand)](docs/hero-violin.png)

First position is four notes per string — open string plus three fingers — and **which notes those are depends on the key**. Each finger has a normal spot on the string and a low/high alternative a semitone away; the key decides which one. In D major that's A0 = A, A1 = B, A2 = C#, A3 = D and E0 = E, E1 = F#, E2 = G, E3 = A (low 2 on the E string). In A major the same fingers put G# under E2 and D3 (high 2 / high 3). Only the sixteen in-position notes are labelled: the sharps that belong to the key keep their labels, while the other black keys stay blank instead of borrowing a neighbour's finger number.

The key comes from the file's key signature (MusicXML `<key>` or a MIDI key-signature event), an explicit key on the built-in pieces, or a duration-weighted guess from the notes. The box next to 🎻 shows the detected key and lets you override it — all twelve major and natural-minor keys, remembered on the device. Transposing a song shifts the chart with the notes so the falling bars keep their labels. Key changes *within* a score aren't followed; the first key signature wins.

It shows first position only; it doesn't choose fingerings for you or read sheet music — it shows where the note sits, and you decide how to play it.

The built-in pieces are arranged for duet: the violin line sounds through its own bowed synth (slow attack, vibrato, sawtooth stack), never lights the piano keys, and falls in cyan bars. Piano bars are split by hand using the score's grand staff — green for the treble staff (right hand), purple for the bass staff (left hand). MusicXML imports get the same treatment automatically: violin parts (by part/instrument name or GM program 41) are tagged as the bowed voice, and a part declaring `<staves>2</staves>` has its hands split the same way. Single-staff scores fall back to a middle-C split. At pitches both parts share, the violin takes the note under the bow.

## Run it locally

No build step, no dependencies. Serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` directly from disk mostly works, but the service worker and MIDI loading expect `http://`.

## How it's built

One HTML file with inline CSS and JavaScript, plus a manifest, a service worker and the source MusicXML for the Jingle Bells built-in. Audio is synthesized with the Web Audio API; MIDI and MusicXML parsing are hand-rolled. No frameworks, no bundler, no network calls.

## Built-in pieces

All built-ins are transcriptions from MusicXML scores. The first three are public domain; the easy-chorus Jingle Bells arrangement is by Astra:

- **Lightly Row** (trad. American, Suzuki Violin Bk 1) — violin & piano duet
- **Long, Long Ago** (T.H. Bayly) — violin & piano duet
- **Canon in D** (Johann Pachelbel) — violin & piano duet
- **Jingle Bells** (Astra) — easy chorus in A major, violin & piano duet

The Jingle Bells source score lives in [`scores/jingle_bell.xml`](scores/jingle_bell.xml), so its transcription can be checked against the part names, key signature and grand-staff split.

Otherwise the app ships no songbook: it accepts any MIDI or MusicXML file you own (compressed `.mxl` included).

## License

**Code:** [MIT](LICENSE) © Ming-Hen (Henry) Tsai · **Public-domain built-in song note data:** CC0 1.0 Public Domain Dedication — the melodies (Bayly, Pachelbel, traditional) are public domain, and their transcribed note events are dedicated to the public domain too. The Jingle Bells arrangement is credited to Astra and is not covered by that dedication.

## More experiments

The browser games and other one-file experiments live at [hen-ml/html_games](https://github.com/hen-ml/html_games).
