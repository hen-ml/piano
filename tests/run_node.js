// Node runner for the Piano unit tests.
// Stubs the browser APIs index.html touches so the real script runs under Node,
// then runs tests/piano_tests.js against the real window.PIANO test hook.

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const ROOT = path.join(__dirname, '..');

globalThis.window = globalThis;

// ---- minimal DOM stubs -----------------------------------------------------
function stubEl(props = {}) {
    const el = {
        classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
        style: {},
        textContent: '',
        value: '',
        dataset: {},
        getAttribute() { return null; },
        setAttribute() { },
        getContext() { return stubEl(); },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        appendChild() { return null; },
        addEventListener() { },
        click() { },
        children: [],
        clientWidth: 400,
        offsetLeft: 0, offsetWidth: 0, offsetTop: 0,
        getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
        ...props
    };
    return new Proxy(el, {
        get(t, k) { return k in t ? t[k] : stubEl(); }
    });
}

const elements = {};
globalThis.document = {
    getElementById(id) { if (!(id in elements)) elements[id] = stubEl(); return elements[id]; },
    createElement() { return stubEl(); },
    get elements() { return elements; },
    body: stubEl(),
    documentElement: stubEl(),
    addEventListener() { },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};

// localStorage shim (hermetic: tests don't pollute real storage)
(function () {
    const store = {};
    globalThis.localStorage = {
        getItem(k) { return store[k] == null ? null : store[k]; },
        setItem(k, v) { store[k] = String(v); },
        clear() { Object.keys(store).forEach(k => delete store[k]); }
    };
})();

globalThis.performance = performance;
globalThis.innerWidth = 800;
globalThis.innerHeight = 600;
globalThis.navigator = {
    serviceWorker: { register: () => Promise.resolve() },
    requestMIDIAccess: undefined,
    userAgent: 'piano-node-tests'
};
globalThis.requestAnimationFrame = (cb) => { globalThis._rafCb = cb; return 0; };
globalThis.cancelAnimationFrame = () => { };
globalThis.addEventListener = function () { };
globalThis.removeEventListener = function () { };
globalThis.matchMedia = function () {
    return { matches: false, addEventListener() { }, removeEventListener() { } };
};

// ---- tiny XML -> DOM stub for parseMusicXML --------------------------------
// Real DOM nodes that xmlChild/xmlChildren/xmlText walk: nodeType, localName,
// nodeName, getAttribute, textContent, firstChild, nextSibling, children.
function parseMiniXml(text) {
    const root = {
        type: 'element', name: '#document', localName: null, nodeName: '#document', nodeType: 1,
        children: [], attrs: {},
        get firstChild() { return this.children[0] || null; },
        get nextSibling() { return null; },
        get textContent() { return this.children.map(c => c.textContent).join(''); },
        getElementsByTagName() { return []; }
    };
    const stack = [root];
    let i = 0, current = root;
    while (i < text.length) {
        if (text[i] === '<') {
            const close = text.indexOf('>', i + 1);
            if (close < 0) break;
            const raw = text.slice(i + 1, close);
            i = close + 1;
            if (raw.startsWith('!--')) { i = text.indexOf('-->', i); if (i < 0) break; i += 3; continue; }
            if (raw.startsWith('?')) { continue; } // <?xml ...?>
            if (raw.startsWith('/')) { stack.pop(); current = stack[stack.length - 1]; continue; }
            const m = /^([\w:.-]+)\s*([\s\S]*)$/.exec(raw);
            const name = m[1];
            const children = [];
            const node = {
                type: 'element', name, localName: name, nodeName: name, nodeType: 1,
                children, attrs: {},
                getAttribute(name) { return node.attrs && node.attrs[name] != null ? String(node.attrs[name]) : null; },
                get firstChild() { return children[0] || null; },
                get nextSibling() { return node._parent ? node._parent.children[node._idx + 1] || null : null; },
                get textContent() { return children.map(c => c.textContent).join(''); },
                getElementsByTagName(q) {
                    const out = [];
                    (function walk(n) { for (const c of n.children || []) { if (c.type === 'element' && c.name === q) out.push(c); walk(c); } })(node);
                    return out;
                }
            };
            node._parent = current; node._idx = current.children.length;
            const rest = m[2];
            for (const am of rest.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g))
                node.attrs[am[1]] = am[2];
            current.children.push(node);
            current = node;
            stack.push(node);
            if (raw.endsWith('/')) { stack.pop(); current = stack[stack.length - 1]; }
        } else {
            const close = text.indexOf('<', i);
            const end = close < 0 ? text.length : close;
            const t = text.slice(i, end);
            if (t) {
                const tnode = {
                    type: 'text', text: t, localName: null, nodeName: '#text', nodeType: 3,
                    get firstChild() { return null; },
                    get nextSibling() { return tnode._parent ? tnode._parent.children[tnode._idx + 1] || null : null; },
                    get textContent() { return t; }
                };
                tnode._parent = current; tnode._idx = current.children.length;
                current.children.push(tnode);
            }
            i = end;
        }
    }
    return {
        documentElement: root.children.find(c => c.type === 'element') || null,
        getElementsByTagName() { return []; }
    };
}
globalThis.DOMParser = class {
    parseFromString(text) { return parseMiniXml(text); }
};

// ---- load index.html's script exactly as a browser would -------------------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('no <script> block in index.html');

// never start real audio or register the service worker under Node
globalThis.ensureAudio = () => { };

new Function(m[1])(); // defines all of the app's real functions + window.PIANO

const P = globalThis.window.PIANO;
if (!P) throw new Error('window.PIANO test hook not installed by index.html');

const { run } = require('./piano_tests.js');
const report = run(P);

const fails = report.results.filter(r => !r.ok);
console.log(`Piano unit tests: ${report.pass}/${report.total} passed`);
for (const f of fails) {
    console.log(`\nFAIL — ${f.name}`);
    for (const e of f.fails) console.log('  - ' + e);
}
process.exit(fails.length ? 1 : 0);
