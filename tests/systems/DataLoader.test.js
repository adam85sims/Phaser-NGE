/**
 * DataLoader unit tests.
 *
 * Data is a simple global store populated by BootScene after fetch.
 * Contains: game config, characters, variables, scenes with lookup methods.
 * No Phaser or DOM dependencies.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Data } from '../../src/systems/DataLoader.js';

describe('Data store (DataLoader)', () => {

  beforeEach(() => {
    // Reset the Data store to clean state
    Data.game = null;
    Data.characters = null;
    Data.variables = null;
    Data.scenes = {};
  });

  /* ── getScene ──────────────────────── */

  describe('getScene', () => {

    it('returns a registered scene by ID', () => {
      const scene = { id: 'forest', nodes: [] };
      Data.scenes = { forest: scene };

      expect(Data.getScene('forest')).toBe(scene);
    });

    it('returns null for unknown scene', () => {
      expect(Data.getScene('nonexistent')).toBeNull();
    });

    it('returns null when scenes is empty', () => {
      Data.scenes = {};
      expect(Data.getScene('anything')).toBeNull();
    });
  });

  /* ── getCharacter ──────────────────── */

  describe('getCharacter', () => {

    it('returns a character definition by ID', () => {
      const char = { name: 'Lena', color: '#00ccff' };
      Data.characters = { hero: char };

      expect(Data.getCharacter('hero')).toBe(char);
    });

    it('returns null for unknown character', () => {
      expect(Data.getCharacter('nonexistent')).toBeNull();
    });

    it('returns null when characters is null', () => {
      Data.characters = null;
      expect(Data.getCharacter('hero')).toBeNull();
    });
  });

  /* ── getDefaultTextSpeed ───────────── */

  describe('getDefaultTextSpeed', () => {

    it('returns the configured text speed', () => {
      Data.game = { defaults: { textSpeed: 30 } };
      expect(Data.getDefaultTextSpeed()).toBe(30);
    });

    it('returns 40 when game config is null', () => {
      Data.game = null;
      expect(Data.getDefaultTextSpeed()).toBe(40);
    });

    it('returns 40 when defaults are missing', () => {
      Data.game = {};
      expect(Data.getDefaultTextSpeed()).toBe(40);
    });

    it('returns 40 when textSpeed is undefined', () => {
      Data.game = { defaults: {} };
      expect(Data.getDefaultTextSpeed()).toBe(40);
    });
  });

  /* ── Property defaults ─────────────── */

  describe('default property values', () => {

    it('starts with null game', () => {
      expect(Data.game).toBeNull();
    });

    it('starts with null characters', () => {
      expect(Data.characters).toBeNull();
    });

    it('starts with null variables', () => {
      expect(Data.variables).toBeNull();
    });

    it('starts with empty scenes object (not null)', () => {
      expect(Data.scenes).toEqual({});
    });
  });
});
