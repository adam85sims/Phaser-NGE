import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { startServer, stopServer, setProjectRoot, getProjectRoot } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.VITE_ELECTRON === 'true';
let mainWindow;
let serverPort;

async function createWindow() {
  // In dev, use port 3001 for embedded server. In prod, use random port.
  serverPort = await startServer(isDev ? 3001 : 0, isDev);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Phaser NGE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Expose IPC handlers
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    });
    if (canceled) {
      return null;
    } else {
      const selectedPath = filePaths[0];
      setProjectRoot(selectedPath);
      return selectedPath;
    }
  });

  ipcMain.handle('project:exportWeb', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Empty Folder for HTML5 Export'
    });
    if (canceled) return { success: false };

    const destDir = filePaths[0];
    const projectRoot = getProjectRoot();
    if (!projectRoot) return { success: false, error: 'No active project' };

    try {
      // 1. Locate Engine Dist
      const distPath = isDev 
        ? path.join(__dirname, '../dist')
        : path.join(app.getAppPath(), 'dist');

      // 2. Copy Engine Files
      await fs.copyFile(path.join(distPath, 'index.html'), path.join(destDir, 'index.html'));
      
      const destAssetsPath = path.join(destDir, 'assets');
      await fs.mkdir(destAssetsPath, { recursive: true });
      
      const engineAssets = await fs.readdir(path.join(distPath, 'assets'));
      for (const file of engineAssets) {
        await fs.copyFile(
          path.join(distPath, 'assets', file),
          path.join(destAssetsPath, file)
        );
      }

      // 3. Copy Project Data
      const destDataPath = path.join(destDir, 'data');
      await fs.cp(path.join(projectRoot, 'data'), destDataPath, { recursive: true });

      // 4. Copy Project Assets (merging into the same assets folder)
      await fs.cp(path.join(projectRoot, 'assets'), destAssetsPath, { recursive: true });

      return { success: true, path: destDir };
    } catch (err) {
      console.error('Export failed:', err);
      return { success: false, error: err.message };
    }
  });

  const launcherUrl = isDev 
    ? 'http://localhost:3000/launcher/'
    : `http://127.0.0.1:${serverPort}/launcher/`;

  mainWindow.loadURL(launcherUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
