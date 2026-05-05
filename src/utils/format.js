/**
 * 格式化工具函数
 * 从 bookStore.js 拆出
 */

/**
 * 格式化时间戳为友好文本
 * @param {number} timestamp
 * @returns {string}
 */
export function formatTime(timestamp) {
  if (!timestamp) return '未阅读'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'

  return date.toLocaleDateString('zh-CN')
}

/**
 * 获取书籍显示名（去除 .txt 后缀）
 * @param {string} fileName
 * @returns {string}
 */
export function getDisplayName(fileName) {
  return fileName.replace(/\.txt$/i, '')
}

/**
 * 封面颜色池
 */
export const COVER_COLORS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
]

/**
 * 根据文件路径计算封面样式
 * @param {string} filePath
 * @returns {{ background: string }}
 */
export function getCoverStyle(filePath) {
  const index = filePath.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const gradient = COVER_COLORS[index % COVER_COLORS.length]
  return { background: gradient }
}
