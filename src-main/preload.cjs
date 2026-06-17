const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openFolderDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  exportWebBuild: () => ipcRenderer.invoke('project:exportWeb'),
  exportExeBuild: () => ipcRenderer.invoke('project:exportExe'),
  getRecentProjects: () => ipcRenderer.invoke('projects:getRecent'),
  addRecentProject: (project) => ipcRenderer.invoke('projects:addRecent', project),
  removeRecentProject: (projectPath) => ipcRenderer.invoke('projects:removeRecent', projectPath),
  setProjectRoot: (projectPath) => ipcRenderer.invoke('projects:setRoot', projectPath)
});
