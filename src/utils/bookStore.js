/**
 * 书籍本地存储模块
 * 使用 localStorage 持久化书籍信息和阅读进度
 */

const STORAGE_KEY = 'txt-novel-reader-books'
const SETTINGS_KEY = 'txt-novel-reader-settings'

// 默认全局设置
const DEFAULT_SETTINGS = {
  fontSize: 18,
  fontFamily: 'system',
  lineHeight: 1.8,
  paragraphSpacing: 12,
  topMargin: 24,
  bottomMargin: 24,
  leftMargin: 48,
  rightMargin: 48,
  theme: 'default',      // default, eye, night, custom
  nightMode: false,
  fontColor: '#2c2c2c',
  bgColor: '#f5f0e8',
  pageTurnMode: 'scroll', // scroll, slide
  autoReadSpeed: 30,      // 自动阅读速度（0~100）
  autoReadMode: 'scroll', // scroll, cover - 自动阅读方式
  contentWidth: 80,       // 正文区域宽度占窗口百分比 (40-100)
}

// 预设主题
export const THEMES = [
  { id: 'default', name: '默认', fontColor: '#2c2c2c', bgColor: '#f5f0e8' },
  { id: 'eye', name: '护眼', fontColor: '#3e4a3e', bgColor: '#c7edcc' },
  { id: 'parchment', name: '羊皮纸', fontColor: '#5b4636', bgColor: '#f1e7d0' },
  { id: 'blue', name: '淡蓝', fontColor: '#2c3e50', bgColor: '#d6eaf8' },
  { id: 'night', name: '夜间', fontColor: '#888', bgColor: '#1a1a1a' },
]

// 预设行间距
export const LINE_HEIGHT_PRESETS = [
  { id: 'compact', name: '紧凑', value: 1.4 },
  { id: 'normal', name: '适中', value: 1.8 },
  { id: 'loose', name: '宽松', value: 2.2 },
  { id: 'very-loose', name: '很宽', value: 2.6 },
]

// 可选字体
export const FONT_FAMILIES = [
  { id: 'system', name: '系统默认', value: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif' },
  { id: 'songti', name: '宋体', value: '"SimSun", "Songti SC", serif' },
  { id: 'heiti', name: '黑体', value: '"SimHei", "Heiti SC", sans-serif' },
  { id: 'kaiti', name: '楷体', value: '"KaiTi", "STKaiti", serif' },
  { id: 'fangsong', name: '仿宋', value: '"FangSong", "STFangsong", serif' },
]

// 排序方式
export const SORT_OPTIONS = [
  { id: 'lastRead', name: '最近阅读' },
  { id: 'addedTime', name: '添加时间' },
  { id: 'name', name: '书名' },
  { id: 'readProgress', name: '阅读进度' },
]

/**
 * 获取所有书籍
 */
export function getBooks() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * 保存所有书籍
 */
function saveBooks(books) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
  } catch (e) {
    console.error('保存书籍数据失败:', e)
  }
}

/**
 * 添加或更新一本书
 * 注意：content 字段不存入 localStorage（可能很大），仅保存在内存中
 */
export function saveBook(bookData) {
  const books = getBooks()
  const existing = books[bookData.filePath]
  const now = Date.now()

  // 分离大字段，不存入 localStorage
  const { content, fullText, chapters, ...meta } = bookData

  books[bookData.filePath] = {
    ...existing,
    ...meta,
    lastReadTime: now,
    addedTime: existing?.addedTime || now,
  }

  saveBooks(books)
  return books[bookData.filePath]
}

/**
 * 更新阅读进度（带节流，避免频繁写入）
 * @param {string} filePath
 * @param {number} chapterIndex - 当前章节索引
 * @param {number} scrollRatio - 章节内滚动比例 0~1
 * @param {number} progress - 全书阅读进度 0~100
 */
let progressTimer = null
const PENDING_PROGRESS = {}

export function updateProgress(filePath, chapterIndex, scrollRatio, progress) {
  PENDING_PROGRESS[filePath] = {
    currentChapterIndex: chapterIndex,
    currentScrollRatio: scrollRatio,  // 0~1 比例，恢复时换算
    progress,                          // 全书进度百分比
    lastReadTime: Date.now()
  }

  if (!progressTimer) {
    progressTimer = setTimeout(() => {
      flushProgress()
      progressTimer = null
    }, 2000)
  }
}

export function flushProgress() {
  const books = getBooks()
  for (const [filePath, data] of Object.entries(PENDING_PROGRESS)) {
    if (books[filePath]) {
      Object.assign(books[filePath], data)
    }
  }
  saveBooks(books)
  Object.keys(PENDING_PROGRESS).forEach(k => delete PENDING_PROGRESS[k])
}

/**
 * 删除一本书
 */
export function deleteBook(filePath) {
  const books = getBooks()
  delete books[filePath]
  saveBooks(books)
}

/**
 * 获取排序后的书籍列表
 */
export function getSortedBooks(sortBy = 'lastRead') {
  const books = getBooks()
  const list = Object.values(books)

  switch (sortBy) {
    case 'lastRead':
      return list.sort((a, b) => (b.lastReadTime || 0) - (a.lastReadTime || 0))
    case 'addedTime':
      return list.sort((a, b) => (b.addedTime || 0) - (a.addedTime || 0))
    case 'name':
      return list.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || '', 'zh-CN'))
    case 'readProgress':
      return list.sort((a, b) => (b.progress || 0) - (a.progress || 0))
    default:
      return list
  }
}

/**
 * 获取全局设置
 */
export function getSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * 保存全局设置
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('保存设置失败:', e)
  }
}

/**
 * 格式化时间
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
