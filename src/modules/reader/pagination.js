/**
 * 翻页分页纯函数（无 DOM，可单测）
 * ratio：章内阅读比例 0~1，以 pageCount 为分母（page p → p/pageCount）
 */

/** 页数 = 内容总宽 / 单页步长，四舍五入，至少 1 页 */
export function computePageCount(scrollWidth, step) {
  if (!step || step <= 0) return 1
  return Math.max(1, Math.round(scrollWidth / step))
}

/** 夹取页码到 [0, pageCount-1] */
export function clampPage(pageIndex, pageCount) {
  if (pageCount <= 0) return 0
  return Math.min(pageCount - 1, Math.max(0, pageIndex))
}

/** 章内比例 → 页码 */
export function ratioToPageIndex(ratio, pageCount) {
  const r = Math.min(1, Math.max(0, ratio || 0))
  return clampPage(Math.round(r * pageCount), pageCount)
}

/** 页码 → 章内比例 */
export function pageIndexToRatio(pageIndex, pageCount) {
  if (pageCount <= 0) return 0
  return Math.min(1, Math.max(0, pageIndex / pageCount))
}

/** 下一页目标（可能跨章）；atEnd=全书末页 */
export function resolveNextPage({ pageIndex, pageCount, chapterIndex, totalChapters }) {
  if (pageIndex < pageCount - 1) {
    return { chapterIndex, pageIndex: pageIndex + 1, crossedChapter: false, atEnd: false }
  }
  if (chapterIndex < totalChapters - 1) {
    return { chapterIndex: chapterIndex + 1, pageIndex: 0, crossedChapter: true, atEnd: false }
  }
  return { chapterIndex, pageIndex, crossedChapter: false, atEnd: true }
}

/** 上一页目标（可能跨章）；跨章用 pageIndex:-1 表示"上一章末页"；atStart=全书首页 */
export function resolvePrevPage({ pageIndex, chapterIndex }) {
  if (pageIndex > 0) {
    return { chapterIndex, pageIndex: pageIndex - 1, crossedChapter: false, atStart: false }
  }
  if (chapterIndex > 0) {
    return { chapterIndex: chapterIndex - 1, pageIndex: -1, crossedChapter: true, atStart: false }
  }
  return { chapterIndex, pageIndex: 0, crossedChapter: false, atStart: true }
}
