const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  exportPDF: (data: any) => ipcRenderer.invoke('export-pdf', data),
  saveLayout: (data: any) => ipcRenderer.invoke('save-layout', data),
  loadLayout: () => ipcRenderer.invoke('load-layout'),
  packageLayout: (data: any) => ipcRenderer.invoke('package-layout', data)
})
