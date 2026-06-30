import {
  handleListAssets,
  handleSave,
  handleProjectNew,
  handleUploadAsset,
  handleCreateFolder,
  handleMoveAsset,
  handleCreateFile,
  handleDeleteAsset
} from './shared/api-handlers.js';
import { createWebExport } from './shared/export-web.js';

/**
 * Vite plugin that provides /api/* endpoints for the editor.
 * Delegates to shared api-handlers.js for the actual logic.
 * When running without Electron, this plugin is loaded in vite.config.js.
 * When running with Electron, the Express server (src-main/server.js) handles APIs instead.
 */
export default function editorBackend(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();

  return {
    name: 'editor-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        res.setHeader('Content-Type', 'application/json');

        try {
          // ── GET endpoints ──
          if (req.method === 'GET') {
            if (req.url === '/api/list-assets') {
              const result = await handleListAssets(projectRoot);
              res.end(JSON.stringify(result));
              return;
            }

            if (req.url === '/api/export-web') {
              await createWebExport(projectRoot, res);
              // createWebExport pipes directly to res, so we're done
              return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }

          // ── POST endpoints ──
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

            let result;
            switch (req.url) {
              case '/api/save':
                result = await handleSave(projectRoot, payload);
                break;
              case '/api/project/new':
                result = await handleProjectNew(projectRoot, payload);
                break;
              case '/api/upload-asset':
                result = await handleUploadAsset(projectRoot, payload);
                break;
              case '/api/create-folder':
                result = await handleCreateFolder(projectRoot, payload);
                break;
              case '/api/move-asset':
                result = await handleMoveAsset(projectRoot, payload);
                break;
              case '/api/create-file':
                result = await handleCreateFile(projectRoot, payload);
                break;
              case '/api/delete-asset':
                result = await handleDeleteAsset(projectRoot, payload);
                break;
              default:
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
            }

            res.end(JSON.stringify(result));
            return;
          }

          // No matching method
          next();
        } catch (err) {
          console.error(`[editor-backend] Error handling ${req.url}:`, err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}
