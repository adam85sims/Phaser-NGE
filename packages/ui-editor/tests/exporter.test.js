import { describe, it, expect } from 'vitest';
import { exportLayoutToJSON } from '../src/utils/exporter';

const makeNodes = () => ({
  root: {
    id: 'root',
    type: 'canvas',
    name: 'Main Canvas',
    props: { width: 1280, height: 720 },
    children: ['box123', 'image001'],
    role: 'canvas',
  },
  box123: {
    id: 'box123',
    type: 'panel',
    name: 'Dialogue Box',
    props: { x: 50, y: 520, width: 1180, height: 180, backgroundColor: '#22224488' },
    children: ['speakerText', 'dialogueText'],
    role: 'dialogue_box',
    anchor: 'bottom-center',
  },
  speakerText: {
    id: 'speakerText',
    type: 'text',
    name: 'Speaker Name',
    props: { x: 30, y: 15, width: 200, height: 28, text: 'Hero', fontSize: 22, fontFamily: 'monospace', color: '#00ccff' },
    children: [],
    role: 'speaker_name',
    anchor: 'top-left',
  },
  dialogueText: {
    id: 'dialogueText',
    type: 'text',
    name: 'Dialogue Text',
    props: { x: 30, y: 50, width: 1100, height: 110, text: 'Hello world!', fontSize: 28, fontFamily: 'monospace', color: '#ffffff' },
    children: [],
    role: 'dialogue_text',
    anchor: 'top-left',
  },
  image001: {
    id: 'image001',
    type: 'image',
    name: 'Hero Portrait',
    props: { x: 50, y: 200, width: 300, height: 300, src: 'characters/hero.png', objectFit: 'contain', opacity: 1 },
    children: [],
    role: 'portrait_left',
    anchor: 'center-left',
  },
});

describe('exportLayoutToJSON', () => {
  it('should export a valid JSON string', () => {
    const json = exportLayoutToJSON(makeNodes());
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.exportType).toBe('layouteer-ui');
  });

  it('should include all nodes in the layout tree', () => {
    const json = exportLayoutToJSON(makeNodes());
    const parsed = JSON.parse(json);
    const layout = parsed.layout;

    expect(layout.id).toBe('root');
    expect(layout.type).toBe('canvas');
    expect(layout.props.width).toBe(1280);
    expect(layout.children).toHaveLength(2);
  });

  it('should include anchors on non-default elements', () => {
    const json = exportLayoutToJSON(makeNodes());
    const parsed = JSON.parse(json);

    // Find the dialogue box node
    const findNode = (node, id) => {
      if (node.id === id) return node;
      if (!node.children) return null;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };

    const box = findNode(parsed.layout, 'box123');
    expect(box.anchor).toBe('bottom-center');

    // Text with default 'top-left' anchor should not appear in export
    const text = findNode(parsed.layout, 'speakerText');
    expect(text.anchor).toBeUndefined();
  });

  it('should normalize image src to asset:// URI', () => {
    const json = exportLayoutToJSON(makeNodes());
    const parsed = JSON.parse(json);

    const findNode = (node, id) => {
      if (node.id === id) return node;
      if (!node.children) return null;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };

    const img = findNode(parsed.layout, 'image001');
    expect(img.props.src).toBe('asset://characters/hero.png');
  });

  it('should omit roles set to "none"', () => {
    const nodes = makeNodes();
    const plainPanel = {
      id: 'plain123',
      type: 'panel',
      name: 'Plain Panel',
      props: { x: 0, y: 0, width: 100, height: 100 },
      children: [],
      role: 'none',
      anchor: 'top-left',
    };
    nodes.plain123 = plainPanel;
    nodes.root.children.push('plain123');

    const json = exportLayoutToJSON(nodes);
    const parsed = JSON.parse(json);

    const findNode = (node, id) => {
      if (node.id === id) return node;
      if (!node.children) return null;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };

    const plain = findNode(parsed.layout, 'plain123');
    expect(plain.role).toBeUndefined();
  });
});
