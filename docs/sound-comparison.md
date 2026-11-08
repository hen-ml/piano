# Piano and violin sound comparison

The acoustic presets are based on recordings, not entirely on oscillators. Previously, however, the first strike needing each sample used a procedural synth while that recording loaded. This made the same key sound different on the next strike.

## What was measured

Rendered a held middle C (MIDI 60) at velocity 0.8 with the app's Web Audio graph in a 44.1 kHz stereo `OfflineAudioContext`, at the default 70% volume, using seeded randomness for repeatability. The reference is the app's own bundled C4 recording played through the same graph, not a separate recording of another piano or violin. Values are RMS across both channels in the 0.1–0.5 seconds after the strike; individual notes, devices, and rooms will vary.

| Voice | Old fallback / recorded sample | Revised fallback / recorded sample |
| --- | ---: | ---: |
| Piano | +11.4 dB | −0.6 dB |
| Violin | +9.9 dB | −1.2 dB |

The old piano synth also decayed differently: its RMS was about 20 dB above the recording over the 1–2 second interval. The synthesized violin had a brighter, more uniform spectrum than the recording. Matching loudness alone cannot reproduce an instrument's hammer, bow, body resonances, or natural changes over time.

The old piano recordings were spaced as far as nine semitones apart, making some notes play up to four semitones away from their source. For example, E4 was made by speeding up C4 by four semitones. That also sped up the recorded attack and decay, not just the pitch.

## Changes

- Use the additional D-sharp and F-sharp piano samples from the same source. Across the standard 88 keys, the closest bundled recording is now at most one semitone away once decoded. Additional violin anchors reduce its maximum shift from three to two semitones within the bundled violin range. While the closest recording is loading, a nearby decoded recording may be shifted by up to three semitones for piano or two for violin.
- Decode a small selection of commonly used notes ahead of the first gesture without starting audible audio. Song playback also prefetches recordings up to four real-time seconds ahead, following tempo and transposition.
- While the closest sample loads, use a nearby decoded recording when possible. If none is available, the keyboard still responds immediately with a level-matched procedural fallback; it does not wait for the network. Sample loads are deduplicated, concurrency is limited, failures can be retried, and an LRU cache limits retained decoded samples to 64 MiB.
- Preserve more of the recorded attacks, shorten the piano damper release, and make the piano fallback's higher harmonics and treble notes decay faster. The violin fallback is also substantially quieter.
- Hold the current gain envelope on release or retrigger. Previously, a very fast release before the first audio render could read the default gain of 1 and create a brief level spike, especially in the synthesized voice.

These changes reduce the measured jumps; they do not make the fallback identical to the recordings. The piano still has only one recorded velocity layer, so velocity affects level and filtering rather than selecting a different recording. Notes outside the bundled ranges may be shifted farther, and an immediate first strike can still use the synth if neither its recording nor a nearby one is ready. The recordings themselves can also vary in tone and level, and the app does not simulate all the interactions of a real piano or violin.

The underlying recordings and licenses are listed in [AUDIO_CREDITS.md](../AUDIO_CREDITS.md). Run `node --test tests/audio.test.cjs` to check sample mapping, loading, caching, fallback behavior, and song lookahead.
