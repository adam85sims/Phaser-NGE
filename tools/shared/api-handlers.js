// Shared API handler logic used by both the Vite plugin (editor-backend.js)
// and the Express server (src-main/server.js).
// Each handler takes (projectRoot, payload|params) and returns a result object.
// Errors are thrown; callers handle HTTP response formatting.

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/**
 * GET /api/list-assets
 * Scans public/assets/ recursively, returns flat list of files + directories.
 * Creates standard subdirs (backgrounds, characters, audio/bgm, audio/sfx) if missing.
 */
export async function handleListAssets(projectRoot) {
  const baseDir = path.join(projectRoot, 'public', 'assets');

  // Ensure standard asset directories exist
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
            results.push({
              name: item.name,
              path: relPath,
              type: 'file',
              size: stat.size,
              modified: stat.mtime.toISOString()
            });
          }
        }
      }
    } catch (e) {
      // ignore missing dirs
    }
    return results;
  }

  return scanDirRecursive(baseDir);
}

/**
 * POST /api/save
 * Saves full project state: game.json, characters.json, variables.json, theme.json,
 * all scenes (clear-then-write), all animations (clear-then-write).
 * Auto-compiles gallery list from public/assets/gallery/.
 * Validates scenes for missing node references and missing assets.
 * Returns { success: true, warnings: string[] }.
 */
export async function handleSave(projectRoot, payload) {
  const dataDir = path.join(projectRoot, 'data');
  const scenesDir = path.join(dataDir, 'scenes');
  const animationsDir = path.join(dataDir, 'animations');

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(animationsDir, { recursive: true });

  // Auto-compile gallery list from gallery directory
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

  // Write main data files
  if (payload.game) await fs.writeFile(path.join(dataDir, 'game.json'), JSON.stringify(payload.game, null, 2));
  if (payload.characters) await fs.writeFile(path.join(dataDir, 'characters.json'), JSON.stringify(payload.characters, null, 2));
  if (payload.variables) await fs.writeFile(path.join(dataDir, 'variables.json'), JSON.stringify(payload.variables, null, 2));
  if (payload.theme) await fs.writeFile(path.join(dataDir, 'theme.json'), JSON.stringify(payload.theme, null, 2));

  // Validate scenes for missing references and assets
  const warnings = [];
  if (payload.scenes) {
    const assetCache = new Set();
    try {
      const items = await fs.readdir(path.join(projectRoot, 'public', 'assets'), { recursive: true });
      items.forEach(i => assetCache.add(i.replace(/\\/g, '/')));
    } catch (e) {}

    for (const [id, sceneData] of Object.entries(payload.scenes)) {
      if (!sceneData.nodes || sceneData.nodes.length === 0) continue;

      const nodeIds = new Set(sceneData.nodes.map(n => n.id));

      // BFS orphan detection from entryNode
      const visited = new Set();
      const queue = [sceneData.entryNode];
      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId || visited.has(currentId)) continue;
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

      // Check for missing references (dangling pointers)
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

      // Check for missing assets in layers
      if (sceneData.layers) {
        for (const layer of sceneData.layers) {
          if (layer.asset && !assetCache.has(layer.asset)) {
            warnings.push(`Scene '${id}': Layer references missing asset '${layer.asset}'`);
          }
        }
      }
    }
  }

  // Write scenes (clear first to handle deletions)
  if (payload.scenes) {
    const existingScenes = await fs.readdir(scenesDir);
    for (const file of existingScenes) {
      if (file.endsWith('.json')) await fs.unlink(path.join(scenesDir, file));
    }
    for (const [id, sceneData] of Object.entries(payload.scenes)) {
      await fs.writeFile(path.join(scenesDir, `${id}.json`), JSON.stringify(sceneData, null, 2));
    }
  }

  // Write animations (clear first to handle deletions)
  if (payload.animations) {
    const existingAnims = await fs.readdir(animationsDir);
    for (const file of existingAnims) {
      if (file.endsWith('.json')) await fs.unlink(path.join(animationsDir, file));
    }
    for (const [id, animData] of Object.entries(payload.animations)) {
      await fs.writeFile(path.join(animationsDir, `${id}.json`), JSON.stringify(animData, null, 2));
    }
  }

  return { success: true, warnings };
}

/**
 * POST /api/project/new
 * Creates a fresh project from a template payload. Clears all existing data first.
 */
export async function handleProjectNew(projectRoot, payload) {
  const dataDir = path.join(projectRoot, 'data');
  const scenesDir = path.join(dataDir, 'scenes');
  const animationsDir = path.join(dataDir, 'animations');

  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(animationsDir, { recursive: true });

  // Clear existing project data
  for (const file of ['game.json', 'characters.json', 'variables.json']) {
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

  // Write template data
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

  return { success: true };
}

/**
 * POST /api/upload-asset
 * Uploads a base64-encoded file to public/assets/<targetDir>/.
 */
export async function handleUploadAsset(projectRoot, { targetDir, filename, base64 }) {
  const assetsDir = path.join(projectRoot, 'public', 'assets', targetDir || '');
  await fs.mkdir(assetsDir, { recursive: true });

  // Strip data-URI prefix if present
  const base64Data = base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  await fs.writeFile(path.join(assetsDir, filename), buffer);
  const relPath = path.join(targetDir || '', filename).split(path.sep).join('/');
  return { success: true, path: relPath };
}

/**
 * POST /api/create-folder
 * Creates a directory relative to project root. Rejects paths with '..'.
 */
export async function handleCreateFolder(projectRoot, { targetPath }) {
  if (targetPath.includes('..')) throw new Error('Invalid path');
  const dirPath = path.join(projectRoot, targetPath);
  await fs.mkdir(dirPath, { recursive: true });
  return { success: true };
}

/**
 * POST /api/move-asset
 * Moves/renames a file or directory within the project. Rejects paths with '..'.
 */
export async function handleMoveAsset(projectRoot, { sourcePath, targetPath }) {
  if (sourcePath.includes('..') || targetPath.includes('..')) throw new Error('Invalid path');
  const fullSource = path.join(projectRoot, sourcePath);
  const fullTarget = path.join(projectRoot, targetPath);
  await fs.mkdir(path.dirname(fullTarget), { recursive: true });
  await fs.rename(fullSource, fullTarget);
  return { success: true };
}

/**
 * POST /api/create-file
 * Creates a file with optional content at a path relative to project root.
 */
export async function handleCreateFile(projectRoot, { targetPath, content }) {
  if (targetPath.includes('..')) throw new Error('Invalid path');
  const filePath = path.join(projectRoot, targetPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content || '');
  return { success: true };
}

/**
 * POST /api/delete-asset
 * Deletes a file or directory (recursive) at a path relative to project root.
 */
export async function handleDeleteAsset(projectRoot, { targetPath }) {
  if (targetPath.includes('..')) throw new Error('Invalid path');
  const fullPath = path.join(projectRoot, targetPath);
  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true, force: true });
  } else {
    await fs.unlink(fullPath);
  }
  return { success: true };
}
