const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

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
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC: 打开文件选择对话框（支持多选）
ipcMain.handle('open-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return []
  }

  return result.filePaths.map(filePath => {
    try {
      let content = fs.readFileSync(filePath, 'utf-8')
      let encoding = 'utf-8'

      // 检测乱码，如果超过 5% 的替换字符则尝试 GBK
      const replacementCount = (content.match(/\ufffd/g) || []).length
      if (replacementCount > content.length * 0.05) {
        try {
          const iconv = require('iconv-lite')
          const rawBuffer = fs.readFileSync(filePath)
          content = iconv.decode(rawBuffer, 'gbk')
          encoding = 'gbk'
        } catch (e) {
          // iconv-lite 不可用，保持 UTF-8
        }
      }

      return {
        filePath,
        fileName: path.basename(filePath),
        content,
        encoding
      }
    } catch (err) {
      return { filePath, error: err.message }
    }
  })
})

// IPC: 读取单个文件
ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    let encoding = 'utf-8'

    const replacementCount = (content.match(/\ufffd/g) || []).length
    if (replacementCount > content.length * 0.05) {
      try {
        const iconv = require('iconv-lite')
        const rawBuffer = fs.readFileSync(filePath)
        content = iconv.decode(rawBuffer, 'gbk')
        encoding = 'gbk'
      } catch (e) {
        // iconv-lite 不可用
      }
    }

    return {
      filePath,
      fileName: path.basename(filePath),
      content,
      encoding
    }
  } catch (err) {
    return { error: err.message }
  }
})

app.whenReady().then(() => {
  if (process.argv.includes('--dev')) {
    process.env.NODE_ENV = 'development'
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
