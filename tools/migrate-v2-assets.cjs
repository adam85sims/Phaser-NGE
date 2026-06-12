const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

function migrate() {
  console.log('Migrating assets to v2 free-form paths...');

  // 1. Migrate characters.json
  const charPath = path.join(dataDir, 'characters.json');
  if (fs.existsSync(charPath)) {
    const chars = JSON.parse(fs.readFileSync(charPath, 'utf8'));
    let changed = false;
    for (const char of Object.values(chars)) {
      if (char.portraits) {
        for (const [expr, asset] of Object.entries(char.portraits)) {
          if (asset && !asset.includes('/')) {
            char.portraits[expr] = `characters/${asset}`;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      fs.writeFileSync(charPath, JSON.stringify(chars, null, 2));
      console.log('Migrated characters.json');
    }
  }

  // 2. Migrate scenes
  const scenesDir = path.join(dataDir, 'scenes');
  if (fs.existsSync(scenesDir)) {
    const files = fs.readdirSync(scenesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const scenePath = path.join(scenesDir, file);
      const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
      let changed = false;

      // Legacy scene background field
      if (scene.background && !scene.background.includes('/')) {
        scene.background = `backgrounds/${scene.background}`;
        changed = true;
      }

      // Legacy scene music field
      if (scene.music && !scene.music.includes('/')) {
        scene.music = `audio/bgm/${scene.music}`;
        changed = true;
      }

      // Layers array
      if (scene.layers) {
        for (const layer of scene.layers) {
          if (layer.asset && !layer.asset.includes('/')) {
            let prefix = 'backgrounds/';
            if (layer.category === 'characters' || layer.category === 'portraits' || layer.type === 'character') prefix = 'characters/';
            else if (layer.category === 'props' || layer.type === 'prop') prefix = 'props/';
            layer.asset = `${prefix}${layer.asset}`;
            changed = true;
          }
        }
      }

      // Nodes
      if (scene.nodes) {
        for (const node of scene.nodes) {
          if (node.type === 'event' && node.eventValue && !node.eventValue.includes('/')) {
            if (node.eventType === 'bgm') {
              node.eventValue = `audio/bgm/${node.eventValue}`;
              changed = true;
            } else if (node.eventType === 'sfx') {
              node.eventValue = `audio/sfx/${node.eventValue}`;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2));
        console.log(`Migrated scene: ${file}`);
      }
    }
  }

  console.log('Migration complete.');
}

migrate();
