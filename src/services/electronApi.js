/**
 * Electron API 服务层
 * 封装所有 window.electronAPI 调用，composables 不直接访问 window.electronAPI
 */

/**
 * 打开文件选择对话框
 * @returns {Promise<Array<{filePath, fileName, content, encoding} | {error: string}>>}
 */
export async function openFiles() {
  if (!window.electronAPI) {
    throw new Error('Electron API 不可用，请确保在 Electron 环境中运行')
  }
  return window.electronAPI.openFiles()
}

/**
 * 打开一本书：读文件 + 建章节索引
 * @param {string} filePath
 * @returns {Promise<{filePath, fileName, encoding, fullText, chapters, totalChapters}>}
 */
export async function openBook(filePath) {
  if (!window.electronAPI) {
    throw new Error('Electron API 不可用')
  }
  const result = await window.electronAPI.openBook(filePath)
  if (result.error) {
    throw new Error(result.error)
  }
  return result
}
