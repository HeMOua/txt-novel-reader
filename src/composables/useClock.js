import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 时钟 composable - 每分钟更新一次
 */
export function useClock() {
  const currentTime = ref('')

  function updateClock() {
    const now = new Date()
    currentTime.value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
  }

  let timer = null

  onMounted(() => {
    updateClock()
    timer = setInterval(updateClock, 10000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { currentTime }
}
