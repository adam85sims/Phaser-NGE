---
name: variable-system
description: "Tracks game state variables (flags, counters, strings). Initializes from variables.json, modified during gameplay via node actions and choice effects. Evaluates condition strings like 'has_weapon_permit == true' or 'courage >= 30'. Supports listeners for reactive game logic. Related triggers: game variables, flags, conditions, branching logic, state tracking, condition evaluation."
---

# VariableSystem

> Game state tracker — manages named variables (booleans, numbers, strings), evaluates condition expressions from narrative data, and notifies listeners on changes. Variables are initialized from `variables.json` definitions and serialized for save/load.

**Source:** `src/systems/VariableSystem.js`
**Related skills:** `../scene-controller/SKILL.md`, `../save-system/SKILL.md`, `../data-loader/SKILL.md`

## Constructor

```js
constructor()
```

Initializes variable values from `Data.variables` (the object loaded from `variables.json`). Each key with a `default` property sets the starting value.

## Public Methods

### `get(name)`
Returns the current value of a variable. Returns `undefined` if not set.

### `set(name, value)`
Sets a variable and notifies listeners if the value changed.

### `add(name, delta)`
Adds a delta to a numeric variable. No-op if the variable isn't a number.

### `toggle(name)`
Flips a boolean variable. Calls `set()` internally.

### `evaluate(condition)`
Evaluates a condition string like `"has_weapon_permit == true"` or `"courage >= 30"`.

Returns `true` if condition is empty/null (unconditional). Returns `false` for malformed conditions.

**Pattern:** `variable_name operator value`

Supported operators: `==` `=` `!=` `>=` `<=` `>` `<`

Value parsing:
- `"true"` / `"false"` → boolean
- `"null"` → null
- Numeric strings → parsed as float
- Quoted strings → quotes stripped

### `applyAction(action)`
Processes a node action object. Supports three action shapes:

```js
{ setFlag: "var_name", setValue: "value" }       // set
{ toggleFlag: "var_name" }                        // toggle
{ addFlag: "var_name", delta: 5 }                 // add
```

### `serialize()`
Returns a plain object copy of all current variable values. Used by SaveSystem.

### `deserialize(data)`
Replaces all variable values from a save data object. Used by SaveSystem.

### `onChange(varName, callback)`
Register a listener. `callback(name, value)` is called when that variable's value changes.

## Gotchas

- **`variables.json` defines defaults** — but the default value is stored directly under the key. The `VariableSystem` reads `Data.variables[key].default`. If the key has no `default` property, the variable starts as `undefined`.
- **`applyAction` with `setFlag` AND missing `setValue`** — if `setFlag` is truthy but `setValue` is `undefined`, `set()` is called with `undefined`, effectively resetting the variable. Only sets if `setValue !== undefined`.
- **Condition `=` is allowed** — both `==` and `=` are treated as equality (same as `==`, not assignment).
- **Malformed conditions return `false`** — if the pattern `(\\w+)\\s*(==|!=|>=|<=|>|<|=)\\s*(.+)` doesn't match, the condition evaluates to `false`. This is intentional: a broken condition defaults to "not met."
- **Listeners fire on actual changes only** — `set()` compares old and new values with `!==` before notifying.
