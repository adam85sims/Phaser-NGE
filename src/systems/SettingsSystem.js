/**
 * Settings — persistent user preferences.
 * Loaded from localStorage on boot, saved on change.
 * Read by DialogueSystem (textSpeed), AudioSystem (volume), etc.
 */
export const Settings = {
  textSpeed: 40,
  bgmVolume: 0.7,
  sfxVolume: 1.0,
  fullscreen: false,

  /** Load settings from localStorage */
  load() {
    try {
      const raw = localStorage.getItem('narrative_settings');
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(this, saved);
      }
    } catch {
      // Corrupted settings — reset
      this._reset();
    }
  },

  /** Save current settings to localStorage */
  save() {
    try {
      localStorage.setItem('narrative_settings', JSON.stringify({
        textSpeed: this.textSpeed,
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume,
        fullscreen: this.fullscreen,
      }));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  },

  _reset() {
    this.textSpeed = 40;
    this.bgmVolume = 0.7;
    this.sfxVolume = 1.0;
    this.fullscreen = false;
  },

  /** Clamp a numeric value between min and max */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },
};
