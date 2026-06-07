/**
 * SceneController unit tests.
 *
 * SceneController is the graph-based narrative state machine.
 * It reads scenes from Data, processes nodes, and fires callbacks.
 * No Phaser dependency — just Data + VariableSystem + setTimeout.
 *
 * Key gotcha: processNode() guards with `if (!this.isRunning) return;`.
 * Tests that call processNode() directly must set isRunning = true first.
 * Tests that need node-following (conditions, choices, events, waits)
 * must also have a currentScene with the target nodes in its nodes[].
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Data } from '../../src/systems/DataLoader.js';
import { VariableSystem } from '../../src/systems/VariableSystem.js';
import { SceneController } from '../../src/systems/SceneController.js';

/* ── Helpers ─────────────────────────────── */

function makeScene(id, nodes, entryNode) {
  return {
    id: id || 'test_scene',
    entryNode: entryNode || (nodes?.[0]?.id) || 'start',
    background: null,
    music: null,
    nodes: nodes || [],
  };
}

function makeDialogue(id, speaker, text, overrides = {}) {
  return { id, type: 'dialogue', speaker, text, ...overrides };
}

function makeChoice(id, prompt, choices, overrides = {}) {
  return { id, type: 'choice', prompt, choices, ...overrides };
}

function makeCondition(id, condition, next, elseNext, overrides = {}) {
  return { id, type: 'condition', condition, next, else: elseNext, ...overrides };
}

function makeEvent(id, eventType, eventValue, overrides = {}) {
  return { id, type: 'event', eventType, eventValue, ...overrides };
}

function makeWait(id, duration, overrides = {}) {
  return { id, type: 'wait', duration, ...overrides };
}

function makeEnd(id, text, overrides = {}) {
  return { id, type: 'end', text, ...overrides };
}

function createController(variableDefs) {
  Data.variables = variableDefs || {};
  const vars = new VariableSystem();
  return new SceneController(vars);
}

function registerScene(scene) {
  if (!Data.scenes) Data.scenes = {};
  Data.scenes[scene.id] = scene;
}

function callbackSpy() {
  return vi.fn();
}

/* ── Tests ───────────────────────────────── */

describe('SceneController', () => {

  let ctrl;

  beforeEach(() => {
    Data.scenes = {};
    ctrl = createController({});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (ctrl) ctrl.destroy();
  });

  /* ── Construction ──────────────────── */

  describe('construction', () => {

    it('initialises with default null state', () => {
      expect(ctrl.currentScene).toBeNull();
      expect(ctrl.currentNode).toBeNull();
      expect(ctrl.isRunning).toBe(false);
      expect(ctrl.onDialogue).toBeNull();
      expect(ctrl.onChoice).toBeNull();
      expect(ctrl.onSceneEnd).toBeNull();
      expect(ctrl.onAction).toBeNull();
      expect(ctrl.onSceneStart).toBeNull();
      expect(ctrl.onWait).toBeNull();
    });

    it('accepts a VariableSystem', () => {
      expect(ctrl.vars).toBeInstanceOf(VariableSystem);
    });
  });

  /* ── startScene ─────────────────────── */

  describe('startScene', () => {

    it('loads a scene and jumps to entryNode', () => {
      const scene = makeScene('s1', [
        makeDialogue('start', 'narrator', 'Hello'),
        makeDialogue('next_node', 'hero', 'World'),
      ], 'start');
      registerScene(scene);

      const onStart = callbackSpy();
      ctrl.onSceneStart = onStart;

      ctrl.startScene('s1');

      expect(ctrl.currentScene).toBe(scene);
      expect(ctrl.isRunning).toBe(true);
      expect(onStart).toHaveBeenCalledWith({
        sceneId: 's1',
        background: null,
        music: null,
      });
      expect(ctrl.currentNode.id).toBe('start');
    });

    it('warns and returns for missing scene', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      ctrl.startScene('nonexistent');
      expect(warn).toHaveBeenCalled();
      expect(ctrl.isRunning).toBe(false);
      warn.mockRestore();
    });

    it('falls back to first node id when no entryNode', () => {
      const scene = makeScene('s1', [
        makeDialogue('first', 'narrator', 'Hi'),
      ]);
      delete scene.entryNode;
      registerScene(scene);

      ctrl.startScene('s1');
      expect(ctrl.currentNode.id).toBe('first');
    });

    it('ends scene if scene has no nodes', () => {
      const scene = makeScene('empty_scene', []);
      registerScene(scene);

      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.startScene('empty_scene');
      expect(onEnd).toHaveBeenCalled();
      expect(ctrl.isRunning).toBe(false);
    });

    it('fires onSceneStart callback with scene metadata', () => {
      const scene = makeScene('s1', [makeDialogue('a', 'n', 'x')]);
      scene.background = 'city_night';
      scene.music = 'ambient';
      registerScene(scene);

      const onStart = callbackSpy();
      ctrl.onSceneStart = onStart;

      ctrl.startScene('s1');
      expect(onStart).toHaveBeenCalledWith({
        sceneId: 's1',
        background: 'city_night',
        music: 'ambient',
      });
    });
  });

  /* ── processNode ────────────────────── */

  describe('processNode', () => {

    beforeEach(() => {
      // processNode() checks isRunning — set it so dispatch works
      ctrl.isRunning = true;
    });

    it('dispatches dialogue nodes', () => {
      const node = makeDialogue('d1', 'hero', 'Hello');
      ctrl.processNode(node);
      expect(ctrl.currentNode).toBe(node);
    });

    it('dispatches choice nodes', () => {
      const node = makeChoice('c1', 'Pick', [{ text: 'A', next: 'a' }]);
      ctrl.processNode(node);
      expect(ctrl.currentNode).toBe(node);
    });

    it('dispatches condition nodes', () => {
      const node = makeCondition('cond1', 'courage >= 50', 'brave', 'coward');
      ctrl.processNode(node);
      expect(ctrl.currentNode).toBe(node);
    });

    it('dispatches event nodes', () => {
      const node = makeEvent('e1', 'sfx', 'boom');
      ctrl.processNode(node);
      expect(ctrl.currentNode).toBe(node);
    });

    it('dispatches wait nodes', () => {
      const node = makeWait('w1', 1000);
      ctrl.processNode(node);
      expect(ctrl.currentNode).toBe(node);
    });

    it('dispatches end nodes', () => {
      const node = makeEnd('end1', 'The End');
      ctrl.processNode(node);
      expect(ctrl.currentNode).toBe(node);
    });

    it('warns and advances on unknown node type', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const node = { id: 'unknown', type: 'nonexistent' };
      const advanceSpy = vi.spyOn(ctrl, 'advance');

      ctrl.processNode(node);

      expect(warn).toHaveBeenCalled();
      expect(advanceSpy).toHaveBeenCalled();
      warn.mockRestore();
      advanceSpy.mockRestore();
    });

    it('applies variable actions from node', () => {
      Data.variables = { score: { type: 'number', default: 0 } };
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);
      ctrl.isRunning = true;

      const node = makeDialogue('d1', 'n', 'msg', { setFlag: 'score', setValue: 10 });
      ctrl.processNode(node);
      expect(vs.get('score')).toBe(10);
    });

    it('does nothing when not running', () => {
      ctrl.isRunning = false;
      const spy = vi.spyOn(ctrl, 'showDialogue');
      ctrl.processNode(makeDialogue('d1', 'n', 't'));
      expect(spy).not.toHaveBeenCalled();
    });
  });

  /* ── showDialogue ────────────────────── */

  describe('showDialogue', () => {

    it('calls onDialogue callback', () => {
      const onDia = callbackSpy();
      ctrl.onDialogue = onDia;

      ctrl.showDialogue(makeDialogue('d1', 'hero', 'Hello world', { expression: 'happy' }));

      expect(onDia).toHaveBeenCalledWith({
        speaker: 'hero',
        text: 'Hello world',
        expression: 'happy',
        autoAdvance: false,
        waitTime: 0,
      });
    });

    it('sets auto-advance timer when autoAdvance is true', () => {
      const onDia = callbackSpy();
      ctrl.onDialogue = onDia;
      const advanceSpy = vi.spyOn(ctrl, 'advance');

      ctrl.showDialogue(makeDialogue('d1', 'n', 'text', { autoAdvance: true, waitTime: 500 }));

      // Timer should be set (will be a timeout object)
      expect(ctrl._autoTimer).toBeTruthy();

      // Advance after timer fires
      vi.advanceTimersByTime(500);
      expect(advanceSpy).toHaveBeenCalled();
    });

    it('does NOT auto-advance when autoAdvance is false', () => {
      ctrl.onDialogue = callbackSpy();
      ctrl.showDialogue(makeDialogue('d1', 'n', 'text'));

      expect(ctrl._autoTimer).toBeUndefined();
    });
  });

  /* ── presentChoices ──────────────────── */

  describe('presentChoices', () => {

    it('calls onChoice with filtered choices', () => {
      Data.variables = { has_key: { type: 'boolean', default: false } };
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);
      ctrl.isRunning = true;

      const onChoice = callbackSpy();
      ctrl.onChoice = onChoice;

      const node = makeChoice('c1', 'What now?', [
        { text: 'Open door', next: 'open', condition: 'has_key == true' },
        { text: 'Walk away', next: 'leave' },
      ]);

      ctrl.processNode(node);

      expect(onChoice).toHaveBeenCalledTimes(1);
      const callArg = onChoice.mock.calls[0][0];
      expect(callArg.prompt).toBe('What now?');
      // Only the unconditional choice should be available
      expect(callArg.choices).toHaveLength(1);
      expect(callArg.choices[0].text).toBe('Walk away');
    });

    it('advances via jumpToId when no choices are valid and node.next exists', () => {
      Data.variables = { has_key: { type: 'boolean', default: false } };
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      // Need a full scene so jumpToId can find the fallback node
      const scene = makeScene('c1', [   // scene id matches the choice node id
        makeChoice('c1', 'Pick', [
          { text: 'Locked', next: 'fail', condition: 'has_key == true' },
        ], { next: 'fallback_node' }),
        makeDialogue('fallback_node', 'n', 'fallback reached'),
      ]);
      registerScene(scene);

      ctrl.startScene('c1'); // entryNode = 'c1' (the choice node)
      expect(ctrl.isAtChoice).toBe(false); // no valid choices, auto-diverted

      // Should have jumped to fallback via node.next
      expect(ctrl.currentNode.id).toBe('fallback_node');
    });

    it('ends scene when no valid choices and no next', () => {
      Data.variables = {};
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('c1', [   // scene id matches choice node id
        makeChoice('c1', 'Pick', [
          { text: 'Locked', next: 'nope', condition: 'impossible == true' },
        ]),
      ]);
      registerScene(scene);

      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.startScene('c1');
      expect(ctrl.isRunning).toBe(false);
      expect(onEnd).toHaveBeenCalled();
    });

    it('maps choices with correct fields including setFlag/setValue', () => {
      const onChoice = callbackSpy();
      ctrl.onChoice = onChoice;
      ctrl.isRunning = true;

      const node = makeChoice('c1', 'Pick', [
        { text: 'Brave', next: 'brave', setFlag: 'courage', setValue: 10 },
        { text: 'Coward', next: 'coward' },
      ]);

      ctrl.processNode(node);
      expect(onChoice).toHaveBeenCalledTimes(1);
      const choices = onChoice.mock.calls[0][0].choices;
      expect(choices[0].text).toBe('Brave');
      expect(choices[0].next).toBe('brave');
      expect(choices[0].setFlag).toBe('courage');
      expect(choices[0].setValue).toBe(10);
      expect(choices[0].index).toBe(0);
      expect(choices[1].text).toBe('Coward');
      expect(choices[1].index).toBe(1);
    });
  });

  /* ── evaluateCondition ───────────────── */

  describe('evaluateCondition', () => {

    beforeEach(() => {
      Data.variables = { courage: { type: 'number', default: 50 }, flag: { type: 'boolean', default: false } };
    });

    it('follows `next` when condition is true', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('cond', [   // scene id matches condition node id
        makeCondition('cond', 'courage >= 50', 'brave_path', 'coward_path'),
        makeDialogue('brave_path', 'n', 'brave'),
        makeDialogue('coward_path', 'n', 'coward'),
      ]);
      registerScene(scene);
      ctrl.startScene('cond');

      // courage = 50 >= 50 → true → brave_path
      expect(ctrl.currentNode.id).toBe('brave_path');
    });

    it('follows `else` when condition is false', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('cond2', [   // scene id matches condition node id
        makeCondition('cond2', 'courage >= 100', 'brave_path', 'coward_path'),
        makeDialogue('brave_path', 'n', 'brave'),
        makeDialogue('coward_path', 'n', 'coward'),
      ]);
      registerScene(scene);
      ctrl.startScene('cond2');

      // courage = 50 < 100 → false → coward_path
      expect(ctrl.currentNode.id).toBe('coward_path');
    });

    it('falls back to next when condition is false and no `else`', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('cond3', [   // scene id matches condition node id
        makeCondition('cond3', 'flag == true', 'fallback_node'),
        makeDialogue('fallback_node', 'n', 'fallback reached'),
      ]);
      registerScene(scene);
      ctrl.startScene('cond3');

      // flag = false, no `else` → falls through to `next` → fallback_node
      expect(ctrl.currentNode.id).toBe('fallback_node');
    });

    it('ends scene when no path is available', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('cond4', [   // scene id matches condition node id
        { id: 'cond4', type: 'condition', condition: 'flag == true' },
      ]);
      registerScene(scene);

      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.startScene('cond4');

      expect(ctrl.isRunning).toBe(false);
      expect(onEnd).toHaveBeenCalled();
    });
  });

  /* ── fireEvent ───────────────────────── */

  describe('fireEvent', () => {

    it('calls onAction with event type and value', () => {
      const onAction = callbackSpy();
      ctrl.onAction = onAction;

      ctrl.fireEvent(makeEvent('e1', 'sfx', 'explosion'));

      expect(onAction).toHaveBeenCalledWith({
        type: 'sfx',
        value: 'explosion',
        setFlag: undefined,
        setValue: undefined,
      });
    });

    it('includes setFlag/setValue in action payload', () => {
      const onAction = callbackSpy();
      ctrl.onAction = onAction;

      ctrl.fireEvent({
        id: 'e1',
        type: 'event',
        eventType: 'set_flag',
        eventValue: null,
        setFlag: 'alert_triggered',
        setValue: true,
      });

      expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
        setFlag: 'alert_triggered',
        setValue: true,
      }));
    });

    it('follows next after event (via processNode + full scene)', () => {
      const scene = makeScene('e1', [   // scene id matches event node id
        makeEvent('e1', 'sfx', 'ping', { next: 'after_event' }),
        makeDialogue('after_event', 'n', 'arrived'),
      ]);
      registerScene(scene);

      ctrl.startScene('e1');
      expect(ctrl.currentNode.id).toBe('after_event');
    });

    it('ends scene when no next', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.fireEvent(makeEvent('e1', 'sfx', 'done'));
      expect(ctrl.isRunning).toBe(false);
      expect(onEnd).toHaveBeenCalled();
    });
  });

  /* ── doWait ──────────────────────────── */

  describe('doWait', () => {

    it('calls onWait callback', () => {
      const onWait = callbackSpy();
      ctrl.onWait = onWait;

      ctrl.doWait(makeWait('w1', 2000));
      expect(onWait).toHaveBeenCalledWith({ duration: 2000 });
    });

    it('uses default duration of 1000ms when not specified', () => {
      const onWait = callbackSpy();
      ctrl.onWait = onWait;

      ctrl.doWait(makeWait('w1', undefined));
      expect(onWait).toHaveBeenCalledWith({ duration: 1000 });
    });

    it('follows next after wait duration', () => {
      const advanceSpy = vi.spyOn(ctrl, 'jumpToId');

      ctrl.doWait(makeWait('w1', 500, { next: 'after_wait' }));
      vi.advanceTimersByTime(500);

      expect(advanceSpy).toHaveBeenCalledWith('after_wait');
    });

    it('ends scene when no next after wait', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.doWait(makeWait('w1', 300));
      vi.advanceTimersByTime(300);

      expect(onEnd).toHaveBeenCalled();
    });
  });

  /* ── endScene ────────────────────────── */

  describe('endScene', () => {

    it('sets isRunning to false', () => {
      ctrl.isRunning = true;
      ctrl.endScene(makeEnd('end1', 'Done'));
      expect(ctrl.isRunning).toBe(false);
    });

    it('calls onSceneEnd with end text', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.endScene(makeEnd('end1', 'To be continued...'));
      expect(onEnd).toHaveBeenCalledWith({
        text: 'To be continued...',
        nextScene: null,
      });
    });

    it('calls onSceneEnd with nextScene when specified', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.endScene(makeEnd('end1', 'The End', { nextScene: 'chapter_2' }));
      expect(onEnd).toHaveBeenCalledWith({
        text: 'The End',
        nextScene: 'chapter_2',
      });
    });

    it('handles end scene with null/undefined node (edge case)', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.endScene(null);
      expect(onEnd).toHaveBeenCalledWith({
        text: null,
        nextScene: null,
      });
    });
  });

  /* ── advance ─────────────────────────── */

  describe('advance', () => {

    it('follows currentNode.next', () => {
      const scene = makeScene('s1', [
        makeDialogue('start', 'n', 'first', { next: 'second' }),
        makeDialogue('second', 'n', 'second text'),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      expect(ctrl.currentNode.id).toBe('start');
      ctrl.advance();
      expect(ctrl.currentNode.id).toBe('second');
    });

    it('ends scene when currentNode has no next', () => {
      const scene = makeScene('s1', [makeDialogue('only', 'n', 'lone')]);
      registerScene(scene);
      ctrl.startScene('s1');

      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.advance();
      expect(ctrl.isRunning).toBe(false);
      expect(onEnd).toHaveBeenCalled();
    });

    it('ends scene when currentNode is null', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.advance();
      expect(onEnd).toHaveBeenCalled();
    });

    it('clears any existing auto-timer', () => {
      const scene = makeScene('s1', [
        makeDialogue('start', 'n', 'auto', { autoAdvance: true, waitTime: 5000, next: 'next' }),
        makeDialogue('next', 'n', 'arrived'),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      // Auto-timer should be set
      expect(ctrl._autoTimer).toBeTruthy();

      // Manually advance before timer fires
      ctrl.advance();

      // Timer should be cleared
      expect(ctrl._autoTimer).toBeNull();
      expect(ctrl.currentNode.id).toBe('next');
    });
  });

  /* ── jumpToId ────────────────────────── */

  describe('jumpToId', () => {

    it('finds and processes a node by ID', () => {
      const scene = makeScene('s1', [
        makeDialogue('start', 'n', 'first'),
        makeDialogue('target', 'n', 'found me'),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      ctrl.jumpToId('target');
      expect(ctrl.currentNode.id).toBe('target');
      expect(ctrl.currentNode.text).toBe('found me');
    });

    it('warns and ends scene when node not found', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const scene = makeScene('s1', [makeDialogue('start', 'n', 'hi')]);
      registerScene(scene);
      ctrl.startScene('s1');

      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.jumpToId('nonexistent');
      expect(warn).toHaveBeenCalled();
      expect(ctrl.isRunning).toBe(false);
      expect(onEnd).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('ends scene when no currentScene', () => {
      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.jumpToId('anything');
      expect(onEnd).toHaveBeenCalled();
      expect(ctrl.isRunning).toBe(false);
    });
  });

  /* ── selectChoice ────────────────────── */

  describe('selectChoice', () => {

    beforeEach(() => {
      Data.variables = { courage: { type: 'number', default: 50 } };
    });

    it('applies choice action and follows next', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('s1', [
        makeChoice('c1', 'Pick', [
          { text: 'Brave', next: 'brave_end', setFlag: 'courage', setValue: 80 },
        ]),
        makeDialogue('brave_end', 'n', 'You chose bravery'),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      // At the choice
      expect(ctrl.isAtChoice).toBe(true);
      ctrl.selectChoice(0);

      expect(vs.get('courage')).toBe(80);
      expect(ctrl.currentNode.id).toBe('brave_end');
    });

    it('follows nextScene for scene transitions', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const startSceneSpy = vi.spyOn(ctrl, 'startScene');

      const scene1 = makeScene('s1', [
        makeChoice('c1', 'Leave', [
          { text: 'Go to forest', nextScene: 'scene_forest' },
        ]),
      ]);
      registerScene(scene1);

      ctrl.startScene('s1');
      ctrl.selectChoice(0);

      expect(startSceneSpy).toHaveBeenCalledWith('scene_forest');
    });

    it('ignores invalid index', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('s1', [
        makeChoice('c1', 'Pick', [
          { text: 'A', next: 'a' },
          { text: 'B', next: 'b' },
        ]),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      ctrl.selectChoice(-1);
      expect(ctrl._pendingChoices).not.toBeNull(); // still pending

      ctrl.selectChoice(999);
      expect(ctrl._pendingChoices).not.toBeNull(); // still pending
    });

    it('falls back to advance when choice has no next or nextScene', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('s1', [
        makeChoice('c1', '?', [
          { text: 'Nothing' },
        ], { next: 'fallback' }),
        makeDialogue('fallback', 'n', 'fallback reached'),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      expect(ctrl.isAtChoice).toBe(true);
      ctrl.selectChoice(0);

      // Choice option has no 'next' → advance() → node.next = 'fallback'
      expect(ctrl.currentNode.id).toBe('fallback');
    });
  });

  /* ── State properties ────────────────── */

  describe('state properties (awaitingInput, isAtChoice)', () => {

    it('awaitingInput is true for dialogue nodes', () => {
      ctrl.isRunning = true;
      ctrl.processNode(makeDialogue('d1', 'n', 'hi'));
      expect(ctrl.awaitingInput).toBe(true);
    });

    it('awaitingInput is false when no currentNode', () => {
      expect(ctrl.awaitingInput).toBe(false);
    });

    it('isAtChoice is true when choice has pending options', () => {
      ctrl.isRunning = true;
      ctrl.onChoice = callbackSpy();
      ctrl.processNode(makeChoice('c1', 'Pick', [{ text: 'A', next: 'a' }]));
      expect(ctrl.isAtChoice).toBe(true);
    });

    it('isAtChoice is false for non-choice nodes', () => {
      ctrl.isRunning = true;
      ctrl.processNode(makeDialogue('d1', 'n', 'hi'));
      expect(ctrl.isAtChoice).toBe(false);
    });

    it('isAtChoice is false after choice is selected', () => {
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('s1', [
        makeChoice('c1', 'Pick', [{ text: 'A', next: 'a' }]),
        makeDialogue('a', 'n', 'result'),
      ]);
      registerScene(scene);
      ctrl.startScene('s1');

      expect(ctrl.isAtChoice).toBe(true);
      ctrl.selectChoice(0);
      expect(ctrl.isAtChoice).toBe(false);
    });
  });

  /* ── destroy ─────────────────────────── */

  describe('destroy', () => {

    it('clears the auto-timer (timer is disarmed)', () => {
      // create a timer, store reference, destroy, verify timer was cleared
      const fn = vi.fn();
      ctrl._autoTimer = setTimeout(fn, 9999);
      ctrl.destroy();
      // The timeout was cleared by destroy, so it shouldn't fire
      vi.advanceTimersByTime(9999);
      expect(fn).not.toHaveBeenCalled();
    });

    it('resets state', () => {
      ctrl.isRunning = true;
      ctrl.currentScene = {};
      ctrl.currentNode = {};

      ctrl.destroy();

      expect(ctrl.isRunning).toBe(false);
      expect(ctrl.currentScene).toBeNull();
      expect(ctrl.currentNode).toBeNull();
    });
  });

  /* ── Integration: full scene walk ────── */

  describe('integration: full scene walkthrough', () => {

    it('walks a simple linear scene end-to-end', () => {
      const scene = makeScene('linear', [
        makeDialogue('start', 'n', 'First', { next: 'second' }),
        makeDialogue('second', 'hero', 'Second', { next: 'the_end' }),
        makeEnd('the_end', 'Done'),
      ]);
      registerScene(scene);

      const events = [];
      ctrl.onDialogue = (d) => events.push(`dialogue:${d.speaker}:${d.text}`);
      ctrl.onSceneStart = (d) => events.push(`start:${d.sceneId}`);
      ctrl.onSceneEnd = (d) => events.push(`end:${d.text}`);

      ctrl.startScene('linear');
      expect(events).toContain('start:linear');

      events.length = 0;
      expect(ctrl.currentNode.text).toBe('First');

      ctrl.advance(); // first → second
      expect(ctrl.currentNode.text).toBe('Second');
      expect(ctrl.currentNode.speaker).toBe('hero');

      ctrl.advance(); // second → end
      expect(ctrl.isRunning).toBe(false);
      expect(events).toContain('end:Done');
    });

    it('walks a branching scene with condition', () => {
      Data.variables = { courage: { type: 'number', default: 30 } };
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('branch', [
        makeDialogue('start', 'n', 'Begin', { next: 'check' }),
        makeCondition('check', 'courage >= 50', 'brave', 'coward'),
        makeDialogue('brave', 'n', 'You are brave!', { next: 'end' }),
        makeDialogue('coward', 'n', 'You are cautious.', { next: 'end' }),
        makeEnd('end', 'Done'),
      ]);
      registerScene(scene);

      const events = [];
      ctrl.onDialogue = (d) => events.push(d.text);

      ctrl.startScene('branch');
      ctrl.advance(); // start → check

      // courage = 30 → coward path
      expect(ctrl.currentNode.text).toBe('You are cautious.');

      ctrl.advance(); // coward → end
      expect(ctrl.isRunning).toBe(false);
    });

    it('walks a choice scene with variable modification', () => {
      Data.variables = { courage: { type: 'number', default: 50 } };
      const vs = new VariableSystem();
      ctrl = new SceneController(vs);

      const scene = makeScene('choice_scene', [
        makeDialogue('start', 'n', 'Pick your path', { next: 'decision' }),
        makeChoice('decision', 'What do you do?', [
          { text: 'Be brave', setFlag: 'courage', setValue: 80, next: 'brave_end' },
          { text: 'Be cautious', setFlag: 'courage', setValue: 20, next: 'cautious_end' },
        ]),
        makeDialogue('brave_end', 'n', 'Brave ending!', { next: 'fin' }),
        makeDialogue('cautious_end', 'n', 'Cautious ending.', { next: 'fin' }),
        makeEnd('fin', 'THE END'),
      ]);
      registerScene(scene);

      ctrl.startScene('choice_scene');
      ctrl.advance(); // start → decision

      expect(ctrl.isAtChoice).toBe(true);

      // Select the brave option
      ctrl.selectChoice(0);
      expect(vs.get('courage')).toBe(80);
      expect(ctrl.currentNode.text).toBe('Brave ending!');

      ctrl.advance(); // brave_end → fin
      expect(ctrl.isRunning).toBe(false);
    });

    it('handles empty scene gracefully', () => {
      const scene = makeScene('empty', []);
      registerScene(scene);

      const onEnd = callbackSpy();
      ctrl.onSceneEnd = onEnd;

      ctrl.startScene('empty');

      expect(ctrl.isRunning).toBe(false);
      expect(onEnd).toHaveBeenCalled();
    });
  });
});
