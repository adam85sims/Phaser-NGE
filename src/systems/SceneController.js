import { Data } from './DataLoader.js';

/**
 * SceneController — graph-based narrative state machine.
 *
 * Walks a scene's node graph by following 'next' connections
 * from each node. Entry point is scene.entryNode.
 * No sequential advancement — every transition is an explicit jump.
 */
export class SceneController {
  constructor(variableSystem) {
    this.vars = variableSystem;
    this.currentScene = null;
    this.currentNode = null;
    this.isRunning = false;

    // Callbacks — set by GameScene
    this.onDialogue = null;     // fn({ speaker, text, expression })
    this.onChoice = null;       // fn({ prompt, choices[] })
    this.onSceneEnd = null;     // fn({ text, nextScene })
    this.onAction = null;       // fn({ type, ... })
    this.onSceneStart = null;   // fn({ sceneId, background, music })
    this.onWait = null;         // fn({ duration })
  }

  /* ── Scene Loading ─────────────────────────── */

  startScene(sceneId) {
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

    // Start at the entry node
    const entryId = scene.entryNode || scene.nodes?.[0]?.id;
    if (entryId) {
      this.jumpToId(entryId);
    } else {
      this.endScene();
    }
  }

  /* ── Node Processing ───────────────────────── */

  processNode(node) {
    if (!this.isRunning || !node) return;

    this.currentNode = node;

    // Apply any variable actions attached to this node
    this.vars.applyAction(node);

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
      case 'end':
        this.endScene(node);
        break;
      default:
        console.warn(`Unknown node type: ${node.type}`);
        this.advance();
    }
  }

  /* ── Node Types ────────────────────────────── */

  showDialogue(node) {
    if (this.onDialogue) {
      this.onDialogue({
        speaker: node.speaker,
        text: node.text,
        expression: node.expression || null,
        autoAdvance: node.autoAdvance || false,
        waitTime: node.waitTime || 0
      });
    }

    if (node.autoAdvance) {
      this._autoTimer = setTimeout(() => {
        this.advance();
      }, node.waitTime || 2000);
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
          setValue: c.setValue
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
        setValue: node.setValue
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

    this._autoTimer = setTimeout(() => {
      if (node.next) this.jumpToId(node.next);
      else this.endScene();
    }, duration);
  }

  endScene(node) {
    this.isRunning = false;
    if (this.onSceneEnd) {
      this.onSceneEnd({
        text: node?.text || null,
        nextScene: node?.nextScene || null
      });
    }
  }

  /* ── Navigation ────────────────────────────── */

  /** Advance via the current node's 'next' field (graph edge) */
  advance() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
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

    // Apply choice variable action
    this.vars.applyAction({
      setFlag: chosen.setFlag,
      setValue: chosen.setValue
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
    if (this._autoTimer) clearTimeout(this._autoTimer);
    this.isRunning = false;
    this.currentScene = null;
    this.currentNode = null;
  }
}
