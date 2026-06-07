/**
 * SaveSystem unit tests.
 *
 * SaveSystem serializes game state to localStorage.
 * Depends on: VariableSystem (for variable state), SceneController (for scene/node tracking).
 * All three are testable — VariableSystem has no DOM deps, SceneController has no Phaser deps.
 *
 * jsdom provides localStorage in the test environment.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VariableSystem } from '../../src/systems/VariableSystem.js';
import { SceneController } from '../../src/systems/SceneController.js';
import { SaveSystem } from '../../src/systems/SaveSystem.js';
import { Data } from '../../src/systems/DataLoader.js';

describe('SaveSystem', () => {

  let vs;
  let ctrl;
  let saveSys;

  beforeEach(() => {
    Data.variables = {
      courage: { type: 'number', default: 50 },
      has_key: { type: 'boolean', default: false },
    };
    Data.scenes = {};

    vs = new VariableSystem();
    ctrl = new SceneController(vs);
    saveSys = new SaveSystem(vs, ctrl);

    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /* ── getSlots ─────────────────────── */

  describe('getSlots', () => {

    it('returns empty array when no saves exist', () => {
      const slots = saveSys.getSlots();
      expect(slots).toEqual([]);
    });

    it('returns previously saved slots', () => {
      // Manually write some save data
      localStorage.setItem('narrative_saves', JSON.stringify({ 0: { slot: 0, title: 'Save 1' } }));
      const slots = saveSys.getSlots();
      expect(slots[0].title).toBe('Save 1');
    });

    it('returns empty array when localStorage is empty/missing', () => {
      localStorage.removeItem('narrative_saves');
      expect(saveSys.getSlots()).toEqual([]);
    });

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem('narrative_saves', 'not-valid-json{{{');
      // Should return empty array rather than crash
      expect(() => saveSys.getSlots()).not.toThrow();
      expect(saveSys.getSlots()).toEqual([]);
    });
  });

  /* ── save ──────────────────────────── */

  describe('save', () => {

    it('stores variables, scene, and node info to a slot', () => {
      vs.set('courage', 80);
      vs.set('has_key', true);

      // Set up some scene state on the controller
      ctrl.currentScene = { id: 'chapter_2' };
      ctrl.currentNode = { id: 'scene_2_start' };

      const result = saveSys.save(0);

      expect(result.slot).toBe(0);
      expect(result.sceneId).toBe('chapter_2');
      expect(result.nodeId).toBe('scene_2_start');
      expect(result.variables).toEqual({ courage: 80, has_key: true });
      expect(result.title).toBe('Save 1');
      expect(result.timestamp).toEqual(expect.any(Number));

      // Verify it was persisted
      const slots = saveSys.getSlots();
      expect(slots[0].slot).toBe(0);
    });

    it('overwrites an existing save slot', () => {
      saveSys.save(0);
      saveSys.save(0); // overwrite

      const slots = saveSys.getSlots();
      expect(Object.keys(slots).length).toBe(1); // only 1 slot, not 2
    });

    it('saves to multiple slots independently', () => {
      const t0 = Date.now();
      saveSys.save(0);
      saveSys.save(1);
      saveSys.save(2);

      const slots = saveSys.getSlots();
      expect(slots[0].slot).toBe(0);
      expect(slots[1].slot).toBe(1);
      expect(slots[2].slot).toBe(2);
    });

    it('includes nodeIndex from scene controller', () => {
      ctrl.currentScene = { id: 'test' };
      ctrl.currentNode = { id: 'node_3' };
      ctrl.nodeIndex = 3;

      const result = saveSys.save(0);
      expect(result.nodeIndex).toBe(3);
    });

    it('handles save when scene/node are null', () => {
      ctrl.currentScene = null;
      ctrl.currentNode = null;

      const result = saveSys.save(0);
      expect(result.sceneId).toBeNull();
      expect(result.nodeId).toBeNull();
    });
  });

  /* ── load ──────────────────────────── */

  describe('load', () => {

    it('restores variables and returns scene info', () => {
      vs.set('courage', 99); // set some state
      ctrl.currentScene = { id: 'scene_5' };
      ctrl.currentNode = { id: 'node_42' };
      ctrl.nodeIndex = 42;

      saveSys.save(0);

      // Reset variables
      vs.set('courage', 0);

      const loaded = saveSys.load(0);

      expect(loaded).not.toBeNull();
      expect(loaded.sceneId).toBe('scene_5');
      expect(loaded.nodeIndex).toBe(42);
      expect(vs.get('courage')).toBe(99); // restored
    });

    it('returns null when loading an empty slot', () => {
      const result = saveSys.load(0);
      expect(result).toBeNull();
    });

    it('returns null when loading a non-existent slot', () => {
      const result = saveSys.load(99);
      expect(result).toBeNull();
    });

    it('does not throw when load slot exists but has no variables', () => {
      localStorage.setItem('narrative_saves', JSON.stringify({ 0: { slot: 0 } }));
      expect(() => saveSys.load(0)).not.toThrow();
      const result = saveSys.load(0);
      expect(result).not.toBeNull();
    });
  });

  /* ── delete ────────────────────────── */

  describe('delete', () => {

    it('removes a save slot', () => {
      saveSys.save(0);
      saveSys.save(1);

      saveSys.delete(0);

      const slots = saveSys.getSlots();
      expect(slots[0]).toBeNull();    // JSON.stringify converts sparse array hole to null
      expect(slots[1]).toBeDefined();
    });

    it('does nothing when deleting a non-existent slot', () => {
      expect(() => saveSys.delete(99)).not.toThrow();
    });

    it('leaves other slots intact when deleting', () => {
      saveSys.save(0);
      saveSys.save(1);
      saveSys.save(2);

      saveSys.delete(1);

      const slots = saveSys.getSlots();
      expect(slots[0]).toBeDefined();
      expect(slots[1]).toBeNull();     // JSON.stringify converts sparse array hole to null
      expect(slots[2]).toBeDefined();
    });
  });

  /* ── formatTimestamp ───────────────── */

  describe('formatTimestamp', () => {

    it('returns a readable date string', () => {
      // Use a fixed timestamp
      const ts = new Date('2026-06-07T14:30:00').getTime();
      const formatted = saveSys.formatTimestamp(ts);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  /* ── Integration ───────────────────── */

  describe('integration: save/load round-trip', () => {

    it('preserves game state across save/load cycle', () => {
      // Simulate gameplay
      Data.variables = {
        courage: { type: 'number', default: 50 },
        has_key: { type: 'boolean', default: false },
        name: { type: 'string', default: 'Lena' },
      };
      vs._initFromData();

      vs.set('courage', 75);
      vs.set('has_key', true);
      vs.set('name', 'Hero');

      ctrl.currentScene = { id: 'forest' };
      ctrl.currentNode = { id: 'clearing' };
      ctrl.nodeIndex = 12;

      // Save
      saveSys.save(2);

      // Change state
      vs.set('courage', 10);
      vs.set('has_key', false);
      ctrl.currentScene = { id: 'dungeon' };
      ctrl.currentNode = { id: 'cell' };

      // Load
      const loaded = saveSys.load(2);

      // Verify restored
      expect(vs.get('courage')).toBe(75);
      expect(vs.get('has_key')).toBe(true);
      expect(vs.get('name')).toBe('Hero');
      expect(loaded.sceneId).toBe('forest');
      expect(loaded.nodeIndex).toBe(12);
    });

    it('handles multiple save slots independently', () => {
      Data.variables = { x: { type: 'number', default: 0 } };
      vs._initFromData();

      vs.set('x', 10);
      ctrl.currentScene = { id: 'scene_a' };
      ctrl.currentNode = { id: 'node_a' };
      saveSys.save(0);

      vs.set('x', 20);
      ctrl.currentScene = { id: 'scene_b' };
      ctrl.currentNode = { id: 'node_b' };
      saveSys.save(1);

      // Load slot 0
      vs.set('x', 999);
      const loaded0 = saveSys.load(0);
      expect(vs.get('x')).toBe(10);
      expect(loaded0.sceneId).toBe('scene_a');

      // Load slot 1
      const loaded1 = saveSys.load(1);
      expect(vs.get('x')).toBe(20);
      expect(loaded1.sceneId).toBe('scene_b');
    });
  });
});
