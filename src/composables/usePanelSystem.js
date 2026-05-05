import { ref, computed } from 'vue'

/**
 * 面板状态机 composable
 * 管理三级面板系统：一级（底部按钮栏）、二级（内容面板）、三级（全屏弹窗）
 * 以及自动阅读专属面板
 */
export function usePanelSystem() {
  const showPanelSystem = ref(false)    // 一级+二级面板系统可见
  const activeLevel2 = ref(null)         // 'default' | 'catalog' | 'night' | 'settings' | null
  const showLevel3 = ref(false)          // 三级面板（翻页方式）
  const showAutoReadPanel = ref(false)   // 自动阅读专属面板
  const prevLevel2 = ref(null)           // 三级面板打开前的二级面板记忆

  const showAnyPanel = computed(() =>
    showPanelSystem.value || showAutoReadPanel.value || showLevel3.value
  )

  /** 切换二级面板 */
  function setLevel2(panel) {
    if (activeLevel2.value === panel) return
    activeLevel2.value = panel
    if (!showPanelSystem.value) showPanelSystem.value = true
  }

  /** 打开三级面板 */
  function openLevel3() {
    prevLevel2.value = activeLevel2.value
    showLevel3.value = true
  }

  /** 关闭三级面板 - 回到二级面板 */
  function closeLevel3() {
    showLevel3.value = false
  }

  /** 关闭三级面板 - 直接回到阅读 */
  function closeLevel3ToReading() {
    showLevel3.value = false
    showPanelSystem.value = false
    activeLevel2.value = null
  }

  /** 关闭所有面板 */
  function closeAllPanels() {
    showLevel3.value = false
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
    showPanelSystem, activeLevel2, showLevel3, showAutoReadPanel, showAnyPanel,
    setLevel2, openLevel3, closeLevel3, closeLevel3ToReading,
    closeAllPanels, showDefaultPanel, showAutoRead, hideAutoRead, hideAllPanels,
  }
}
