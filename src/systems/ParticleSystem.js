export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.emitters = new Map();
    
    // Create a default procedural particle texture if none exists
    if (!scene.textures.exists('default_particle')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture('default_particle', 16, 16);
    }
  }

  handleEvent(data) {
    const { action, id, config } = data;
    const effectId = id || 'default';

    if (action === 'stop') {
      if (this.emitters.has(effectId)) {
        const emitter = this.emitters.get(effectId);
        emitter.stop();
        // optionally destroy after particles die
        this.scene.time.delayedCall(5000, () => {
          emitter.destroy();
          this.emitters.delete(effectId);
        });
      }
      return;
    }

    if (action === 'start') {
      // Parse config
      let cfg = {};
      try {
        cfg = config ? JSON.parse(config) : {};
      } catch(e) {
        console.warn('Invalid particle config JSON', e);
      }

      // Default configs for common weather
      let finalConfig = {};
      if (effectId === 'snow') {
        finalConfig = {
          x: { min: 0, max: this.scene.W },
          y: -20,
          lifespan: 6000,
          speedY: { min: 50, max: 150 },
          speedX: { min: -20, max: 20 },
          scale: { start: 0.5, end: 0 },
          quantity: 2,
          blendMode: 'ADD'
        };
      } else if (effectId === 'rain') {
        finalConfig = {
          x: { min: 0, max: this.scene.W },
          y: -20,
          lifespan: 2000,
          speedY: { min: 600, max: 800 },
          speedX: { min: -10, max: 10 },
          scaleY: 4,
          scaleX: 0.2,
          quantity: 5,
          alpha: 0.4,
          blendMode: 'ADD'
        };
      }

      Object.assign(finalConfig, cfg);

      // We use the default texture for now
      // In Phaser 3.60+, add.particles takes (x, y, texture, config)
      const emitter = this.scene.add.particles(0, 0, 'default_particle', finalConfig);
      emitter.setDepth(200); // Behind dialogue but in front of characters
      
      this.emitters.set(effectId, emitter);
    }
  }
}
