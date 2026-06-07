import { ref } from 'vue'
import { getChapterText } from '@/utils/chapterParser.js'
import {
  computePageCount, ratioToPageIndex, pageIndexToRatio, clampPage,
  resolveNextPage, resolvePrevPage,
} from '@/modules/reader/pagination.js'

/**
 * 分页阅读引擎：把当前章排成 CSS 多列页面，提供页导航与覆盖翻页动画。
 * 覆盖动画唯一动作：incoming 层遮罩高度 0→满（下一页自上而下覆盖当前页）。
 *
 * @param {Object} o
 * @param {Ref<HTMLElement>} o.viewportEl    可视页框（决定页宽/页高，承载排版样式）
 * @param {Ref<HTMLElement>} o.baseLayerEl   底层（translateX 显示当前页）
 * @param {Ref<HTMLElement>} o.baseFlowEl    底层多列内容容器
 * @param {Ref<HTMLElement>} o.coverMaskEl   上层遮罩（高度 0→满）
 * @param {Ref<HTMLElement>} o.incomingLayerEl 上层（translateX 显示下一页）
 * @param {Ref<HTMLElement>} o.incomingFlowEl  上层多列内容容器
 * @param {Ref} o.settings
 * @param {Ref<Array>} o.chapters
 * @param {Ref<string>} o.fullText
 * @param {Ref<number>} o.currentChapterIndex
 */
export function usePagedReader(o) {
  const {
    viewportEl, baseLayerEl, baseFlowEl, coverMaskEl, incomingLayerEl, incomingFlowEl,
    settings, chapters, fullText, currentChapterIndex,
  } = o

  const pageIndex = ref(0)
  const pageCount = ref(1)
  let step = 0
  let animating = false
  let raf = null

  const sideMargin = () => Math.max(0, settings.value.leftMargin || 0)
  const V_PAD_TOP = 24
  const V_PAD_BOTTOM = 48

  /** 填充某章正文到 flow（标题 + 段落） */
  function fillFlow(flowEl, chapterIdx) {
    flowEl.innerHTML = ''
    const meta = chapters.value[chapterIdx]
    if (!meta) return
    const text = getChapterText(fullText.value, meta)
    const lines = text.split('\n').filter(l => l.trim())
    const frag = document.createDocumentFragment()
    const h = document.createElement('h2')
    h.className = 'paged-chapter-title'
    h.textContent = meta.title
    frag.appendChild(h)
    if (lines.length === 0) {
      const p = document.createElement('p')
      p.textContent = '（本章无内容）'
      frag.appendChild(p)
    } else {
      for (const line of lines) {
        const p = document.createElement('p')
        p.textContent = line.trim()
        frag.appendChild(p)
      }
    }
    flowEl.appendChild(frag)
  }

  /** 列化 flow：列宽=内容宽、列高=内容高、列隙=2×边距。返回 step（页间距）。 */
  function applyColumns(flowEl) {
    const vp = viewportEl.value
    const lm = sideMargin()
    const colW = Math.max(1, vp.clientWidth - 2 * lm)
    const colH = Math.max(1, vp.clientHeight - V_PAD_TOP - V_PAD_BOTTOM)
    const gap = 2 * lm
    // 容器必须恰为单列宽，否则多列引擎会把唯一可见列拉伸到整幅宽度，
    // 使列间距(colW+gap)>翻页 step，导致每页向右累积偏移。
    flowEl.style.width = colW + 'px'
    flowEl.style.marginLeft = lm + 'px'
    flowEl.style.columnWidth = colW + 'px'
    flowEl.style.columnGap = gap + 'px'
    flowEl.style.height = colH + 'px'
    flowEl.style.columnFill = 'auto'
    return colW + gap
  }

  function setLayerPage(layerEl, p) {
    layerEl.style.transform = `translateX(${-p * step}px)`
  }

  /** 预备 incoming 层为"下一页"（同章 +1 或下一章首页） */
  function prepareIncoming() {
    if (!incomingFlowEl.value || !incomingLayerEl.value || !coverMaskEl.value) return
    coverMaskEl.value.style.height = '0px'
    const nxt = resolveNextPage({
      pageIndex: pageIndex.value, pageCount: pageCount.value,
      chapterIndex: currentChapterIndex.value, totalChapters: chapters.value.length,
    })
    const idx = nxt.atEnd ? currentChapterIndex.value : nxt.chapterIndex
    fillFlow(incomingFlowEl.value, idx)
    applyColumns(incomingFlowEl.value)
    setLayerPage(incomingLayerEl.value, nxt.atEnd ? pageIndex.value : nxt.pageIndex)
  }

  /**
   * 重新排版当前章并测量页数。
   * @param {number|null} targetPageIndex  指定页码；-1=末页；null=用 ratio 或保持
   * @param {number|null} ratio
   */
  function layout(targetPageIndex = null, ratio = null) {
    const vp = viewportEl.value
    if (!vp || !baseFlowEl.value || !baseLayerEl.value) return
    fillFlow(baseFlowEl.value, currentChapterIndex.value)
    step = applyColumns(baseFlowEl.value)
    // 强制布局后测量
    pageCount.value = computePageCount(baseFlowEl.value.scrollWidth, step)

    let p
    if (targetPageIndex === -1) p = pageCount.value - 1
    else if (targetPageIndex != null) p = targetPageIndex
    else if (ratio != null) p = ratioToPageIndex(ratio, pageCount.value)
    else p = pageIndex.value
    pageIndex.value = clampPage(p, pageCount.value)

    setLayerPage(baseLayerEl.value, pageIndex.value)
    prepareIncoming()
  }

  /** 翻页时给遮罩前沿（下边缘）加阴影，便于分辨覆盖推进的横线；静止时清除。 */
  function setCoverEdge(on) {
    const el = coverMaskEl.value
    if (!el) return
    el.style.boxShadow = on
      ? (settings.value.nightMode
          ? '0 3px 10px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.22)'
          : '0 3px 10px rgba(0,0,0,0.28), 0 1px 0 rgba(0,0,0,0.18)')
      : 'none'
  }

  let animResolve = null

  function cancelAnim() {
    if (raf) { cancelAnimationFrame(raf); raf = null }
    setCoverEdge(false)
    animating = false
    // 唤醒被中止的 animateCover，使其 await 立即返回（turnNext/turnPrev 据 animating 判定中止）
    if (animResolve) { const r = animResolve; animResolve = null; r() }
  }

  /** 立即中止进行中的翻页动画：恢复显示当前页、收起遮罩。 */
  function abortTurn() {
    cancelAnim()
    if (baseLayerEl.value) setLayerPage(baseLayerEl.value, pageIndex.value)
    if (coverMaskEl.value) coverMaskEl.value.style.height = '0px'
  }

  /** 覆盖动画：遮罩高度从 (fromFull?满:0) 过渡到 (fromFull?0:满)，时长 duration ms */
  function animateCover(fromFull, duration) {
    return new Promise(resolve => {
      animResolve = resolve
      const vp = viewportEl.value
      const full = vp ? vp.clientHeight : 0
      const start = performance.now()
      setCoverEdge(true)
      const tick = (t) => {
        const p = Math.min(1, (t - start) / Math.max(1, duration))
        const h = fromFull ? full * (1 - p) : full * p
        if (coverMaskEl.value) coverMaskEl.value.style.height = h + 'px'
        if (p >= 1) { raf = null; setCoverEdge(false); animResolve = null; resolve(); return }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
  }

  /** 翻到下一页：播放覆盖动画后提交。返回 {atEnd} */
  async function turnNext(duration) {
    if (animating) return { atEnd: false }
    const nxt = resolveNextPage({
      pageIndex: pageIndex.value, pageCount: pageCount.value,
      chapterIndex: currentChapterIndex.value, totalChapters: chapters.value.length,
    })
    if (nxt.atEnd) return { atEnd: true }
    animating = true
    await animateCover(false, duration)   // 遮罩 0→满
    if (!animating) return { atEnd: false }  // 动画被中止：不提交翻页
    if (nxt.crossedChapter) {
      currentChapterIndex.value = nxt.chapterIndex
      layout(0)
    } else {
      pageIndex.value = nxt.pageIndex
      setLayerPage(baseLayerEl.value, pageIndex.value)
      prepareIncoming()
    }
    animating = false
    return { atEnd: false }
  }

  /** 翻到上一页。同章=反向覆盖动画；跨章=瞬切上一章末页。返回 {atStart} */
  async function turnPrev(duration) {
    if (animating) return { atStart: false }
    const prv = resolvePrevPage({ pageIndex: pageIndex.value, chapterIndex: currentChapterIndex.value })
    if (prv.atStart) return { atStart: true }
    if (prv.crossedChapter) {
      currentChapterIndex.value = prv.chapterIndex
      layout(-1)
      return { atStart: false }
    }
    // 同章反向：base=上一页，incoming=当前页，遮罩满→0
    animating = true
    const curr = pageIndex.value
    fillFlow(incomingFlowEl.value, currentChapterIndex.value)
    applyColumns(incomingFlowEl.value)
    setLayerPage(incomingLayerEl.value, curr)
    setLayerPage(baseLayerEl.value, prv.pageIndex)
    const vp = viewportEl.value
    if (coverMaskEl.value && vp) coverMaskEl.value.style.height = vp.clientHeight + 'px'
    await animateCover(true, duration)    // 遮罩 满→0
    if (!animating) return { atStart: false }  // 动画被中止：不提交翻页
    pageIndex.value = prv.pageIndex
    setLayerPage(baseLayerEl.value, pageIndex.value)
    prepareIncoming()
    animating = false
    return { atStart: false }
  }

  function destroy() { cancelAnim() }

  const pageRatio = () => pageIndexToRatio(pageIndex.value, pageCount.value)
  const isAnimating = () => animating

  return {
    pageIndex, pageCount, pageRatio, isAnimating,
    layout, turnNext, turnPrev, prepareIncoming, abortTurn, destroy,
  }
}
