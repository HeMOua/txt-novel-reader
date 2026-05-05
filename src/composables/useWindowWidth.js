import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 窗口宽度检测 composable
 * @param {number} threshold - 宽屏阈值，默认 600px
 */
export function useWindowWidth(threshold = 600) {
  const isWideWindow = ref(window.innerWidth >= threshold)

  function checkWidth() {
    isWideWindow.value = window.innerWidth >= threshold
  }

  onMounted(() => {
    checkWidth()
    window.addEventListener('resize', checkWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkWidth)
  })

  return { isWideWindow }
}
