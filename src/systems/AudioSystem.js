/**
 * AudioSystem — BGM and SFX manager.
 * Falls back gracefully if audio files don't exist.
 */
export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.bgmChannel = null;
    this.bgmVolume = 0.7;
    this.sfxVolume = 1.0;
    this.muted = false;
  }

  /** Play background music (looped) */
  playBGM(key) {
    if (!key || this.muted) return;

    // Don't restart same track
    if (this.bgmChannel && this.bgmChannel.key === key) return;

    this.stopBGM();

    if (this.scene.cache.audio.exists(key)) {
      this.bgmChannel = this.scene.sound.add(key, { loop: true, volume: this.bgmVolume });
      this.bgmChannel.play();
    }
  }

  /** Stop background music */
  stopBGM() {
    if (this.bgmChannel) {
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
    this.stopBGM();
  }
}
