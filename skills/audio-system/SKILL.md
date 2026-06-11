---
name: audio-system
description: "BGM and SFX manager with graceful fallback when audio files don't exist. Supports background music (loop), one-shot sound effects, volume control per channel, and global mute. Ducks gracefully if a key is missing from the audio cache. Related triggers: audio manager, sound effects, background music, BGM, SFX, volume control."
---

# AudioSystem

> Simple audio manager for background music and sound effects. Handles cache checks gracefully — if a sound key doesn't exist in the Phaser audio cache, the operation is silently skipped (with a one-time `console.warn`) rather than throwing. Audio files are auto-preloaded by `BootScene` based on scene graph references.

**Source:** `src/systems/AudioSystem.js`
**Related skills:** `../game-scene/SKILL.md`

## Constructor

```js
constructor(scene)
```

Takes a Phaser Scene reference (used to access `scene.cache.audio` and `scene.sound`). Initializes volumes from defaults: BGM 0.7, SFX 1.0, muted false.

## Public Methods

### `playBGM(key)`
- Ignores duplicate if the same key is already playing
- Silently skips if key not in `cache.audio` or if muted
- Creates a looping sound at `bgmVolume`

### `stopBGM()`
Stops and destroys the current BGM channel. Safe to call when no BGM is playing.

### `playSFX(key)`
Plays a one-shot sound at `sfxVolume`. Silently skips if key missing or muted.

### `setBGMVolume(v)`
Sets volume (0-1 range) and updates the currently playing BGM channel if active.

### `setSFXVolume(v)`
Sets SFX volume. Applied to future `playSFX()` calls.

### `toggleMute()`
Toggles the `muted` flag. Pauses or resumes the current BGM channel. Returns the new muted state.

### `destroy()`
Stops and cleans up the BGM channel. Called on scene shutdown.

## Gotchas

- **Cache existence check** — `playBGM()` and `playSFX()` check `this.scene.cache.audio.exists(key)` before attempting to play. If the key doesn't exist, the operation is skipped and a one-time `console.warn` is emitted (deduped per missing key). This prevents console errors during development when audio assets aren't loaded.
- **Duplicate BGM prevention** — `playBGM()` checks if the same key is already playing on `bgmChannel` and returns early. To force a restart of the current track, call `stopBGM()` first.
- **Mute is all-or-nothing** — `toggleMute()` affects both BGM and SFX. There's no per-channel mute.
- **Volume range** — values are 0.0 to 1.0. No clamping is performed.
- **Audio preloading is automatic** — `BootScene` walks every scene and registers `eventType: 'bgm'` / `'sfx'` event values (and legacy `scene.music`) with the Phaser loader via `this.load.audio(key, url)`. Files are looked up in `public/assets/audio/bgm/` and `public/assets/audio/sfx/` with extensions probed in order: `mp3, ogg, wav, opus, m4a`. Drop a file matching the filename stem and it Just Works — no manifest to update.
