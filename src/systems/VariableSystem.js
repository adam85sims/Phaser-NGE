import { Data } from './DataLoader.js';

/**
 * VariableSystem — tracks game state variables (flags, counters, strings, arrays).
 * Inits from variables.json, modified during gameplay via scene actions.
 * Evaluates condition strings like "has_weapon_permit == true" or "courage >= 30"
 * Supports array variables: inventory contains "sword", inventory not_contains "shield"
 */
export class VariableSystem {
  constructor() {
    this.scopes = [{}]; // Index 0 is global scope
    this.listeners = [];  // [{ varName, callback }]
    this._initFromData();
  }

  /* ── Scoping ──────────────────────────────── */

  pushScope(initialVars = {}) {
    this.scopes.push({ ...initialVars });
  }

  popScope() {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  /* ── Init ─────────────────────────────────── */

  _initFromData() {
    const defs = Data.variables || {};
    for (const [key, def] of Object.entries(defs)) {
      if (def.type === 'array') {
        // Deep-copy array defaults so each instance gets its own copy
        this.scopes[0][key] = Array.isArray(def.default) ? [...def.default] : [];
      } else {
        this.scopes[0][key] = def.default;
      }
    }
  }

  /* ── Read / Write ──────────────────────────── */

  get(name) {
    // Search from top to bottom
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        return this.scopes[i][name];
      }
    }
    return undefined;
  }

  set(name, value) {
    const old = this.get(name);
    
    // Find where it's defined and update it there.
    // If not defined anywhere, set in the local (top) scope.
    let found = false;
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (name in this.scopes[i]) {
        this.scopes[i][name] = value;
        found = true;
        break;
      }
    }
    
    if (!found) {
      this.scopes[this.scopes.length - 1][name] = value;
    }

    if (old !== value) {
      this._notify(name, value);
    }
  }

  /** Apply a delta to a numeric variable */
  add(name, delta) {
    const cur = this.get(name);
    if (typeof cur === 'number') {
      this.set(name, cur + delta);
    }
  }

  /** Toggle a boolean */
  toggle(name) {
    this.set(name, !this.get(name));
  }

  /* ── Array Operations ───────────────────────── */

  /** Append a value to an array variable */
  arrayAppend(name, value) {
    const arr = this.get(name);
    if (Array.isArray(arr)) {
      arr.push(value);
      this._notify(name, arr);
    } else {
      // If not an array yet, create one with this value
      this.set(name, [value]);
    }
  }

  /** Remove the first occurrence of a value from an array variable */
  arrayRemove(name, value) {
    const arr = this.get(name);
    if (Array.isArray(arr)) {
      const idx = arr.indexOf(value);
      if (idx !== -1) {
        arr.splice(idx, 1);
        this._notify(name, arr);
      }
    }
  }

  /** Check if an array variable contains a value */
  arrayContains(name, value) {
    const arr = this.get(name);
    return Array.isArray(arr) && arr.indexOf(value) !== -1;
  }

  /** Clear an array variable to empty */
  arrayClear(name) {
    const arr = this.get(name);
    if (Array.isArray(arr)) {
      arr.length = 0;
      this._notify(name, arr);
    } else {
      this.set(name, []);
    }
  }

  /* ── Condition Evaluation ──────────────────── */

  /**
   * Evaluate a condition string like:
   *   "has_weapon_permit == true"
   *   "courage >= 30"
   *   "player_name == Lena"
   *   "courage >= 50 AND has_key == true"
   *   "courage >= 50 OR is_hero == true"
   *   "(courage >= 50 AND has_key == true) OR is_hero == true"
   * Returns true if condition is empty/null.
   */
  evaluate(condition) {
    if (!condition || condition.trim() === '') return true;

    let trimmed = condition.trim();

    // Strip outer parentheses if they wrap the entire expression
    while (trimmed.startsWith('(') && this._findMatchingParen(trimmed, 0) === trimmed.length - 1) {
      trimmed = trimmed.slice(1, -1).trim();
    }

    // Split on top-level OR (not inside parentheses)
    const orParts = this._splitTopLevel(trimmed, ' OR ');
    if (orParts.length > 1) {
      return orParts.some(part => this.evaluate(part));
    }

    // Split on top-level AND (not inside parentheses)
    const andParts = this._splitTopLevel(trimmed, ' AND ');
    if (andParts.length > 1) {
      return andParts.every(part => this.evaluate(part));
    }

    // Single condition
    return this._evaluateSingle(trimmed);
  }

  /**
   * Evaluate a single (non-compound) condition.
   */
  _evaluateSingle(trimmed) {
    // Check for 'contains' / 'not_contains' operators first (array-specific)
    const containsMatch = trimmed.match(/^(\w+)\s+(not_contains|contains)\s+(.+)$/);
    if (containsMatch) {
      const [_, varName, op, rawVal] = containsMatch;
      const val = this._parseValue(rawVal.trim());
      const current = this.get(varName);
      if (!Array.isArray(current)) return false;
      const found = current.indexOf(val) !== -1;
      return op === 'contains' ? found : !found;
    }

    const match = trimmed.match(
      /^(\w+)\s*(==|!=|>=|<=|>|<|=)\s*(.+)$/
    );
    if (!match) return false;

    const [_, varName, op, rawVal] = match;
    const val = this._parseValue(rawVal.trim());
    const current = this.get(varName);

    switch (op) {
      case '==': case '=': return current == val;
      case '!=': return current != val;
      case '>=': return current >= val;
      case '<=': return current <= val;
      case '>':  return current > val;
      case '<':  return current < val;
      default:   return false;
    }
  }

  /**
   * Split a string on a delimiter, but only at the top level
   * (not inside parentheses).
   */
  _splitTopLevel(str, delimiter) {
    const parts = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') depth--;
      else if (depth === 0 && str.slice(i, i + delimiter.length) === delimiter) {
        parts.push(str.slice(start, i).trim());
        start = i + delimiter.length;
        i += delimiter.length - 1;
      }
    }
    parts.push(str.slice(start).trim());
    return parts;
  }

  /**
   * Find the matching closing parenthesis for an opening one.
   */
  _findMatchingParen(str, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  _parseValue(raw) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (/^\d+\.?\d*$/.test(raw)) return parseFloat(raw);
    // String — strip quotes if present
    return raw.replace(/^["']|["']$/g, '');
  }

  /* ── Actions ───────────────────────────────── */

  /** Apply a node action: { setFlag, setValue, toggleFlag, addFlag, arrayAppend, arrayRemove, arrayClear } */
  applyAction(action) {
    if (!action) return;
    if (action.setFlag && action.setValue !== undefined) {
      this.set(action.setFlag, action.setValue);
    }
    if (action.toggleFlag) {
      this.toggle(action.toggleFlag);
    }
    if (action.addFlag && action.delta !== undefined) {
      this.add(action.addFlag, action.delta);
    }
    // Array operations
    if (action.arrayAppend && action.arrayValue !== undefined) {
      this.arrayAppend(action.arrayAppend, action.arrayValue);
    }
    if (action.arrayRemove && action.arrayValue !== undefined) {
      this.arrayRemove(action.arrayRemove, action.arrayValue);
    }
    if (action.arrayClear) {
      this.arrayClear(action.arrayClear);
    }
  }

  /* ── Serialization ─────────────────────────── */

  /** Return plain object for save (only saves global scope) */
  serialize() {
    const out = {};
    for (const [key, val] of Object.entries(this.scopes[0])) {
      out[key] = Array.isArray(val) ? [...val] : val;
    }
    return out;
  }

  /** Restore from save data */
  deserialize(data) {
    this.scopes = [{ ...data }];
  }

  /* ── Listeners ─────────────────────────────── */

  onChange(varName, callback) {
    this.listeners.push({ varName, callback });
  }

  _notify(name, value) {
    this.listeners.forEach(l => {
      if (l.varName === name) l.callback(name, value);
    });
  }
}
