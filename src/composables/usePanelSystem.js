import { ref, computed } from 'vue'

/**
 * 面板状态机 composable
 * 管理面板系统：一级（底部按钮栏）、二级（内容面板）
 * 以及自动阅读专属面板
 */
export function usePanelSystem() {
  const showPanelSystem = ref(false)    // 一级+二级面板系统可见
  const activeLevel2 = ref(null)         // 'default' | 'catalog' | 'night' | 'settings' | null
  const showAutoReadPanel = ref(false)   // 自动阅读专属面板

  const showAnyPanel = computed(() =>
    showPanelSystem.value || showAutoReadPanel.value
  )

  /** 切换二级面板 */
  function setLevel2(panel) {
    if (activeLevel2.value === panel) return
    activeLevel2.value = panel
    if (!showPanelSystem.value) showPanelSystem.value = true
  }

  /** 关闭所有面板 */
  function closeAllPanels() {
    showPanelSystem.value = false
    activeLevel2.value = null
    showAutoReadPanel.value = false
  }

  /** 显示默认面板（一级+默认二级） */
  function showDefaultPanel() {
    showPanelSystem.value = true
    activeLevel2.value = 'default'
  }

  /** 显示自动阅读面板 */
  function showAutoRead() {
    showAutoReadPanel.value = true
  }

  /** 隐藏自动阅读面板 */
  function hideAutoRead() {
    showAutoReadPanel.value = false
  }

  /** 隐藏所有面板（回到纯阅读） */
  function hideAllPanels() {
    showPanelSystem.value = false
    activeLevel2.value = null
  }

  return {
    showPanelSystem, activeLevel2, showAutoReadPanel, showAnyPanel,
    setLevel2, closeAllPanels, showDefaultPanel, showAutoRead, hideAutoRead, hideAllPanels,
  }
}
