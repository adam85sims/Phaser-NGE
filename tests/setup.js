/**
 * Test setup — runs before every test file.
 *
 * jsdom provides: window, document, localStorage, fetch (via polyfill)
 *
 * We do NOT mock Phaser here — the pure-logic modules under test
 * (VariableSystem, SceneController, SaveSystem, DataLoader) don't
 * import Phaser. Modules that do (DialogueSystem, CharacterSystem)
 * are tested via the manual QA checklist.
 */

// Ensure localStorage is available (jsdom provides it, but belt-and-braces)
if (typeof localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
}

// Suppress expected console noise during tests
let _warnCalls = [];
let _errorCalls = [];
const origWarn = console.warn;
const origError = console.error;

beforeEach(() => {
  _warnCalls = [];
  _errorCalls = [];
  console.warn = (...args) => {
    _warnCalls.push(args.join(' '));
  };
  console.error = (...args) => {
    _errorCalls.push(args.join(' '));
  };
});

afterEach(() => {
  console.warn = origWarn;
  console.error = origError;
  localStorage.clear();
});

/**
 * Helper: get warnings issued during a test
 */
export function getWarnings() {
  return [..._warnCalls];
}

/**
 * Helper: get errors issued during a test
 */
export function getErrors() {
  return [..._errorCalls];
}
