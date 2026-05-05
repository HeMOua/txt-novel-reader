import { ref, onUnmounted } from 'vue'
import { updateProgress, flushProgress } from '@/utils/bookStore.js'

/**
 * 阅读进度追踪与持久化 composable
 * @param {Object} options
 * @param {Ref<string>} options.filePath - 当前书籍路径
 * @param {Ref<number>} options.currentChapterIndex - 当前章节索引
 * @param {Ref<number>} options.progress - 阅读进度 0~100
 */
export function useProgress({ filePath, currentChapterIndex, progress }) {
  let progressSavePending = false

  /** 保存阅读进度（带节流，由 scroll 事件驱动） */
  function saveReadingProgress(scrollRatio = 0) {
    updateProgress(filePath.value, currentChapterIndex.value, scrollRatio, progress.value)
  }

  /** 立即刷写所有挂起的进度到 localStorage */
  function flushReadingProgress() {
    flushProgress()
  }

  onUnmounted(() => {
    flushProgress()
  })

  return { saveReadingProgress, flushReadingProgress }
}
