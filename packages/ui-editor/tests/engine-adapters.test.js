import { describe, it, expect } from 'vitest';
import { exportToGodot } from '../src/utils/adapters/godot';
import { exportToUnity } from '../src/utils/adapters/unity';
import { exportToUnreal } from '../src/utils/adapters/unreal';

const makeExportJson = () => ({
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
      {
        id: 'titleText',
        type: 'text',
        name: 'Title',
        props: { x: 640, y: 100, width: 500, height: 60, text: 'GAME TITLE', fontSize: 56, fontFamily: 'serif', color: '#ffffff', textAlign: 'center' },
        children: [],
        role: 'menu_title',
        anchor: 'top-center',
      },
      {
        id: 'startBtn',
        type: 'button',
        name: 'Start Button',
        props: { x: 540, y: 300, width: 200, height: 50, label: 'Start', backgroundColor: '#3b82f6', color: '#ffffff', borderRadius: 6 },
        children: [],
        role: 'menu_button',
        anchor: 'center',
      },
    ],
  },
});

describe('Godot adapter', () => {
  it('should produce a .tscn output with gd_scene header', () => {
    const output = exportToGodot(makeExportJson());
    expect(output).toContain('[gd_scene');
    expect(output).toContain('format=3');
  });

  it('should include control nodes with proper types', () => {
    const output = exportToGodot(makeExportJson());
    expect(output).toContain('type="Label"');
    expect(output).toContain('type="PanelContainer"');
    expect(output).toContain('type="TextureRect"');
    expect(output).toContain('type="Button"');
  });

  it('should include text content for labels', () => {
    const output = exportToGodot(makeExportJson());
    expect(output).toContain('text = "Hello world!"');
    expect(output).toContain('text = "Hero"');
    expect(output).toContain('text = "GAME TITLE"');
  });

  it('should include anchor/offset values', () => {
    const output = exportToGodot(makeExportJson());
    expect(output).toContain('anchor_left = 0.5000');
    expect(output).toContain('anchor_top = 1.0000');
  });

  it('should resolve asset:// URIs to res:// paths', () => {
    const output = exportToGodot(makeExportJson());
    expect(output).toContain('res://assets/characters/hero.png');
  });

  it('should include color values', () => {
    const output = exportToGodot(makeExportJson());
    expect(output).toContain('font_color = Color(');
  });
});

describe('Unity adapter', () => {
  it('should produce a C# script with MenuItem', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('MenuItem');
    expect(output).toContain('Layouteer/Generate UI from JSON');
  });

  it('should include RectTransform setup code', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('RectTransform');
    expect(output).toContain('AddComponent<Canvas>');
  });

  it('should handle text elements with TextMeshPro', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('TextMeshProUGUI');
    expect(output).toContain('node.props?.text');
    expect(output).toContain('fontSize');
  });

  it('should handle button elements', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('AddComponent<Button>');
    expect(output).toContain('Start');
  });

  it('should include anchor mapping switch statement', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('bottom-center');
    expect(output).toContain('SetAnchorAndPosition');
  });

  it('should parse colors from hex', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('ParseColor');
    expect(output).toContain('Convert.ToByte');
  });

  it('should resolve asset:// URIs to Assets/ paths', () => {
    const output = exportToUnity(makeExportJson());
    expect(output).toContain('ResolveAssetPath');
    expect(output).toContain('"Assets/"');
  });
});

describe('Unreal adapter', () => {
  it('should produce a Python script', () => {
    const output = exportToUnreal(makeExportJson());
    expect(output).toContain('import unreal');
    expect(output).toContain('create_widget');
  });

  it('should include anchor mapping', () => {
    const output = exportToUnreal(makeExportJson());
    expect(output).toContain('get_anchors');
    expect(output).toContain('bottom-center');
  });

  it('should create widget types for each element type', () => {
    const output = exportToUnreal(makeExportJson());
    expect(output).toContain('unreal.TextBlock');
    expect(output).toContain('unreal.CanvasPanel');
    expect(output).toContain('unreal.Image');
    expect(output).toContain('unreal.Button');
  });

  it('should include color parsing', () => {
    const output = exportToUnreal(makeExportJson());
    expect(output).toContain('parse_color');
    expect(output).toContain('LinearColor');
  });

  it('should include text content', () => {
    const output = exportToUnreal(makeExportJson());
    expect(output).toContain('Hello world!');
  });

  it('should include coordinate conversion', () => {
    const output = exportToUnreal(makeExportJson());
    expect(output).toContain('offset_left');
    expect(output).toContain('offset_top');
  });
});
