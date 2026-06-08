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
    this.bgmVolume = Settings.bgmVolume;
    this.sfxVolume = Settings.sfxVolume;
    this.muted = false;

    // Track active tween so we can cancel mid-crossfade
    this._fadeTween = null;
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

    if (!this.scene.cache.audio.exists(key)) return;

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
    }
  }

  setBGMVolume(v) {
    this.bgmVolume = v;
    if (this.bgmChannel) this.bgmChannel.setVolume(v);
  }

  setSFXVolume(v) {
    this.sfxVolume = v;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      if (this.bgmChannel) this.bgmChannel.pause();
    } else {
      if (this.bgmChannel) this.bgmChannel.resume();
    }
    return this.muted;
  }

  destroy() {
    this.stopBGM(0);
  }
}
