/**
 * SaveSystem — serializes game state to localStorage.
 * Each slot stores variables + current scene/position.
 */
export class SaveSystem {
  constructor(variableSystem, sceneController) {
    this.vars = variableSystem;
    this.sceneCtrl = sceneController;
    this.SAVE_KEY = 'narrative_saves';
  }

  /** Get list of save slots */
  getSlots() {
    const raw = localStorage.getItem(this.SAVE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      console.warn('SaveSystem: corrupted save data, resetting');
      localStorage.removeItem(this.SAVE_KEY);
      return [];
    }
  }

  /** Save to a specific slot (0-9) */
  save(slotIndex) {
    const slots = this.getSlots();
    const data = {
      slot: slotIndex,
      timestamp: Date.now(),
      title: `Save ${slotIndex + 1}`,
      sceneId: this.sceneCtrl.currentScene?.id || null,
      nodeId: this.sceneCtrl.currentNode?.id || null,
      variables: this.vars.serialize()
    };

    slots[slotIndex] = data;
    localStorage.setItem(this.SAVE_KEY, JSON.stringify(slots));
    return data;
  }

  /** Load from a slot */
  load(slotIndex) {
    const slots = this.getSlots();
    const data = slots[slotIndex];
    if (!data) return null;

    this.vars.deserialize(data.variables || {});

    // Return scene info so the game can navigate there
    return {
      sceneId: data.sceneId,
      nodeId: data.nodeId
    };
  }

  /** Delete a save slot */
  delete(slotIndex) {
    const slots = this.getSlots();
    if (slots[slotIndex]) {
      delete slots[slotIndex];
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(slots));
    }
  }

  /** Quick save to slot 0 */
  quickSave() {
    return this.save(0);
  }

  /** Quick load from slot 0 */
  quickLoad() {
    return this.load(0);
  }

  /** Auto-save to slot 9 */
  autoSave() {
    return this.save(9);
  }

  /** Format a timestamp for display */
  formatTimestamp(ts) {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}
