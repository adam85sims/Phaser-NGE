# Narrative Engine — Post-VN Roadmap

**Goal:** Validate the current VN engine is production-ready, then investigate and design modules for Point & Click and RPG game genres.

**Architecture:** The engine is a data-driven Phaser 4 game. Story content is JSON. The engine is JavaScript (ESM), no TypeScript. 8 systems wired through a central GameScene. We'll add genre-specific modules as opt-in packages that extend the core, not fork it.

**Tech Stack:** Phaser 4.1.0, Vite 6.3, JavaScript (ESM), Vitest for unit tests, plain JSON for data.

---

## Phase 1: VN Engine Validation

The VN engine is feature-complete but entirely untested. We need a test suite and a manual QA pass before we can call it stable.

### Task 1: Add test infrastructure

**Objective:** Install Vitest, create `tests/` directory, write a test config that can import engine modules.

**Files:**
- Modify: `package.json` — add `vitest` devDependency and `"test"` script
- Create: `tests/vitest.config.js`
- Create: `tests/setup.js` — mock Phaser and browser globals

Potential issue: The engine imports Phaser directly (`import Phaser from 'phaser'`) and uses browser APIs (`localStorage`, `fetch`). We'll need to test the pure-logic systems separately (VariableSystem, DataLoader, SceneController logic) and integration-test the rendering systems (DialogueSystem, CharacterSystem) via a headless Phaser or mock.

**Modules that can be unit-tested (no DOM/Phaser needed):**
- `VariableSystem` — pure logic, condition parsing, variable set/get/serialize
- `DataLoader` — data store, minimal (just object access)
- Scene traversal patterns (SceneController's `jumpToId` / `processNode` / `advance` — depends on Phaser)

**Modules that need Phaser mock:**
- `SceneController` (uses none of Phaser directly, but is instantiated from GameScene)
- `SaveSystem` (uses `localStorage` which we can mock)

**Modules that need integration testing:**
- `DialogueSystem` — creates Phaser game objects
- `CharacterSystem` — creates Phaser game objects
- `AudioSystem` — uses Phaser sound
- `GameScene` — full Phaser scene

**Step 1: Install Vitest**

Modify `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.1.0"
  }
}
```

**Step 2: Create `tests/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
  }
});
```

**Step 3: Create `tests/setup.js`**

Mock minimal Phaser imports + localStorage + fetch so the pure-logic systems can load.

**Step 4: Create test for VariableSystem**

`tests/systems/VariableSystem.test.js`:
- Init from variable definitions
- `get()`, `set()`, `add()`, `toggle()`
- `evaluate()` with all operators: `==`, `!=`, `>=`, `<=`, `>`, `<`
- `evaluate()` with boolean, number, and string values
- `evaluate()` with empty/null condition (returns true)
- `applyAction()` with setFlag/setValue
- `serialize()` / `deserialize()`
- `onChange()` listeners

**Step 5: Create test for SceneController (logic)**

`tests/systems/SceneController.test.js`:
- Test that we can mock a VariableSystem and inject it
- Test scene loading with a fake scene object
- Test `advance()` follows `next` field
- Test `jumpToId()` finds node by ID
- Test `processNode()` dispatches to correct handler
- Test condition evaluation routing (next vs else)
- Test `selectChoice()` applies choice action and follows next
- Test `endScene()` fires callback

**Step 6: Create test for SaveSystem**

`tests/systems/SaveSystem.test.js`:
- Mock localStorage
- Test save/load round-trip
- Test delete slot
- Test getSlots returns correct

**Step 7: Manual QA checklist**

Create `docs/qa-checklist.md` with testable scenarios:
- [ ] Dialogue displays, typewriter works, click skips to end
- [ ] Choices render, click/keyboard selects, branch is followed
- [ ] Condition nodes route correctly based on variable state
- [ ] Event nodes execute (bgm, sfx, camera shake, camera flash)
- [ ] Wait nodes pause and auto-advance
- [ ] End nodes show text and scene transition works
- [ ] Scene transitions (end node → nextScene, F-key switching)
- [ ] Variable mutations persist across scene transitions
- [ ] Save/Load round-trip
- [ ] Dialogue editor: create scene, add nodes, wire connections, export
- [ ] Dialogue editor: imported scene plays in game

**Step 8: Add edge case tests**

- Empty scene (no nodes)
- Scene with only an end node
- Choice with no valid options (condition blocks all)
- Dialogue with missing speaker
- Variable condition with undefined variable
- Scene graph with cycles (should it be allowed? document behaviour)

---

## Phase 2: Point & Click Module Research

**What defines a Point & Click game?**

Core mechanics:
- **Room/scene system** — static background images, interactive hotspots
- **Inventory** — collect, combine, use items
- **Cursor modes** — look, talk, use, pick up, walk
- **Dialog trees** — branching conversations with NPCs (we already have this!)
- **Puzzles** — item-on-hotspot, item-on-item, sequence/state puzzles
- **Character movement** — click-to-walk on pre-rendered backgrounds (or simple pathfinding)

### Task 2: Design P&C module interfaces

**Files to create:**
- `src/modules/point-click/HotspotSystem.js` — interactive region detection
- `src/modules/point-click/InventorySystem.js` — item grid, combine, use
- `src/modules/point-click/CursorManager.js` — mode switching (look/talk/use/grab)
- `src/modules/point-click/PuzzleSystem.js` — state-based puzzle evaluation
- `src/data-schemas/point-click/hotspots.schema.md` — data format for hotspots
- `src/data-schemas/point-click/inventory.schema.md` — data format for items
- `data/point-click/room-<id>.json` — room definitions with hotspot arrays

**Research questions to answer:**

1. **Hotspot detection:** Pixel-precise or shape-based? Polygon hit areas defined in JSON or an editor? Phaser's built-in `setInteractive()` with custom hit areas?

2. **Inventory UI:** Horizontal bar at bottom? Grid overlay? Drag-to-use or click-to-select-then-click-target?

3. **Cursor states:** Switch cursor icon via CSS `cursor` property or canvas-drawn? Needs to handle 4-6 cursor modes.

4. **Dialog re-entry:** When the player talks to an NPC again, does the dialog restart or continue from a "greeting again" node? Our existing node system handles this — just jump to a different entry node.

5. **Item-on-item:** How to represent combinations? Data-driven table: `{ item1: "key", item2: "lock", result: { text: "It opens!", removeItems: ["key"], addItems: ["opened_lock"] } }`

6. **Room transitions:** Full-scene switch (our current model) or edge-scroll? For VN-style, full scene switch makes sense.

7. **Save state for P&C:** Need to save inventory contents, puzzle states, visited rooms, dialog flags. Our existing VariableSystem covers most of this — we just need to save inventory as a serializable array.

8. **Tooling:** Does the dialogue editor extend to hotspots? Or do we need a separate room editor?

**Deliverable:** A markdown document `docs/point-click-design.md` with:
- Data schemas for rooms, hotspots, items, puzzles
- System architecture diagram
- Integration points with existing VN engine
- List of Phaser APIs needed (hit areas, input, graphics)
- Recommendations for tooling

---

## Phase 3: RPG Module Research

**Core mechanics:**
- **Overworld / maps** — tile-based movement, scrolling
- **Player entity** — sprite, stats (HP, MP, STR, DEF, etc.), equipment
- **NPC interaction** — talk, shop, quest give/turn-in
- **Combat system** — turn-based or real-time
- **Inventory & equipment** — expanded from P&C inventory
- **Leveling & XP** — character growth
- **Quest system** — active/completed quest tracking

### Task 3: Design RPG module interfaces

**Files to create:**
- `src/modules/rpg/MapSystem.js` — tilemap loading, camera, collision
- `src/modules/rpg/PlayerSystem.js` — sprite, movement, stats
- `src/modules/rpg/CombatSystem.js` — battle flow state machine
- `src/modules/rpg/QuestSystem.js` — quest state tracking
- `src/modules/rpg/ShopSystem.js` — buy/sell interface
- `src/data-schemas/rpg/` — JSON schemas for maps, actors, items, quests

**Research questions to answer:**

1. **Tilemaps:** Phaser 4 has built-in tilemap support (Tiled JSON format). Can we use Phaser's `Tilemap` API directly or do we need a wrapper? Should maps be Tiled JSON or a custom format?

2. **Movement:** Grid-based (step on tile) or free (pixel-based)? Grid-based is simpler and suits our data-driven philosophy. Keyboard + click-to-move?

3. **Collision:** Phaser Arcade physics for basic tile collision. Do we need wall tiles marked in the tilemap data?

4. **NPC interaction:** Overlap detection → trigger dialog scene (our existing system). NPCs are sprites on the map with a hotspot zone.

5. **Combat:** Turn-based (menu-driven) or real-time (action)? Turn-based is more data-driven and fits the VN engine's node-walking architecture. A combat node could be a special scene type.

6. **Stats & equipment:** Deeper variable system than VN. Do we extend VariableSystem or build a separate StatsComponent?

7. **Saving:** Map position + player state + quest state. Extends the existing SaveSystem.

8. **Screen transitions:** Map → Battle → Dialog. Camera fades between game modes. Can we use Phaser's scene stacking or do we layer containers?

9. **Tooling:** Tiled map editor is external (standard tool). Do we need a data-file generator?

**Deliverable:** A markdown document `docs/rpg-design.md` with:
- Data schemas for maps, actors, items, equipment, quests, shops
- System architecture diagram
- Combat flow state machine
- Integration with existing VN engine (dialog triggers on NPC contact)
- Phaser APIs needed (tilemap, arcade physics, camera)
- Trade-offs: grid vs free movement, turn-based vs real-time combat

---

## Summary: What Stays, What Changes, What's New

| System | VN (current) | P&C | RPG |
|--------|--------------|-----|-----|
| DialogueSystem | ✓ | Reuse as-is | Reuse as-is |
| VariableSystem | ✓ | Reuse (extend for item flags) | Need stat extension |
| SceneController | ✓ | Reuse (add puzzle node types) | Reuse (add combat nodes) |
| CharacterSystem | ✓ | Reuse | Add sprite sheets |
| DataLoader | ✓ | Reuse | Reuse |
| SaveSystem | ✓ | Extend (items + puzzles) | Extend (stats + map pos) |
| AudioSystem | ✓ | Reuse | Reuse |
| BootScene | ✓ | Reuse | Reuse (more data files) |
| HotspotSystem | — | **New** | Used for NPC triggers |
| InventorySystem | — | **New** | **New** (expanded) |
| CursorManager | — | **New** | — |
| PuzzleSystem | — | **New** | — |
| MapSystem | — | — | **New** |
| PlayerSystem | — | — | **New** |
| CombatSystem | — | — | **New** |
| QuestSystem | — | — | **New** |

---

## Dependencies

| Dep | Why | Concern |
|-----|-----|---------|
| vitest ^3.1.0 | Unit testing | Standard, no issues |
| jsdom | Mock browser env for tests | May not handle full Phaser; we fall back to mocking |
| Phaser 4 tilemap APIs | RPG maps | Built-in, no extra dep |
| Tiled map editor | RPG map authoring | External tool, JSON export |

---

## Risks & Open Questions

1. **Phaser 4 headless testing** — Phaser 4 may not work in jsdom. We may need to mock heavily or use Playwright for integration tests. Fallback: test pure logic only, do integration via manual QA.

2. **Scope creep on tooling** — P&C needs a room editor, RPG needs map editor. The user owns tooling. Our job is to define the data schemas so the user can build tools that work with them.

3. **Module loading** — How do genre modules plug in? Import-time detection (`if scene data has hotspots, load HotspotSystem`)? Config file? Start with config-based (`game.json` → `"genre": "vn" | "point-click" | "rpg"`).

4. **Scene overlap** — A VN scene with P&C elements (clickable background with dialog overlay). Need a hybrid mode.

5. **Narrative node extension** — Should new node types be added to the shared graph format? Probably yes — a "puzzle" node evaluates a puzzle state, a "combat" node triggers a battle. The graph walker handles them like any other node type.

---

## Execution Plan

```
Phase 1 — VN Validation (Priority: HIGH)
├── Task 1: Add test infrastructure (vitest, setup)
├── Task 2: VariableSystem unit tests
├── Task 3: SceneController logic tests
├── Task 4: SaveSystem tests
├── Task 5: Manual QA checklist
└── Task 6: Fix any bugs found during testing

Phase 2 — P&C Design (Priority: MEDIUM)
├── Task 7: Research P&C data schemas & Phaser APIs
├── Task 8: Write point-click-design.md
└── Task 9: Design tool data formats for the user

Phase 3 — RPG Design (Priority: LOW — biggest scope)
├── Task 10: Research RPG systems & Phaser tilemap APIs
├── Task 11: Write rpg-design.md
└── Task 12: Design map/actor data formats
```
