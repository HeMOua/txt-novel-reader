const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFiles: () => ipcRenderer.invoke('open-files'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath)
})
