import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { startServer, stopServer, setProjectRoot, getProjectRoot } from './server.js';
import { rcedit } from 'rcedit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.VITE_ELECTRON === 'true';
let mainWindow;
let serverPort;

const recentProjectsPath = path.join(app.getPath('userData'), 'recent-projects.json');

async function getRecentProjects() {
  try {
    const data = await fs.readFile(recentProjectsPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveRecentProjects(projects) {
  try {
    await fs.mkdir(path.dirname(recentProjectsPath), { recursive: true });
    await fs.writeFile(recentProjectsPath, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save recent projects:', err);
  }
}

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

  ipcMain.handle('projects:getRecent', async () => {
    return await getRecentProjects();
  });

  ipcMain.handle('projects:addRecent', async (event, { path: projectPath, name }) => {
    let projects = await getRecentProjects();
    projects = projects.filter(p => p.path !== projectPath);
    projects.unshift({
      path: projectPath,
      name,
      lastOpened: new Date().toISOString()
    });
    if (projects.length > 10) {
      projects = projects.slice(0, 10);
    }
    await saveRecentProjects(projects);
    return projects;
  });

  ipcMain.handle('projects:removeRecent', async (event, projectPath) => {
    let projects = await getRecentProjects();
    projects = projects.filter(p => p.path !== projectPath);
    await saveRecentProjects(projects);
    return projects;
  });

  ipcMain.handle('projects:setRoot', async (event, projectPath) => {
    try {
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) {
        return { success: false, error: 'not_directory' };
      }
    } catch (err) {
      return { success: false, error: 'not_found' };
    }
    setProjectRoot(projectPath);
    return { success: true };
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

      // 2. Copy Engine Files and inject icon
      let indexHtml = await fs.readFile(path.join(distPath, 'index.html'), 'utf-8');
      
      try {
        const gameJson = await fs.readFile(path.join(projectRoot, 'data', 'game.json'), 'utf-8');
        const gameData = JSON.parse(gameJson);
        if (gameData.icon) {
          const iconPath = gameData.icon.startsWith('/') ? gameData.icon : `/assets/${gameData.icon}`;
          indexHtml = indexHtml.replace('</head>', `  <link rel="icon" href="${iconPath}">\n</head>`);
        }
      } catch (e) {
        console.warn('Could not read project icon for web export', e);
      }
      
      await fs.writeFile(path.join(destDir, 'index.html'), indexHtml);
      
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
      await fs.cp(path.join(projectRoot, 'public', 'assets'), destAssetsPath, { recursive: true });

      return { success: true, path: destDir };
    } catch (err) {
      console.error('Export failed:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('project:exportExe', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Empty Folder for Windows EXE Export'
    });
    if (canceled) return { success: false };

    const destDir = filePaths[0];
    const projectRoot = getProjectRoot();
    if (!projectRoot) return { success: false, error: 'No active project' };

    try {
      if (isDev) {
        // When running via dev server, we can't export a packaged EXE easily.
        // We look for win-unpacked.
        const winUnpacked = path.join(app.getAppPath(), '..', 'release', 'win-unpacked');
        try {
          await fs.access(winUnpacked);
        } catch {
          return { success: false, error: 'Please build the engine first using npm run build:electron, or run the editor from the packaged engine to use EXE export.' };
        }
      }

      const sourceExeDir = isDev 
        ? path.join(app.getAppPath(), '..', 'release', 'win-unpacked')
        : path.dirname(process.execPath);

      // Copy the entire engine directory to the destination
      await fs.cp(sourceExeDir, destDir, { recursive: true });

      // Create game-data folder
      const gameDataPath = path.join(destDir, 'game-data');
      await fs.mkdir(gameDataPath, { recursive: true });

      // Copy project data and assets into game-data
      await fs.cp(path.join(projectRoot, 'data'), path.join(gameDataPath, 'data'), { recursive: true });
      await fs.cp(path.join(projectRoot, 'public', 'assets'), path.join(gameDataPath, 'public', 'assets'), { recursive: true });

      let gameTitle = 'MyGame';
      let iconPath = null;
      try {
        const gameJson = await fs.readFile(path.join(projectRoot, 'data', 'game.json'), 'utf-8');
        const gameData = JSON.parse(gameJson);
        if (gameData.title) gameTitle = gameData.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'MyGame';
        if (gameData.icon) {
          iconPath = path.join(projectRoot, 'public', 'assets', gameData.icon);
        }
      } catch (e) {}

      const oldExePath = path.join(destDir, 'Phaser NGE.exe');
      const newExePath = path.join(destDir, `${gameTitle}.exe`);
      
      try {
        await fs.access(oldExePath);
        await fs.rename(oldExePath, newExePath);
        
        // If an icon is specified and it's an .ico file, apply it
        // Note: rcedit requires an .ico file
        if (iconPath && iconPath.toLowerCase().endsWith('.ico')) {
          try {
            await rcedit(newExePath, {
              icon: iconPath,
              'version-string': {
                'FileDescription': gameTitle,
                'ProductName': gameTitle
              }
            });
          } catch (rceditErr) {
            console.warn('Could not set EXE icon using rcedit:', rceditErr);
          }
        } else if (iconPath) {
          console.warn('App Icon for EXE must be a .ico file. Provided:', iconPath);
        }
      } catch (e) {
        console.warn('Could not rename or patch EXE:', e);
      }

      return { success: true, path: destDir };
    } catch (err) {
      console.error('EXE Export failed:', err);
      return { success: false, error: err.message };
    }
  });

  const standaloneUrl = isDev
    ? `http://127.0.0.1:${serverPort}/`
    : `http://127.0.0.1:${serverPort}/`; // In production standalone, we want to load the game directly

  const devPort = process.env.PORT || 3000;
  const launcherUrl = isDev 
    ? `http://localhost:${devPort}/launcher/`
    : `http://127.0.0.1:${serverPort}/launcher/`;

  mainWindow.loadURL(process.env.STANDALONE_MODE === 'true' ? standaloneUrl : launcherUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Standalone mode detection
  const execDir = path.dirname(process.execPath);
  const standaloneGameDataPath = path.join(execDir, 'game-data');
  try {
    const stat = await fs.stat(standaloneGameDataPath);
    if (stat.isDirectory()) {
      process.env.STANDALONE_MODE = 'true';
      setProjectRoot(standaloneGameDataPath);
    }
  } catch (e) {}

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
