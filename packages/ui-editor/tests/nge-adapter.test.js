import { describe, it, expect } from 'vitest';
import { adaptToNGE, exportToNGE } from '../src/utils/adapters/nge';

const makeExportJson = () => {
  // Simulate what exportLayoutToJSON produces with nesting
  return {
    schemaVersion: '1.0',
    exportType: 'layouteer-ui',
    canvas: { width: 1280, height: 720 },
    layout: {
      id: 'root',
      type: 'canvas',
      name: 'Main Canvas',
      props: { width: 1280, height: 720 },
      children: [
        {
          id: 'box123',
          type: 'panel',
          name: 'Dialogue Box',
          props: { x: 50, y: 520, width: 1180, height: 180, backgroundColor: '#22224488', borderRadius: 8, padding: { x: 30, y: 20 } },
          children: [
            {
              id: 'speakerText',
              type: 'text',
              name: 'Speaker Name',
              props: { x: 30, y: 15, width: 200, height: 28, text: 'Hero', fontSize: 22, fontFamily: 'monospace', color: '#00ccff' },
              children: [],
              role: 'speaker_name',
            },
            {
              id: 'dialogueText',
              type: 'text',
              name: 'Dialogue Text',
              props: { x: 30, y: 50, width: 1100, height: 110, text: 'Hello world!', fontSize: 28, fontFamily: 'monospace', color: '#ffffff' },
              children: [],
              role: 'dialogue_text',
            },
          ],
          role: 'dialogue_box',
          anchor: 'bottom-center',
        },
        {
          id: 'portraitL',
          type: 'image',
          name: 'Portrait Left',
          props: { x: 60, y: 140, width: 250, height: 350, src: 'asset://characters/hero.png', objectFit: 'contain' },
          children: [],
          role: 'portrait_left',
          anchor: 'center-left',
        },
      ],
    },
  };
};

describe('adaptToNGE', () => {
  it('should extract dialogue box dimensions', () => {
    const { theme } = adaptToNGE(makeExportJson());
    expect(theme.dialogue.textBoxSize).toEqual({ width: 1180, height: 180 });
    expect(theme.dialogue.textBoxPosition).toEqual({ x: 50, y: 520 });
    expect(theme.dialogue.backgroundColor).toBe('#22224488');
    expect(theme.dialogue.borderRadius).toBe(8);
  });

  it('should extract dialogue text styling', () => {
    const { theme } = adaptToNGE(makeExportJson());
    expect(theme.dialogue.fontSize).toBe(28);
    expect(theme.dialogue.fontFamily).toBe('monospace');
    expect(theme.dialogue.textColor).toBe('#ffffff');
  });

  it('should extract speaker name styling', () => {
    const { theme } = adaptToNGE(makeExportJson());
    expect(theme.dialogue.speakerNameColor).toBe('#00ccff');
    expect(theme.dialogue.speakerNameFontSize).toBe(22);
    expect(theme.dialogue.speakerNameFontFamily).toBe('monospace');
  });

  it('should extract portrait left dimensions', () => {
    const { theme } = adaptToNGE(makeExportJson());
    expect(theme.dialogue.portraitLeft).toEqual({
      x: 60, y: 140, width: 250, height: 350, objectFit: 'contain', anchor: 'center-left',
    });
  });

  it('should include the anchor from dialogue box', () => {
    const { theme } = adaptToNGE(makeExportJson());
    expect(theme.dialogue.anchor).toBe('bottom-center');
  });

  it('should generate layers for unstyled elements', () => {
    const exportJson = makeExportJson();
    // Remove roles recursively so they become unstyled layers
    const removeRoles = (nodes) => {
      nodes.forEach(n => { delete n.role; if (n.children) removeRoles(n.children); });
    };
    removeRoles(exportJson.layout.children);

    const { layers } = adaptToNGE(exportJson);
    // All 4 non-root elements should become layers
    expect(layers.length).toBe(4);
  });
});

describe('exportToNGE', () => {
  it('should produce valid JSON output', () => {
    const json = exportToNGE(makeExportJson());
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.exportType).toBe('nge-theme');
    expect(parsed.theme).toBeDefined();
    expect(parsed.layers).toBeDefined();
  });

  it('should include canvas dimensions', () => {
    const json = exportToNGE(makeExportJson());
    const parsed = JSON.parse(json);
    expect(parsed.canvas).toEqual({ width: 1280, height: 720 });
  });
});
