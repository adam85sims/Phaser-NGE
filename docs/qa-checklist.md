# VN Engine — Manual QA Checklist

These tests require a browser. They exercise the Phaser-rendering systems (DialogueSystem, CharacterSystem, AudioSystem) and the editor tool — things the automated unit tests can't cover.

## Prerequisites

```bash
cd narrative-engine
npm run dev
```

Game URL: `http://localhost:3000/`
Editor URL: `http://localhost:3000/tools/dialogue-editor/`

---

## 1. Game Load & Boot

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1.1 | Open `http://localhost:3000/` | Loading screen appears briefly, then fades into the game showing the sample scene dialogue "A calm evening settles over the city..." | ☐ |
| 1.2 | Check browser console for errors | No JS errors, no CORS errors, no 404s for data files | ☐ |
| 1.3 | Check Network tab for data loads | `game.json`, `characters.json`, `variables.json`, all scene files load with status 200 | ☐ |
| 1.4 | Page refresh | Game reloads cleanly, no stale state from previous session | ☐ |

---

## 2. Dialogue System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 2.1 | **Typewriter effect** | Text appears character by character. Speed is reading-speed (not instant) | ☐ |
| 2.2 | **Click/Space/Enter to skip** | During typewriter, pressing Space/Enter or clicking jumps to full text immediately | ☐ |
| 2.3 | **Click/Space/Enter to advance** | After typewriter finishes, pressing Space/Enter or clicking advances to the next node | ☐ |
| 2.4 | **Continue indicator** | After text finishes, a blinking ▼ arrow appears at bottom-right of text box | ☐ |
| 2.5 | **Nameplate display** | "Lena" appears in blue for hero dialogue, "???" in orange for mystery_man, no nameplate for narrator | ☐ |
| 2.6 | **Multiple dialogue nodes** | The sample scene walks through start → intro_hero → meet_stranger → stranger_speaks (check by clicking through) | ☐ |

---

## 3. Choice System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.1 | **Choices appear** | At "How do you respond?" the dialogue box shows 3 choices: "Who are you?", "I don't have time for games.", "Reach for your weapon" | ☐ |
| 3.2 | **Number key selection** | Press 1, 2, or 3 to select a choice | ☐ |
| 3.3 | **Click selection** | Click on a choice text with the mouse | ☐ |
| 3.4 | **Choice highlight** | Choices highlight on hover (text turns white) | ☐ |
| 3.5 | **Choice branches correctly** | Selecting "Who are you?" → goes to who_are_you dialogue. Selecting other option → different branch | ☐ |
| 3.6 | **Conditional choices** | "I don't have time for games." requires courage >= 30 (default is 50, so it's visible). "Reach for your weapon" requires has_weapon_permit == true (default is false, so it's hidden) | ☐ |
| 3.7 | **Hidden choices** | Verify "Reach for your weapon" is NOT shown when has_weapon_permit defaults to false | ☐ |

---

## 4. Condition System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 4.1 | Press F2 to load the condition test scene | Scene loads with "CONDITION TEST: Your courage is being tested." | ☐ |
| 4.2 | **Condition branch (true)** | courage defaults to 50, so `courage >= 50` is true → "BRAVE PATH: Your courage is strong." appears | ☐ |
| 4.3 | **Condition branch (false)** | On the brave path, make a selection. If you select "Proceed carefully" (adds 5 courage), the final condition `courage >= 70` checks: 55 < 70 → "NORMAL ENDING" | ☐ |
| 4.4 | **Chained conditions** | Two conditions in sequence: first courage check → choice → second courage check with different threshold | ☐ |

---

## 5. Event System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.1 | Press F3 to load the event test scene | Scene loads with "EVENT TEST: The city hums around you." | ☐ |
| 5.2 | **Camera shake** | Select "Camera shake (intense)" → the screen shakes noticeably | ☐ |
| 5.3 | **Camera flash** | Select "Flash the screen" → brief white flash | ☐ |
| 5.4 | **SFX event** | Select "Set variable + play SFX" → toast shows "⚡ sfx: alert" (no audio file loaded, so no sound plays — graceful fallback is acceptable) | ☐ |
| 5.5 | **Wait node** | Select "Wait 3 seconds" → game pauses for 3 seconds, then advances | ☐ |
| 5.6 | **Event toasts** | For each event, a brief toast notification appears and fades out at the bottom of the screen | ☐ |

---

## 6. Wait Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1 | Wait pauses for full duration | The 3-second wait from test 5.5 pauses exactly the specified time | ☐ |
| 6.2 | Dialogue box hides during wait | Text box disappears during wait, reappears when next node triggers | ☐ |
| 6.3 | Can't skip a wait with click | Clicking during a wait should NOT advance (wait is timer-only) | ☐ |

---

## 7. End Node & Scene Transition

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 7.1 | **End text display** | When a scene ends, "To be continued..." (or other end text) appears centered on screen in gold, pulsing | ☐ |
| 7.2 | **Scene transition (end → nextScene)** | Currently no scene has nextScene set — verify by checking all scene files (optional: add one and test) | ☐ |
| 7.3 | **F-key scene switching** | F1 → sample scene. F2 → conditions test. F3 → events test. Each has a clean fade transition. | ☐ |

---

## 8. Character System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 8.1 | **Portrait placeholder** | When hero speaks, a blue circle with face features appears on screen above the text box | ☐ |
| 8.2 | **Portrait fade in/out** | Portrait fades in when character starts speaking, fades out on transition | ☐ |
| 8.3 | **Multiple character portraits** | Hero (blue), Mystery Man (orange) appear with different colors | ☐ |
| 8.4 | **No portrait for narrator** | Narrator has no portrait and no nameplate — only text | ☐ |
| 8.5 | **Portrait position** | Portrait appears centered (default position) above the dialogue text box | ☐ |

---

## 9. Variable System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 9.1 | **Variable mutation via choice** | Selecting "Who are you?" (setFlag: courage, setValue: 5) should increase courage from 50 to 55 | ☐ |
| 9.2 | **Variable mutation via event** | The "Set variable + play SFX" choice in event test sets `alert_triggered = true` | ☐ |
| 9.3 | **Variables persist across scenes** | Change courage in the sample scene, then switch to conditions test (F2) — the modified value should be used for conditions | ☐ |

---

## 10. Save System

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 10.1 | **Save persists to localStorage** | Open DevTools → Application → Local Storage → `narrative_saves` key exists after game loads | ☐ |
| 10.2 | **Save on scene transition** | Internal save trigger works (check the code — currently save is manual via SaveSystem API, not automatic) | ☐ |
| 10.3 | **Load restores state** | Future: verify load restores variables + scene position | ☐ |

---

## 11. Dialogue Editor Tool

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 11.1 | Open `http://localhost:3000/tools/dialogue-editor/` | Editor loads without errors. Shows a node graph canvas. | ☐ |
| 11.2 | **Scene dropdown** | Dropdown lists available scenes (sample, test-conditions, test-events) | ☐ |
| 11.3 | **Select a scene** | Selecting a scene displays its node graph with correct layout | ☐ |
| 11.4 | **Node rendering** | Nodes render with correct colors: Blue (dialogue), Amber (choice), Purple (condition), Green (event), Grey (wait), Red (end) | ☐ |
| 11.5 | **Wire connections** | Nodes show connection lines between output ports (right) and input ports (left) | ☐ |
| 11.6 | **Click a node** | Node properties appear in the right panel (text, speaker, choices, etc.) | ☐ |
| 11.7 | **Edit node properties** | Change text in a dialogue node, verify it updates in the editor | ☐ |
| 11.8 | **Drag nodes** | Click and drag a node to reposition it on the canvas | ☐ |
| 11.9 | **Create new node** | There should be a way to add new nodes (check the UI) | ☐ |
| 11.10 | **Wire nodes together** | Drag from an output port to an input port to create a connection | ☐ |
| 11.11 | **Export button** | Clicking Export produces a valid JSON file | ☐ |
| 11.12 | **Export → Game workflow** | Export a scene, place in `data/scenes/`, register in `game.json`, refresh game → scene plays | ☐ |
| 11.13 | **Browser console** | No JS errors in editor page | ☐ |

---

## 12. Error Handling & Edge Cases

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 12.1 | **Missing scene file** | Remove a scene file from `data/scenes/` and refresh — game should not crash, just warn | ☐ |
| 12.2 | **Broken JSON** | Introduce a syntax error in a scene JSON — game shows LOAD ERROR in red on the boot screen | ☐ |
| 12.3 | **Missing characters.json** | Delete `data/characters.json` — game loads but no character data, narrator works | ☐ |
| 12.4 | **Empty variables** | Empty `variables.json` — game loads with no tracked variables | ☐ |
| 12.5 | **Browser resize** | Resize the browser window — game scales via Phaser.Scale.FIT. Should stay centered. | ☐ |
| 12.6 | **Rapid clicking** | Click rapidly through dialogue — should not skip nodes, skip only the current typewriter | ☐ |
| 12.7 | **F-key during dialogue** | Press F1/F2/F3 while text is typing — should switch scenes cleanly | ☐ |

---

## 13. Performance

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 13.1 | **FPS check** | Open DevTools performance tab. FPS should stay at 60 during dialogue | ☐ |
| 13.2 | **Memory usage** | No steady memory increase. Memory should be stable across scene switches | ☐ |
| 13.3 | **No DOM leaks** | Switching scenes should not leave old game objects in memory | ☐ |

---

## Summary

| Section | Automated Tests | Manual Tests | Status |
|---------|----------------|--------------|--------|
| VariableSystem | 52 | — | ✓ All pass |
| SceneController | 61 | — | ✓ All pass |
| SaveSystem | 18 | — | ✓ All pass |
| DataLoader | 14 | — | ✓ All pass |
| Game Load & Boot | — | 4 | ☐ |
| Dialogue System | — | 6 | ☐ |
| Choice System | — | 7 | ☐ |
| Condition System | — | 4 | ☐ |
| Event System | — | 6 | ☐ |
| Wait Node | — | 3 | ☐ |
| End Node & Transition | — | 3 | ☐ |
| Character System | — | 5 | ☐ |
| Variable System | — | 3 | ☐ |
| Save System | — | 3 | ☐ |
| Dialogue Editor | — | 13 | ☐ |
| Error Handling | — | 7 | ☐ |
| Performance | — | 3 | ☐ |
| **Total** | **146** | **67** | |

---

## How to File Bugs

For each failing manual test, note:
1. Test # and description
2. What actually happened vs expected
3. Browser console errors (if any)
4. Steps to reproduce
