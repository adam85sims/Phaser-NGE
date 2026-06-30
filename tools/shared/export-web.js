// Browser-side web export: creates a ZIP of dist/, data/, and public/assets/
// for standalone deployment without Electron.
// Used by both the Vite plugin (editor-backend.js) and Express server (server.js).

import fs from 'fs/promises';
import path from 'path';
import { ZipArchive } from 'archiver';

/**
 * Creates a ZIP archive of the project for web deployment and pipes it to the response.
 * The ZIP contains:
 *   - dist/         (built engine)
 *   - data/         (story content: game.json, scenes, animations, characters, variables, theme)
 *   - assets/       (media: backgrounds, characters, audio, fonts)
 *   - index.html    (minimal launcher that loads the engine)
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {import('http').ServerResponse} res - HTTP response to stream the ZIP into
 */
export async function createWebExport(projectRoot, res) {
  // Verify dist/ exists — user must have run `npm run build` first
  const distDir = path.join(projectRoot, 'dist');
  try {
    await fs.access(distDir);
  } catch (e) {
    throw new Error('No dist/ folder found. Run "npm run build" first to create the production bundle.');
  }

  // Set response headers for ZIP download
  const title = await getProjectTitle(projectRoot);
  const safeName = (title || 'game').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-web-export.zip"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });

  // Forward archiver warnings/errors to console
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[export-web] Archiver warning:', err.message);
    } else {
      throw err;
    }
  });
  archive.on('error', (err) => { throw err; });

  // Pipe archive directly to the HTTP response
  archive.pipe(res);

  // Add built engine files (dist/)
  archive.directory(distDir, 'dist');

  // Add story data (data/)
  archive.directory(path.join(projectRoot, 'data'), 'data');

  // Add media assets (public/assets/ → assets/ in the ZIP)
  const assetsDir = path.join(projectRoot, 'public', 'assets');
  try {
    await fs.access(assetsDir);
    archive.directory(assetsDir, 'assets');
  } catch (e) {
    console.warn('[export-web] No public/assets/ directory found, skipping assets.');
  }

  // Add a minimal index.html that loads the engine
  const viewport = await getViewportSize(projectRoot);
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || 'Game')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="dist/main.js"></script>
</body>
</html>`;
  archive.append(indexHtml, { name: 'index.html' });

  // Finalize and stream
  await archive.finalize();
}

/**
 * Reads the project title from data/game.json, if it exists.
 */
async function getProjectTitle(projectRoot) {
  try {
    const raw = await fs.readFile(path.join(projectRoot, 'data', 'game.json'), 'utf-8');
    const game = JSON.parse(raw);
    return game.title || null;
  } catch (e) {
    return null;
  }
}

/**
 * Reads viewport dimensions from data/game.json.
 */
async function getViewportSize(projectRoot) {
  try {
    const raw = await fs.readFile(path.join(projectRoot, 'data', 'game.json'), 'utf-8');
    const game = JSON.parse(raw);
    return { width: game.width || 1280, height: game.height || 720 };
  } catch (e) {
    return { width: 1280, height: 720 };
  }
}

/**
 * Basic HTML entity escaping for safe embedding in the HTML template.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
