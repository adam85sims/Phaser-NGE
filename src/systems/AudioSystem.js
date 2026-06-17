import { Settings } from './SettingsSystem.js';

/**
 * AudioSystem — BGM and SFX manager.
 * Supports crossfade, fade-in, and fade-out for background music.
 * Falls back gracefully if audio files don't exist.
 */
export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.bgmChannel = null;
    this.voiceChannel = null;
    this.bgmVolume = Settings.bgmVolume;
    this.sfxVolume = Settings.sfxVolume;
    this.voiceVolume = Settings.voiceVolume || 1.0;
    this.muted = false;

    // Track active tween so we can cancel mid-crossfade
    this._fadeTween = null;

    // Remember which missing keys we've already warned about so a scene
    // that fires the same bad event 20 times doesn't spam the console.
    this._warnedKeys = new Set();
  }

  /**
   * Play background music (looped) with optional crossfade.
   * @param {string} key - Audio key in cache
   * @param {number} fadeDuration - Crossfade/fade-in duration in ms (default 800)
   */
  playBGM(key, fadeDuration = 800) {
    if (!key || this.muted) return;

    // Don't restart the same track if it's already playing
    if (this.bgmChannel && this.bgmChannel.key === key && this.bgmChannel.isPlaying) return;

    // Cancel any in-progress fade tween
    if (this._fadeTween) {
      this._fadeTween.destroy();
      this._fadeTween = null;
    }

    if (!this.scene.cache.audio.exists(key)) {
      this._warnMissing('bgm', key);
      return;
    }

    // Create the new track (start at volume 0 for fade-in / crossfade)
    const newChannel = this.scene.sound.add(key, { loop: true, volume: 0 });
    newChannel.play();

    if (this.bgmChannel) {
      // Crossfade: fade out old track, fade in new track simultaneously
      const oldChannel = this.bgmChannel;

      // Fade out old track
      this._fadeTween = this.scene.tweens.add({
        targets: oldChannel,
        volume: 0,
        duration: fadeDuration,
        ease: 'Sine.easeIn',
        onComplete: () => {
          oldChannel.stop();
          oldChannel.destroy();
        }
      });

      // Fade in new track
      this.scene.tweens.add({
        targets: newChannel,
        volume: this.bgmVolume,
        duration: fadeDuration,
        ease: 'Sine.easeOut'
      });
    } else {
      // No existing track — simple fade in from 0
      this._fadeTween = this.scene.tweens.add({
        targets: newChannel,
        volume: this.bgmVolume,
        duration: fadeDuration,
        ease: 'Sine.easeOut'
      });
    }

    this.bgmChannel = newChannel;
  }

  /**
   * Stop background music with optional fade-out.
   * @param {number} fadeDuration - Fade-out duration in ms (default 400). 0 = instant.
   */
  stopBGM(fadeDuration = 400) {
    if (!this.bgmChannel) return;

    if (this._fadeTween) {
      this._fadeTween.destroy();
      this._fadeTween = null;
    }

    if (fadeDuration > 0) {
      const channel = this.bgmChannel;
      this._fadeTween = this.scene.tweens.add({
        targets: channel,
        volume: 0,
        duration: fadeDuration,
        ease: 'Sine.easeIn',
        onComplete: () => {
          channel.stop();
          channel.destroy();
          if (this.bgmChannel === channel) this.bgmChannel = null;
          this._fadeTween = null;
        }
      });
    } else {
      this.bgmChannel.stop();
      this.bgmChannel.destroy();
      this.bgmChannel = null;
    }
  }

  /** Play a sound effect once */
  playSFX(key) {
    if (!key || this.muted) return;
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key, { volume: this.sfxVolume });
    } else {
      this._warnMissing('sfx', key);
    }
  }

  _warnMissing(type, key) {
    if (this._warnedKeys.has(`${type}:${key}`)) return;
    this._warnedKeys.add(`${type}:${key}`);
    console.warn(
      `[AudioSystem] Audio key '${key}' not in audio cache. ` +
      `Check if the file exists and is preloaded.`
    );
  }

  setBGMVolume(v) {
    this.bgmVolume = v;
    if (this.bgmChannel) this.bgmChannel.setVolume(v);
  }

  setSFXVolume(v) {
    this.sfxVolume = v;
  }

  setVoiceVolume(v) {
    this.voiceVolume = v;
    if (this.voiceChannel) this.voiceChannel.setVolume(v);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      if (this.bgmChannel) this.bgmChannel.pause();
      if (this.voiceChannel) this.voiceChannel.pause();
    } else {
      if (this.bgmChannel) this.bgmChannel.resume();
      if (this.voiceChannel) this.voiceChannel.resume();
    }
    return this.muted;
  }

  destroy() {
    this.stopBGM(0);
    this.stopVoice(0);
  }

  /** Play a voice line, stopping previous ones */
  playVoice(key) {
    if (!key || this.muted) return;
    this.stopVoice(0);
    if (this.scene.cache.audio.exists(key)) {
      this.voiceChannel = this.scene.sound.add(key, { volume: this.voiceVolume });
      this.voiceChannel.play();
    } else {
      this._warnMissing('voice', key);
    }
  }

  /** Stop voice playback with optional quick fade */
  stopVoice(fadeDuration = 200) {
    if (!this.voiceChannel) return;
    
    if (fadeDuration > 0 && this.voiceChannel.isPlaying) {
      const channel = this.voiceChannel;
      this.scene.tweens.add({
        targets: channel,
        volume: 0,
        duration: fadeDuration,
        ease: 'Sine.easeIn',
        onComplete: () => {
          channel.stop();
          channel.destroy();
        }
      });
    } else {
      this.voiceChannel.stop();
      this.voiceChannel.destroy();
    }
    this.voiceChannel = null;
  }
}
