const { registerFileIpc } = require('./fileHandler')

/**
 * 注册所有 IPC 处理器
 * @param {BrowserWindow} mainWindow
 */
function registerAllIpc(mainWindow) {
  registerFileIpc(mainWindow)
  // 后续可在此注册更多 IPC 处理器
}

module.exports = { registerAllIpc }
