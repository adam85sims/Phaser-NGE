import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentProjectRoot = process.cwd();
let app = null;
let server = null;

export function setProjectRoot(rootPath) {
  currentProjectRoot = rootPath;
}

export function getProjectRoot() {
  return currentProjectRoot;
}

export async function startServer(port = 0, isDev = false) {
  app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Middleware to expose project-specific static files
  app.use('/data', (req, res, next) => {
    if (!currentProjectRoot) return next();
    express.static(path.join(currentProjectRoot, 'data'))(req, res, next);
  });
  
  app.use('/assets', (req, res, next) => {
    if (!currentProjectRoot) return next();
    express.static(path.join(currentProjectRoot, 'public', 'assets'))(req, res, next);
  });

  // Serve engine static files from dist/ if in production
  if (!isDev) {
    app.use(express.static(path.join(__dirname, '../dist')));
  }

  // API Status (used by Launcher)
  app.get('/api/status', (req, res) => {
    res.json({ projectRoot: currentProjectRoot });
  });

  // Editor API Endpoints (Ported from editor-backend.js)
  app.get('/api/list-assets', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const baseDir = path.join(currentProjectRoot, 'public', 'assets');
      
      await fs.mkdir(path.join(baseDir, 'backgrounds'), { recursive: true });
      await fs.mkdir(path.join(baseDir, 'characters'), { recursive: true });
      await fs.mkdir(path.join(baseDir, 'audio/bgm'), { recursive: true });
      await fs.mkdir(path.join(baseDir, 'audio/sfx'), { recursive: true });
      
      async function scanDirRecursive(dirPath) {
        let results = [];
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true });
          for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');
            
            if (item.isDirectory()) {
              results.push({ name: item.name, path: relPath, type: 'directory' });
              results.push(...await scanDirRecursive(fullPath));
            } else {
              const validExts = /\.(png|jpg|jpeg|gif|webp|mp3|ogg|wav|ttf|otf|woff2?)$/i;
              if (validExts.test(item.name)) {
                const stat = fsSync.statSync(fullPath);
                results.push({ name: item.name, path: relPath, type: 'file', size: stat.size, modified: stat.mtime.toISOString() });
              }
            }
          }
        } catch (e) {
          // ignore missing dirs
        }
        return results;
      }

      const result = await scanDirRecursive(baseDir);
      res.json(result);
    } catch (err) {
      console.error('Error listing assets:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/save', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const payload = req.body;
      const dataDir = path.join(currentProjectRoot, 'data');
      const scenesDir = path.join(dataDir, 'scenes');
      const animationsDir = path.join(dataDir, 'animations');

      await fs.mkdir(dataDir, { recursive: true });
      await fs.mkdir(scenesDir, { recursive: true });
      await fs.mkdir(animationsDir, { recursive: true });

      if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
      if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
      if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));
      if (payload.theme) await fs.writeFile(path.join(dataDir, 'theme.json'), JSON.stringify(payload.theme, null, 2));

      const warnings = [];
      if (payload.scenes) {
        const assetCache = new Set();
        try {
          const items = await fs.readdir(path.join(currentProjectRoot, 'public', 'assets'), { recursive: true });
          items.forEach(i => assetCache.add(i.replace(/\\/g, '/')));
        } catch (e) {}

        for (const [id, sceneData] of Object.entries(payload.scenes)) {
          if (!sceneData.nodes || sceneData.nodes.length === 0) continue;
          const nodeIds = new Set(sceneData.nodes.map(n => n.id));
          
          for (const node of sceneData.nodes) {
            if (node.next && !nodeIds.has(node.next)) warnings.push(`Scene '${id}': Node '${node.id}' missing 'next' -> '${node.next}'`);
            if (node.else && !nodeIds.has(node.else)) warnings.push(`Scene '${id}': Node '${node.id}' missing 'else' -> '${node.else}'`);
            if (node.choices) {
              for (const c of node.choices) {
                if (c.next && !nodeIds.has(c.next)) warnings.push(`Scene '${id}': Choice missing 'next' -> '${c.next}'`);
              }
            }
          }
          if (sceneData.layers) {
            for (const layer of sceneData.layers) {
              if (layer.asset && !assetCache.has(layer.asset)) warnings.push(`Scene '${id}': Layer missing asset '${layer.asset}'`);
            }
          }
        }
      }

      if (payload.scenes) {
        const existingScenes = await fs.readdir(scenesDir);
        for (const file of existingScenes) {
          if (file.endsWith('.json')) await fs.unlink(path.join(scenesDir, file));
        }
        for (const [id, sceneData] of Object.entries(payload.scenes)) {
          await fs.writeFile(path.join(scenesDir, `${id}.json`), JSON.stringify(sceneData, null, 2));
        }
      }

      if (payload.animations) {
        const existingAnims = await fs.readdir(animationsDir);
        for (const file of existingAnims) {
          if (file.endsWith('.json')) await fs.unlink(path.join(animationsDir, file));
        }
        for (const [id, animData] of Object.entries(payload.animations)) {
          await fs.writeFile(path.join(animationsDir, `${id}.json`), JSON.stringify(animData, null, 2));
        }
      }

      res.json({ success: true, warnings });
    } catch (err) {
      console.error('Error saving:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/project/new', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const payload = req.body;
      const dataDir = path.join(currentProjectRoot, 'data');
      const scenesDir = path.join(dataDir, 'scenes');
      const animationsDir = path.join(dataDir, 'animations');
      
      await fs.mkdir(scenesDir, { recursive: true });
      await fs.mkdir(animationsDir, { recursive: true });
      
      for (const file of ['game.json', 'characters.json', 'variables.json']) {
        try { await fs.unlink(path.join(dataDir, file)); } catch(e){}
      }
      try {
        const existingScenes = await fs.readdir(scenesDir);
        for (const file of existingScenes) {
          if (file.endsWith('.json')) await fs.unlink(path.join(scenesDir, file));
        }
      } catch(e){}
      try {
        const existingAnims = await fs.readdir(animationsDir);
        for (const file of existingAnims) {
          if (file.endsWith('.json')) await fs.unlink(path.join(animationsDir, file));
        }
      } catch(e){}

      if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
      if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
      if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/upload-asset', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const { targetDir, filename, base64 } = req.body;
      const assetsDir = path.join(currentProjectRoot, 'public', 'assets', targetDir || '');
      await fs.mkdir(assetsDir, { recursive: true });
      
      const base64Data = base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      await fs.writeFile(path.join(assetsDir, filename), buffer);
      const relPath = path.join(targetDir || '', filename).split(path.sep).join('/');
      res.json({ success: true, path: relPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/create-folder', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const { targetPath } = req.body;
      if (targetPath.includes('..')) throw new Error('Invalid path');
      const dirPath = path.join(currentProjectRoot, targetPath);
      await fs.mkdir(dirPath, { recursive: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/create-file', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const { targetPath, content } = req.body;
      if (targetPath.includes('..')) throw new Error('Invalid path');
      const filePath = path.join(currentProjectRoot, targetPath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content || '');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/delete-asset', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const { targetPath } = req.body;
      if (targetPath.includes('..')) throw new Error('Invalid path');
      const fullPath = path.join(currentProjectRoot, targetPath);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return new Promise((resolve) => {
    server = app.listen(port, '127.0.0.1', () => {
      console.log(`Embedded server running on http://127.0.0.1:${server.address().port}`);
      resolve(server.address().port);
    });
  });
}

export function stopServer() {
  if (server) server.close();
}
