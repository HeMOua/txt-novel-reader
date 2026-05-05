import { ref, watch } from 'vue'

/**
 * 自动阅读引擎 composable
 * 支持滚屏和覆盖两种自动阅读模式
 * @param {Object} options
 * @param {Ref} options.scrollArea - 滚动容器 ref
 * @param {Ref} options.contentEl - 内容容器 ref
 * @param {Ref} options.settings - 设置 ref
 * @param {Ref} options.autoReading - 是否自动阅读
 * @param {Function} options.appendChapterBelow - 底部追加章节
 */
export function useAutoRead({ scrollArea, contentEl, settings, autoReading, appendChapterBelow }) {
  let autoReadRaf = null
  let autoReadPaused = false
  let coverOverlayEl = null

  function startAutoRead() {
    stopAutoRead()
    if (!scrollArea.value) return
    if (settings.value.autoReadMode === 'cover') {
      startCoverAutoRead()
    } else {
      startScrollAutoRead()
    }
  }

  function startScrollAutoRead() {
    function getPxPerSec() {
      const speed = Math.max(0, Math.min(100, settings.value.autoReadSpeed ?? 30))
      return 5 + speed * 2
    }
    let virtualTop = scrollArea.value.scrollTop
    let lastT = 0
    function tick(t) {
      if (!scrollArea.value) { autoReadRaf = null; return }
      if (!lastT) { lastT = t; autoReadRaf = requestAnimationFrame(tick); return }
      let dt = t - lastT
      lastT = t
      if (dt > 100) dt = 100
      virtualTop += getPxPerSec() * (dt / 1000)
      const actual = scrollArea.value.scrollTop
      if (Math.abs(actual - virtualTop) > 4) virtualTop = actual
      scrollArea.value.scrollTop = virtualTop
      autoReadRaf = requestAnimationFrame(tick)
    }
    autoReadRaf = requestAnimationFrame(tick)
  }

  function startCoverAutoRead() {
    const scrollEl = scrollArea.value
    const container = scrollEl.parentElement
    if (!scrollEl || !container) return

    const overlay = document.createElement('div')
    overlay.className = 'cover-overlay'
    Object.assign(overlay.style, {
      position: 'absolute',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '15',
      background: 'transparent',
    })
    const mask = document.createElement('div')
    mask.className = 'cover-mask'
    const maskBg = settings.value.nightMode ? '#1a1a1a' : (settings.value.bgColor || '#f5f0e8')
    Object.assign(mask.style, {
      position: 'absolute',
      top: '0', left: '0', right: '0',
      height: '0',
      overflow: 'hidden',
      background: maskBg,
      willChange: 'height',
    })
    const cloneWrap = document.createElement('div')
    cloneWrap.className = 'cover-clone-wrap'
    mask.appendChild(cloneWrap)
    overlay.appendChild(mask)
    const line = document.createElement('div')
    line.className = 'cover-line'
    const lineBorder = settings.value.nightMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
    const shadow1 = settings.value.nightMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)'
    const shadow2 = settings.value.nightMode ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.15)'
    Object.assign(line.style, {
      position: 'absolute',
      left: '0', right: '0',
      top: '0',
      height: '2px',
      background: lineBorder,
      boxShadow: `0 8px 16px ${shadow1}, 0 2px 6px ${shadow2}`,
      transform: 'translateY(-1px)',
      willChange: 'top',
      pointerEvents: 'none',
      zIndex: '2',
    })
    overlay.appendChild(line)
    container.appendChild(overlay)
    coverOverlayEl = overlay

    function syncOverlayBox() {
      const sr = scrollEl.getBoundingClientRect()
      const cr = container.getBoundingClientRect()
      overlay.style.top = (sr.top - cr.top) + 'px'
      overlay.style.left = (sr.left - cr.left) + 'px'
      overlay.style.width = sr.width + 'px'
      overlay.style.height = sr.height + 'px'
      cloneWrap.style.height = sr.height + 'px'
    }
    syncOverlayBox()

    let H = scrollEl.clientHeight
    let pageStep = computePageStep()
    let pageStart = 0

    function computePageStep() {
      const lineH = (settings.value.fontSize || 18) * (settings.value.lineHeight || 1.8)
      if (!lineH || lineH <= 0) return scrollEl.clientHeight
      const n = Math.max(1, Math.floor(scrollEl.clientHeight / lineH))
      return n * lineH
    }

    function snapshotNextPage() {
      cloneWrap.innerHTML = ''
      if (!contentEl.value) return
      const clone = contentEl.value.cloneNode(true)
      clone.style.position = 'absolute'
      clone.style.left = '0'
      clone.style.right = '0'
      clone.style.top = `-${scrollEl.scrollTop + pageStep}px`
      clone.style.margin = '0 auto'
      cloneWrap.appendChild(clone)
    }
    snapshotNextPage()

    // 需要在 composable 内部访问 isRestoring
    // 通过闭包传入
    const setIsRestoring = null // 需要外部注入

    function tick(t) {
      if (!autoReading.value || !scrollArea.value) {
        cleanupCoverOverlay()
        return
      }
      if (!pageStart) pageStart = t
      const speed = Math.max(0, Math.min(100, settings.value.autoReadSpeed ?? 30))
      const pageDuration = Math.max(800, 11000 - speed * 100)
      const p = Math.min(1, (t - pageStart) / pageDuration)
      const px = (p * H).toFixed(2) + 'px'
      mask.style.height = px
      line.style.top = px
      if (p >= 1) {
        if (scrollEl.scrollTop + pageStep >= scrollEl.scrollHeight - 1) {
          autoReading.value = false
          cleanupCoverOverlay()
          return
        }
        // isRestoring 需要由外部管理，这里用简单的方式
        scrollEl.scrollTop = scrollEl.scrollTop + pageStep
        if (scrollEl.scrollTop + H >= scrollEl.scrollHeight - 200) {
          appendChapterBelow()
        }
        requestAnimationFrame(() => {
          H = scrollEl.clientHeight
          pageStep = computePageStep()
          syncOverlayBox()
          snapshotNextPage()
          mask.style.height = '0px'
          line.style.top = '0px'
          pageStart = 0
          autoReadRaf = requestAnimationFrame(tick)
        })
        return
      }
      autoReadRaf = requestAnimationFrame(tick)
    }
    autoReadRaf = requestAnimationFrame(tick)
  }

  function cleanupCoverOverlay() {
    if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
    if (coverOverlayEl) { coverOverlayEl.remove(); coverOverlayEl = null }
  }

  function stopAutoRead() {
    if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
    if (coverOverlayEl) { coverOverlayEl.remove(); coverOverlayEl = null }
    autoReadPaused = false
  }

  function isAutoReadPaused() { return autoReadPaused }

  /** 暂停自动阅读（面板打开时） */
  function pauseAutoRead() {
    if (!autoReadPaused) {
      autoReadPaused = true
      if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
      if (coverOverlayEl) { coverOverlayEl.remove(); coverOverlayEl = null }
    }
  }

  /** 恢复自动阅读（面板关闭时） */
  function resumeAutoRead() {
    if (autoReadPaused) {
      autoReadPaused = false
      startAutoRead()
    }
  }

  return {
    autoReadPaused: () => autoReadPaused,
    startAutoRead, stopAutoRead,
    pauseAutoRead, resumeAutoRead,
    cleanupCoverOverlay,
  }
}
