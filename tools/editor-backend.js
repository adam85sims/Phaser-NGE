import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export default function editorBackend() {
  return {
    name: 'editor-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        res.setHeader('Content-Type', 'application/json');

        // GET endpoints
        if (req.method === 'GET') {
          if (req.url === '/api/list-assets') {
            try {
              const baseDir = path.resolve('public', 'assets');
              const result = {};

              const dirs = {
                backgrounds: 'backgrounds',
                portraits: 'characters',
                music: 'audio/bgm',
                sfx: 'audio/sfx',
                fonts: 'fonts'
              };

              for (const [key, dirName] of Object.entries(dirs)) {
                const dirPath = path.join(baseDir, dirName);
                console.log('[list-assets] scanning:', dirPath);
                try {
                  const files = await fs.readdir(dirPath);
                  console.log('[list-assets]', key, 'found:', files);
                  const validExts = /\.(png|jpg|jpeg|gif|webp|mp3|ogg|wav|ttf|otf|woff2?)$/i;
                  result[key] = files.filter(f => validExts.test(f)).map(f => {
                    const stat = fsSync.statSync(path.join(dirPath, f));
                    return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
                  }).sort((a, b) => a.name.localeCompare(b.name));
                } catch (e) {
                  console.log('[list-assets]', key, 'error:', e.message);
                  result[key] = [];
                }
              }

              res.end(JSON.stringify(result));
            } catch (err) {
              console.error('Error listing assets:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
          // No matching GET endpoint
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        // POST endpoints
        if (req.method === 'POST') {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }
          let payload;
          try {
            payload = JSON.parse(body);
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');

          if (req.url === '/api/save') {
            try {
              const dataDir = path.resolve('data');
              const scenesDir = path.join(dataDir, 'scenes');

              // Ensure directories exist
              await fs.mkdir(dataDir, { recursive: true });
              await fs.mkdir(scenesDir, { recursive: true });

              // Write main project files
              if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
              if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
              if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));

              // Write scenes
              if (payload.scenes) {
                // Clear existing scenes first to handle deletions
                const existingScenes = await fs.readdir(scenesDir);
                for (const file of existingScenes) {
                  if (file.endsWith('.json')) {
                    await fs.unlink(path.join(scenesDir, file));
                  }
                }

                // Write new scenes
                for (const [id, sceneData] of Object.entries(payload.scenes)) {
                  await fs.writeFile(path.join(scenesDir, `${id}.json`), JSON.stringify(sceneData, null, 2));
                }
              }

              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Error saving project:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/project/new') {
            try {
              const dataDir = path.resolve('data');
              const scenesDir = path.join(dataDir, 'scenes');
              
              await fs.mkdir(scenesDir, { recursive: true });
              
              // Clear current project
              const dataFiles = ['game.json', 'characters.json', 'variables.json'];
              for (const file of dataFiles) {
                try { await fs.unlink(path.join(dataDir, file)); } catch (e) {}
              }
              
              try {
                const existingScenes = await fs.readdir(scenesDir);
                for (const file of existingScenes) {
                  if (file.endsWith('.json')) await fs.unlink(path.join(scenesDir, file));
                }
              } catch (e) {}

              // Write new template
              if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
              if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
              if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));

              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Error creating new project:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/upload-asset') {
            try {
              const { category, filename, base64 } = payload;
              
              // Map category to directory path
              const categoryToDir = {
                'backgrounds': 'backgrounds',
                'portraits': 'characters',
                'bgm': 'audio/bgm',
                'sfx': 'audio/sfx',
                'fonts': 'fonts',
                'bg': 'backgrounds',  // legacy support
              };
              
              const subDir = categoryToDir[category] || category;
              const assetsDir = path.resolve('public', 'assets', subDir);
              await fs.mkdir(assetsDir, { recursive: true });
              
              // Decode base64
              const base64Data = base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              
              await fs.writeFile(path.join(assetsDir, filename), buffer);
              
              res.end(JSON.stringify({ success: true, path: `/assets/${subDir}/${filename}` }));
            } catch (err) {
              console.error('Error uploading asset:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
          }
          return;
        }

        // No matching method
        next();
      });
    }
  };
}
