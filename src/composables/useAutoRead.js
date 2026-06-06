import { ref, watch } from 'vue'

/**
 * 自动阅读引擎 composable
 * 支持滚屏和翻页两种自动阅读模式
 * @param {Object} options
 * @param {Ref} options.scrollArea - 滚动容器 ref
 * @param {Ref} options.contentEl - 内容容器 ref
 * @param {Ref} options.settings - 设置 ref
 * @param {Ref} options.autoReading - 是否自动阅读
 * @param {Function} options.appendChapterBelow - 底部追加章节
 * @param {Ref<boolean>} options.isPaged - 是否翻页模式
 * @param {Function} options.pagedTurnNext - (durationMs) => Promise<{atEnd}> 翻页引擎翻页
 * @param {Function} options.afterPagedTurn - 翻页后更新进度/保存
 */
export function useAutoRead({ scrollArea, contentEl, settings, autoReading, appendChapterBelow, isPaged, pagedTurnNext, afterPagedTurn }) {
  let autoReadRaf = null
  let autoReadPaused = false
  let pagedLoopStop = false

  function startAutoRead() {
    stopAutoRead()
    if (isPaged.value) {
      startPagedAutoRead()
    } else {
      if (!scrollArea.value) return
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

  function dwellMs() {
    const speed = Math.max(0, Math.min(100, settings.value.autoReadSpeed ?? 30))
    // 速度 0→慢(约 12s/页)，100→快(约 1.2s/页)
    return Math.max(1200, 12000 - speed * 108)
  }

  async function startPagedAutoRead() {
    pagedLoopStop = false
    while (!pagedLoopStop && autoReading.value) {
      const { atEnd } = await pagedTurnNext(dwellMs())
      if (atEnd) { autoReading.value = false; break }
      if (pagedLoopStop || !autoReading.value) break
      afterPagedTurn()
    }
  }

  function stopAutoRead() {
    pagedLoopStop = true
    if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
    autoReadPaused = false
  }

  function isAutoReadPaused() { return autoReadPaused }

  /** 暂停自动阅读（面板打开时） */
  function pauseAutoRead() {
    if (!autoReadPaused) {
      autoReadPaused = true
      pagedLoopStop = true
      if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
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
  }
}
