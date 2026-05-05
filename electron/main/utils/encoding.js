const fs = require('fs')

/**
 * 读文件并自动检测编码（UTF-8 / GBK）
 * @param {string} filePath
 * @returns {{ content: string, encoding: string }}
 */
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

module.exports = { readFileWithEncoding }
