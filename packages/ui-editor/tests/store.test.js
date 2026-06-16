import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../src/store/useLayoutStore';

// Helper to get fresh state
const getState = () => useLayoutStore.getState();

describe('useLayoutStore', () => {
  beforeEach(() => {
    // Reset to initial state
    useLayoutStore.setState({
      nodes: {
        root: {
          id: 'root',
          type: 'canvas',
          name: 'Main Canvas',
          props: { width: 1280, height: 720 },
          children: [],
          role: 'canvas',
        },
      },
      selectedIds: [],
      snapToGrid: true,
      gridSize: 20,
    });
    useLayoutStore.temporal.getState().clear();
  });

  describe('node CRUD', () => {
    it('should add a node to root', () => {
      const state = getState();
      state.addNode('root', 'panel');
      const nodes = getState().nodes;
      const added = Object.values(nodes).find(n => n.type === 'panel');
      expect(added).toBeDefined();
      expect(added.anchor).toBe('top-left');
      expect(added.role).toBe('none');
      expect(nodes['root'].children).toContain(added.id);
    });

    it('should add to a non-root parent', () => {
      const state = getState();
      state.addNode('root', 'panel');
      const panelId = getState().selectedIds[0];

      state.addNode(panelId, 'text');
      const panel = getState().nodes[panelId];
      expect(panel.children.length).toBe(1);
      const child = getState().nodes[panel.children[0]];
      expect(child.type).toBe('text');
    });

    it('should remove a node and its children', () => {
      const state = getState();
      state.addNode('root', 'panel');
      const panelId = getState().selectedIds[0];
      state.addNode(panelId, 'text');

      state.removeNode(panelId);
      const nodes = getState().nodes;
      expect(nodes[panelId]).toBeUndefined();
      // All child nodes should also be removed
      const textNodes = Object.values(nodes).filter(n => n.type === 'text');
      expect(textNodes.length).toBe(0);
    });

    it('should not delete root', () => {
      getState().removeNode('root');
      expect(getState().nodes['root']).toBeDefined();
    });

    it('should update node properties', () => {
      getState().addNode('root', 'panel');
      const id = getState().selectedIds[0];
      getState().updateNodeProps(id, { x: 100, y: 200, width: 300 });
      const node = getState().nodes[id];
      expect(node.props.x).toBe(100);
      expect(node.props.y).toBe(200);
      expect(node.props.width).toBe(300);
    });

    it('should update node metadata', () => {
      getState().addNode('root', 'panel');
      const id = getState().selectedIds[0];
      getState().updateNode(id, { name: 'My Panel', role: 'dialogue_box' });
      const node = getState().nodes[id];
      expect(node.name).toBe('My Panel');
      expect(node.role).toBe('dialogue_box');
    });
  });

  describe('multi-select', () => {
    it('should select a single node', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const id2 = getState().selectedIds[0];

      getState().selectNode(id1);
      expect(getState().selectedIds).toEqual([id1]);
    });

    it('should toggle selection with multi flag', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const id2 = getState().selectedIds[0];

      // Select id1 (toggles into current selection which is [id2])
      getState().selectNode(id1, true);
      expect(getState().selectedIds).toEqual([id2, id1]);

      // Deselect id2
      getState().selectNode(id2, true);
      expect(getState().selectedIds).toEqual([id1]);
    });

    it('should clear selection', () => {
      getState().addNode('root', 'panel');
      const id = getState().selectedIds[0];
      getState().clearSelection();
      expect(getState().selectedIds).toEqual([]);
    });
  });

  describe('layer ordering', () => {
    it('should move a node up in the parent\'s children array', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const id2 = getState().selectedIds[0];

      // Initially [id1, id2]. Move id2 up (earlier in array = behind)
      getState().moveUp(id2);
      const children = getState().nodes['root'].children;
      expect(children.indexOf(id2)).toBeLessThan(children.indexOf(id1));
    });

    it('should move a node down', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const id2 = getState().selectedIds[0];

      // Initially [id1, id2]. Move id1 down (later in array = on top)
      getState().moveDown(id1);
      const children = getState().nodes['root'].children;
      expect(children.indexOf(id2)).toBeLessThan(children.indexOf(id1));
    });

    it('should bring a node to front (end of array)', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const id2 = getState().selectedIds[0];
      getState().addNode('root', 'button');
      const id3 = getState().selectedIds[0];

      getState().bringToFront(id1);
      const children = getState().nodes['root'].children;
      expect(children[children.length - 1]).toBe(id1);
    });

    it('should send a node to back (start of array)', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const id2 = getState().selectedIds[0];

      getState().sendToBack(id2);
      const children = getState().nodes['root'].children;
      expect(children[0]).toBe(id2);
    });
  });

  describe('alignment', () => {
    it('should align elements to the left', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().updateNodeProps(id1, { x: 50, width: 100 });
      getState().addNode('root', 'panel');
      const id2 = getState().selectedIds[0];
      getState().updateNodeProps(id2, { x: 200, width: 150 });

      // Build multi-select without toggling: clear, then select both
      getState().clearSelection();
      getState().selectNode(id1, true);
      getState().selectNode(id2, true);
      getState().setGridSize(1);
      getState().alignElements('left');

      const n1 = getState().nodes[id1];
      const n2 = getState().nodes[id2];
      expect(n1.props.x).toBe(50);
      expect(n2.props.x).toBe(50); // Aligned to min x
    });

    it('should align elements to the right', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().updateNodeProps(id1, { x: 50, width: 100 });
      getState().addNode('root', 'panel');
      const id2 = getState().selectedIds[0];
      getState().updateNodeProps(id2, { x: 200, width: 150 });

      getState().clearSelection();
      getState().selectNode(id1, true);
      getState().selectNode(id2, true);
      getState().setGridSize(1);
      getState().alignElements('right');

      const n1 = getState().nodes[id1];
      const n2 = getState().nodes[id2];
      // Max right edge = max(x + width) = max(150, 350) = 350
      expect(n1.props.x + n1.props.width).toBe(350);
      expect(n2.props.x + n2.props.width).toBe(350);
    });

    it('should distribute elements horizontally', () => {
      getState().addNode('root', 'panel');
      const id1 = getState().selectedIds[0];
      getState().updateNodeProps(id1, { x: 0, width: 50 });
      getState().addNode('root', 'panel');
      const id2 = getState().selectedIds[0];
      getState().updateNodeProps(id2, { x: 200, width: 50 });
      getState().addNode('root', 'panel');
      const id3 = getState().selectedIds[0];
      getState().updateNodeProps(id3, { x: 400, width: 50 });

      getState().selectNode(id1, true);
      getState().selectNode(id2, true);
      getState().selectNode(id3, true);
      getState().distributeElements('horizontal');

      const n1 = getState().nodes[id1];
      const n2 = getState().nodes[id2];
      const n3 = getState().nodes[id3];
      // Start=0, End=450, totalWidth=150, gap=(450-150)/2=150
      // Element0: 0, Element1: 0+50+150=200, Element2: 200+50+150=400
      expect(n1.props.x).toBe(0);
      expect(n2.props.x).toBe(200);
      expect(n3.props.x).toBe(400);
    });
  });

  describe('reparenting', () => {
    it('should reparent a node from root to another node', () => {
      getState().addNode('root', 'panel');
      const panelId = getState().selectedIds[0];
      getState().addNode('root', 'text');
      const textId = getState().selectedIds[0];

      getState().reparentNode(textId, panelId);

      const panel = getState().nodes[panelId];
      expect(panel.children).toContain(textId);
      expect(getState().nodes['root'].children).not.toContain(textId);
    });

    it('should not reparent to a descendant', () => {
      getState().addNode('root', 'panel');
      const panelId = getState().selectedIds[0];
      getState().addNode(panelId, 'text');
      const textId = getState().selectedIds[0];

      // Try to reparent the panel to its child text
      getState().reparentNode(panelId, textId);

      // Should be unchanged
      const panel = getState().nodes[panelId];
      expect(panel.children).toContain(textId);
      expect(getState().nodes['root'].children).toContain(panelId);
    });
  });
});
