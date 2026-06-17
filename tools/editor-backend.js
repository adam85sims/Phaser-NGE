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
              const animationsDir = path.join(dataDir, 'animations');

              // Ensure directories exist
              await fs.mkdir(dataDir, { recursive: true });
              await fs.mkdir(scenesDir, { recursive: true });
              await fs.mkdir(animationsDir, { recursive: true });

              // Auto-compile gallery list
              try {
                const galleryDir = path.join(projectRoot, 'public', 'assets', 'gallery');
                await fs.mkdir(galleryDir, { recursive: true });
                const galleryItems = await fs.readdir(galleryDir);
                if (payload.game) {
                  payload.game.gallery = galleryItems
                    .filter(i => /\.(png|jpg|jpeg|webp)$/i.test(i))
                    .map(i => i.replace(/\.[^.]+$/, ''));
                }
              } catch (e) {}

              // Write main project files
              if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
              if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
              if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));
              if (payload.theme) await fs.writeFile(path.join(dataDir, 'theme.json'), JSON.stringify(payload.theme, null, 2));

              // Validate the scenes before writing
              const warnings = [];
              if (payload.scenes) {
                const assetCache = new Set();
                try {
                  const items = await fs.readdir(path.join(projectRoot, 'public', 'assets'), { recursive: true });
                  items.forEach(i => assetCache.add(i.replace(/\\\\/g, '/')));
                } catch (e) {}

                for (const [id, sceneData] of Object.entries(payload.scenes)) {
                  if (!sceneData.nodes || sceneData.nodes.length === 0) continue;
                  
                  // Collect all node IDs
                  const nodeIds = new Set(sceneData.nodes.map(n => n.id));
                  
                  // Check orphaned nodes (BFS from entryNode)
                  const visited = new Set();
                  const queue = [sceneData.entryNode];
                  while (queue.length > 0) {
                    const currentId = queue.shift();
                    if (!currentId) continue;
                    if (visited.has(currentId)) continue;
                    visited.add(currentId);
                    
                    const node = sceneData.nodes.find(n => n.id === currentId);
                    if (!node) continue;
                    
                    if (node.next && !visited.has(node.next)) queue.push(node.next);
                    if (node.else && !visited.has(node.else)) queue.push(node.else);
                    if (node.choices) {
                      for (const c of node.choices) {
                        if (c.next && !visited.has(c.next)) queue.push(c.next);
                      }
                    }
                  }
                  
                  // Find orphaned nodes (optional warning, maybe too noisy for editing)
                  // but missing references are important:
                  for (const node of sceneData.nodes) {
                    if (node.next && !nodeIds.has(node.next)) {
                      warnings.push(`Scene '${id}': Node '${node.id}' has missing 'next' pointer -> '${node.next}'`);
                    }
                    if (node.else && !nodeIds.has(node.else)) {
                      warnings.push(`Scene '${id}': Node '${node.id}' has missing 'else' pointer -> '${node.else}'`);
                    }
                    if (node.choices) {
                      for (const c of node.choices) {
                        if (c.next && !nodeIds.has(c.next)) {
                          warnings.push(`Scene '${id}': Choice in node '${node.id}' has missing 'next' pointer -> '${c.next}'`);
                        }
                      }
                    }
                  }
                  
                  // Check missing assets in layers
                  if (sceneData.layers) {
                    for (const layer of sceneData.layers) {
                      if (layer.asset && !assetCache.has(layer.asset)) {
                         warnings.push(`Scene '${id}': Layer references missing asset '${layer.asset}'`);
                      }
                    }
                  }
                }
              }

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

              // Write animations
              if (payload.animations) {
                // Clear existing animations first to handle deletions
                const existingAnims = await fs.readdir(animationsDir);
                for (const file of existingAnims) {
                  if (file.endsWith('.json')) {
                    await fs.unlink(path.join(animationsDir, file));
                  }
                }

                // Write new animations
                for (const [id, animData] of Object.entries(payload.animations)) {
                  await fs.writeFile(path.join(animationsDir, `${id}.json`), JSON.stringify(animData, null, 2));
                }
              }

              res.end(JSON.stringify({ success: true, warnings }));
            } catch (err) {
              console.error('Error saving project:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/project/new') {
            try {
              const dataDir = path.join(projectRoot, 'data');
              const scenesDir = path.join(dataDir, 'scenes');
              const animationsDir = path.join(dataDir, 'animations');
              
              await fs.mkdir(scenesDir, { recursive: true });
              await fs.mkdir(animationsDir, { recursive: true });
              
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

              try {
                const existingAnims = await fs.readdir(animationsDir);
                for (const file of existingAnims) {
                  if (file.endsWith('.json')) await fs.unlink(path.join(animationsDir, file));
                }
              } catch (e) {}

              // Auto-compile gallery list
              try {
                const galleryDir = path.join(projectRoot, 'public', 'assets', 'gallery');
                await fs.mkdir(galleryDir, { recursive: true });
                const galleryItems = await fs.readdir(galleryDir);
                if (payload.game) {
                  payload.game.gallery = galleryItems
                    .filter(i => /\.(png|jpg|jpeg|webp)$/i.test(i))
                    .map(i => i.replace(/\.[^.]+$/, ''));
                }
              } catch (e) {}

              // Write new template
              if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
              if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
              if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));
              if (payload.theme) await fs.writeFile(path.join(dataDir, 'theme.json'), JSON.stringify(payload.theme, null, 2));

              if (payload.scenes) {
                for (const [id, sceneData] of Object.entries(payload.scenes)) {
                  await fs.writeFile(path.join(scenesDir, `${id}.json`), JSON.stringify(sceneData, null, 2));
                }
              }

              if (payload.animations) {
                for (const [id, animData] of Object.entries(payload.animations)) {
                  await fs.writeFile(path.join(animationsDir, `${id}.json`), JSON.stringify(animData, null, 2));
                }
              }

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
              const { targetPath } = payload; // path relative to project root
              
              // Basic security check to prevent escaping project root
              if (targetPath.includes('..')) throw new Error('Invalid path');
              
              const dirPath = path.join(projectRoot, targetPath);
              await fs.mkdir(dirPath, { recursive: true });
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/move-asset') {
            try {
              const { sourcePath, targetPath } = payload;
              if (sourcePath.includes('..') || targetPath.includes('..')) throw new Error('Invalid path');
              
              const fullSource = path.join(projectRoot, sourcePath);
              const fullTarget = path.join(projectRoot, targetPath);
              
              // Ensure target directory exists
              await fs.mkdir(path.dirname(fullTarget), { recursive: true });
              await fs.rename(fullSource, fullTarget);
              
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/create-file') {
            try {
              const { targetPath, content } = payload;
              if (targetPath.includes('..')) throw new Error('Invalid path');
              
              const filePath = path.join(projectRoot, targetPath);
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, content || '');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          } else if (req.url === '/api/delete-asset') {
            try {
              const { targetPath } = payload;
              if (targetPath.includes('..')) throw new Error('Invalid path');
              
              const fullPath = path.join(projectRoot, targetPath);
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
