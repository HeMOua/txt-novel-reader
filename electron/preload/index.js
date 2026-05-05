const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 打开文件选择框（只用于批量添加到书架，不进入阅读器）
  openFiles: () => ipcRenderer.invoke('open-files'),
  // 核心：打开一本书 = 读文件 + 建章节索引，返回 {fullText, chapters, ...}
  openBook: (filePath) => ipcRenderer.invoke('open-book', filePath),
})
