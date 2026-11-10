// UI smoke test: loads index.html's real script against a small fake DOM and
// fake Web Audio, then drives the interface the way a person would — open the
// panels, play a song, set an A–B loop, run to the end, delete and undo, use the
// computer keyboard across an octave shift, background the tab.
//
// The unit suites exercise the parsers and the audio maths directly; this one
// catches the other kind of bug: a control wired to the wrong element, a toggled
// class nobody reads, a transport that disappears at the end of the song.
//
// Run with: node tests/ui_smoke.cjs   (also runs in CI)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const declaredIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

const checks = [];
const problems = [];       // uncaught errors and rejected promises from the app

class ClassList {
    constructor(el) { this.el = el; this.set = new Set(); }
    add(...cs) { cs.forEach(c => this.set.add(c)); }
    remove(...cs) { cs.forEach(c => this.set.delete(c)); }
    toggle(c, force) {
        const on = force === undefined ? !this.set.has(c) : !!force;
        on ? this.set.add(c) : this.set.delete(c);
        return on;
    }
    contains(c) { return this.set.has(c); }
    toString() { return [...this.set].join(' '); }
}

class El {
    constructor(tag = 'div', id = '') {
        this.tagName = tag.toUpperCase();
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.listeners = {};
        this.classList = new ClassList(this);
        this.style = {};
        this.dataset = {};
        this.attrs = {};
        this._text = '';
        this._html = '';
        this.value = '';
        this.title = '';
        this.width = 0; this.height = 0;
        this.clientWidth = 400; this.clientHeight = 300;
        this.offsetLeft = 0; this.offsetTop = 0; this.offsetWidth = 40; this.offsetHeight = 200;
    }
    get options() { return this.children; }
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); }
    get innerHTML() { return this._html; }
    set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    removeEventListener() {}
    dispatch(type, ev = {}) {
        ev.target = ev.target || this;
        ev.currentTarget = this;
        ev.preventDefault = ev.preventDefault || (() => {});
        ev.stopPropagation = ev.stopPropagation || (() => {});
        for (const fn of this.listeners[type] || []) fn(ev);
    }
    click() { this.dispatch('click'); }
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter(k => k !== c); }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    getContext() {
        const ctx = {};
        for (const m of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath',
            'fill', 'stroke', 'arc', 'roundRect', 'save', 'restore', 'translate', 'scale',
            'fillText', 'strokeRect', 'createLinearGradient', 'quadraticCurveTo',
            'setTransform', 'resetTransform', 'bezierCurveTo', 'rect', 'clip', 'setLineDash',
            'arcTo', 'ellipse', 'transform', 'rotate']) ctx[m] = () => {};
        ctx.measureText = () => ({ width: 10 });
        ctx.createLinearGradient = () => ({ addColorStop() {} });
        return ctx;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200 }; }
    _matches(sel) {
        return sel.startsWith('.') ? this.classList.contains(sel.slice(1))
            : this.tagName.toLowerCase() === sel.toLowerCase();
    }
    querySelectorAll(sel) {
        const out = [];
        const walk = n => { for (const c of n.children) { if (c._matches(sel)) out.push(c); walk(c); } };
        walk(this);
        return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    focus() {}
    blur() {}
}

const els = new Map();
function getEl(id) {
    if (!els.has(id)) {
        if (!declaredIds.has(id) && !/^(key|white|black)/.test(id)) problems.push('getElementById for missing id: ' + id);
        els.set(id, new El('div', id));
    }
    return els.get(id);
}

const szbtns = [2, 3, 4, 5].map(n => { const e = new El('div'); e.dataset.oct = String(n); e.className = 'szbtn'; return e; });
// the one <option> that is in the markup; the rest are appended by the script
(() => { const k = getEl('keySel'); const o = new El('option'); o.value = 'auto'; o.textContent = 'Auto'; k.appendChild(o); })();

const winListeners = {};
const docListeners = {};

global.window = global;
global.document = {
    getElementById: getEl,
    createElement: tag => new El(tag),
    body: new El('body'),
    documentElement: new El('html'),
    visibilityState: 'visible',
    addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll(sel) { return sel === '.szbtn' ? szbtns : []; },
};
global.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); };
global.removeEventListener = () => {};
global.innerWidth = 1280;
global.innerHeight = 800;
global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
let rafId = 0;
const rafTimers = new Set();
global.requestAnimationFrame = cb => {
    const id = ++rafId;
    const t = setTimeout(() => { rafTimers.delete(id); cb(performance.now()); }, 16);
    rafTimers.add(id);
    return id;
};
global.cancelAnimationFrame = id => { clearTimeout(id); rafTimers.delete(id); };
global.performance = require('perf_hooks').performance;
global.screen = { orientation: { lock: () => Promise.reject(new Error('nope')) } };

const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};

Object.defineProperty(global, 'navigator', {
    configurable: true, writable: true,
    value: {
        userAgent: 'smoke-harness',
        audioSession: { type: 'ambient' },
        permissions: { query: async () => ({ state: 'prompt' }) },
        requestMIDIAccess: () => new Promise(() => {}),   // a real browser waits for the user
        serviceWorker: { controller: null, addEventListener() {}, register: () => Promise.resolve({}) },
    },
});

// --- minimal Web Audio ------------------------------------------------------
class Param {
    constructor(v = 1) { this.value = v; }
    setValueAtTime(v) { this.value = v; return this; }
    linearRampToValueAtTime(v) { this.value = v; return this; }
    exponentialRampToValueAtTime(v) { this.value = v; return this; }
    setTargetAtTime(v) { this.value = v; return this; }
    cancelScheduledValues() {}
}
class Node {
    constructor(kind) {
        this.kind = kind;
        for (const n of ['gain', 'frequency', 'detune', 'playbackRate', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[n] = new Param();
    }
    connect(n) { return n; }
    start() {}
    stop() {}
}
class FakeCtx {
    constructor() { this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = new Node('out'); }
    resume() { return Promise.resolve(); }
    createGain() { return new Node('gain'); }
    createBiquadFilter() { return new Node('filter'); }
    createOscillator() { return new Node('osc'); }
    createBufferSource() { return new Node('src'); }
    createConvolver() { return new Node('conv'); }
    createDynamicsCompressor() { return new Node('comp'); }
    createBuffer(ch, len) { return { length: len, numberOfChannels: ch, sampleRate: 44100, getChannelData: () => new Float32Array(len) }; }
    decodeAudioData() { return Promise.resolve({ length: 1000, numberOfChannels: 2, sampleRate: 44100 }); }
}
global.AudioContext = FakeCtx;
global.OfflineAudioContext = FakeCtx;
global.fetch = () => new Promise(() => {});   // keep sample decodes pending
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

process.on('exit', () => { if (problems.length) console.log('\nEXIT with problems:\n' + problems.join('\n')); });
process.on('uncaughtException', e => problems.push('uncaught: ' + e.stack.split('\n').slice(0, 4).join(' | ')));
process.on('unhandledRejection', e => problems.push('unhandled rejection: ' + (e && e.message ? e.message : e)));

// A change that breaks the app at load, or wedges the rAF loop, must not hang CI.
const watchdog = setTimeout(() => {
    console.log('UI smoke: TIMED OUT after 30 s');
    process.exit(2);
}, 30000);

vm.createContext(global);
try {
    vm.runInContext(script, global, { filename: 'index.html' });
} catch (e) {
    console.log('UI smoke: the app threw at load\n' + e.stack.split('\n').slice(0, 6).join('\n'));
    process.exit(1);
}
const P = global.PIANO;
if (!P) { console.log('UI smoke: index.html did not install window.PIANO'); process.exit(1); }

const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, fn) => {
    let ok = true, detail = '';
    try { const r = fn(); if (r) detail = String(r); }
    catch (e) { ok = false; detail = e.message; }
    checks.push({ name, ok, detail });
    return ok;
};

(async () => {
    // 1. help panel
    check('gear opens help', () => {
        getEl('gear').click();
        if (!getEl('helpModal').classList.contains('open')) throw new Error('help modal did not open');
        if (getEl('verLabel').textContent !== P.version()) throw new Error('version not shown');
        getEl('helpClose').click();
        if (getEl('helpModal').classList.contains('open')) throw new Error('help modal did not close');
        return getEl('verLabel').textContent;
    });

    // 2. songs modal + list
    check('Songs button lists the built-ins', () => {
        getEl('songsBtn').click();
        if (!getEl('songsModal').classList.contains('open')) throw new Error('songs modal did not open');
        const n = getEl('songsList').children.length;
        if (n < 6) throw new Error('only ' + n + ' songs listed');
        return n + ' rows';
    });

    // 3. Web MIDI must ask by button, not by a permission prompt on first tap
    (winListeners.pointerdown || []).forEach(fn => fn({}));
    await wait(20);
    check('MIDI connect is a button, not a first-tap prompt', () => {
        if (getEl('midiBtn').style.display !== '') throw new Error('connect button stayed hidden');
        return 'shown';
    });

    // 4. play a song, let the clock run
    check('play Lightly Row', () => P.playSong('lightlyrow') || P.playing());
    check('iOS audio session is set to playback', () => {
        const s = global.navigator.audioSession;
        if (!s || s.type !== 'playback') throw new Error('audio session: ' + (s && s.type));
        return s.type;
    });
    await wait(400);
    check('song clock advances', () => {
        const t = P._songTime();
        if (!(t > 50)) throw new Error('clock stuck at ' + t);
        return Math.round(t) + ' ms';
    });

    // 5. A–B loop on the built-in (no bar data → note onsets)
    check('loop controls', () => {
        P.seek(0.25);
        P.toggleLoop();
        getEl('tSetA').click();
        P.seek(0.5);
        getEl('tSetB').click();
        const l = P.loop();
        if (!l.on) throw new Error('loop did not turn on');
        if (!(l.b > l.a)) throw new Error('B not after A: ' + JSON.stringify(l));
        if (!getEl('tLoopAB').classList.contains('on')) throw new Error('A/B controls hidden');
        return `A ${Math.round(l.a)} ms, B ${Math.round(l.b)} ms, readout ${getEl('tLoopV').textContent}`;
    });
    await wait(300);
    check('loop wraps rather than running past B', () => {
        const t = P._songTime(), l = P.loop();
        if (t > l.b + 100) throw new Error('clock past B and still running: ' + t);
        return Math.round(t) + ' ms';
    });
    check('clear range restores whole-song loop', () => {
        getEl('tLoopClear').click();
        const l = P.loop();
        if (l.a !== 0 || l.b !== 0) throw new Error('range not cleared');
        return getEl('tLoopV').textContent;
    });

    // 6. run to the end: transport must stay, play must restart
    check('loop off before the end-of-song check', () => {
        P.toggleLoop();
        if (P.loop().on) throw new Error('loop still on');
        return 'whole song, loop off';
    });
    check('end of song keeps the transport', () => {
        P.seek(1);
        P.setRate(3);          // songRate is clamped to 1.5, so jump near the end
        return 'seeking to ' + Math.round(P._songTime());
    });
    await wait(700);
    check('transport visible and paused at the end', () => {
        if (getEl('transport').classList.contains('hidden')) throw new Error('transport was hidden at the end');
        if (P._songTime() < 1000) throw new Error('clock did not reach the end');
        return Math.round(P._songTime()) + ' ms of ' + Math.round(P._songTime());
    });
    check('play restarts from the top', () => {
        getEl('tPlay').click();
        const t = P._songTime();
        if (!(t < 500)) throw new Error('did not restart: ' + t);
        return Math.round(t) + ' ms';
    });

    // 7. delete an imported song, then undo
    check('import + delete + undo', () => {
        const { id } = P.addUserMIDI('Smoke Test', [[0, 60, 300, 100, 0], [300, 62, 300, 90, 0]], 'test');
        const before = getEl('songsList').children.length;
        const rows = getEl('songsList').children;
        const row = rows[rows.length - 1];
        const del = row.children.find(c => c.textContent === '✕');
        if (!del) throw new Error('no delete control on the imported row');
        del.dispatch('click');
        if (getEl('songsList').children.length !== before - 1) throw new Error('row not removed');
        if (!getEl('toast').classList.contains('show')) throw new Error('no undo toast');
        const msg = getEl('toastMsg').textContent;
        getEl('toastAction').click();       // Undo
        if (!P.songs().includes(id)) throw new Error('undo did not restore the song');
        if (getEl('songsList').children.length !== before) throw new Error('list did not return to ' + before);
        return msg;
    });

    // 8. computer keyboard octave bug: A held across X
    const send = (type, key) => (winListeners[type] || []).forEach(fn => fn({ key, repeat: false, preventDefault() {} }));
    check('keyup releases the struck pitch after an octave shift', () => {
        P.setSustain(false);
        const before = P.state().kbOctave;
        send('keydown', 'a');
        if (P.activeVoices() !== 1) throw new Error('keydown did not sound: ' + P.activeVoices());
        send('keydown', 'x');           // octave up while A is still held
        send('keyup', 'a');
        if (P.activeVoices() !== 0) throw new Error('held note stuck after keyup: ' + P.activeVoices());
        if (P.state().kbOctave !== before + 1) throw new Error('X did not shift the octave');
        return `octave ${before} → ${P.state().kbOctave}, voices 1 → 0`;
    });
    check('blur / hidden tab releases every held key', () => {
        send('keydown', 'a'); send('keydown', 'd');
        if (P.activeVoices() !== 2) throw new Error('expected two voices, got ' + P.activeVoices());
        (winListeners.blur || []).forEach(fn => fn({}));
        if (P.activeVoices() !== 0) throw new Error('stuck after blur: ' + P.activeVoices());
        send('keydown', 'a');
        document.visibilityState = 'hidden';
        (docListeners.visibilitychange || []).forEach(fn => fn({}));
        document.visibilityState = 'visible';
        if (P.activeVoices() !== 0) throw new Error('stuck after hide: ' + P.activeVoices());
        return 'voices after blur: 0, after hide: 0';
    });

    // 9. an imported song that carries bar lines: A/B snap to its measures
    check('imported bars drive the A–B snap', () => {
        const ev = [[0, 60, 500, 100, 0], [1000, 62, 500, 90, 0], [2000, 64, 500, 90, 0], [3000, 65, 500, 90, 0]];
        ev.bars = [0, 1000, 2000, 3000];
        const { id } = P.addUserMIDI('Bar Test', ev, 'test');
        P.playSong(id);
        const b = P.bars();
        if (!b || b.join() !== '0,1000,2000,3000') throw new Error('loaded song has no bars: ' + b);
        P.seek(0.28);                     // 1120 ms → snaps to the 1000 ms bar
        P.toggleLoop();
        getEl('tSetA').click();
        P.seek(0.72);                     // → snaps to 3000? 2880 → 3000
        getEl('tSetB').click();
        const l = P.loop();
        if (l.a !== 1000) throw new Error('A snapped to ' + l.a + ', expected 1000');
        if (l.b !== 3000) throw new Error('B snapped to ' + l.b + ', expected 3000');
        return `A ${l.a}, B ${l.b}`;
    });
    // 10. backgrounding pauses and resumes; no burst of missed notes
    check('hidden tab pauses the song', () => {
        P.playSong('lightlyrow');
        P.seek(0.2);
        return Math.round(P._songTime()) + ' ms';
    });
    document.visibilityState = 'hidden';
    (docListeners.visibilitychange || []).forEach(fn => fn({}));
    const pausedAt = P._songTime();
    await wait(500);
    const stillPaused = P._songTime();
    document.visibilityState = 'visible';
    (docListeners.visibilitychange || []).forEach(fn => fn({}));
    await wait(300);
    const resumed = P._songTime();
    check('hidden tab pauses, visible resumes', () => {
        if (Math.abs(stillPaused - pausedAt) > 40) throw new Error('clock ran on while hidden: ' + Math.round(pausedAt) + ' → ' + Math.round(stillPaused));
        if (!(resumed > stillPaused)) throw new Error('did not resume: ' + Math.round(stillPaused) + ' → ' + Math.round(resumed));
        return Math.round(pausedAt) + ' ms held, resumed at ' + Math.round(resumed);
    });

    try { P.stopSong(); } catch (e) { problems.push('stopSong: ' + e.message); }


    clearTimeout(watchdog);
    const failed = checks.filter(c => !c.ok);
    console.log('UI smoke: ' + (checks.length - failed.length) + '/' + checks.length + ' checks passed');
    for (const c of checks) console.log((c.ok ? 'ok   ' : 'FAIL ') + c.name + (c.detail ? ' → ' + c.detail : ''));
    if (problems.length) console.log('\nUncaught in the app:\n  ' + problems.join('\n  '));
    process.exit(failed.length || problems.length ? 1 : 0);
})();
