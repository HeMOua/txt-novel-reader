const { ipcMain, dialog } = require('electron')
const path = require('path')
const { readFileWithEncoding } = require('../utils/encoding')
const { buildChapterIndex } = require('../utils/chapterParser')

/**
 * 注册文件相关的 IPC 处理器
 * @param {BrowserWindow} mainWindow
 */
function registerFileIpc(mainWindow) {
  // 打开文件选择对话框（只做文件选择 + 读取，不解析章节）
  ipcMain.handle('open-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return []

    return result.filePaths.map(filePath => {
      try {
        const { content, encoding } = readFileWithEncoding(filePath)
        return { filePath, fileName: path.basename(filePath), content, encoding }
      } catch (err) {
        return { filePath, error: err.message }
      }
    })
  })

  // IPC: 核心入口 — 读文件 + 建章节索引
  ipcMain.handle('open-book', async (_event, filePath) => {
    try {
      const { content: fullText, encoding } = readFileWithEncoding(filePath)
      const chapters = buildChapterIndex(fullText)
      return {
        filePath,
        fileName: path.basename(filePath),
        encoding,
        fullText,
        chapters,
        totalChapters: chapters.length
      }
    } catch (err) {
      return { error: err.message }
    }
  })
}

module.exports = { registerFileIpc }
