import { Data } from './DataLoader.js';

/**
 * VariableSystem — tracks game state variables (flags, counters, strings).
 * Inits from variables.json, modified during gameplay via scene actions.
 * Evaluates condition strings like "has_weapon_permit == true" or "courage >= 30"
 */
export class VariableSystem {
  constructor() {
    this.vars = {};
    this.listeners = [];  // [{ varName, callback }]
    this._initFromData();
  }

  /* ── Init ─────────────────────────────────── */

  _initFromData() {
    const defs = Data.variables || {};
    for (const [key, def] of Object.entries(defs)) {
      this.vars[key] = def.default;
    }
  }

  /* ── Read / Write ──────────────────────────── */

  get(name) {
    return this.vars[name];
  }

  set(name, value) {
    const old = this.vars[name];
    this.vars[name] = value;
    if (old !== value) {
      this._notify(name, value);
    }
  }

  /** Apply a delta to a numeric variable */
  add(name, delta) {
    const cur = this.vars[name];
    if (typeof cur === 'number') {
      this.set(name, cur + delta);
    }
  }

  /** Toggle a boolean */
  toggle(name) {
    this.set(name, !this.vars[name]);
  }

  /* ── Condition Evaluation ──────────────────── */

  /**
   * Evaluate a condition string like:
   *   "has_weapon_permit == true"
   *   "courage >= 30"
   *   "player_name == Lena"
   * Returns true if condition is empty/null.
   */
  evaluate(condition) {
    if (!condition || condition.trim() === '') return true;

    const trimmed = condition.trim();

    // Pattern: variable name, operator, value
    const match = trimmed.match(
      /^(\w+)\s*(==|!=|>=|<=|>|<|=)\s*(.+)$/
    );
    if (!match) return false;

    const [_, varName, op, rawVal] = match;
    const val = this._parseValue(rawVal.trim());
    const current = this.vars[varName];

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

  /** Return plain object for save */
  serialize() {
    return { ...this.vars };
  }

  /** Restore from save data */
  deserialize(data) {
    this.vars = { ...data };
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
