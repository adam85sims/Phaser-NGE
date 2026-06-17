/**
 * Lightweight Extension Registry for Node Types
 * 
 * Decouples node definitions from the core Editor and Runtime logic.
 * Both the Editor and the Engine use this registry.
 */
export class Registry {
  static nodeTypes = new Map();

  /**
   * Register a new node type plugin.
   * @param {string} typeId - Unique ID for the node type (e.g., 'dialogue')
   * @param {Object} config - Configuration object
   * @param {string} config.label - Human readable name
   * @param {string} config.color - Hex color code for the graph node
   * @param {Function} config.defaultData - Returns an object with default properties for a new node
   * @param {Function} config.renderEditor - (node, container) => HTML string or renders into container
   * @param {Function} config.executeRuntime - (node, controller) => void
   * @param {Function} [config.getHeight] - (node) => number (Optional, defaults to 64)
   * @param {Function} [config.getOutputs] - (node) => Array<{id, label, portIndex}> (Optional, returns next links)
   */
  static registerNodeType(typeId, config) {
    this.nodeTypes.set(typeId, config);
  }

  static getNodeType(typeId) {
    return this.nodeTypes.get(typeId);
  }

  static extendNodeType(typeId, config) {
    const existing = this.nodeTypes.get(typeId);
    if (existing) {
      Object.assign(existing, config);
    } else {
      console.warn(`Cannot extend unknown node type: ${typeId}`);
    }
  }

  static getAllNodeTypes() {
    return Array.from(this.nodeTypes.entries()).map(([id, config]) => ({
      id,
      ...config
    }));
  }
}
