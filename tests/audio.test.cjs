// Run with: node --test tests/audio.test.cjs
// The app intentionally has no build step or test dependencies. These tests
// exercise its actual inline audio code with lightweight Web Audio stubs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const audioStart = html.indexOf('let ac = null, master = null, comp = null;');
const audioEnd = html.indexOf('//  KEYBOARD RENDERING', audioStart);
assert(audioStart >= 0 && audioEnd > audioStart, 'could not find the audio section');
const audioCode = html.slice(audioStart, audioEnd);

class Param {
    constructor(value = 1) { this.value = value; this.events = []; }
    event(type, value, time) { this.events.push({ type, value, time }); this.value = value; return this; }
    setValueAtTime(value, time) { return this.event('set', value, time); }
    linearRampToValueAtTime(value, time) { return this.event('linear', value, time); }
    exponentialRampToValueAtTime(value, time) { return this.event('exponential', value, time); }
    setTargetAtTime(value, time) { return this.event('target', value, time); }
    cancelScheduledValues(time) { this.events.push({ type: 'cancel', time }); }
}
class Node {
    constructor(kind) {
        this.kind = kind;
        for (const name of ['gain', 'frequency', 'detune', 'playbackRate', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = new Param();
    }
    connect(node) { return node; }
    start(time) { this.startedAt = time; }
    stop(time) { this.stoppedAt = time; }
}
class FakeContext {
    constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = new Node('destination'); }
    resume() { return Promise.resolve(); }
    createGain() { return new Node('gain'); }
    createDynamicsCompressor() { return new Node('compressor'); }
    createConvolver() { return new Node('convolver'); }
    createBiquadFilter() { return new Node('filter'); }
    createOscillator() { return new Node('oscillator'); }
    createBufferSource() { return new Node('bufferSource'); }
    createBuffer(channels, length, sampleRate) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return { length, numberOfChannels: channels, sampleRate, getChannelData: channel => data[channel] };
    }
    decodeAudioData(bytes) { return Promise.resolve({ length: 1000, numberOfChannels: 2, url: bytes.url }); }
}
function setup() {
    const requests = [];
    const sandbox = {
        window: { AudioContext: FakeContext, OfflineAudioContext: FakeContext },
        fetch: url => new Promise(resolve => requests.push({ url, resolve })),
        lightKey() {}, strikeKey() {}, updateVoiceReadout() {}, recPush() {},
        sustainBtn: { classList: { toggle() {} } }, recording: false, setTimeout,
        console,
    };
    vm.createContext(sandbox);
    vm.runInContext(audioCode, sandbox, { filename: 'index.html audio' });
    const api = vm.runInContext(`({
        SAMPLE_FILES, SAMPLE_CACHE_LIMIT, sampleBuffers, samplePending, sampleFailures, sampleQueue,
        sampleRoot, requestSample, nearestSample, rememberSample, cachedSample, warmSamples,
        noteOn, violinNoteOn, releaseVoice, voices,
        bytes: () => sampleCacheBytes, loads: () => sampleLoads,
        disableWarmup: () => { samplesWarmed = true; },
        setInstrument: value => { instrument = value; },
        context: () => ac,
    })`, sandbox);
    return { api, requests };
}
const ok = url => ({ ok: true, arrayBuffer: async () => ({ url }) });

test('all sample anchors exist, are cached offline, and minimize pitch shifting', () => {
    const { api } = setup();
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const worker = { self: { addEventListener() {} } };
    vm.runInNewContext(sw + '\nglobalThis.assets = ASSETS;', worker);
    const assets = new Set(worker.assets);
    assert.equal(assets.size, worker.assets.length, 'service-worker assets must be unique');
    for (const [family, samples] of Object.entries(api.SAMPLE_FILES)) {
        for (const [, url] of samples) {
            assert(!url.includes('#'), `${url} would be truncated as a URL fragment`);
            assert(fs.existsSync(path.join(root, url)), `${url} is missing`);
            assert(assets.has(url), `${family} sample ${url} is not cached offline`);
        }
    }
    for (let midi = 21; midi <= 108; midi++) {
        assert(Math.abs(midi - api.sampleRoot('piano', midi).root) <= 1, `piano note ${midi}`);
    }
    for (let midi = 55; midi <= 96; midi++) {
        assert(Math.abs(midi - api.sampleRoot('violin', midi).root) <= 2, `violin note ${midi}`);
    }
    assert.equal(api.sampleRoot('piano', 64).root, 63);
    assert.equal(api.sampleRoot('violin', 64).root, 64);
});

test('warming starts decoding before the real audio context, with bounded concurrency', () => {
    const { api, requests } = setup();
    api.warmSamples();
    assert.equal(api.context(), null, 'warming must not start audible audio');
    assert.equal(api.loads(), 3);
    assert.equal(requests.length, 3);
    assert.equal(api.sampleQueue.length, 10);
    api.warmSamples();
    assert.equal(requests.length, 3, 'warming is started only once');
});

test('sample requests deduplicate and real key presses jump the warming queue', async () => {
    const { api, requests } = setup();
    const first = api.requestSample('piano', 60);
    assert.strictEqual(api.requestSample('piano', 61), first); // same C4 recording
    api.requestSample('piano', 63);
    api.requestSample('piano', 66);
    api.requestSample('piano', 72);
    api.requestSample('piano', 75);
    api.requestSample('piano', 84, true);
    assert.equal(api.sampleQueue[0].root, 84);
    const queued = api.requestSample('piano', 72, true);
    assert.equal(api.sampleQueue[0].root, 72);
    assert.strictEqual(api.requestSample('piano', 72, true), queued);
    assert.equal(requests.length, 3);
    requests[0].resolve(ok(requests[0].url));
    assert(await first);
    assert.equal(requests.length, 4);
    assert(requests[3].url.endsWith('/C5.mp3'), 'the promoted request should run next');
});

test('failed recordings use a cooldown and can be retried', async () => {
    const { api, requests } = setup();
    const first = api.requestSample('piano', 60);
    requests[0].resolve({ ok: false, status: 503 });
    assert.equal(await first, null);
    assert(api.sampleFailures.piano.has(60));
    assert.equal(await api.requestSample('piano', 60), null);
    assert.equal(requests.length, 1, 'do not retry every playback tick');
    api.sampleFailures.piano.set(60, 0);
    const retry = api.requestSample('piano', 60);
    requests[1].resolve(ok(requests[1].url));
    assert(await retry);
    assert(api.sampleBuffers.piano.has(60));
    assert(!api.sampleFailures.piano.has(60));
});

test('a nearby recording is used immediately while the closest anchor loads', () => {
    const { api } = setup();
    const near = { length: 100, numberOfChannels: 2 };
    const exact = { length: 100, numberOfChannels: 2 };
    api.rememberSample('piano', 66, near);
    let sample = api.nearestSample('piano', 64);
    assert.equal(sample.root, 66);
    assert.strictEqual(sample.buffer, near);
    assert(Math.abs(sample.rate - 2 ** (-2 / 12)) < 1e-10);
    assert(api.samplePending.piano.has(63));
    api.rememberSample('piano', 63, exact);
    sample = api.nearestSample('piano', 64);
    assert.equal(sample.root, 63);
    assert.strictEqual(sample.buffer, exact);
    assert(Math.abs(sample.rate - 2 ** (1 / 12)) < 1e-10);
    assert.equal(api.nearestSample('piano', 48), null, 'do not stretch a distant recording excessively');
});

test('decoded sample cache evicts the least recently used buffers', () => {
    const { api } = setup();
    const buffer = () => ({ length: 5 * 1024 * 1024, numberOfChannels: 1 }); // 20 MiB, no allocation
    for (const midi of [60, 63, 66]) api.rememberSample('piano', midi, buffer());
    api.cachedSample('piano', 60); // keep C4 hot
    api.rememberSample('piano', 69, buffer());
    assert(api.sampleBuffers.piano.has(60));
    assert(!api.sampleBuffers.piano.has(63));
    assert(api.sampleBuffers.piano.has(66));
    assert(api.sampleBuffers.piano.has(69));
    assert(api.bytes() <= api.SAMPLE_CACHE_LIMIT);
});

test('piano and violin fallbacks are velocity-sensitive and independent', () => {
    const { api } = setup();
    api.disableWarmup();
    api.noteOn(60, 0.8);
    api.violinNoteOn(60, 0.8);
    const piano = api.voices.get(60), violin = api.voices.get('vn60');
    assert.equal(piano.oscs[0].kind, 'oscillator');
    assert.equal(violin.oscs[0].kind, 'oscillator');
    const pianoPeak = piano.gain.gain.events.find(e => e.type === 'exponential').value;
    const violinPeak = violin.gain.gain.events.find(e => e.type === 'exponential').value;
    assert(Math.abs(pianoPeak - 0.065 * 0.8 ** 1.28) < 1e-9);
    assert(Math.abs(violinPeak - 0.09 * 0.8 ** 1.15) < 1e-9);
    api.releaseVoice(60, false);
    assert(!api.voices.has(60));
    assert(api.voices.has('vn60'));
    api.rememberSample('piano', 60, { length: 100, numberOfChannels: 2 });
    api.noteOn(60, 0.8);
    assert.equal(api.voices.get(60).oscs[0].kind, 'bufferSource');
    api.setInstrument('electric');
    api.noteOn(64, 0.8);
    const electric = api.voices.get(64);
    assert.equal(electric.oscs[0].kind, 'oscillator');
    assert(Math.abs(electric.gain.gain.events.find(e => e.type === 'exponential').value - (0.16 + 0.12 * 0.8)) < 1e-9);
});

test('quick releases preserve the envelope and cannot spike to the default gain', () => {
    const { api } = setup();
    api.disableWarmup();
    api.noteOn(60, 0.8);
    let voice = api.voices.get(60);
    const legacyGain = voice.gain.gain;
    legacyGain.value = 1; // browsers can report this before their first render quantum
    api.releaseVoice(60, true);
    const heldValue = legacyGain.events.filter(e => e.type === 'set').at(-1).value;
    assert(heldValue <= voice.peak, 'legacy release must not jump above the strike level');
    assert(!api.voices.has(60));

    api.violinNoteOn(60, 0.8);
    voice = api.voices.get('vn60');
    const modernGain = voice.gain.gain;
    modernGain.cancelAndHoldAtTime = time => modernGain.events.push({ type: 'hold', time });
    api.releaseVoice('vn60', false);
    assert(modernGain.events.some(e => e.type === 'hold'));
    assert.equal(modernGain.events.at(-1).type, 'exponential');
    assert(!api.voices.has('vn60'));
});

test('song sample lookahead follows tempo, transpose, and instrument', () => {
    const start = html.indexOf('function prefetchSongSamples(t)');
    const end = html.indexOf('function songTickFn()', start);
    assert(start >= 0 && end > start);
    const calls = [];
    const context = { calls, requestSample: (...args) => calls.push(args) };
    vm.createContext(context);
    vm.runInContext(`
        let songStrikes = [[0, 60, 200, 1, ''], [1000, 69, 200, 1, 'vn'],
            [3000, 64, 200, 1, ''], [6000, 72, 200, 1, 'vn']];
        let songPrefetchIdx = 0, songRate = 0.5, songTranspose = 2, instrument = 'grand';
        ${html.slice(start, end)}
        globalThis.run = prefetchSongSamples;
        globalThis.reset = (rate, preset, transpose) => { songPrefetchIdx = 0; songRate = rate; instrument = preset; songTranspose = transpose; };
    `, context);
    context.run(0); // 2,000 ms of song time = 4 seconds at half speed
    assert.deepEqual(calls, [['piano', 62], ['violin', 71]]);
    context.run(1000);
    assert.deepEqual(calls[2], ['piano', 66]);
    assert.equal(calls.length, 3, 'already prefetched notes are not queued again');
    calls.length = 0;
    context.reset(1.5, 'organ', -2);
    context.run(0);
    assert.deepEqual(calls, [['violin', 67], ['violin', 70]], 'non-grand instruments only prefetch violin samples');
});
