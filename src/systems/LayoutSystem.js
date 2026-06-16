import { Data } from './DataLoader.js';

/**
 * LayoutSystem — applies named UI layouts to the game at runtime.
 *
 * A layout is a JSON object (loaded from data/layouts/<id>.json) that
 * contains a `theme` section and an optional `layers` section.
 *
 * When applied:
 *   1. The theme section REPLACES Data.theme entirely (not merged).
 *      DialogueSystem, MenuScene, CharacterSystem pick up the new values
 *      on their next read.
 *   2. The layers section creates Phaser GameObjects on the target scene,
 *      managed separately from the scene's own LayerSystem.
 *
 * Usage:
 *   const layoutSys = new LayoutSystem(scene);
 *   layoutSys.apply('default_dialogue', { fade: true });
 *   layoutSys.clear(); // destroys all managed objects
 */
export class LayoutSystem {
  constructor(scene) {
    this.scene = scene;
    this._objects = [];    // Phaser objects we created
    this._activeLayout = null;
  }

  /**
   * Apply a layout by ID.
   * @param {string} layoutId — key in Data.layouts
   * @param {object} [options]
   * @param {boolean} [options.fade=false] — fade in layers on creation
   */
  apply(layoutId, options = {}) {
    const layout = Data.getLayout(layoutId);
    if (!layout) {
      console.warn(`LayoutSystem: layout not found — "${layoutId}"`);
      return;
    }

    // Clear any previously applied layout first
    this.clear();

    this._activeLayout = layout;

    // 1. Replace theme entirely
    if (layout.theme) {
      Data.theme = layout.theme;
    }

    // 2. Build layer objects from layout.layers[]
    if (layout.layers && layout.layers.length > 0) {
      this._buildLayers(layout.layers, options);
    }

    // 3. Fade in the camera if requested
    if (options.fade && this.scene.cameras?.main) {
      this.scene.cameras.main.fadeIn(300, 0, 0, 0);
    }
  }

  /**
   * Destroy all objects created by this LayoutSystem and
   * clear the active layout reference.
   */
  clear() {
    this._objects.forEach(obj => {
      try { obj.destroy(); } catch (e) { /* already destroyed */ }
    });
    this._objects = [];
    this._activeLayout = null;
  }

  /**
   * Build Phaser GameObjects from the layout's layers array.
   * Each layer maps to a Phaser primitive based on its type.
   */
  _buildLayers(layers, options) {
    const scene = this.scene;
    const fade = options.fade || false;

    layers.forEach((layer, index) => {
      let obj = null;
      const alpha = layer.opacity ?? 1;

      switch (layer.type) {
        case 'panel':
        case 'background': {
          let fillColor = 0x334155;
          if (layer.backgroundColor) {
            fillColor = parseInt(layer.backgroundColor.replace('#', ''), 16);
          }
          obj = scene.add.rectangle(
            layer.x + (layer.width || 0) / 2,
            layer.y + (layer.height || 0) / 2,
            layer.width || 200,
            layer.height || 100,
            fillColor,
            (layer.backgroundColor?.length === 9)
              ? parseInt(layer.backgroundColor.slice(7), 16) / 255
              : alpha
          );
          obj.setOrigin(0.5);
          if (layer.borderRadius) {
            obj.setStrokeStyle(1, 0x475569);
          }
          break;
        }

        case 'text': {
          const textStyle = {
            fontSize: layer.fontSize ? `${layer.fontSize}px` : '16px',
            fontFamily: layer.fontFamily || 'monospace',
            color: layer.color || '#ffffff',
          };
          obj = scene.add.text(layer.x, layer.y, layer.text || '', textStyle);
          if (layer.textAlign === 'center') {
            obj.setOrigin(0.5, 0);
            obj.setX(layer.x + (layer.width || 200) / 2);
          }
          break;
        }

        case 'image': {
          const assetKey = layer.asset?.replace(/^asset:\/\//, '');
          const texKey = assetKey?.replace(/\.\w+$/, ''); // strip ext
          if (texKey && scene.textures.exists(texKey)) {
            obj = scene.add.image(
              layer.x + (layer.width || 0) / 2,
              layer.y + (layer.height || 0) / 2,
              texKey
            );
            if (layer.width) obj.setDisplaySize(layer.width, layer.height);
          } else {
            // Fallback placeholder rectangle
            obj = scene.add.rectangle(
              layer.x + (layer.width || 0) / 2,
              layer.y + (layer.height || 0) / 2,
              layer.width || 200,
              layer.height || 100,
              0x1e293b
            );
          }
          break;
        }

        case 'button': {
          // Panel background
          const bgColor = layer.backgroundColor
            ? parseInt(layer.backgroundColor.replace('#', ''), 16)
            : 0x3b82f6;
          obj = scene.add.rectangle(
            layer.x + (layer.width || 0) / 2,
            layer.y + (layer.height || 0) / 2,
            layer.width || 200,
            layer.height || 50,
            bgColor,
            alpha
          );
          obj.setOrigin(0.5);
          obj.setInteractive({ useHandCursor: true });

          // Label text
          const labelStyle = {
            fontSize: layer.fontSize ? `${layer.fontSize}px` : '16px',
            fontFamily: layer.fontFamily || 'monospace',
            color: layer.color || '#ffffff',
          };
          const label = scene.add.text(layer.x + (layer.width || 0) / 2, layer.y + (layer.height || 0) / 2,
            layer.label || '', labelStyle);
          label.setOrigin(0.5);
          this._objects.push(label);
          break;
        }

        default:
          console.warn(`LayoutSystem: unknown layer type "${layer.type}"`);
          break;
      }

      if (obj) {
        obj.setDepth(layer.zIndex ?? (index + 1));
        if (!fade) {
          obj.setAlpha(alpha);
        } else {
          obj.setAlpha(0);
          scene.tweens.add({
            targets: obj,
            alpha: alpha,
            duration: 300,
            delay: index * 50,
          });
        }
        this._objects.push(obj);
      }
    });
  }

  /**
   * Returns the ID of the currently active layout, or null.
   */
  get activeLayoutId() {
    return this._activeLayout?.id || null;
  }
}
