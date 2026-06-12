import Phaser from 'phaser';

export class LayerSystem {
  constructor(scene) {
    this.scene = scene;
    // Container for all layers, positioned behind characters and UI
    this.container = scene.add.container(0, 0).setDepth(0);
    this.layers = {}; // Map of layerId -> Phaser.GameObjects.Image
  }

  /**
   * Initialize layers from scene data when a scene starts.
   * @param {Array} layerData Array of layer configuration objects
   * @param {String} legacyBackground String representing the legacy background (if no layers exist)
   */
  loadSceneLayers(layerData, legacyBackground = null) {
    // Clear existing layers
    this.clearAll();

    let data = layerData;

    // Migrate legacy background on the fly if no layers are defined
    if ((!data || data.length === 0) && legacyBackground) {
      data = [{
        id: 'legacy_bg',
        type: 'background',
        asset: legacyBackground,
        x: 0,
        y: 0,
        scale: 1,
        zIndex: 0,
        opacity: 1
      }];
    }

    if (!data || !Array.isArray(data)) {
      this._drawFallbackGradient();
      return;
    }

    // Sort layers by zIndex to add them in the correct order
    const sortedLayers = [...data].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    let hasBackground = false;

    sortedLayers.forEach(layerConf => {
      if (!layerConf.asset) return;

      let texKey = layerConf.asset;

      if (layerConf.type === 'background') {
         hasBackground = true;
      }

      if (this.scene.textures.exists(texKey)) {
        this._createLayerImage(layerConf, texKey);
      } else {
        console.warn(`Layer asset not found: ${texKey}`);
      }
    });

    if (!hasBackground) {
      this._drawFallbackGradient();
    }
  }

  _createLayerImage(layerConf, texKey) {
    const x = layerConf.x || 0;
    const y = layerConf.y || 0;
    
    // Set origin to top-left to match the editor DOM preview exactly
    const img = this.scene.add.image(x, y, texKey).setOrigin(0.5, 0.5);
    
    if (layerConf.scale !== undefined) {
       img.setScale(layerConf.scale);
    }
    
    if (layerConf.rotation !== undefined) {
       img.setAngle(layerConf.rotation);
    }

    if (layerConf.hidden) {
       img.setAlpha(0);
    } else if (layerConf.opacity !== undefined) {
       img.setAlpha(layerConf.opacity);
    }
    
    img.zIndex = layerConf.zIndex || 0;
    img.layerId = layerConf.id;
    img.assetName = layerConf.asset;
    
    this.container.add(img);
    this.layers[layerConf.id] = img;
  }

  /** Gets a specific layer sprite by ID */
  getLayer(id) {
    return this.layers[id];
  }

  showLayer(id, duration = 0) {
    const layer = this.layers[id];
    if (!layer) return null;

    if (duration > 0) {
      return new Promise(resolve => {
        this.scene.tweens.add({
          targets: layer,
          alpha: 1,
          duration: duration,
          onComplete: resolve
        });
      });
    } else {
      layer.setAlpha(1);
      return Promise.resolve();
    }
  }

  hideLayer(id, duration = 0) {
    const layer = this.layers[id];
    if (!layer) return null;

    if (duration > 0) {
      return new Promise(resolve => {
        this.scene.tweens.add({
          targets: layer,
          alpha: 0,
          duration: duration,
          onComplete: resolve
        });
      });
    } else {
      layer.setAlpha(0);
      return Promise.resolve();
    }
  }

  showLayerByAsset(assetName, duration = 0) {
    const layer = Object.values(this.layers).find(img => img.assetName === assetName);
    if (layer) {
      return this.showLayer(layer.layerId, duration);
    }
    return null;
  }

  hideLayerByAsset(assetName, duration = 0) {
    const layer = Object.values(this.layers).find(img => img.assetName === assetName);
    if (layer) {
      return this.hideLayer(layer.layerId, duration);
    }
    return null;
  }

  /**
   * Replaces the old procedural gradient fallback
   */
  _drawFallbackGradient() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    
    const graphics = this.scene.add.graphics();
    const colors = [0x0a0a1a, 0x0f0f2a, 0x1a0a2a];
    const steps = 60;
    
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const ci = t < 0.5 ? 0 : (t < 0.8 ? 1 : 2);
      const next = ci < 2 ? ci + 1 : ci;
      const lt = (t - ci * 0.5) * 2;
      
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(colors[ci]),
        Phaser.Display.Color.IntegerToColor(colors[next]),
        100, lt * 100
      );
      
      graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      graphics.fillRect(0, (i / steps) * h, w, h / steps + 1);
    }
    
    // Store as a generic background so it gets cleared properly
    this.container.add(graphics);
    this.fallbackGraphics = graphics;
  }

  clearAll() {
    Object.values(this.layers).forEach(layer => layer.destroy());
    this.layers = {};
    if (this.fallbackGraphics) {
      this.fallbackGraphics.destroy();
      this.fallbackGraphics = null;
    }
  }

  destroy() {
    this.clearAll();
    if (this.container) {
      this.container.destroy();
    }
  }
}
