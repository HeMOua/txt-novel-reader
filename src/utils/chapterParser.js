/**
 * TXT 小说章节解析器
 * 支持多种章节格式匹配，提取章节名和内容
 */

// 章节匹配正则列表，按优先级排序
const CHAPTER_PATTERNS = [
  // 第X章 章节名
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}章\s*.+/,
  // 第X回 章节名
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}回\s*.+/,
  // 第X节 章节名
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}节\s*.+/,
  // 第X卷 章节名
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}卷\s*.+/,
  // 卷X 章节名
  /^[\s]*卷[零一二三四五六七八九十百千万〇０-９0-9]{1,7}\s*.+/,
  // Chapter X: title / Chapter X title
  /^[\s]*[Cc]hapter\s+\d+[\s:：]*.{1,50}/,
  // 数字编号章节：如 "1 章节名" 或 "1. 章节名" 或 "1、章节名"
  /^[\s]*\d{1,5}[\s.、．]\s*.{2,40}$/,
  // 【章节名】
  /^[\s]*【.{1,40}】[\s]*$/,
  // ［章节名］
  /^[\s]*［.{1,40}］[\s]*$/,
]

/**
 * 解析文本内容为章节列表
 * @param {string} content - 文本内容
 * @returns {Array<{title: string, content: string, index: number}>} 章节列表
 */
export function parseChapters(content) {
  const lines = content.split('\n')
  const chapters = []
  let currentChapter = null
  let matchedPatternIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // 跳过空行检测
    if (trimmedLine === '') {
      if (currentChapter) {
        currentChapter.content += '\n'
      }
      continue
    }

    // 尝试匹配章节标题
    let isChapterTitle = false
    let matchedTitle = trimmedLine

    // 只有当行长度合理时才尝试匹配（章节标题通常不会太长）
    if (trimmedLine.length <= 60) {
      for (let p = 0; p < CHAPTER_PATTERNS.length; p++) {
        if (CHAPTER_PATTERNS[p].test(trimmedLine)) {
          isChapterTitle = true
          // 记录首次匹配到的模式，后续优先使用同一模式
          if (matchedPatternIndex === -1) {
            matchedPatternIndex = p
          }
          break
        }
      }

      // 如果已经匹配过某种模式，优先使用同模式匹配
      if (!isChapterTitle && matchedPatternIndex >= 0) {
        if (CHAPTER_PATTERNS[matchedPatternIndex].test(trimmedLine)) {
          isChapterTitle = true
        }
      }
    }

    if (isChapterTitle) {
      // 保存上一章
      if (currentChapter) {
        currentChapter.content = currentChapter.content.trim()
        chapters.push(currentChapter)
      }
      // 开始新章节
      currentChapter = {
        title: cleanTitle(matchedTitle),
        content: '',
        index: chapters.length
      }
    } else {
      if (currentChapter) {
        currentChapter.content += line + '\n'
      }
      // 如果还没遇到第一个章节标题，归入"前言"
    }
  }

  // 保存最后一章
  if (currentChapter) {
    currentChapter.content = currentChapter.content.trim()
    chapters.push(currentChapter)
  }

  // 如果没检测到章节，整篇作为一章
  if (chapters.length === 0) {
    chapters.push({
      title: '全文',
      content: content.trim(),
      index: 0
    })
  }

  // 检查是否有前言部分（第一个章节标题之前的内容）
  const firstChapterStart = findFirstChapterLine(lines)
  if (firstChapterStart > 0) {
    const preface = lines.slice(0, firstChapterStart).join('\n').trim()
    if (preface) {
      chapters.unshift({
        title: '前言',
        content: preface,
        index: 0
      })
      // 重新编号
      chapters.forEach((ch, i) => { ch.index = i })
    }
  }

  return chapters
}

/**
 * 找到第一个章节标题所在行号
 */
function findFirstChapterLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.length > 60) continue
    for (const pattern of CHAPTER_PATTERNS) {
      if (pattern.test(trimmed)) {
        return i
      }
    }
  }
  return -1
}

/**
 * 清理章节标题
 */
function cleanTitle(title) {
  return title
    .replace(/^[\s]+/, '')
    .replace(/[\s]+$/, '')
    .replace(/^【|】$/g, '')
    .replace(/^［|］$/g, '')
}

/**
 * 根据滚动位置计算当前章节索引
 * @param {Array} chapters - 章节列表
 * @param {number} scrollTop - 当前滚动位置
 * @param {number} scrollHeight - 总滚动高度
 * @returns {number} 当前章节索引
 */
export function getCurrentChapterByProgress(chapters, scrollTop, scrollHeight) {
  if (!chapters.length || scrollHeight <= 0) return 0
  const progress = scrollTop / scrollHeight
  const index = Math.floor(progress * chapters.length)
  return Math.min(index, chapters.length - 1)
}

/**
 * 计算阅读进度百分比
 * @param {number} currentChapter - 当前章节索引（从0开始）
 * @param {number} totalChapters - 总章节数
 * @param {number} chapterProgress - 章节内进度 0-1
 * @returns {number} 总进度百分比 0-100
 */
export function calcProgress(currentChapter, totalChapters, chapterProgress) {
  if (totalChapters <= 0) return 0
  const chapterWeight = 1 / totalChapters
  return Math.min(100, ((currentChapter + (chapterProgress || 0)) * chapterWeight) * 100)
}
