import { Data } from './DataLoader.js';

/**
 * VariableSystem — tracks game state variables (flags, counters, strings).
 * Inits from variables.json, modified during gameplay via scene actions.
 * Evaluates condition strings like "has_weapon_permit == true" or "courage >= 30"
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
      this.scopes[0][key] = def.default;
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

  /** Apply a node action: { setFlag, setValue, toggleFlag, addFlag } */
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
  }

  /* ── Serialization ─────────────────────────── */

  /** Return plain object for save (only saves global scope) */
  serialize() {
    return { ...this.scopes[0] };
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
