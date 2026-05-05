/**
 * TXT 小说章节索引构建器
 *
 * 核心设计：只记录章节在原始文本中的 start/end 字节偏移
 * 不存储任何章节内容字符串，避免内存翻倍
 *
 * 返回格式: Array<{ title: string, start: number, end: number, index: number }>
 */

// 章节匹配正则列表，按优先级排序
// 关键约束：在 章/回/节/卷 之后必须是行尾或者 空白/标点 分隔（避免匹配正文中的 "第三章节内容..."）
const CHAPTER_PATTERNS = [
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}章(?:[\s　:：\-—.、·]+.{0,40})?[\s　]*$/,
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}回(?:[\s　:：\-—.、·]+.{0,40})?[\s　]*$/,
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}节(?:[\s　:：\-—.、·]+.{0,40})?[\s　]*$/,
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}卷(?:[\s　:：\-—.、·]+.{0,40})?[\s　]*$/,
  /^[\s]*卷[零一二三四五六七八九十百千万〇０-９0-9]{1,7}(?:[\s　:：\-—.、·]+.{0,40})?[\s　]*$/,
  /^[\s]*[Cc]hapter\s+\d+(?:[\s:：\-—.]+.{0,40})?[\s]*$/,
  /^[\s]*【.{1,40}】[\s]*$/,
  /^[\s]*［.{1,40}］[\s]*$/,
]

// 二次校验：包含句末标点的行不可能是章节标题（多半是正文）
function looksLikeProseSentence(line) {
  return /[。！？；,，]/.test(line)
}

function cleanTitle(title) {
  return title
    .replace(/^[\s]+/, '')
    .replace(/[\s]+$/, '')
    .replace(/^【|】$/g, '')
    .replace(/^［|］$/g, '')
}

/**
 * 构建章节索引
 * @param {string} fullText - 完整原始文本
 * @returns {Array<{title: string, start: number, end: number, index: number}>}
 */
export function buildChapterIndex(fullText) {
  const lines = fullText.split('\n')
  const chapterStarts = []   // [{lineIdx, title}]
  let matchedPatternIndex = -1

  // 第一遍：找出所有章节标题行
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.length > 50) continue
    // 含有句末标点的行视为正文，跳过
    if (looksLikeProseSentence(trimmed)) continue

    let matched = false
    for (let p = 0; p < CHAPTER_PATTERNS.length; p++) {
      if (CHAPTER_PATTERNS[p].test(trimmed)) {
        if (matchedPatternIndex === -1) matchedPatternIndex = p
        matched = true
        break
      }
    }
    // 已锁定模式后优先该模式
    if (!matched && matchedPatternIndex >= 0) {
      matched = CHAPTER_PATTERNS[matchedPatternIndex].test(trimmed)
    }

    if (matched) {
      chapterStarts.push({ lineIdx: i, title: cleanTitle(trimmed) })
    }
  }

  // 第二遍：把行号转成字符偏移（在整体 fullText 里的位置）
  // 构建每行起始字符偏移表
  const lineOffsets = new Array(lines.length)
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    lineOffsets[i] = offset
    offset += lines[i].length + 1  // +1 for '\n'
  }

  const totalLen = fullText.length

  // 构建索引
  const index = []

  // 如果有前言（第一章标题之前有内容）
  if (chapterStarts.length > 0 && chapterStarts[0].lineIdx > 0) {
    const prefaceEnd = lineOffsets[chapterStarts[0].lineIdx]
    const prefaceText = fullText.slice(0, prefaceEnd).trim()
    if (prefaceText) {
      index.push({ title: '前言', start: 0, end: prefaceEnd, index: 0 })
    }
  }

  for (let i = 0; i < chapterStarts.length; i++) {
    const { lineIdx, title } = chapterStarts[i]
    const start = lineOffsets[lineIdx]
    const end = i + 1 < chapterStarts.length
      ? lineOffsets[chapterStarts[i + 1].lineIdx]
      : totalLen
    index.push({ title, start, end, index: index.length })
  }

  // 没有识别到任何章节：整篇作为一章
  if (index.length === 0) {
    index.push({ title: '全文', start: 0, end: totalLen, index: 0 })
  }

  // 重新编号（前言可能偏移）
  index.forEach((ch, i) => { ch.index = i })

  return index
}

/**
 * 按需获取某章节的文本（用 slice 惰性截取，不预先复制）
 * @param {string} fullText
 * @param {{ start: number, end: number }} chapterMeta
 * @returns {string}
 */
export function getChapterText(fullText, chapterMeta) {
  const raw = fullText.slice(chapterMeta.start, chapterMeta.end)
  // 跳过第一行（章节标题行），只返回正文内容
  // 前言（title==='前言'）没有独立标题行，直接返回全文
  if (chapterMeta.title === '前言' || chapterMeta.title === '全文') return raw
  const newlineIdx = raw.indexOf('\n')
  if (newlineIdx === -1) return ''
  return raw.slice(newlineIdx + 1)
}

/**
 * 计算阅读进度百分比
 */
export function calcProgress(currentChapterIndex, totalChapters, chapterScrollRatio) {
  if (totalChapters <= 0) return 0
  return Math.min(100, ((currentChapterIndex + (chapterScrollRatio || 0)) / totalChapters) * 100)
}

// 兼容旧代码的别名
export { buildChapterIndex as parseChapters }
