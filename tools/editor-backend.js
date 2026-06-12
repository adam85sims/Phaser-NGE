import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export default function editorBackend(options = {}) {
  // For future launcher support, projectRoot defaults to cwd but can be overridden
  const projectRoot = options.projectRoot || process.cwd();
  
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
              const baseDir = path.join(projectRoot, 'public', 'assets');
              
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
              const dataDir = path.join(projectRoot, 'data');
              const scenesDir = path.join(dataDir, 'scenes');

              // Ensure directories exist
              await fs.mkdir(dataDir, { recursive: true });
              await fs.mkdir(scenesDir, { recursive: true });

              // Write main project files
              if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
              if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
              if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));
              if (payload.theme) await fs.writeFile(path.join(dataDir, 'theme.json'), JSON.stringify(payload.theme, null, 2));

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
              const dataDir = path.join(projectRoot, 'data');
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
              const { targetDir, filename, base64 } = payload;
              
              const assetsDir = path.join(projectRoot, 'public', 'assets', targetDir || '');
              await fs.mkdir(assetsDir, { recursive: true });
              
              // Decode base64
              const base64Data = base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              
              await fs.writeFile(path.join(assetsDir, filename), buffer);
              
              const relPath = path.join(targetDir || '', filename).split(path.sep).join('/');
              res.end(JSON.stringify({ success: true, path: relPath }));
            } catch (err) {
              console.error('Error uploading asset:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/create-folder') {
            try {
              const { targetDir } = payload;
              const dirPath = path.join(projectRoot, 'public', 'assets', targetDir);
              await fs.mkdir(dirPath, { recursive: true });
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/delete-asset') {
            try {
              const { targetPath } = payload;
              const fullPath = path.join(projectRoot, 'public', 'assets', targetPath);
              const stat = await fs.stat(fullPath);
              if (stat.isDirectory()) {
                await fs.rm(fullPath, { recursive: true, force: true });
              } else {
                await fs.unlink(fullPath);
              }
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
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
