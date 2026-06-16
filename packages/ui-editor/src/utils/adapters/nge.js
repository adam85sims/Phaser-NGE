/**
 * NGE (Phaser 4) Adapter for Layouteer
 * Converts Layouteer export JSON into NGE's data/theme.json format
 * and scene layer definitions.
 *
 * Pure function — no Phaser imports, no DOM. Runs in Node.js or browser.
 */

export function adaptToNGE(exportJson) {
  const layout = exportJson.layout;
  if (!layout || !layout.children) return null;

  const elements = flattenElements(layout);
  const byRole = groupByRole(elements);

  const theme = buildTheme(byRole);
  const layers = buildLayers(elements.filter(e => !e.role || e.role === 'none'));

  return { theme, layers };
}

// Recursively flatten the element tree into a list
function flattenElements(node, depth = 0) {
  const result = [];
  if (!node) return result;
  if (node.id !== 'root' && node.id !== undefined) {
    result.push({ ...node, depth });
  }
  if (node.children) {
    node.children.forEach(child => {
      // If child is an id string, the export uses flat format; resolve from somewhere
      // For now, assume children are already element objects
      if (typeof child === 'object') {
        result.push(...flattenElements(child, depth + 1));
      }
    });
  }
  return result;
}

// Also support flat elements[] array format
function extractElements(layout) {
  // The export format has layout as the root tree node.
  // But flat format has layout with children as IDs that reference... 
  // Actually, looking at the export format, elements[].children contains IDs,
  // and the elements are in a flat array. But the buildTree in exporter.js
  // produces a nested tree where children are objects.
  // We support both.
  const items = [];
  function walk(node) {
    if (!node) return;
    items.push(node);
    if (node.children) {
      node.children.forEach(child => walk(child));
    }
  }
  walk(layout);
  return items;
}

function groupByRole(elements) {
  const map = {};
  for (const el of elements) {
    if (el.role) {
      if (!map[el.role]) map[el.role] = [];
      map[el.role].push(el);
    }
  }
  return map;
}

function buildTheme(byRole) {
  const theme = {
    dialogue: {},
    ui: {
      menu: { buttons: [] },
      splash: { enabled: false }
    }
  };

  // --- Dialogue Box ---
  const dBox = byRole['dialogue_box']?.[0];
  if (dBox) {
    theme.dialogue.textBoxSize = { width: dBox.props.width, height: dBox.props.height };
    theme.dialogue.textBoxPosition = { x: dBox.props.x, y: dBox.props.y };
    if (dBox.props.backgroundColor) theme.dialogue.backgroundColor = dBox.props.backgroundColor;
    if (dBox.props.padding) theme.dialogue.padding = dBox.props.padding;
    if (dBox.props.borderRadius) theme.dialogue.borderRadius = dBox.props.borderRadius;
    if (dBox.props.transitionDuration) theme.dialogue.transitionDuration = dBox.props.transitionDuration;
    // Inherit anchor if set
    if (dBox.anchor) theme.dialogue.anchor = dBox.anchor;
  }

  // --- Dialogue Text ---
  const dText = byRole['dialogue_text']?.[0];
  if (dText) {
    if (dText.props.fontSize) theme.dialogue.fontSize = dText.props.fontSize;
    if (dText.props.fontFamily) theme.dialogue.fontFamily = dText.props.fontFamily;
    if (dText.props.color) theme.dialogue.textColor = dText.props.color;
    if (dText.props.textAlign) theme.dialogue.textAlign = dText.props.textAlign;
    if (dText.props.lineHeight) theme.dialogue.lineHeight = dText.props.lineHeight;
    if (dText.props.textSpeed !== undefined) theme.dialogue.textSpeed = dText.props.textSpeed;
  }

  // --- Speaker Name ---
  const sName = byRole['speaker_name']?.[0];
  if (sName) {
    if (sName.props.color) theme.dialogue.speakerNameColor = sName.props.color;
    if (sName.props.fontSize) theme.dialogue.speakerNameFontSize = sName.props.fontSize;
    if (sName.props.fontFamily) theme.dialogue.speakerNameFontFamily = sName.props.fontFamily;
    if (sName.props.text) theme.dialogue.speakerNameText = sName.props.text;
  }

  // --- Portrait Left ---
  const portL = byRole['portrait_left']?.[0];
  if (portL) {
    theme.dialogue.portraitLeft = {
      x: portL.props.x, y: portL.props.y,
      width: portL.props.width, height: portL.props.height,
      ...(portL.props.objectFit ? { objectFit: portL.props.objectFit } : {}),
      ...(portL.anchor ? { anchor: portL.anchor } : {}),
    };
  }

  // --- Portrait Right ---
  const portR = byRole['portrait_right']?.[0];
  if (portR) {
    theme.dialogue.portraitRight = {
      x: portR.props.x, y: portR.props.y,
      width: portR.props.width, height: portR.props.height,
      ...(portR.props.objectFit ? { objectFit: portR.props.objectFit } : {}),
      ...(portR.anchor ? { anchor: portR.anchor } : {}),
    };
  }

  // --- Choice Container ---
  const choiceCont = byRole['choice_container']?.[0];
  if (choiceCont) {
    theme.dialogue.choiceContainer = {
      x: choiceCont.props.x, y: choiceCont.props.y,
      width: choiceCont.props.width, height: choiceCont.props.height,
      ...(choiceCont.anchor ? { anchor: choiceCont.anchor } : {}),
    };
  }

  // --- Menu ---
  const menuBg = byRole['menu_background']?.[0];
  if (menuBg) {
    theme.ui.menu.background = menuBg.props.src || menuBg.props.backgroundColor || null;
  }

  const menuTitle = byRole['menu_title']?.[0];
  if (menuTitle) {
    theme.ui.menu.title = {
      text: menuTitle.props.text || 'Game Title',
      x: menuTitle.props.x + (menuTitle.props.width / 2) || 640,
      y: menuTitle.props.y + (menuTitle.props.height / 2) || 220,
      font: menuTitle.props.fontFamily || 'monospace',
      size: menuTitle.props.fontSize || 56,
      color: menuTitle.props.color || '#ffffff',
    };
  }

  const menuSubtitle = byRole['menu_subtitle']?.[0];
  if (menuSubtitle) {
    theme.ui.menu.subtitle = {
      text: menuSubtitle.props.text || '',
      x: menuSubtitle.props.x + (menuSubtitle.props.width / 2) || 640,
      y: menuSubtitle.props.y + (menuSubtitle.props.height / 2) || 280,
      font: menuSubtitle.props.fontFamily || 'monospace',
      size: menuSubtitle.props.fontSize || 18,
      color: menuSubtitle.props.color || '#666688',
    };
  }

  const menuButtons = byRole['menu_button'] || [];
  if (menuButtons.length > 0) {
    theme.ui.menu.buttons = menuButtons.map((btn, i) => ({
      id: btn.props.id || `menu_btn_${i}`,
      label: btn.props.label || btn.props.text || `Button ${i + 1}`,
      x: btn.props.x + (btn.props.width / 2) || 640,
      y: btn.props.y + (btn.props.height / 2) || 420 + i * 60,
      font: btn.props.fontFamily || 'monospace',
      size: btn.props.fontSize || 22,
      color: btn.props.color || '#00ccff',
      hoverColor: btn.props.hoverColor || '#ffffff',
    }));
  }

  // --- Splash ---
  // No direct splash mapping — rendered by the editor if needed

  return theme;
}

/**
 * Build scene layer definitions for elements that don't have a semantic role.
 * These become layers[] in a Phaser NGE scene.
 */
function buildLayers(unstyledElements) {
  const layers = unstyledElements.map((el, i) => ({
    id: el.id,
    type: el.type === 'image' ? 'image' : 'background',
    asset: el.type === 'image' ? el.props.src : undefined,
    x: el.props.x || 0,
    y: el.props.y || 0,
    width: el.props.width,
    height: el.props.height,
    scale: 1,
    zIndex: i + 1,
    opacity: el.props.opacity ?? 1,
    ...(el.props.backgroundColor ? { backgroundColor: el.props.backgroundColor } : {}),
  }));

  return layers;
}

/**
 * Generate the full NGE-compatible output as a string.
 */
export function exportToNGE(exportJson) {
  const { theme, layers } = adaptToNGE(exportJson);

  const canvas = exportJson.layout || exportJson.canvas;
  const result = {
    schemaVersion: '1.0',
    exportType: 'nge-theme',
    canvas: canvas ? {
      width: canvas.props?.width || canvas.width,
      height: canvas.props?.height || canvas.height,
    } : { width: 1280, height: 720 },
    theme,
    layers,
    generatedAt: new Date().toISOString(),
  };

  return JSON.stringify(result, null, 2);
}
