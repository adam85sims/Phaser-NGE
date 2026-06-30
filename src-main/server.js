import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleListAssets,
  handleSave,
  handleProjectNew,
  handleUploadAsset,
  handleCreateFolder,
  handleMoveAsset,
  handleCreateFile,
  handleDeleteAsset
} from '../tools/shared/api-handlers.js';
import { createWebExport } from '../tools/shared/export-web.js';

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

/**
 * Wraps a shared handler for Express: catches errors, formats JSON response.
 * Keeps Express-specific concerns (req/res) out of the shared handlers.
 */
function expressHandler(handler) {
  return async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      const payload = req.body;
      const result = await handler(currentProjectRoot, payload);
      res.json(result);
    } catch (err) {
      console.error(`[server] Error in ${req.path}:`, err);
      res.status(500).json({ error: err.message });
    }
  };
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

  // Web export — streams a ZIP of dist/ + data/ + assets/ for browser download
  app.get('/api/export-web', async (req, res) => {
    try {
      if (!currentProjectRoot) throw new Error('No project selected');
      await createWebExport(currentProjectRoot, res);
    } catch (err) {
      console.error('[server] Error in /api/export-web:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── API endpoints (delegated to shared handlers) ──

  app.get('/api/list-assets', expressHandler(async (projectRoot) => {
    return handleListAssets(projectRoot);
  }));

  app.post('/api/save', expressHandler(handleSave));
  app.post('/api/project/new', expressHandler(handleProjectNew));
  app.post('/api/upload-asset', expressHandler(handleUploadAsset));
  app.post('/api/create-folder', expressHandler(handleCreateFolder));
  app.post('/api/move-asset', expressHandler(handleMoveAsset));
  app.post('/api/create-file', expressHandler(handleCreateFile));
  app.post('/api/delete-asset', expressHandler(handleDeleteAsset));

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
