import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Resolve the NGE project's public/assets directory
const assetsDir = path.resolve(__dirname, '../../public/assets')

// Vite plugin: serve /api/assets listing
function assetListerPlugin() {
  return {
    name: 'asset-lister',
    configureServer(server) {
      server.middlewares.use('/api/assets', (req, res) => {
        const subdir = req.url?.split('?')[0]?.replace(/^\//, '') || '';
        const target = subdir ? path.join(assetsDir, subdir) : assetsDir;
        
        try {
          if (!fs.existsSync(target)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'not found' }));
            return;
          }

          const stats = fs.statSync(target);
          if (stats.isDirectory()) {
            const items = fs.readdirSync(target).map(name => {
              const fullPath = path.join(target, name);
              const stat = fs.statSync(fullPath);
              const ext = path.extname(name).toLowerCase();
              const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext);
              return {
                name,
                path: path.relative(assetsDir, fullPath),
                directory: stat.isDirectory(),
                type: isImage ? 'image' : stat.isDirectory() ? 'directory' : 'other',
                ext: isImage ? ext : null,
              };
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ directory: subdir || '/', items }));
          } else if (stats.isFile()) {
            // Return the file directly
            res.setHeader('Content-Type', {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
              '.bmp': 'image/bmp',
            }[path.extname(target).toLowerCase()] || 'application/octet-stream');
            fs.createReadStream(target).pipe(res);
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    assetListerPlugin()
  ],
})
