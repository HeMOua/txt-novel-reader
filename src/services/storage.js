/**
 * localStorage 存储服务
 * 从 bookStore.js 拆出的纯存储操作
 */

const BOOKS_KEY = 'txt-novel-reader-books'
const SETTINGS_KEY = 'txt-novel-reader-settings'

export function loadBooks() {
  try {
    const data = localStorage.getItem(BOOKS_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function saveBooksData(books) {
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books))
  } catch (e) {
    console.error('保存书籍数据失败:', e)
  }
}

export function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function saveSettingsData(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('保存设置失败:', e)
  }
}
