import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 键盘快捷键 composable
 * @param {Object} handlers - 按键处理映射
 * @param {Function} handlers.onPrev - 向上/向左翻页
 * @param {Function} handlers.onNext - 向下/向右/空格翻页
 * @param {Function} handlers.onEscape - Escape 键处理
 */
export function useKeyboard({ onPrev, onNext, onEscape }) {
  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        onPrev?.()
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        onNext?.()
        e.preventDefault()
        break
      case 'Escape':
        onEscape?.()
        e.preventDefault()
        break
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
  })

  return { onKeyDown }
}
