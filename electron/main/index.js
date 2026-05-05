const { app, BrowserWindow } = require('electron')
const path = require('path')
const { registerAllIpc } = require('./ipc')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 600,
    minHeight: 400,
    title: 'TXT 小说阅读器',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
  registerAllIpc(mainWindow)
}

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
