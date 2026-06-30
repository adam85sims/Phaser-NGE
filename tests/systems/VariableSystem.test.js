/**
 * VariableSystem unit tests.
 *
 * VariableSystem is pure logic — no Phaser or DOM dependencies.
 * It reads variable definitions from Data.variables on construction.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Data } from '../../src/systems/DataLoader.js';
import { VariableSystem } from '../../src/systems/VariableSystem.js';

/* ── Helpers ─────────────────────────────── */

function setDataVariables(defs) {
  Data.variables = defs;
}

/* ── Tests ───────────────────────────────── */

describe('VariableSystem', () => {

  beforeEach(() => {
    // Reset Data before each test
    Data.variables = null;
  });

  /* ── Init ────────────────────── */

  describe('construction & init', () => {

    it('initialises from Data.variables with default values', () => {
      setDataVariables({
        hp: { type: 'number', default: 100 },
        alive: { type: 'boolean', default: true },
        name: { type: 'string', default: 'Lena' },
      });
      const vs = new VariableSystem();
      expect(vs.get('hp')).toBe(100);
      expect(vs.get('alive')).toBe(true);
      expect(vs.get('name')).toBe('Lena');
    });

    it('handles empty variable definitions', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      expect(vs.get('anything')).toBeUndefined();
    });

    it('handles null variable definitions', () => {
      Data.variables = null;
      const vs = new VariableSystem();
      expect(vs.get('anything')).toBeUndefined();
    });

    it('handles missing variables.json gracefully', () => {
      Data.variables = undefined;
      const vs = new VariableSystem();
      expect(vs.get('anything')).toBeUndefined();
    });
  });

  /* ── get / set ────────────────── */

  describe('get / set', () => {

    it('get returns current value', () => {
      setDataVariables({ score: { type: 'number', default: 0 } });
      const vs = new VariableSystem();
      expect(vs.get('score')).toBe(0);
    });

    it('set updates the value', () => {
      setDataVariables({ score: { type: 'number', default: 0 } });
      const vs = new VariableSystem();
      vs.set('score', 42);
      expect(vs.get('score')).toBe(42);
    });

    it('get returns undefined for unknown variables', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      expect(vs.get('nonexistent')).toBeUndefined();
    });

    it('set creates a new variable if it did not exist', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      vs.set('dynamic_flag', true);
      expect(vs.get('dynamic_flag')).toBe(true);
    });

    it('set overwrites existing values', () => {
      setDataVariables({ x: { type: 'number', default: 10 } });
      const vs = new VariableSystem();
      vs.set('x', 20);
      vs.set('x', 30);
      expect(vs.get('x')).toBe(30);
    });
  });

  /* ── add (delta) ──────────────── */

  describe('add (numeric delta)', () => {

    it('adds a positive delta', () => {
      setDataVariables({ gold: { type: 'number', default: 50 } });
      const vs = new VariableSystem();
      vs.add('gold', 10);
      expect(vs.get('gold')).toBe(60);
    });

    it('subtracts with negative delta', () => {
      setDataVariables({ gold: { type: 'number', default: 50 } });
      const vs = new VariableSystem();
      vs.add('gold', -15);
      expect(vs.get('gold')).toBe(35);
    });

    it('silently ignores non-numeric variables', () => {
      setDataVariables({ name: { type: 'string', default: 'Lena' } });
      const vs = new VariableSystem();
      vs.add('name', 5);        // no error
      expect(vs.get('name')).toBe('Lena');  // unchanged
    });

    it('silently ignores unknown variables', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      vs.add('nothing', 99);    // no crash
      expect(vs.get('nothing')).toBeUndefined();
    });
  });

  /* ── toggle (boolean) ─────────── */

  describe('toggle (boolean)', () => {

    it('toggles true to false', () => {
      setDataVariables({ active: { type: 'boolean', default: true } });
      const vs = new VariableSystem();
      vs.toggle('active');
      expect(vs.get('active')).toBe(false);
    });

    it('toggles false to true', () => {
      setDataVariables({ active: { type: 'boolean', default: false } });
      const vs = new VariableSystem();
      vs.toggle('active');
      expect(vs.get('active')).toBe(true);
    });

    it('toggles undefined to true', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      vs.toggle('new_flag');
      expect(vs.get('new_flag')).toBe(true);
    });
  });

  /* ── Condition evaluation ─────── */

  describe('evaluate condition strings', () => {

    let vs;
    beforeEach(() => {
      setDataVariables({
        courage: { type: 'number', default: 50 },
        has_key: { type: 'boolean', default: false },
        name: { type: 'string', default: 'Lena' },
        level: { type: 'number', default: 5 },
        items: { type: 'number', default: 0 },
      });
      vs = new VariableSystem();
    });

    it('returns true when condition is empty', () => {
      expect(vs.evaluate('')).toBe(true);
    });

    it('returns true when condition is null', () => {
      expect(vs.evaluate(null)).toBe(true);
    });

    it('returns true when condition is whitespace', () => {
      expect(vs.evaluate('   ')).toBe(true);
    });

    /* ── Numeric comparisons ── */

    it('evaluates == (equal) correctly', () => {
      expect(vs.evaluate('courage == 50')).toBe(true);
      expect(vs.evaluate('courage == 99')).toBe(false);
    });

    it('evaluates != (not equal) correctly', () => {
      expect(vs.evaluate('courage != 40')).toBe(true);
      expect(vs.evaluate('courage != 50')).toBe(false);
    });

    it('evaluates >= (greater than or equal) correctly', () => {
      expect(vs.evaluate('courage >= 50')).toBe(true);
      expect(vs.evaluate('courage >= 51')).toBe(false);
      expect(vs.evaluate('courage >= 30')).toBe(true);
    });

    it('evaluates <= (less than or equal) correctly', () => {
      expect(vs.evaluate('courage <= 50')).toBe(true);
      expect(vs.evaluate('courage <= 49')).toBe(false);
      expect(vs.evaluate('courage <= 60')).toBe(true);
    });

    it('evaluates > (greater than) correctly', () => {
      expect(vs.evaluate('courage > 49')).toBe(true);
      expect(vs.evaluate('courage > 50')).toBe(false);
    });

    it('evaluates < (less than) correctly', () => {
      expect(vs.evaluate('courage < 51')).toBe(true);
      expect(vs.evaluate('courage < 50')).toBe(false);
    });

    /* ── Boolean comparisons ── */

    it('evaluates boolean == true/false', () => {
      expect(vs.evaluate('has_key == false')).toBe(true);
      expect(vs.evaluate('has_key == true')).toBe(false);
    });

    it('evaluates boolean != true/false', () => {
      expect(vs.evaluate('has_key != true')).toBe(true);
      vs.set('has_key', true);
      expect(vs.evaluate('has_key != false')).toBe(true);
    });

    /* ── String comparisons ── */

    it('evaluates string == with unquoted value', () => {
      expect(vs.evaluate('name == Lena')).toBe(true);
      expect(vs.evaluate('name == Adam')).toBe(false);
    });

    it('evaluates string == with quoted value', () => {
      expect(vs.evaluate('name == "Lena"')).toBe(true);
      expect(vs.evaluate("name == 'Lena'")).toBe(true);
    });

    it('evaluates string != correctly', () => {
      expect(vs.evaluate('name != Adam')).toBe(true);
      expect(vs.evaluate('name != Lena')).toBe(false);
    });

    /* ── Edge cases ── */

    it('returns false for malformed conditions', () => {
      expect(vs.evaluate('not a condition')).toBe(false);
    });

    it('returns false when comparing undefined variable', () => {
      expect(vs.evaluate('unknown == 10')).toBe(false);
    });

    it('handles `=` as alias for `==`', () => {
      expect(vs.evaluate('courage = 50')).toBe(true);
      expect(vs.evaluate('courage = 99')).toBe(false);
    });

    it('handles zero and negative values', () => {
      vs.set('items', 0);
      expect(vs.evaluate('items == 0')).toBe(true);
      expect(vs.evaluate('items >= 0')).toBe(true);
      expect(vs.evaluate('items < 1')).toBe(true);
      vs.set('items', -5);
      expect(vs.evaluate('items < 0')).toBe(true);
      expect(vs.evaluate('items == -5')).toBe(true);
    });

    /* ── Compound conditions (AND/OR) ── */

    it('evaluates AND — both true', () => {
      expect(vs.evaluate('courage >= 30 AND courage <= 70')).toBe(true);
    });

    it('evaluates AND — one false', () => {
      expect(vs.evaluate('courage >= 30 AND courage <= 40')).toBe(false);
    });

    it('evaluates AND — both false', () => {
      expect(vs.evaluate('courage >= 100 AND courage <= 10')).toBe(false);
    });

    it('evaluates OR — both true', () => {
      expect(vs.evaluate('courage >= 30 OR courage <= 70')).toBe(true);
    });

    it('evaluates OR — one true', () => {
      expect(vs.evaluate('courage >= 100 OR courage <= 70')).toBe(true);
    });

    it('evaluates OR — both false', () => {
      expect(vs.evaluate('courage >= 100 OR courage <= 10')).toBe(false);
    });

    it('AND has higher precedence than OR', () => {
      // "false OR (true AND true)" = true
      // Without precedence: "(false OR true) AND true" = true (same result here)
      // Better test: "false OR (false AND true)" = false
      // vs "(false OR false) AND true" = false
      // Let's use: "true OR (false AND false)" = true
      // vs "(true OR false) AND false" = false
      vs.set('a', true);
      vs.set('b', false);
      vs.set('c', false);
      // "a == true OR b == true AND c == false"
      // = "a == true OR (b == true AND c == false)"
      // = "true OR (false AND true)"
      // = "true OR false"
      // = true
      expect(vs.evaluate('a == true OR b == true AND c == false')).toBe(true);
    });

    it('handles parentheses to override precedence', () => {
      vs.set('a', true);
      vs.set('b', false);
      vs.set('c', false);
      // "(a == true OR b == true) AND c == false"
      // = "(true OR false) AND true"
      // = "true AND true"
      // = true
      expect(vs.evaluate('(a == true OR b == true) AND c == false')).toBe(true);
    });

    it('handles nested parentheses', () => {
      // "((courage >= 30))" — double parens around single condition
      expect(vs.evaluate('((courage >= 30))')).toBe(true);
    });

    it('handles multiple ANDs chained', () => {
      expect(vs.evaluate('courage >= 30 AND courage <= 70 AND courage == 50')).toBe(true);
      expect(vs.evaluate('courage >= 30 AND courage <= 70 AND courage == 99')).toBe(false);
    });

    it('handles multiple ORs chained', () => {
      expect(vs.evaluate('courage == 10 OR courage == 50 OR courage == 90')).toBe(true);
      expect(vs.evaluate('courage == 10 OR courage == 20 OR courage == 90')).toBe(false);
    });

    it('handles mixed AND/OR with different variables', () => {
      vs.set('has_key', false);
      expect(vs.evaluate('courage >= 50 AND has_key == true')).toBe(false);
      expect(vs.evaluate('courage >= 50 OR has_key == true')).toBe(true);
      vs.set('has_key', true);
      expect(vs.evaluate('courage >= 50 AND has_key == true')).toBe(true);
    });
  });

  /* ── applyAction ───────────────── */

  describe('applyAction', () => {

    let vs;
    beforeEach(() => {
      setDataVariables({ courage: { type: 'number', default: 50 } });
      vs = new VariableSystem();
    });

    it('sets a variable via { setFlag, setValue }', () => {
      vs.applyAction({ setFlag: 'courage', setValue: 75 });
      expect(vs.get('courage')).toBe(75);
    });

    it('applies setFlag/setValue on a non-existent variable', () => {
      vs.applyAction({ setFlag: 'new_flag', setValue: true });
      expect(vs.get('new_flag')).toBe(true);
    });

    it('toggles a flag via { toggleFlag }', () => {
      vs.set('toggle_me', false);
      vs.applyAction({ toggleFlag: 'toggle_me' });
      expect(vs.get('toggle_me')).toBe(true);
    });

    it('adds delta via { addFlag, delta }', () => {
      vs.applyAction({ addFlag: 'courage', delta: 10 });
      expect(vs.get('courage')).toBe(60);
    });

    it('handles null/undefined action gracefully', () => {
      expect(() => vs.applyAction(null)).not.toThrow();
      expect(() => vs.applyAction(undefined)).not.toThrow();
    });

    it('handles action with no relevant fields', () => {
      expect(() => vs.applyAction({})).not.toThrow();
      expect(vs.get('courage')).toBe(50); // unchanged
    });

    it('can apply all three actions together', () => {
      const spy = { calls: [] };
      vs.onChange('a', (n, v) => spy.calls.push({ n, v }));
      vs.onChange('b', (n, v) => spy.calls.push({ n, v }));

      vs.applyAction({ setFlag: 'a', setValue: 10, toggleFlag: 'b', addFlag: 'courage', delta: 5 });

      expect(vs.get('a')).toBe(10);
      expect(vs.get('b')).toBe(true);
      expect(vs.get('courage')).toBe(55);
      expect(spy.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  /* ── Serialize / Deserialize ───── */

  describe('serialize / deserialize', () => {

    it('serialize returns a plain object of all vars', () => {
      setDataVariables({
        a: { type: 'number', default: 1 },
        b: { type: 'boolean', default: true },
      });
      const vs = new VariableSystem();
      const snapshot = vs.serialize();
      expect(snapshot).toEqual({ a: 1, b: true });
    });

    it('serialize returns a copy (not a reference)', () => {
      setDataVariables({ x: { type: 'number', default: 5 } });
      const vs = new VariableSystem();
      const snapshot = vs.serialize();
      snapshot.x = 999;
      expect(vs.get('x')).toBe(5);
    });

    it('deserialize restores saved state', () => {
      setDataVariables({ courage: { type: 'number', default: 50 } });
      const vs = new VariableSystem();
      vs.set('courage', 80);
      const saved = vs.serialize();

      const vs2 = new VariableSystem();
      vs2.deserialize(saved);
      expect(vs2.get('courage')).toBe(80);
    });

    it('deserialize can add variables that did not exist at init', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      vs.deserialize({ new_flag: 'hello', score: 42 });
      expect(vs.get('new_flag')).toBe('hello');
      expect(vs.get('score')).toBe(42);
    });
  });

  /* ── Listeners ─────────────────── */

  describe('onChange listeners', () => {

    it('calls listener when variable changes via set()', () => {
      setDataVariables({ x: { type: 'number', default: 0 } });
      const vs = new VariableSystem();
      const calls = [];
      vs.onChange('x', (name, value) => calls.push({ name, value }));
      vs.set('x', 42);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ name: 'x', value: 42 });
    });

    it('does NOT call listener when variable is set to same value', () => {
      setDataVariables({ x: { type: 'number', default: 0 } });
      const vs = new VariableSystem();
      const calls = [];
      vs.onChange('x', (name, value) => calls.push({ name, value }));
      vs.set('x', 0); // same as default
      expect(calls).toHaveLength(0);
    });

    it('multiple listeners on the same variable all fire', () => {
      setDataVariables({ x: { type: 'number', default: 0 } });
      const vs = new VariableSystem();
      const calls = [];
      vs.onChange('x', () => calls.push('a'));
      vs.onChange('x', () => calls.push('b'));
      vs.set('x', 1);
      expect(calls).toEqual(['a', 'b']);
    });

    it('listeners fire for toggle() and add() changes', () => {
      setDataVariables({
        flag: { type: 'boolean', default: false },
        num: { type: 'number', default: 10 },
      });
      const vs = new VariableSystem();
      const calls = [];
      vs.onChange('flag', (n) => calls.push(`flag:${n}`));
      vs.onChange('num', (n) => calls.push(`num:${n}`));

      vs.toggle('flag');
      vs.add('num', 5);

      expect(calls).toContain('flag:flag');
      expect(calls).toContain('num:num');
    });

    it('listeners are NOT called for unchanged toggle/add', () => {
      // add to undefined var doesn't change it
      setDataVariables({});
      const vs = new VariableSystem();
      const calls = [];
      vs.onChange('nothing', () => calls.push('fired'));
      vs.add('nothing', 99);
      expect(calls).toHaveLength(0);
    });
  });

  /* ── Array operations ────────── */

  describe('array operations', () => {
    it('initialises array variables with default empty array', () => {
      setDataVariables({
        inventory: { type: 'array', default: [] },
      });
      const vs = new VariableSystem();
      expect(vs.get('inventory')).toEqual([]);
    });

    it('initialises array variables with pre-populated default', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield'] },
      });
      const vs = new VariableSystem();
      expect(vs.get('inventory')).toEqual(['sword', 'shield']);
    });

    it('deep-copies array defaults so instances are independent', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword'] },
      });
      const vs1 = new VariableSystem();
      const vs2 = new VariableSystem();
      vs1.arrayAppend('inventory', 'axe');
      expect(vs2.get('inventory')).toEqual(['sword']);
    });

    it('arrayAppend adds value to array', () => {
      setDataVariables({
        inventory: { type: 'array', default: [] },
      });
      const vs = new VariableSystem();
      vs.arrayAppend('inventory', 'sword');
      expect(vs.get('inventory')).toEqual(['sword']);
      vs.arrayAppend('inventory', 'shield');
      expect(vs.get('inventory')).toEqual(['sword', 'shield']);
    });

    it('arrayAppend creates array if variable is not yet an array', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      vs.arrayAppend('new_list', 'item1');
      expect(vs.get('new_list')).toEqual(['item1']);
    });

    it('arrayRemove removes first occurrence of value', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield', 'sword'] },
      });
      const vs = new VariableSystem();
      vs.arrayRemove('inventory', 'sword');
      expect(vs.get('inventory')).toEqual(['shield', 'sword']);
    });

    it('arrayRemove does nothing if value not found', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword'] },
      });
      const vs = new VariableSystem();
      vs.arrayRemove('inventory', 'axe');
      expect(vs.get('inventory')).toEqual(['sword']);
    });

    it('arrayRemove does nothing if variable is not an array', () => {
      setDataVariables({
        name: { type: 'string', default: 'Lena' },
      });
      const vs = new VariableSystem();
      expect(() => vs.arrayRemove('name', 'Lena')).not.toThrow();
      expect(vs.get('name')).toBe('Lena');
    });

    it('arrayContains returns true when value is in array', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield'] },
      });
      const vs = new VariableSystem();
      expect(vs.arrayContains('inventory', 'sword')).toBe(true);
      expect(vs.arrayContains('inventory', 'axe')).toBe(false);
    });

    it('arrayContains returns false for non-array variable', () => {
      setDataVariables({
        name: { type: 'string', default: 'Lena' },
      });
      const vs = new VariableSystem();
      expect(vs.arrayContains('name', 'Lena')).toBe(false);
    });

    it('arrayClear empties the array', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield'] },
      });
      const vs = new VariableSystem();
      vs.arrayClear('inventory');
      expect(vs.get('inventory')).toEqual([]);
    });

    it('arrayClear creates empty array if variable is not yet an array', () => {
      setDataVariables({});
      const vs = new VariableSystem();
      vs.arrayClear('new_list');
      expect(vs.get('new_list')).toEqual([]);
    });

    it('condition: array contains value', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield'] },
      });
      const vs = new VariableSystem();
      expect(vs.evaluate('inventory contains sword')).toBe(true);
      expect(vs.evaluate('inventory contains axe')).toBe(false);
    });

    it('condition: array not_contains value', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield'] },
      });
      const vs = new VariableSystem();
      expect(vs.evaluate('inventory not_contains axe')).toBe(true);
      expect(vs.evaluate('inventory not_contains sword')).toBe(false);
    });

    it('condition: contains returns false for non-array variable', () => {
      setDataVariables({
        name: { type: 'string', default: 'Lena' },
      });
      const vs = new VariableSystem();
      expect(vs.evaluate('name contains Lena')).toBe(false);
    });

    it('condition: contains works with compound AND/OR', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword'] },
        has_key: { type: 'boolean', default: true },
      });
      const vs = new VariableSystem();
      expect(vs.evaluate('inventory contains sword AND has_key == true')).toBe(true);
      expect(vs.evaluate('inventory contains axe OR has_key == true')).toBe(true);
      expect(vs.evaluate('inventory contains axe AND has_key == true')).toBe(false);
    });

    it('condition: contains works with quoted strings', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['iron sword'] },
      });
      const vs = new VariableSystem();
      expect(vs.evaluate('inventory contains "iron sword"')).toBe(true);
      expect(vs.evaluate("inventory contains 'iron sword'")).toBe(true);
    });

    it('applyAction: arrayAppend via action', () => {
      setDataVariables({
        inventory: { type: 'array', default: [] },
      });
      const vs = new VariableSystem();
      vs.applyAction({ arrayAppend: 'inventory', arrayValue: 'sword' });
      expect(vs.get('inventory')).toEqual(['sword']);
    });

    it('applyAction: arrayRemove via action', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword', 'shield'] },
      });
      const vs = new VariableSystem();
      vs.applyAction({ arrayRemove: 'inventory', arrayValue: 'sword' });
      expect(vs.get('inventory')).toEqual(['shield']);
    });

    it('applyAction: arrayClear via action', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword'] },
      });
      const vs = new VariableSystem();
      vs.applyAction({ arrayClear: 'inventory' });
      expect(vs.get('inventory')).toEqual([]);
    });

    it('serialize/deserialize preserves arrays', () => {
      setDataVariables({
        inventory: { type: 'array', default: [] },
      });
      const vs = new VariableSystem();
      vs.arrayAppend('inventory', 'sword');
      vs.arrayAppend('inventory', 'shield');
      const saved = vs.serialize();
      expect(saved.inventory).toEqual(['sword', 'shield']);

      const vs2 = new VariableSystem();
      vs2.deserialize(saved);
      expect(vs2.get('inventory')).toEqual(['sword', 'shield']);
    });

    it('serialize deep-copies arrays (not references)', () => {
      setDataVariables({
        inventory: { type: 'array', default: ['sword'] },
      });
      const vs = new VariableSystem();
      const saved = vs.serialize();
      saved.inventory.push('axe');
      expect(vs.get('inventory')).toEqual(['sword']);
    });
  });

  /* ── Integration scenarios ─────── */

  describe('integration scenarios', () => {

    it('simulates a branching-quest variable flow', () => {
      setDataVariables({
        courage: { type: 'number', default: 30, min: 0, max: 100 },
        has_weapon_permit: { type: 'boolean', default: false },
      });
      const vs = new VariableSystem();

      // Path A: Player makes brave choices
      vs.applyAction({ setFlag: 'courage', setValue: 30 });
      expect(vs.evaluate('courage >= 50')).toBe(false);

      vs.add('courage', 25);
      expect(vs.evaluate('courage >= 50')).toBe(true);
      expect(vs.evaluate('has_weapon_permit == true')).toBe(false);

      // Path B: Player gets a permit
      vs.set('has_weapon_permit', true);
      expect(vs.evaluate('has_weapon_permit == true')).toBe(true);
      expect(vs.evaluate('courage >= 50')).toBe(true); // still true

      // Save state
      const save = vs.serialize();
      expect(save.courage).toBe(55);
      expect(save.has_weapon_permit).toBe(true);

      // Load into fresh system
      const vs2 = new VariableSystem();
      vs2.deserialize(save);
      expect(vs2.evaluate('courage >= 50')).toBe(true);
      expect(vs2.evaluate('has_weapon_permit == true')).toBe(true);
    });

    it('gracefully handles unexpected variable types', () => {
      Data.variables = null;
      const vs = new VariableSystem();

      // Setting a variable after the fact works
      vs.set('strange', { complex: 'object' });
      expect(vs.get('strange')).toEqual({ complex: 'object' });

      // set works regardless
      vs.set('strange', 'now a string');
      expect(vs.get('strange')).toBe('now a string');

      // Evaluate returns false for complex/unexpected comparisons
      expect(vs.evaluate('strange == something')).toBe(false);
    });
  });
});
