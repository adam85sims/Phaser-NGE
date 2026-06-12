# Inline Scripting

Phaser-NGE supports inline scripting within dialogue text. This allows writers to trigger engine events seamlessly as the dialogue is printed to the screen, perfectly syncing visual actions with the typewriter effect.

## Syntax

Tags are placed directly inside the dialogue text using square brackets. The syntax is:

`[action:target]`

These tags are parsed out of the text at runtime; they will never be visible to the player.

## Supported Tags

### Visibility Toggles
Controls the visibility of layers/objects on the screen. The `target` must match the exact **Asset Name** of the object (as seen in the editor's Outline panel).

- **`[show:imagename]`**: Fades the object in exactly when the typewriter reaches this point in the text.
- **`[hide:imagename]`**: Fades the object out exactly when the typewriter reaches this point in the text.

### Keyframe Animations
Triggers a predefined keyframe animation (created in the Animations Editor Mode) on a specific object. The syntax takes a third parameter for the animation key:

- **`[anim:target:animation_key]`**: Starts the specified animation on the target object immediately. 
  *Example:* `[anim:dave:spin_in]` will trigger the `spin_in` animation on the `dave` layer exactly at that point in the dialogue.

**Example Usage:**
```text
Here is the ancient relic you asked for. [show:ancient_relic] [anim:ancient_relic:pulse] It has been in my family for generations.
```
In this example, the `ancient_relic` asset will become visible immediately after the period following "for", and simultaneously start its `pulse` animation.

## Best Practices
- **Asset Names:** Always use the raw asset name (e.g., `gold_coin`, `elena_neutral`) rather than internal layer IDs.
- **Pre-loading/Adding:** For an object to be toggled via inline scripting, it must first be added to the scene via the editor's Outline panel and set to "hidden" (the eye icon).
- **Skip Behavior:** If the player clicks to skip the dialogue animation, any pending inline scripts in that line of text will instantly execute, ensuring the game state remains accurate.

*(Note: As we continue to develop the engine, more inline tags (such as for SFX or variable manipulation) will be documented here).*
