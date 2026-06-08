import { Data } from './DataLoader.js';

/**
 * SceneController — graph-based narrative state machine.
 *
 * Walks a scene's node graph by following 'next' connections
 * from each node. Entry point is scene.entryNode.
 * Supports sub-scene calls via call_scene nodes (call stack).
 * No sequential advancement — every transition is an explicit jump.
 */
export class SceneController {
  constructor(variableSystem, scene) {
    this.vars = variableSystem;
    this.scene = scene;
    this.currentScene = null;
    this.currentNode = null;
    this.isRunning = false;

    // Call stack for call_scene sub-scene returns
    this._callStack = [];

    // Callbacks — set by GameScene
    this.onDialogue = null;     // fn({ speaker, text, expression })
    this.onChoice = null;       // fn({ prompt, choices[] })
    this.onSceneEnd = null;     // fn({ text, nextScene })
    this.onAction = null;       // fn({ type, ... })
    this.onSceneStart = null;   // fn({ sceneId, background, music })
    this.onWait = null;         // fn({ duration })
    this.onBackgroundChange = null;  // fn(backgroundKey)
  }

  /* ── Scene Loading ─────────────────────────── */

  startScene(sceneId, targetNodeId = null) {
    const scene = Data.getScene(sceneId);
    if (!scene) {
      console.warn(`Scene not found: ${sceneId}`);
      return;
    }

    this.currentScene = scene;
    this.isRunning = true;

    if (this.onSceneStart) {
      this.onSceneStart({
        sceneId: scene.id,
        background: scene.background,
        music: scene.music
      });
    }

    // Start at the target node or fall back to entry
    const nodeId = targetNodeId || (scene.entryNode || scene.nodes?.[0]?.id);
    if (nodeId) {
      this.jumpToId(nodeId);
    } else {
      this.endScene();
    }
  }

  /**
   * Call a sub-scene, saving the current position on the call stack.
   * When the sub-scene ends, control returns to this scene at the
   * specified return node (or the node following this one).
   */
  callScene(node) {
    if (!node.sceneId) {
      console.warn('callScene: no sceneId specified');
      return;
    }

    // Save current position — returnNode is the node to jump to when we come back
    this._callStack.push({
      scene: this.currentScene,
      returnNode: node.next || null
    });

    // Start the sub-scene from its entry
    this.startScene(node.sceneId);
  }

  /* ── Node Processing ───────────────────────── */

  processNode(node) {
    if (!this.isRunning || !node) return;

    this.currentNode = node;

    // Apply any variable actions attached to this node
    this.vars.applyAction(node);

    // Any node can trigger a background change via a `background` field
    if (node.background !== undefined && this.onBackgroundChange) {
      this.onBackgroundChange(node.background);
    }

    switch (node.type) {
      case 'dialogue':
        this.showDialogue(node);
        break;
      case 'choice':
        this.presentChoices(node);
        break;
      case 'condition':
        this.evaluateCondition(node);
        break;
      case 'event':
        this.fireEvent(node);
        break;
      case 'wait':
        this.doWait(node);
        break;
      case 'call_scene':
        this.callScene(node);
        break;
      case 'end':
        this.endScene(node);
        break;
      default:
        console.warn(`Unknown node type: ${node.type}`);
        this.advance();
    }
  }

  /* ── Scenes ─────────────────────────────────── */

  /**
   * End the current scene. If we're in a sub-scene (call stack non-empty),
   * pop the stack and return to the caller instead.
   * If the end node specifies nextScene, that takes priority over the call stack.
   */
  endScene(node) {
    // Pop the call stack — check if we need to return to a caller
    // nextScene on the end node takes priority over call stack returns
    if (node?.nextScene) {
      // Explicit scene transition — clear stack and go
      this._callStack = [];
      this.isRunning = false;
      if (this.onSceneEnd) {
        this.onSceneEnd({ text: node?.text || null, nextScene: node.nextScene });
      }
      return;
    }

    // If there's a return point on the call stack, go back
    if (this._callStack.length > 0) {
      const pop = this._callStack.pop();
      // Restore the calling scene
      this.currentScene = pop.scene;
      this.isRunning = true;

      // Notify UI layer to restore scene visuals (background, music)
      if (this.onSceneStart) {
        this.onSceneStart({
          sceneId: pop.scene.id,
          background: pop.scene.background,
          music: pop.scene.music
        });
      }

      // Jump to the return node, or advance if no return node specified
      if (pop.returnNode) {
        this.jumpToId(pop.returnNode);
      } else {
        // No return node — try to advance from where we left off
        if (this.currentNode?.next) {
          this.jumpToId(this.currentNode.next);
        } else {
          // Can't return — start at entry
          this.startScene(pop.scene.id);
        }
      }
      return;
    }

    // Genuine end — no call stack, no nextScene
    this.isRunning = false;
    if (this.onSceneEnd) {
      this.onSceneEnd({
        text: node?.text || null,
        nextScene: null
      });
    }
  }

  /* ── Node Types ────────────────────────────── */

  showDialogue(node) {
    if (this.onDialogue) {
      this.onDialogue({
        speaker: node.speaker,
        text: node.text,
        expression: node.expression || null,
        position: node.position || 'center',
        autoAdvance: node.autoAdvance || false,
        waitTime: node.waitTime || 0
      });
    }

    if (node.autoAdvance) {
      this._autoTimer = this.scene.time.delayedCall(node.waitTime || 2000, () => {
        this.advance();
      });
    }
    // Otherwise, wait for player input → calls advance()
  }

  presentChoices(node) {
    const available = (node.choices || []).filter(c =>
      this.vars.evaluate(c.condition)
    );

    if (available.length === 0) {
      // No valid choices — follow node.next (if any) or end
      if (node.next) this.jumpToId(node.next);
      else this.endScene();
      return;
    }

    this._pendingChoices = available;

    if (this.onChoice) {
      this.onChoice({
        prompt: node.prompt || null,
        choices: available.map(c => ({
          text: c.text,
          index: available.indexOf(c),
          next: c.next,
          nextScene: c.nextScene,
          setFlag: c.setFlag,
          setValue: c.setValue,
          toggleFlag: c.toggleFlag,
          addFlag: c.addFlag,
          delta: c.delta
        }))
      });
    }
  }

  evaluateCondition(node) {
    const result = this.vars.evaluate(node.condition);
    if (result && node.next) {
      this.jumpToId(node.next);
    } else if (!result && node.else) {
      this.jumpToId(node.else);
    } else if (node.next) {
      this.jumpToId(node.next);
    } else {
      this.endScene();
    }
  }

  fireEvent(node) {
    if (this.onAction) {
      this.onAction({
        type: node.eventType || 'sfx',
        value: node.eventValue || null,
        setFlag: node.setFlag,
        setValue: node.setValue,
        toggleFlag: node.toggleFlag,
        addFlag: node.addFlag,
        delta: node.delta
      });
    }

    if (node.next) {
      this.jumpToId(node.next);
    } else {
      this.endScene();
    }
  }

  doWait(node) {
    const duration = node.duration || 1000;

    if (this.onWait) {
      this.onWait({ duration });
    }

    this._autoTimer = this.scene.time.delayedCall(duration, () => {
      if (node.next) this.jumpToId(node.next);
      else this.endScene();
    });
  }

  /* ── Navigation ────────────────────────────── */

  /** Advance via the current node's 'next' field (graph edge) */
  advance() {
    if (this._autoTimer) {
      this._autoTimer.remove();
      this._autoTimer = null;
    }

    if (!this.currentNode) {
      this.endScene();
      return;
    }

    const nextId = this.currentNode.next;
    if (nextId) {
      this.jumpToId(nextId);
    } else {
      this.endScene();
    }
  }

  /** Jump to a specific node by ID */
  jumpToId(nodeId) {
    if (!this.currentScene || !this.currentScene.nodes) {
      this.endScene();
      return;
    }

    const node = this.currentScene.nodes.find(n => n.id === nodeId);
    if (node) {
      this.processNode(node);
    } else {
      console.warn(`Node not found: ${nodeId}`);
      this.endScene();
    }
  }

  /** Called when user selects a choice */
  selectChoice(choiceIndex) {
    const choices = this._pendingChoices;
    if (!choices || choiceIndex < 0 || choiceIndex >= choices.length) return;

    const chosen = choices[choiceIndex];

    // Apply choice variable actions (set, toggle, add)
    this.vars.applyAction({
      setFlag: chosen.setFlag,
      setValue: chosen.setValue,
      toggleFlag: chosen.toggleFlag,
      addFlag: chosen.addFlag,
      delta: chosen.delta
    });

    this._pendingChoices = null;

    if (chosen.nextScene) {
      this.isRunning = false;
      this.startScene(chosen.nextScene);
    } else if (chosen.next) {
      this.jumpToId(chosen.next);
    } else {
      this.advance();
    }
  }

  /* ── State ─────────────────────────────────── */

  get awaitingInput() {
    if (!this.currentNode) return false;
    return (
      this.currentNode.type === 'dialogue' ||
      this.currentNode.type === 'choice'
    );
  }

  get isAtChoice() {
    return this.currentNode?.type === 'choice' && this._pendingChoices !== null;
  }

  destroy() {
    if (this._autoTimer) {
      this._autoTimer.remove();
      this._autoTimer = null;
    }
    this._callStack = [];
    this.isRunning = false;
    this.currentScene = null;
    this.currentNode = null;
  }
}
