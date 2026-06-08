/**
 * SettingsSystem unit tests.
 *
 * Settings is a simple module-level singleton with load/save/clamp helpers.
 * No Phaser or DOM dependencies (except localStorage for persistence).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Settings } from '../../src/systems/SettingsSystem.js';

describe('Settings', () => {

  beforeEach(() => {
    // Reset to defaults
    Settings.textSpeed = 40;
    Settings.bgmVolume = 0.7;
    Settings.sfxVolume = 1.0;
    Settings.fullscreen = false;
    localStorage.clear();
  });

  it('has sensible defaults', () => {
    expect(Settings.textSpeed).toBe(40);
    expect(Settings.bgmVolume).toBe(0.7);
    expect(Settings.sfxVolume).toBe(1.0);
    expect(Settings.fullscreen).toBe(false);
  });

  it('clamp restricts values to [min, max]', () => {
    expect(Settings.clamp(50, 0, 100)).toBe(50);
    expect(Settings.clamp(-10, 0, 100)).toBe(0);
    expect(Settings.clamp(200, 0, 100)).toBe(100);
  });

  it('save/load round-trips correctly', () => {
    Settings.textSpeed = 25;
    Settings.bgmVolume = 0.5;
    Settings.sfxVolume = 0.3;
    Settings.fullscreen = true;
    Settings.save();

    // Reset to defaults
    Settings.textSpeed = 40;
    Settings.bgmVolume = 0.7;
    Settings.sfxVolume = 1.0;
    Settings.fullscreen = false;

    Settings.load();

    expect(Settings.textSpeed).toBe(25);
    expect(Settings.bgmVolume).toBe(0.5);
    expect(Settings.sfxVolume).toBe(0.3);
    expect(Settings.fullscreen).toBe(true);
  });

  it('load returns defaults when no saved data exists', () => {
    Settings.load(); // no save data in localStorage
    expect(Settings.textSpeed).toBe(40);
    expect(Settings.bgmVolume).toBe(0.7);
    expect(Settings.sfxVolume).toBe(1.0);
    expect(Settings.fullscreen).toBe(false);
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem('narrative_settings', 'not-valid-json{{{');
    expect(() => Settings.load()).not.toThrow();
    // Should reset to defaults
    expect(Settings.textSpeed).toBe(40);
  });
});
