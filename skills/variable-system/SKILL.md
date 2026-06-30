---
name: variable-system
description: "Tracks game state variables (flags, counters, strings, arrays) with scoped contexts. Initializes from variables.json, modified during gameplay via node actions and choice effects. Evaluates compound condition strings with AND/OR/parens and contains/not_contains. Supports scoped variable contexts for macro/call_scene sub-scenes."
---

# VariableSystem

> Game state tracker — manages named variables (booleans, numbers, strings, arrays) with a **stack-based scoping architecture**. Evaluates compound condition expressions (AND/OR with parens, contains for arrays) from narrative data, and notifies listeners on changes. Variables are initialized from `variables.json` definitions and serialized for save/load. Scoped contexts support `macro` / `call_scene` nodes.

**Source:** `src/systems/VariableSystem.js`
**Test:** `tests/systems/VariableSystem.test.js` (224+ tests)
**Related skills:** `../scene-controller/SKILL.md`, `../save-system/SKILL.md`, `../data-loader/SKILL.md`

## Constructor

```js
constructor()
```

Initializes `scopes = [{}]` (index 0 = global). Reads defaults from `Data.variables` — each key with a `default` property sets the starting value in the global scope. Array types are deep-copied.

## Scoped Variables

The system uses a **stack of scopes** (`this.scopes`):

- `scopes[0]` = global scope (persisted by save/load)
- Higher indices = pushed by `callScene` / `macro` / `pushScope()`
- `get()` searches top-to-bottom (current scope first)
- `set()` updates the scope where the variable was first defined, or writes to the top scope if undefined
- `popScope()` removes the top scope (only if more than 1 scope exists)

```js
pushScope({ greeting: "Hello", count: 42 }) // push args
// ... inside sub-scene ...
popScope()                                    // on return, caller's scope unchanged
```

## Variable Types

Variables support four types (defined in `variables.json`):

| Type | Default | Example |
|------|---------|---------|
| `boolean` | `false` | `{ "has_key": { "type": "boolean", "default": false } }` |
| `number` | `0` | `{ "courage": { "type": "number", "default": 50 } }` |
| `string` | `""` | `{ "player_name": { "type": "string", "default": "" } }` |
| `array` | `[]` | `{ "inventory": { "type": "array", "default": [] } }` |

## Public Methods

### `get(name)`
Returns current value, searching top-to-bottom through scopes. Returns `undefined` if not set in any scope.

### `set(name, value)`
Updates the scope where the variable was first defined, or writes to the top (newest) scope if undefined anywhere. Fires listeners on change.

### `add(name, delta)`
Numeric add. No-op if variable is not a number.

### `toggle(name)`
Flips boolean. Calls `set()` internally.

### `pushScope(initialVars)`
Push a new scope with optional initial values. Used by `macro` / `call_scene`.

### `popScope()`
Pop the top scope. Guarded (won't remove global).

### `evaluate(condition)`
Evaluates a condition string. Returns `true` if condition is empty/null.

**Supports compound expressions:**
```js
evaluate("courage >= 50 AND has_key == true")
evaluate("courage >= 100 OR is_hero == true")
evaluate("(a == 1 OR b == 1) AND c == 1")
```

**Array contains:**
```js
evaluate("inventory contains sword")
evaluate("inventory not_contains shield")
```

**Precedence:** AND > OR. Parens override.

**Operators:** `==` `=` `!=` `>=` `<=` `>` `<` `contains` `not_contains`

**Value parsing:** `"true"`/`"false"` → boolean, `"null"` → null, numeric strings → float, quoted strings → stripped.

**Malformed conditions return `false`** — broken condition defaults to "not met."

### `applyAction(action)`
Processes a node action object. Supports:

```js
{ setFlag: "var_name", setValue: "value" }       // set
{ toggleFlag: "var_name" }                        // toggle
{ addFlag: "var_name", delta: 5 }                 // add (numeric)
{ arrayAppend: "inventory", arrayValue: "sword" } // append to array
{ arrayRemove: "inventory", arrayValue: "sword" } // remove from array
{ arrayClear: "inventory" }                       // clear array
```

Any combination of these can appear on a single node.

### Array Operations

```js
arrayAppend(name, value)   // push value to array
arrayRemove(name, value)   // remove first occurrence
arrayContains(name, value) // check membership (returns boolean)
arrayClear(name)           // empty the array
```

- `arrayAppend` creates a new array if the variable doesn't exist yet
- `arrayRemove` is a no-op if value not found or variable is not an array
- Arrays are deep-copied on serialize/deserialize (no reference leaks)

### `serialize()`
Returns a plain object copy of **only the global scope** (`scopes[0]`). Arrays are deep-copied.

### `deserialize(data)`
Replaces `scopes` with `[{ ...data }]` (single global scope, dropping any sub-scopes).

### `onChange(varName, callback)`
Register a listener. `callback(name, value)` fires when that variable's value changes (compared with `!==`).

## Gotchas

- **`variables.json` defines defaults** — `Data.variables[key].default`. If no `default`, starts as `undefined`.
- **`set()` with missing variable** — creates it in the top (active) scope, not the global scope. Use `pushScope`/`popScope` properly to avoid leaking macro-local vars.
- **`applyAction` with `setFlag` but missing `setValue`** — if `setFlag` is truthy and `setValue` is `undefined`, `set()` is NOT called.
- **Condition `=` is equality** — both `==` and `=` treated as comparison, not assignment.
- **Malformed conditions return `false`** — if the regex doesn't match, returns `false`.
- **Listeners fire on actual changes only** — `set()` compares old and new values with `!==` before notifying.
- **`serialize()` saves global scope only** — sub-scope variables are ephemeral.
- **`add()` requires existing numeric value** — not a no-op for non-numbers.
- **`toggle()` works on any type** — toggles via `!this.get(name)`, so toggling undefined creates `true`.
- **Array defaults are deep-copied** — each VariableSystem instance gets its own copy of array defaults.
- **`contains` operator only works on arrays** — returns `false` if the variable is not an array.
