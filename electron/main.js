const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { buildChapterIndex } = require('./chapterParser')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 600,
    minHeight: 400,
    title: 'TXT 小说阅读器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ===== 公共：读文件并自动检测编码 =====
function readFileWithEncoding(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  let encoding = 'utf-8'

  const replacementCount = (content.match(/\ufffd/g) || []).length
  if (replacementCount > content.length * 0.05) {
    try {
      const iconv = require('iconv-lite')
      const rawBuffer = fs.readFileSync(filePath)
      content = iconv.decode(rawBuffer, 'gbk')
      encoding = 'gbk'
    } catch (e) { /* iconv-lite 不可用，保持 UTF-8 */ }
  }
  return { content, encoding }
}

// IPC: 打开文件选择对话框（只做文件选择 + 读取，不解析章节）
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
// 主进程负责：读文件、编码检测、建索引（耗时操作全在这里）
// 渲染进程负责：用 fullText.slice(start, end) 按需取当前章节文本，做 DOM 渲染
ipcMain.handle('open-book', async (_event, filePath) => {
  try {
    const { content: fullText, encoding } = readFileWithEncoding(filePath)
    const chapters = buildChapterIndex(fullText)  // 只有 title/start/end，无内容
    return {
      filePath,
      fileName: path.basename(filePath),
      encoding,
      fullText,          // 原始全文（渲染进程用 slice 按需读取）
      chapters,          // 轻量索引 [{title, start, end, index}]
      totalChapters: chapters.length
    }
  } catch (err) {
    return { error: err.message }
  }
})

app.whenReady().then(() => {
  if (process.argv.includes('--dev')) process.env.NODE_ENV = 'development'
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
