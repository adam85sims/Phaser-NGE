---
name: audio-system
description: "BGM and SFX manager with crossfade support and graceful fallback when audio files don't exist. Supports background music (loop, crossfade swap), one-shot sound effects, volume control per channel, global mute, and runtime on-demand loading via GameScene._loadAndPlay. Related triggers: audio manager, sound effects, background music, BGM, SFX, volume control, crossfade."
---

# AudioSystem

> Audio manager for background music and sound effects. Handles cache checks gracefully — if a sound key doesn't exist in the Phaser audio cache, the operation is silently skipped (with a one-time warning) rather than throwing. Supports crossfade between BGM tracks, runtime fallback loading, and deduplicated missing-key warnings. Audio files are auto-preloaded by BootScene based on scene graph references.

**Source:** `src/systems/AudioSystem.js`
**Related skills:** `../game-scene/SKILL.md`

## Constructor

```js
constructor(scene)
```

Takes a Phaser Scene reference. Initializes volumes from `Data.game.defaults`: BGM 0.7, SFX 1.0, muted false. Sets `fadeDuration` to 800ms for crossfades.

## Public Methods

### `playBGM(key)`
- If same key already playing on `bgmChannel`, skips (dedup)
- If different key playing, **crossfades**: fades out old channel, fades in new simultaneously over `fadeDuration` (800ms)
- Silently skips if key not in `cache.audio` or if muted
- Creates a looping sound at `bgmVolume`

### `stopBGM(duration)`
Fades out over `duration` ms (default 800), then destroys the BGM channel. `duration: 0` = instant stop. Safe to call when no BGM is playing.

### `playSFX(key)`
Plays a one-shot sound at `sfxVolume`. Silently skips if key missing or muted.

### `setBGMVolume(v)`
Sets volume (0-1) and updates the currently playing BGM channel if active.

### `setSFXVolume(v)`
Sets SFX volume. Applied to future `playSFX()` calls.

### `toggleMute()`
Toggles the `muted` flag. Pauses or resumes the current BGM channel. Returns the new muted state. All-or-nothing — affects both BGM and SFX.

### `destroy()`
Stops and cleans up the BGM channel.

## Runtime Fallback (`GameScene._loadAndPlay`)

If an `event` node fires an audio key that wasn't preloaded by BootScene, `GameScene._loadAndPlay(type, key, onReady)` probes extensions `mp3/ogg/wav/opus/m4a` via HEAD requests and loads the file on-the-fly via `this.load.audio` + `this.load.start()`. This prevents audio from failing silently when scenes reference new audio that wasn't in the cache at boot time.

## Gotchas

- **Cache existence check** — `playBGM()` and `playSFX()` check `this.scene.cache.audio.exists(key)` before attempting to play. If missing, the operation is skipped and a one-time `console.warn` is emitted (`_warnedKeys` Set deduplicates per key).
- **Crossfade** — when swapping BGM tracks, the old channel fades out and the new one fades in simultaneously (both tweens run in parallel over `fadeDuration`).
- **Same-track restart prevention** — `playBGM()` checks if the same key is already playing. To force a restart, call `stopBGM()` first.
- **Mute is all-or-nothing** — `toggleMute()` affects both BGM and SFX. No per-channel mute.
- **Volume range** — values are 0.0 to 1.0. No clamping is performed.
- **Audio preloading is automatic** — BootScene walks every scene and registers `eventType: 'bgm'` / `'sfx'` event values with the Phaser loader via `this.load.audio(key, url)`. Files are looked up in `public/assets/audio/bgm/` and `public/assets/audio/sfx/` with extensions probed in order: `mp3, ogg, wav, opus, m4a`.
- **`stopBGM(duration)`** — if duration is 0, the stop is instant (no fade). If omitted, defaults to 800ms fade.
