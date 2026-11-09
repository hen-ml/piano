// Piano Practice — unit tests
// Dependency-free, runs in any browser (tests/runner.html) and in Node (tests/run_node.js).
// Every test exercises the real code in index.html through the `window.PIANO` test hook.

(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.pianoTests = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function check(name, fn) {
        const fails = [];
        const assert = {
            ok(cond, msg) { if (!cond) fails.push(msg); },
            equal(actual, expected, msg) {
                if (!deepEqual(actual, expected))
                    fails.push(msg + '\n  expected: ' + j(expected) + '\n  actual:   ' + j(actual));
            },
            throws(fn, msg) {
                try { fn(); fails.push(msg + ' (no exception thrown)'); }
                catch (e) {}
            }
        };
        try { fn(assert); }
        catch (err) { fails.push('threw: ' + err.message + '\n    ' + err.stack.split('\n').slice(0, 4).join('\n    ')); }
        return { name, ok: fails.length === 0, fails };
    }

    function j(v) {
        try { return JSON.stringify(v); }
        catch (e) { return String(v); }
    }

    function deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a === b;
        if (typeof a !== typeof b) return false;
        if (Array.isArray(a) || Array.isArray(b)) {
            if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
            return true;
        }
        if (typeof a === 'object') {
            const ka = Object.keys(a), kb = Object.keys(b);
            if (ka.length !== kb.length) return false;
            for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
            return true;
        }
        return Number.isNaN(a) && Number.isNaN(b);
    }

    return {
        run: function (P) {
            const results = [];

            // ---------- key signatures ----------
            results.push(check('keyFromFifths: C major', function (a) {
                a.equal(P.keyFromFifths(0, 'major'), { tonic: 0, mode: 'major' });
            }));
            results.push(check('keyFromFifths: G major (1 sharp)', function (a) {
                a.equal(P.keyFromFifths(1, 'major'), { tonic: 7, mode: 'major' });
            }));
            results.push(check('keyFromFifths: F# major (6 sharps)', function (a) {
                a.equal(P.keyFromFifths(6, 'major'), { tonic: 6, mode: 'major' });
            }));
            results.push(check('keyFromFifths: wraps negative fifths (Bb major)', function (a) {
                a.equal(P.keyFromFifths(-2, 'major'), { tonic: 10, mode: 'major' });
            }));
            results.push(check('keyFromFifths: A minor (0 sharps, minor)', function (a) {
                a.equal(P.keyFromFifths(0, 'minor'), { tonic: 9, mode: 'minor' });
            }));
            results.push(check('keyFromFifths: F# minor', function (a) {
                a.equal(P.keyFromFifths(3, 'minor'), { tonic: 6, mode: 'minor' });
            }));

            results.push(check('keyFromValue: parses tonic:mode', function (a) {
                a.equal(P.keyFromValue('2:major'), { tonic: 2, mode: 'major' });
                a.equal(P.keyFromValue('9:minor'), { tonic: 9, mode: 'minor' });
                a.equal(P.keyFromValue('12:major'), { tonic: 0, mode: 'major' }); // wraps
            }));
            results.push(check('keyFromValue: rejects garbage', function (a) {
                a.equal(P.keyFromValue(null), null);
                a.equal(P.keyFromValue(''), null);
                a.equal(P.keyFromValue('garbage'), null);
                a.equal(P.keyFromValue('3:modal'), null);
                a.equal(P.keyFromValue('-1:major'), null);
            }));

            // ---------- violin fingering ----------
            results.push(check('fingerTableFor: D major first position', function (a) {
                const t = P.fingerTableFor({ tonic: 2, mode: 'major' });
                a.equal(t.get(71).text, 'A1');   // A string, finger 1 = B
                a.equal(t.get(73).text, 'A2');   // C#
                a.equal(t.get(74).text, 'A3');   // D
                a.equal(t.get(57).text, 'G1');   // G string, finger 1 = A
                a.equal(t.get(67).text, 'D3');   // D string, finger 3 = G
                a.equal(t.get(80), undefined);   // G# not in D major — unlabelled
            }));
            results.push(check('fingerTableFor: A major uses high 2 / high 3', function (a) {
                const t = P.fingerTableFor({ tonic: 9, mode: 'major' });
                a.equal(t.get(80).text, 'E2');   // E string high 2 = G#
                a.equal(t.get(68).text, 'D3');   // D string high 3 = G#
                a.equal(t.get(67), undefined);   // G natural not in A major
            }));
            results.push(check('fingerTableFor: D minor flattens finger 2', function (a) {
                const t = P.fingerTableFor({ tonic: 2, mode: 'minor' });
                a.equal(t.get(58).text, 'G2');   // G string low 2 = Bb
                a.equal(t.get(59), undefined);   // B natural not in D minor
            }));

            results.push(check('detectKey: C major chord', function (a) {
                const k = P.detectKey([
                    [0, 60, 500, 90, 0], [0, 64, 500, 90, 0], [0, 67, 500, 90, 0]
                ]);
                a.equal(k, { tonic: 0, mode: 'major' });
            }));
            results.push(check('detectKey: empty input returns a valid key', function (a) {
                const k = P.detectKey([]);
                a.ok(typeof k.tonic === 'number' && k.tonic >= 0 && k.tonic <= 11);
                a.ok(k.mode === 'major' || k.mode === 'minor');
            }));

            // defaults: D major, shift 0
            results.push(check('violinFinger: D major default', function (a) {
                a.equal(P.violinFinger(71).text, 'A1');
                a.equal(P.violinFinger(73).text, 'A2');
                a.equal(P.violinFinger(74).text, 'A3');
                a.equal(P.violinFinger(60), null); // C natural not in D major first position
                a.equal(P.violinFinger(61).text, 'G3'); // C# is G string high 3 in D major
            }));
            results.push(check('violinFinger: key override to D minor', function (a) {
                P.setKey('2:minor');
                a.equal(P.violinFinger(58).text, 'G2'); // low 2 = Bb
                a.equal(P.violinFinger(59), null);      // B natural no longer in position
                P.setKey('auto');
                a.equal(P.violinFinger(59).text, 'G2'); // back to D major
                a.equal(P.violinFinger(58), null);
            }));

            // ---------- note names / keyboard ----------
            results.push(check('noteName / isBlack / mtof', function (a) {
                a.equal(P.noteName(60), 'C4');
                a.equal(P.noteName(61), 'C#4');
                a.equal(P.noteName(69), 'A4');
                a.equal(P.noteName(21), 'A0');
                a.equal(P.noteName(108), 'C8');
                a.ok(P.isBlack(61) === true);
                a.ok(P.isBlack(60) === false);
                a.ok(P.isBlack(8) === true);   // G#-1
                a.ok(P.isBlack(7) === false);  // G-1
                a.equal(P.mtof(69), 440);
                a.ok(Math.abs(P.mtof(60) - 261.6255653006) < 0.01);
            }));

            // ---------- event normalization ----------
            results.push(check('normalizeEvents: simple {notes, beat} form', function (a) {
                a.equal(P.normalizeEvents({ notes: [[60, 1], [64, 1]], beat: 500 }),
                    [[0, 60, 460, 95, 0], [500, 64, 460, 95, 0]]);
            }));
            results.push(check('normalizeEvents: pre-normalized events pass through', function (a) {
                const ev = [[1, 2, 3, 4, 5]];
                a.equal(P.normalizeEvents({ events: ev }), ev);
            }));

            // ---------- voicing ----------
            function voicingWeights(events) {
                // the engine returns a Float32Array; round off float32 noise
                return JSON.stringify(Array.from(P.computeVoicing(events)).map(function (x) {
                    return Math.round(x * 1000) / 1000;
                }));
            }
            results.push(check('computeVoicing: single note', function (a) {
                a.equal(voicingWeights([[0, 60, 100, 90, 0, '']]), JSON.stringify([1.05]));
            }));
            results.push(check('computeVoicing: bowed voice always carries', function (a) {
                a.equal(voicingWeights([[0, 60, 100, 90, 0, 'vn']]), JSON.stringify([1.16]));
            }));
            results.push(check('computeVoicing: chord roles', function (a) {
                // bass 60, inner 64, top 67
                a.equal(voicingWeights([
                    [0, 60, 100, 90, 0, ''],
                    [0, 64, 100, 90, 0, ''],
                    [0, 67, 100, 90, 0, '']
                ]), JSON.stringify([0.94, 0.72, 1.22]));
            }));
            results.push(check('computeVoicing: vn keeps 1.16 even under a piano top note', function (a) {
                a.equal(voicingWeights([
                    [0, 60, 100, 90, 0, 'vn'],
                    [0, 67, 100, 90, 0, '']
                ]), JSON.stringify([1.16, 1.22]));
            }));

            // ---------- strike deadlines / pedal ----------
            results.push(check('strikeDeadlines: violin note', function (a) {
                a.equal(JSON.stringify(P.strikeDeadlines(100, 500, true)), JSON.stringify({ sound: 600, lit: 0 }));
            }));
            results.push(check('strikeDeadlines: piano short note', function (a) {
                a.equal(JSON.stringify(P.strikeDeadlines(100, 500, false)), JSON.stringify({ sound: 600, lit: 600 }));
            }));
            results.push(check('strikeDeadlines: piano note capped by string decay', function (a) {
                // grand decay 6.2 s → ring 6200 ms
                a.equal(JSON.stringify(P.strikeDeadlines(100, 70000, false)), JSON.stringify({ sound: 6300, lit: 6300 }));
            }));
            results.push(check('pedalReleaseAt: held through release', function (a) {
                a.equal(P.pedalReleaseAt([[1000, true], [2000, false]], 1500), 2000);
            }));
            results.push(check('pedalReleaseAt: after release, no damper', function (a) {
                a.equal(P.pedalReleaseAt([[1000, true], [2000, false]], 2500), 2500);
            }));
            results.push(check('pedalReleaseAt: down before first event', function (a) {
                a.equal(P.pedalReleaseAt([[1000, true], [2000, false]], 500), 500);
            }));
            results.push(check('pedalReleaseAt: down, never lifted', function (a) {
                a.equal(P.pedalReleaseAt([[1000, true]], 1500), 1500);
            }));
            results.push(check('pedalReleaseAt: up event ignored', function (a) {
                a.equal(P.pedalReleaseAt([[1000, false]], 1500), 1500);
            }));

            // ---------- transport formatting ----------
            results.push(check('fmtT', function (a) {
                a.equal(P.fmtT(0), '0:00');
                a.equal(P.fmtT(5000), '0:05');
                a.equal(P.fmtT(65000), '1:05');
                a.equal(P.fmtT(600000), '10:00');
            }));

            // ---------- MIDI parse ----------
            // DataView wants a real ArrayBuffer, not a Uint8Array view
            function toBuffer(u8) { return u8.buffer.slice(u8.byteOffset, u8.byteLength); }

            results.push(check('parseMIDI: notes, key signature, tempo', function (a) {
                const buf = buildMidiFile([
                    [0, 0x90, 0x3c, 0x64],              // note on C4, vel 100, delta 0
                    [...vlq(480), 0x80, 0x3c, 0x40]     // note off 480 ticks later
                ]);
                const out = P.parseMIDI(toBuffer(buf));
                a.ok(Array.isArray(out));
                a.equal(out[0], [0, 60, 500, 100, 0]);  // 480 ticks @ 480 tpb, 500000 µs/beat = 500 ms
                a.equal(out.key, { tonic: 0, mode: 'major' });
                a.equal(out.pedal, []);
            }));

            // ---------- MIDI export + round trip ----------
            results.push(check('eventsToMIDI: valid SMF and round trip', function (a) {
                const ev = [[0, 60, 500, 100, 0], [600, 64, 300, 80, 0]];
                const bytes = P.eventsToMIDI(ev);
                a.equal(bytes[0], 0x4d); a.equal(bytes[1], 0x54);
                a.equal(bytes[2], 0x68); a.equal(bytes[3], 0x64); // 'MThd'
                a.ok(indexOfSub(bytes, strBytes('MTrk')) >= 0);
                a.ok(bytes.length >= 3 &&
                    bytes[bytes.length - 3] === 0xff &&
                    bytes[bytes.length - 2] === 0x2f &&
                    bytes[bytes.length - 1] === 0x00); // end of track
                const back = P.parseMIDI(toBuffer(bytes));
                a.equal(back[0], [0, 60, 500, 100, 0]);
                a.equal(back[1], [600, 64, 300, 80, 0]);
            }));

            // ---------- MusicXML parse ----------
            results.push(check('parseMusicXML: simple score', function (a) {
                const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <movement-title>Test Tune</movement-title>
  <identification><creator type="composer">T. Composer</creator></identification>
  <part-list>
    <score-part id="P1">
      <part-name>Violin I</part-name>
      <score-instrument id="I1"><instrument-name>Violin</instrument-name></score-instrument>
      <midi-instrument id="I1"><midi-program>41</midi-program></midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key></attributes>
      <sound tempo="120"/>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      <note><chord/><pitch><step>E</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`;
                const out = P.parseMusicXML(xml);
                a.equal(out.title, 'Test Tune');
                a.equal(out.composer, 'T. Composer');
                a.equal(out.key, { tonic: 0, mode: 'major' });
                a.equal(out.kind, 'musicxml');
                // one quarter at 120 BPM = 500 ms; chord shares the start
                a.equal(out[0], [0, 60, 500, 90, 0, 'vn']);
                a.equal(out[1], [0, 65, 500, 90, 0, 'vn']); // E#4
                a.equal(out.pedal, []);
            }));
            results.push(check('parseMusicXML: ties merge into one note', function (a) {
                const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="start"/></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/></note>
    </measure>
  </part>
</score-partwise>`;
                const out = P.parseMusicXML(xml);
                a.equal(out.length, 1);
                a.equal(out[0][0], 0);
                a.equal(out[0][1], 60);
                a.equal(out[0][2], 1000); // tied: two quarters = 1000 ms
            }));
            results.push(check('parseMusicXML: dynamics set the note velocity', function (a) {
                const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><direction-type><dynamics><ff/></dynamics></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <sound dynamics="50"/>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
                const out = P.parseMusicXML(xml);
                a.equal(out[0][3], 112);   // ff
                a.equal(out[1][3], 45);    // <sound dynamics="50"> → 0.9 × 50
                a.equal(out[2][3], 45);    // and it holds for the notes that follow
            }));
            results.push(check('parseMusicXML: rejects bad input', function (a) {
                a.throws(function () { P.parseMusicXML('not xml at all'); }, 'garbage throws');
                a.throws(function () { P.parseMusicXML('<score-timewise/>'); }, 'timewise throws');
                a.throws(function () { P.parseMusicXML('<nope/>'); }, 'non-score throws');
            }));

            // ---------- A–B loop: bar lines and snapping ----------
            results.push(check('parseMusicXML: measure starts for the loop range', function (a) {
                const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>';
                const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes><sound tempo="120"/>${note}
    </measure>
    <measure number="2">${note}</measure>
    <measure number="3">${note}</measure>
  </part>
</score-partwise>`;
                const out = P.parseMusicXML(xml);
                // a whole note per bar at 120 BPM: 4 quarters = 2000 ms
                a.equal(out.bars, [0, 2000, 4000]);
            }));
            results.push(check('midiBarTicks: bars follow the time signature', function (a) {
                // 3/4 at 480 ticks per quarter: 1440 ticks a bar
                a.equal(P.barTicks([{ tick: 0, num: 3, den: 4 }], 3000, 480), [0, 1440, 2880]);
                // 4/4 for two bars, then 3/4 from tick 3840
                a.equal(P.barTicks([{ tick: 0, num: 4, den: 4 }, { tick: 3840, num: 3, den: 4 }], 6000, 480),
                    [0, 1920, 3840, 5280]);
            }));
            results.push(check('parseMIDI: time signature becomes bar lines', function (a) {
                const bytes = buildMidiFile([
                    [0, 0xff, 0x58, 0x04, 0x02, 0x02, 0x18, 0x08],   // 2/4
                    [0, 0x90, 60, 100],
                    [0x87, 0x40, 0x80, 60, 0],                        // +960 ticks = one bar
                ]);
                const out = P.parseMIDI(toBuffer(bytes));
                a.equal(out.bars, [0, 1000]);   // 960 ticks at 120 BPM
            }));
            results.push(check('snapToGrid: nearest bar line, never past the song', function (a) {
                const bars = [0, 1000, 2000, 3000];
                a.equal(P.snapToGrid(1150, bars), 1000, 'rounds down to the nearer bar');
                a.equal(P.snapToGrid(1810, bars), 2000, 'rounds up to the nearer bar');
                a.equal(P.snapToGrid(-40, bars), 0, 'never before the start');
                a.equal(P.snapToGrid(1e9, bars), 3000, 'never past the last bar');
            }));

            // ---------- built-in songs ----------
            results.push(check('built-in songs load', function (a) {
                const ids = P.songs();
                a.ok(ids.includes('lightlyrow'));
                a.ok(ids.includes('maysong'));
                a.ok(ids.includes('longlongago'));
                a.ok(ids.includes('canonind'));
                a.ok(ids.includes('jinglebells'));
            }));
            results.push(check('May Song: piano right hand mirrors the violin', function (a) {
                const ev = P.songEvents('maysong');
                const pick = e => [e[0], e[1], e[2]].join(':');
                const vn = ev.filter(e => e[5] === 'vn').map(pick);
                const rh = ev.filter(e => e[5] === 'rh').map(pick);
                const lh = ev.filter(e => e[5] === 'lh');
                a.ok(vn.length > 0, 'song has a violin line');
                a.equal(rh, vn, 'every violin note is doubled by the right hand');
                a.ok(lh.length > 0, 'song has a left hand');
                // both hands are piano, so the part mute sees one piano part
                a.ok(rh.every(e => e[0] < 72000), 'right hand notes are inside the 24 bars');
            }));

            const pass = results.filter(r => r.ok).length;
            const fail = results.filter(r => !r.ok).length;
            return { results, pass, fail, total: results.length };
        }
    };

    // ---------- test helpers (inside closure) ----------

    function vlq(n) {
        const out = [n & 0x7f]; n >>>= 7;
        while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>>= 7; }
        return out;
    }

    function buildMidiFile(trackEvents) {
        const track = [0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,   // tempo 500000 @ tick 0
                       0, 0xff, 0x59, 0x02, 0x00, 0x00];         // key signature C major
    // each event in trackEvents already carries its own leading delta bytes
    for (const ev of trackEvents) for (const b of ev) track.push(b);
        track.push(0, 0xff, 0x2f, 0x00); // end of track
        const header = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0]); // 1 track, 480 tpb
        const trackHead = new Uint8Array([0x4d, 0x54, 0x72, 0x6b,
            (track.length >>> 24) & 0xff, (track.length >>> 16) & 0xff, (track.length >>> 8) & 0xff, track.length & 0xff]);
        const all = new Uint8Array(header.length + trackHead.length + track.length);
        all.set(header, 0);
        all.set(trackHead, header.length);
        all.set(track, header.length + trackHead.length);
        return all;
    }

    function strBytes(s) { const out = []; for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; }
    function indexOfSub(haystack, needle) {
        for (let i = 0; i <= haystack.length - needle.length; i++) {
            let match = true;
            for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) { match = false; break; }
            if (match) return i;
        }
        return -1;
    }
});
