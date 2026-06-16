/**
 * Starter project templates for Layouteer.
 * Each template defines pre-populated node structures for common game UI patterns.
 */

const makeId = () => Math.random().toString(36).slice(2, 10);

export const TEMPLATES = {
  'visual-novel': {
    name: 'Visual Novel Dialogue',
    description: 'Standard VN layout: dialogue box at bottom, speaker name, text, and left portrait slot',
    buildNodes: () => {
      const canvas = {
        id: 'root',
        type: 'canvas',
        name: 'Main Canvas',
        props: { width: 1280, height: 720 },
        children: [],
        role: 'canvas'
      };

      const dialogueBox = {
        id: makeId(),
        type: 'panel',
        name: 'Dialogue Box',
        props: { x: 50, y: 520, width: 1180, height: 180, backgroundColor: '#22224488', borderRadius: 8, padding: { x: 30, y: 20 } },
        children: [],
        role: 'dialogue_box',
        anchor: 'bottom-center'
      };

      const speakerName = {
        id: makeId(),
        type: 'text',
        name: 'Speaker Name',
        props: { x: 30, y: 15, width: 300, height: 28, text: 'Speaker', fontSize: 22, fontFamily: 'monospace', color: '#00ccff' },
        children: [],
        role: 'speaker_name',
        anchor: 'top-left'
      };

      const dialogueText = {
        id: makeId(),
        type: 'text',
        name: 'Dialogue Text',
        props: { x: 30, y: 50, width: 1100, height: 110, text: 'Hello, world! This is the dialogue text area.', fontSize: 28, fontFamily: 'monospace', color: '#ffffff' },
        children: [],
        role: 'dialogue_text',
        anchor: 'top-left'
      };

      const portraitLeft = {
        id: makeId(),
        type: 'image',
        name: 'Portrait Left',
        props: { x: 60, y: 140, width: 250, height: 350, src: '', objectFit: 'contain', opacity: 1 },
        children: [],
        role: 'portrait_left',
        anchor: 'center-left'
      };

      // Wire up hierarchy
      dialogueBox.children = [speakerName.id, dialogueText.id];
      canvas.children = [portraitLeft.id, dialogueBox.id];

      return {
        nodes: {
          [canvas.id]: canvas,
          [dialogueBox.id]: dialogueBox,
          [speakerName.id]: speakerName,
          [dialogueText.id]: dialogueText,
          [portraitLeft.id]: portraitLeft,
        },
        gridSize: 20,
        snapToGrid: true,
      };
    }
  },

  'rpg-menu': {
    name: 'RPG Menu',
    description: 'Classic RPG-style menu: title, background, action buttons, and stats panel',
    buildNodes: () => {
      const canvas = {
        id: 'root',
        type: 'canvas',
        name: 'Main Canvas',
        props: { width: 1280, height: 720 },
        children: [],
        role: 'canvas'
      };

      const bg = {
        id: makeId(),
        type: 'panel',
        name: 'Menu Background',
        props: { x: 0, y: 0, width: 1280, height: 720, backgroundColor: '#0a0a1a' },
        children: [],
        role: 'menu_background',
        anchor: 'top-left'
      };

      const title = {
        id: makeId(),
        type: 'text',
        name: 'Title',
        props: { x: 640, y: 100, width: 500, height: 60, text: 'EPIC QUEST', fontSize: 56, fontFamily: 'monospace', color: '#ffffff', textAlign: 'center' },
        children: [],
        role: 'menu_title',
        anchor: 'top-center'
      };

      const btnStart = {
        id: makeId(),
        type: 'button',
        name: 'Start Game',
        props: { x: 540, y: 300, width: 200, height: 50, label: 'Start Game', backgroundColor: '#3b82f6', color: '#ffffff', borderRadius: 6 },
        children: [],
        role: 'menu_button',
        anchor: 'center'
      };

      const btnLoad = {
        id: makeId(),
        type: 'button',
        name: 'Load Game',
        props: { x: 540, y: 370, width: 200, height: 50, label: 'Load Game', backgroundColor: '#1e293b', color: '#94a3b8', borderRadius: 6 },
        children: [],
        role: 'menu_button',
        anchor: 'center'
      };

      const btnSettings = {
        id: makeId(),
        type: 'button',
        name: 'Settings',
        props: { x: 540, y: 440, width: 200, height: 50, label: 'Settings', backgroundColor: '#1e293b', color: '#94a3b8', borderRadius: 6 },
        children: [],
        role: 'menu_button',
        anchor: 'center'
      };

      canvas.children = [bg.id, title.id, btnStart.id, btnLoad.id, btnSettings.id];

      return {
        nodes: {
          [canvas.id]: canvas,
          [bg.id]: bg,
          [title.id]: title,
          [btnStart.id]: btnStart,
          [btnLoad.id]: btnLoad,
          [btnSettings.id]: btnSettings,
        },
        gridSize: 20,
        snapToGrid: true,
      };
    }
  },

  'fps-hud': {
    name: 'FPS HUD',
    description: 'First-person shooter HUD: health bar, ammo counter, crosshair, minimap frame',
    buildNodes: () => {
      const canvas = {
        id: 'root',
        type: 'canvas',
        name: 'Main Canvas',
        props: { width: 1280, height: 720 },
        children: [],
        role: 'canvas'
      };

      const healthBg = {
        id: makeId(),
        type: 'panel',
        name: 'Health Bar BG',
        props: { x: 30, y: 650, width: 250, height: 24, backgroundColor: '#333333', borderRadius: 4 },
        children: [],
        role: 'hud_bar',
        anchor: 'bottom-left'
      };

      const healthFill = {
        id: makeId(),
        type: 'panel',
        name: 'Health Bar Fill',
        props: { x: 30, y: 650, width: 200, height: 24, backgroundColor: '#22c55e', borderRadius: 4 },
        children: [],
        role: 'none',
        anchor: 'bottom-left'
      };

      const healthLabel = {
        id: makeId(),
        type: 'text',
        name: 'Health Label',
        props: { x: 30, y: 626, width: 100, height: 20, text: 'HEALTH', fontSize: 14, fontFamily: 'monospace', color: '#22c55e' },
        children: [],
        role: 'none',
        anchor: 'bottom-left'
      };

      const ammoBox = {
        id: makeId(),
        type: 'panel',
        name: 'Ammo Counter',
        props: { x: 1180, y: 660, width: 80, height: 40, backgroundColor: '#1e293b', borderRadius: 6 },
        children: [],
        role: 'none',
        anchor: 'bottom-right'
      };

      const ammoText = {
        id: makeId(),
        type: 'text',
        name: 'Ammo Text',
        props: { x: 1180, y: 668, width: 80, height: 28, text: '30', fontSize: 24, fontFamily: 'monospace', color: '#ffffff', textAlign: 'center' },
        children: [],
        role: 'none',
        anchor: 'bottom-right'
      };

      const crosshairH = {
        id: makeId(),
        type: 'panel',
        name: 'Crosshair H',
        props: { x: 635, y: 358, width: 10, height: 4, backgroundColor: '#ffffff', borderRadius: 2 },
        children: [],
        role: 'none',
        anchor: 'center'
      };

      const crosshairV = {
        id: makeId(),
        type: 'panel',
        name: 'Crosshair V',
        props: { x: 638, y: 355, width: 4, height: 10, backgroundColor: '#ffffff', borderRadius: 2 },
        children: [],
        role: 'none',
        anchor: 'center'
      };

      const minimap = {
        id: makeId(),
        type: 'panel',
        name: 'Minimap Frame',
        props: { x: 1150, y: 20, width: 110, height: 110, backgroundColor: '#11111188', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
        children: [],
        role: 'none',
        anchor: 'top-right'
      };

      const minimapDot = {
        id: makeId(),
        type: 'panel',
        name: 'Minimap Dot',
        props: { x: 1155, y: 65, width: 6, height: 6, backgroundColor: '#3b82f6', borderRadius: 3 },
        children: [],
        role: 'none',
        anchor: 'top-left'
      };

      minimap.children = [minimapDot.id];
      ammoBox.children = [ammoText.id];

      canvas.children = [healthBg.id, healthFill.id, healthLabel.id, ammoBox.id, crosshairH.id, crosshairV.id, minimap.id];

      return {
        nodes: {
          [canvas.id]: canvas,
          [healthBg.id]: healthBg,
          [healthFill.id]: healthFill,
          [healthLabel.id]: healthLabel,
          [ammoBox.id]: ammoBox,
          [ammoText.id]: ammoText,
          [crosshairH.id]: crosshairH,
          [crosshairV.id]: crosshairV,
          [minimap.id]: minimap,
          [minimapDot.id]: minimapDot,
        },
        gridSize: 5,
        snapToGrid: true,
      };
    }
  }
};
