/**
 * TXT 小说章节索引构建器（CommonJS 版，供 Electron 主进程使用）
 *
 * 核心设计：只记录章节在原始文本中的 start/end 字节偏移
 * 不存储任何章节内容字符串
 */

// 章节匹配正则列表，按优先级排序
// 关键约束：章号后的标题为可选，分隔符也为可选（标题可直接紧贴章号，如 `第一章风起云涌`），
// 整行须在 40 字内的标题后结束（锚定 $）。配合 looksLikeProseSentence 过滤正文行。
const CHAPTER_PATTERNS = [
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}章(?:[\s　:：\-—.、·]?.{0,40})?[\s　]*$/,
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}回(?:[\s　:：\-—.、·]?.{0,40})?[\s　]*$/,
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}节(?:[\s　:：\-—.、·]?.{0,40})?[\s　]*$/,
  /^[\s]*第[零一二三四五六七八九十百千万〇０-９0-9]{1,7}卷(?:[\s　:：\-—.、·]?.{0,40})?[\s　]*$/,
  /^[\s]*卷[零一二三四五六七八九十百千万〇０-９0-9]{1,7}(?:[\s　:：\-—.、·]?.{0,40})?[\s　]*$/,
  /^[\s]*[Cc]hapter\s+\d+(?:[\s:：\-—.]?.{0,40})?[\s]*$/,
  /^[\s]*【.{1,40}】[\s]*$/,
  /^[\s]*［.{1,40}］[\s]*$/,
]

// 二次校验：包含句末标点的行不可能是章节标题（多半是正文）
function looksLikeProseSentence(line) {
  return /[。！？；,，]/.test(line)
}

function cleanTitle(title) {
  return title.replace(/^[\s]+/, '').replace(/[\s]+$/, '')
    .replace(/^【|】$/g, '').replace(/^［|］$/g, '')
}

/**
 * 构建章节索引（只存位置，不存内容）
 * @param {string} fullText
 * @returns {Array<{title, start, end, index}>}
 */
function buildChapterIndex(fullText) {
  const lines = fullText.split('\n')
  const chapterStarts = []
  let matchedPatternIndex = -1

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
    if (!matched && matchedPatternIndex >= 0) {
      matched = CHAPTER_PATTERNS[matchedPatternIndex].test(trimmed)
    }
    if (matched) chapterStarts.push({ lineIdx: i, title: cleanTitle(trimmed) })
  }

  // 构建每行字符偏移表
  const lineOffsets = new Array(lines.length)
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    lineOffsets[i] = offset
    offset += lines[i].length + 1
  }

  const totalLen = fullText.length
  const index = []

  if (chapterStarts.length > 0 && chapterStarts[0].lineIdx > 0) {
    const prefaceEnd = lineOffsets[chapterStarts[0].lineIdx]
    const prefaceText = fullText.slice(0, prefaceEnd).trim()
    if (prefaceText) index.push({ title: '前言', start: 0, end: prefaceEnd, index: 0 })
  }

  for (let i = 0; i < chapterStarts.length; i++) {
    const { lineIdx, title } = chapterStarts[i]
    const start = lineOffsets[lineIdx]
    const end = i + 1 < chapterStarts.length ? lineOffsets[chapterStarts[i + 1].lineIdx] : totalLen
    index.push({ title, start, end, index: index.length })
  }

  if (index.length === 0) {
    index.push({ title: '全文', start: 0, end: totalLen, index: 0 })
  }

  index.forEach((ch, i) => { ch.index = i })
  return index
}

module.exports = { buildChapterIndex, parseChapters: buildChapterIndex }
