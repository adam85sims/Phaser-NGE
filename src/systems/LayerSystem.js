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

    // Sort top-level layers by zIndex
    const sortedLayers = [...data].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    let hasBackground = false;

    const buildTree = (layers, parentContainer) => {
      layers.forEach(layerConf => {
        let obj = null;

        if (layerConf.type === 'container' || layerConf.children) {
          // It's a Container
          obj = this.scene.add.container(layerConf.x || 0, layerConf.y || 0);
          if (layerConf.scale !== undefined) obj.setScale(layerConf.scale);
          if (layerConf.rotation !== undefined) obj.setAngle(layerConf.rotation);
          
          if (layerConf.hidden) obj.setAlpha(0);
          else if (layerConf.opacity !== undefined) obj.setAlpha(layerConf.opacity);
          
          // Build children
          if (layerConf.children && layerConf.children.length > 0) {
            buildTree(layerConf.children, obj);
          }
        } else if (layerConf.asset) {
          // It's an Image
          const texKey = layerConf.asset;
          if (layerConf.type === 'background') hasBackground = true;

          if (this.scene.textures.exists(texKey)) {
            const originX = layerConf.originX !== undefined ? layerConf.originX : 0.5;
            const originY = layerConf.originY !== undefined ? layerConf.originY : 0.5;
            obj = this.scene.add.image(layerConf.x || 0, layerConf.y || 0, texKey).setOrigin(originX, originY);
            if (layerConf.scale !== undefined) obj.setScale(layerConf.scale);
            if (layerConf.rotation !== undefined) obj.setAngle(layerConf.rotation);
            if (layerConf.hidden) obj.setAlpha(0);
            else if (layerConf.opacity !== undefined) obj.setAlpha(layerConf.opacity);
            obj.assetName = layerConf.asset;
          } else {
            console.warn(`Layer asset not found: ${texKey}`);
          }
        }

        if (obj) {
          obj.zIndex = layerConf.zIndex || 0;
          obj.layerId = layerConf.id;
          parentContainer.add(obj);
          this.layers[layerConf.id] = obj;
        }
      });
    };

    buildTree(sortedLayers, this.container);

    if (!hasBackground) {
      this._drawFallbackGradient();
    }
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
    this.container.sendToBack(graphics);
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
