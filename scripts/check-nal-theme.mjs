import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('nal/assets/js/theme.js', 'utf8');

function browser({ saved = null, dark = false, blocked = false, legacy = false, media = true } = {}) {
  const listeners = {};
  const controls = [{ value: '' }, { value: '' }];
  const root = { dataset: {}, style: {} };
  const meta = {};
  let stored = saved;
  let systemChange;
  const storage = {
    getItem() { if (blocked) throw new Error('Storage restricted'); return stored; },
    setItem(key, value) { if (blocked) throw new Error('Storage restricted'); stored = value; }
  };
  const system = { matches: dark };
  if (legacy) system.addListener = (fn) => { systemChange = fn; };
  else system.addEventListener = (name, fn) => { systemChange = fn; };
  const listen = (name, fn) => { (listeners[name] ||= []).push(fn); };
  const document = {
    documentElement: root,
    querySelectorAll() { return controls; },
    querySelector(selector) { return { setAttribute(name, value) { meta[selector] = value; } }; },
    addEventListener: listen
  };
  const window = { localStorage: storage, addEventListener: listen };
  if (media) window.matchMedia = () => system;
  vm.runInNewContext(source, { window, document, Set });
  const fire = (name, event = {}) => listeners[name]?.forEach((fn) => fn(event));
  return {
    root, controls, meta, storage, fire,
    stored: () => stored,
    select(value) { fire('change', { target: { value, matches: (selector) => selector === '[data-nal-theme]' } }); },
    device(dark) { system.matches = dark; systemChange?.(); }
  };
}

const initial = browser({ dark: true });
assert.equal(initial.root.dataset.theme, 'dark', 'first paint follows the device');
assert.equal(initial.root.dataset.themePreference, 'system');
assert.equal(initial.root.style.colorScheme, 'dark');
assert.ok(Object.values(initial.meta).includes('#17191e'));
initial.device(false);
assert.equal(initial.root.dataset.theme, 'light');
initial.select('dark');
assert.equal(initial.stored(), 'dark');
assert.deepEqual(initial.controls.map((c) => c.value), ['dark', 'dark']);
initial.device(false);
assert.equal(initial.root.dataset.theme, 'dark', 'explicit choice survives device changes');
assert.equal(browser({ saved: initial.stored(), dark: false }).root.dataset.theme, 'dark', 'new page restores the choice');
initial.select('system');
assert.equal(initial.root.dataset.theme, 'light');
initial.device(true);
assert.equal(initial.root.dataset.theme, 'dark', 'returning to system resumes live device changes');
initial.controls[0].value = '';
initial.fire('nal:page-rendered');
assert.equal(initial.controls[0].value, 'system', 'rerendered header reflects the preference');
initial.select('invalid');
assert.equal(initial.stored(), 'system');
assert.equal(browser({ saved: 'invalid', dark: true }).root.dataset.themePreference, 'system');

const blocked = browser({ blocked: true });
blocked.select('dark');
assert.equal(blocked.root.dataset.theme, 'dark', 'restricted storage does not disable theme switching');
assert.equal(browser({ media: false }).root.dataset.theme, 'light');
const legacy = browser({ legacy: true });
legacy.device(true);
assert.equal(legacy.root.dataset.theme, 'dark');

initial.fire('storage', { key: 'nal:theme:v1', newValue: 'light', storageArea: initial.storage });
assert.equal(initial.root.dataset.theme, 'light', 'another tab can update the choice');
initial.fire('storage', { key: 'nal:theme:v1', newValue: 'dark', storageArea: {} });
assert.equal(initial.root.dataset.theme, 'light', 'session storage cannot replace the preference');
initial.fire('storage', { key: 'nal:wishlist:v1', newValue: 'dark' });
assert.equal(initial.root.dataset.theme, 'light', 'unrelated preferences do not change appearance');
initial.fire('storage', { key: null, newValue: null, storageArea: initial.storage });
assert.equal(initial.root.dataset.themePreference, 'system', 'cleared storage returns to the default');

console.log('NAL theme QA passed: initial paint, device updates, saved choice, controls, storage restrictions and tab sync.');
