import { ref, computed, nextTick } from 'vue'
import { getChapterText } from '@/utils/chapterParser.js'

/**
 * 滑动窗口章节渲染 composable
 * 管理章节 DOM 的按需渲染、滑动窗口、前后追加/裁剪
 */
export function useChapterRenderer({ contentEl, scrollArea, chapters, fullText, currentChapterIndex, onChapterChange }) {
  const MAX_RANGE = 4
  const BUFFER_AHEAD = 1

  const rangeStart = ref(0)
  const rangeEnd = ref(0)
  const chapterDomMap = new Map()
  let isRestoring = false

  function getIsRestoring() { return isRestoring }
  function setIsRestoring(val) { isRestoring = val }

  /** 渲染单个章节 DOM */
  function renderChapterDom(chapterIdx) {
    const meta = chapters.value[chapterIdx]
    if (!meta) return null

    const container = document.createElement('div')
    container.className = 'chapter-block'
    container.dataset.chapterIndex = chapterIdx

    const header = document.createElement('div')
    header.className = 'chapter-header'
    const title = document.createElement('h2')
    title.className = 'chapter-title-inline'
    title.textContent = meta.title
    header.appendChild(title)
    container.appendChild(header)

    const body = document.createElement('div')
    body.className = 'chapter-body'
    container.appendChild(body)

    const text = getChapterText(fullText.value, meta)
    const lines = text.split('\n').filter(l => l.trim())

    if (lines.length === 0) {
      body.innerHTML = '<p style="color:#999;text-align:center">（本章无内容）</p>'
      return container
    }

    const fragment = document.createDocumentFragment()
    for (const line of lines) {
      const p = document.createElement('p')
      p.textContent = line.trim()
      fragment.appendChild(p)
    }
    body.appendChild(fragment)

    return container
  }

  /** 重建滑动窗口（跳转时使用） */
  function rebuildWindow(centerIdx, scrollRatio = 0) {
    if (!contentEl.value) return

    contentEl.value.innerHTML = ''
    chapterDomMap.clear()

    const totalChapters = chapters.value.length
    const start = Math.max(0, centerIdx - BUFFER_AHEAD)
    const end = Math.min(totalChapters - 1, centerIdx + BUFFER_AHEAD)
    rangeStart.value = start
    rangeEnd.value = end

    for (let i = start; i <= end; i++) {
      const dom = renderChapterDom(i)
      if (dom) {
        contentEl.value.appendChild(dom)
        chapterDomMap.set(i, dom)
      }
    }

    isRestoring = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scrollArea.value) return
        const targetDom = chapterDomMap.get(centerIdx)
        if (targetDom && scrollRatio > 0) {
          const chapterH = targetDom.offsetHeight
          const containerH = scrollArea.value.clientHeight
          scrollArea.value.scrollTop = targetDom.offsetTop + Math.round(scrollRatio * Math.max(0, chapterH - containerH))
        } else if (targetDom) {
          scrollArea.value.scrollTop = targetDom.offsetTop
        }
        setTimeout(() => { isRestoring = false }, 100)
      })
    })
  }

  /** 在底部追加一章 */
  function appendChapterBelow() {
    const nextIdx = rangeEnd.value + 1
    if (nextIdx >= chapters.value.length) return
    if (!contentEl.value) return

    const dom = renderChapterDom(nextIdx)
    if (dom) {
      contentEl.value.appendChild(dom)
      chapterDomMap.set(nextIdx, dom)
      rangeEnd.value = nextIdx
    }

    trimFromTop()
  }

  /** 在顶部前插一章 */
  function prependChapterAbove() {
    const prevIdx = rangeStart.value - 1
    if (prevIdx < 0) return
    if (!contentEl.value || !scrollArea.value) return

    const oldScrollTop = scrollArea.value.scrollTop
    const oldScrollHeight = scrollArea.value.scrollHeight

    const dom = renderChapterDom(prevIdx)
    if (!dom) return

    contentEl.value.insertBefore(dom, contentEl.value.firstChild)
    chapterDomMap.set(prevIdx, dom)
    rangeStart.value = prevIdx

    isRestoring = true
    requestAnimationFrame(() => {
      if (!scrollArea.value) { isRestoring = false; return }
      const newScrollHeight = scrollArea.value.scrollHeight
      scrollArea.value.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
      isRestoring = false

      trimFromBottom()
    })
  }

  /** 从顶部裁剪超出范围的章节 */
  function trimFromTop() {
    while (rangeEnd.value - rangeStart.value + 1 > MAX_RANGE && rangeStart.value < currentChapterIndex.value - 1) {
      const dom = chapterDomMap.get(rangeStart.value)
      if (dom) dom.remove()
      chapterDomMap.delete(rangeStart.value)
      rangeStart.value++
    }
  }

  /** 从底部裁剪超出范围的章节 */
  function trimFromBottom() {
    while (rangeEnd.value - rangeStart.value + 1 > MAX_RANGE && rangeEnd.value > currentChapterIndex.value + 1) {
      const dom = chapterDomMap.get(rangeEnd.value)
      if (dom) dom.remove()
      chapterDomMap.delete(rangeEnd.value)
      rangeEnd.value--
    }
  }

  /** 获取章节 DOM（供外部使用，如目录滚动定位） */
  function getChapterDom(idx) {
    return chapterDomMap.get(idx)
  }

  return {
    rangeStart, rangeEnd,
    getIsRestoring, setIsRestoring,
    renderChapterDom, rebuildWindow,
    appendChapterBelow, prependChapterAbove,
    trimFromTop, trimFromBottom,
    getChapterDom, chapterDomMap,
  }
}
