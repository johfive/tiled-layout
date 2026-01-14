const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  exportPDF: (data) => ipcRenderer.invoke('export-pdf', data),
  saveLayout: (data) => ipcRenderer.invoke('save-layout', data),
  loadLayout: () => ipcRenderer.invoke('load-layout'),
  loadLayoutFromPath: (filePath) => ipcRenderer.invoke('load-layout-from-path', filePath),
  packageLayout: (data) => ipcRenderer.invoke('package-layout', data),
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file', (_event, filePath) => callback(filePath))
  }
})
