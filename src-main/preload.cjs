const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openFolderDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  exportWebBuild: () => ipcRenderer.invoke('project:exportWeb')
});
