<template>
  <div
    class="reader-container"
    :class="{ 'night-mode': settings.nightMode }"
    :style="readerStyle"
    @click="onReaderClick"
  >
    <!-- 阅读内容区域：滑动窗口多章渲染 -->
    <div class="reader-scroll" ref="scrollArea" @scroll="onScroll">
      <div class="reader-content" :style="contentStyle" ref="contentEl">
        <!-- 由 JS 动态管理章节 DOM，不使用 v-for 全量渲染 -->
      </div>
    </div>

    <!-- 常驻左上角章节信息 -->
    <div class="chapter-label-fixed" v-if="!showAnyPanel">{{ currentChapterLabel }}</div>

    <!-- 常驻底部信息栏 -->
    <footer class="reader-info-bar" v-if="!showAnyPanel">
      <span class="info-left">{{ Math.round(progress) }}%</span>
      <span class="info-right">{{ currentTime }}</span>
    </footer>

    <!-- 顶部栏 - 面板可见时显示 -->
    <transition name="slide-down">
      <header v-if="showAnyPanel && !showLevel3" class="panel-top-bar" @click.stop>
        <button class="back-btn" @click="emit('back')">← 返回</button>
        <span class="top-bar-title">{{ currentChapterLabel }}</span>
        <span class="top-spacer"></span>
      </header>
    </transition>

    <!-- ========== 自动阅读专属面板 ========== -->
    <transition name="slide-up">
      <div v-if="showAutoReadPanel" class="auto-read-panel" :class="{ 'panel-wide': isWideWindow }" @click.stop>
        <div class="arp-speed">
          <div class="arp-speed-header">
            <span>阅读速度</span>
            <span class="speed-value">{{ settings.autoReadSpeed }}</span>
          </div>
          <div class="arp-speed-track">
            <span class="speed-tip">慢</span>
            <input type="range" min="0" max="100" step="1"
              v-model.number="settings.autoReadSpeed" @input="onSettingsChange" class="slider" />
            <span class="speed-tip">快</span>
          </div>
        </div>
        <div class="arp-mode">
          <div class="arp-mode-item" :class="{ active: settings.autoReadMode === 'scroll' }" @click="setAutoReadMode('scroll')">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M7 10l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>滚屏翻页</span>
          </div>
          <div class="arp-mode-item" :class="{ active: settings.autoReadMode === 'cover' }" @click="setAutoReadMode('cover')">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><path d="M10 12h4" stroke-linecap="round"/></svg>
            <span>覆盖翻页</span>
          </div>
        </div>
        <button class="arp-exit-btn" @click="stopAndExitAutoRead">退出自动阅读</button>
      </div>
    </transition>

    <!-- ========== 二级面板 ========== -->
    <transition name="slide-up">
      <div
        v-if="showPanelSystem && activeLevel2 && !showLevel3"
        class="level2-panel"
        :class="['l2-' + activeLevel2, { 'panel-wide': isWideWindow }]"
        @click.stop
      >
        <!-- 默认二级：章节导航 -->
        <div v-if="activeLevel2 === 'default'" class="l2-default">
          <div class="nav-row">
            <button class="nav-btn" @click="prevChapter" :disabled="currentChapterIndex <= 0">上一章</button>
            <div class="progress-slider">
              <input type="range" min="0" :max="Math.max(totalChapters - 1, 0)"
                v-model.number="sliderChapter" @input="onSliderChange" class="slider" />
            </div>
            <button class="nav-btn" @click="nextChapter" :disabled="currentChapterIndex >= totalChapters - 1">下一章</button>
          </div>
        </div>

        <!-- 目录二级 -->
        <div v-if="activeLevel2 === 'catalog'" class="catalog-content">
          <div class="catalog-tabs">
            <button v-for="tab in catalogTabs" :key="tab.id"
              class="cat-tab" :class="{ active: activeCatalogTab === tab.id }"
              @click="activeCatalogTab = tab.id">{{ tab.name }}</button>
          </div>
          <div class="catalog-info-bar">
            <span class="cat-book-name">{{ bookTitle }}</span>
            <span class="cat-chapter-count">共 {{ totalChapters }} 章</span>
            <button class="cat-sort-btn" @click="catalogReverse = !catalogReverse" :title="catalogReverse ? '正序' : '倒序'">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
                :style="{ transform: catalogReverse ? 'rotate(180deg)' : '' }">
                <path d="M12 5v14M19 12l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="catalog-list" ref="catalogList">
            <div v-for="ch in displayChapters" :key="ch.originalIndex"
              class="catalog-item" :class="{ active: ch.originalIndex === currentChapterIndex }"
              @click="jumpFromCatalog(ch.originalIndex)">
              <span class="chapter-index">{{ ch.originalIndex + 1 }}</span>
              <span class="chapter-title">{{ ch.title }}</span>
            </div>
          </div>
        </div>

        <!-- 夜间二级 -->
        <div v-if="activeLevel2 === 'night'" class="l2-night">
          <div class="night-toggle-row">
            <span class="night-label">夜间模式</span>
            <div class="toggle-switch" :class="{ on: settings.nightMode }" @click="toggleNightMode">
              <div class="toggle-thumb"></div>
            </div>
          </div>
          <div class="night-colors">
            <div v-for="theme in THEMES" :key="theme.id"
              class="color-card" :class="{ active: settings.theme === theme.id }"
              @click="setTheme(theme)">
              <div class="color-swatch" :style="{ background: theme.bgColor }">
                <svg v-if="settings.theme === theme.id" viewBox="0 0 24 24" width="14" height="14"
                  fill="none" :stroke="theme.id === 'night' ? '#e67e22' : '#e67e22'" stroke-width="3">
                  <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="color-name">{{ theme.name }}</span>
            </div>
          </div>
        </div>

        <!-- 设置二级 -->
        <div v-if="activeLevel2 === 'settings'" class="l2-settings">
          <!-- 字号 -->
          <div class="setting-section">
            <div class="setting-row">
              <button class="font-ctrl-btn" @click="changeFontSize(-1)">A-</button>
              <span class="font-size-val">{{ settings.fontSize }}</span>
              <button class="font-ctrl-btn" @click="changeFontSize(1)">A+</button>
              <div class="font-family-wrap">
                <select v-model="settings.fontFamily" @change="onSettingsChange">
                  <option v-for="f in FONT_FAMILIES" :key="f.id" :value="f.id">{{ f.name }}</option>
                </select>
              </div>
            </div>
          </div>
          <!-- 行间距 -->
          <div class="setting-section">
            <span class="section-label">行间距</span>
            <div class="preset-group">
              <button v-for="preset in LINE_HEIGHT_PRESETS" :key="preset.id"
                class="preset-btn" :class="{ active: Math.abs(settings.lineHeight - preset.value) < 0.01 }"
                @click="setLineHeight(preset.value)">{{ preset.name }}</button>
            </div>
          </div>
          <!-- 背景色 -->
          <div class="setting-section">
            <span class="section-label">背景色</span>
            <div class="color-row">
              <div v-for="theme in THEMES" :key="theme.id"
                class="color-card-sm" :class="{ active: settings.theme === theme.id }"
                :style="{ background: theme.bgColor }"
                @click="setTheme(theme)">
                <svg v-if="settings.theme === theme.id" viewBox="0 0 24 24" width="12" height="12"
                  fill="none" stroke="#e67e22" stroke-width="3">
                  <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
          <!-- 功能控制 -->
          <div class="setting-section setting-controls">
            <div class="control-row">
              <span>自动阅读</span>
              <div class="toggle-switch" :class="{ on: autoReading }" @click="startAutoReadFromSettings">
                <div class="toggle-thumb"></div>
              </div>
            </div>
            <div class="control-row page-mode-trigger" @click="openLevel3">
              <span>翻页类型</span>
              <div class="pm-trigger-right">
                <span class="pm-current">{{ currentPageModeName }}</span>
                <svg class="pm-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========== 一级面板 ========== -->
    <transition name="slide-up">
      <div v-if="showPanelSystem && !autoReading && !showLevel3" class="level1-panel" @click.stop>
        <button class="l1-btn" :class="{ active: activeLevel2 === 'catalog' }" @click="handleSetLevel2('catalog')">
          <span class="l1-icon"><SvgIcon name="catalog" :size="22" /></span>
          <span>目录</span>
        </button>
        <button class="l1-btn" :class="{ active: activeLevel2 === 'night' }" @click="handleSetLevel2('night')">
          <span class="l1-icon"><SvgIcon :name="settings.nightMode ? 'sun' : 'moon'" :size="22" /></span>
          <span>{{ settings.nightMode ? '日间' : '夜间' }}</span>
        </button>
        <button class="l1-btn" :class="{ active: activeLevel2 === 'settings' }" @click="handleSetLevel2('settings')">
          <span class="l1-icon"><SvgIcon name="settings" :size="22" /></span>
          <span>设置</span>
        </button>
      </div>
    </transition>

    <!-- ========== 三级面板：翻页方式 ========== -->
    <transition name="fade-scale">
      <div v-if="showLevel3" class="level3-overlay" @click="closeLevel3ToReading">
        <div class="level3-panel" @click.stop>
          <div class="l3-header">
            <button class="l3-back" @click="closeLevel3">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>返回</span>
            </button>
            <span class="l3-title">翻页方式</span>
            <span class="l3-spacer"></span>
          </div>
          <div class="l3-grid">
            <div v-for="mode in pageModes" :key="mode.id"
              class="pm-card" :class="{ active: settings.autoReadMode === mode.id }"
              @click="selectPageMode(mode.id)">
              <div class="pm-card-icon" v-html="mode.icon"></div>
              <span class="pm-card-name">{{ mode.name }}</span>
              <svg v-if="settings.autoReadMode === mode.id" class="pm-card-check" viewBox="0 0 24 24" width="16" height="16"
                fill="none" stroke="#e67e22" stroke-width="2.5">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { getSettings, saveSettings, THEMES, LINE_HEIGHT_PRESETS, FONT_FAMILIES } from '@/utils/bookStore.js'
import SvgIcon from './SvgIcon.vue'

// Composables
import { useClock } from '@/composables/useClock'
import { useWindowWidth } from '@/composables/useWindowWidth'
import { usePanelSystem } from '@/composables/usePanelSystem'
import { useKeyboard } from '@/composables/useKeyboard'
import { useProgress } from '@/composables/useProgress'
import { useChapterRenderer } from '@/composables/useChapterRenderer'
import { useAutoRead } from '@/composables/useAutoRead'

const props = defineProps({
  book: { type: Object, required: true }
})
const emit = defineEmits(['back'])

// ========== Composables ==========
const { currentTime } = useClock()
const { isWideWindow } = useWindowWidth()
const {
  showPanelSystem, activeLevel2, showLevel3, showAutoReadPanel, showAnyPanel,
  setLevel2, openLevel3, closeLevel3, closeLevel3ToReading,
  closeAllPanels, showDefaultPanel, showAutoRead, hideAutoRead, hideAllPanels,
} = usePanelSystem()

// ========== 自动阅读状态 ==========
const autoReading = ref(false)

// ========== 目录状态 ==========
const activeCatalogTab = ref('catalog')
const catalogReverse = ref(false)

const catalogTabs = [
  { id: 'catalog', name: '目录' },
  { id: 'notes', name: '笔记' },
  { id: 'bookmarks', name: '书签' },
]

// ========== 翻页方式 ==========
const pageModes = [
  { id: 'scroll', name: '上下滑动', icon: '<path d="M12 4v16" stroke-linecap="round"/><path d="M7 8l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'cover', name: '左右覆盖', icon: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><path d="M10 12h4" stroke-linecap="round"/>' },
  { id: 'real', name: '仿真翻页', icon: '<path d="M4 4c4 0 6 2 8 2s4-2 8-2"/><path d="M4 12c4 0 6 2 8 2s4-2 8-2"/><path d="M4 20c4 0 6-2 8-2s4 2 8 2"/>' },
  { id: 'none', name: '无动效', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h6" stroke-linecap="round"/>' },
  { id: 'slide', name: '平移翻页', icon: '<rect x="3" y="5" width="12" height="14" rx="1"/><path d="M15 12h6M19 9l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>' },
]

// ========== 基础状态 ==========
const progress = ref(props.book.progress || 0)
const sliderChapter = ref(props.book.currentChapterIndex || 0)
const scrollArea = ref(null)
const contentEl = ref(null)
const catalogList = ref(null)
const currentChapterIndex = ref(props.book.currentChapterIndex || 0)

// ========== 设置 ==========
const settings = ref(getSettings())

// ========== 基础计算 ==========
const chapters = computed(() => props.book.chapters || [])
const totalChapters = computed(() => chapters.value.length)
const fullText = computed(() => props.book.fullText || '')

const currentChapterMeta = computed(() => chapters.value[currentChapterIndex.value] || null)
const currentChapterTitle = computed(() => currentChapterMeta.value?.title || '')
const currentChapterLabel = computed(() => currentChapterTitle.value || `第${currentChapterIndex.value + 1}章`)

const bookTitle = computed(() => {
  const path = props.book.filePath || ''
  return path.split('/').pop().replace(/\.(txt|TXT)$/, '') || '未命名'
})

const displayChapters = computed(() => {
  const list = chapters.value.map((ch, i) => ({ ...ch, originalIndex: i }))
  if (catalogReverse.value) list.reverse()
  return list
})

const currentPageModeName = computed(() => {
  const m = pageModes.find(p => p.id === settings.value.autoReadMode)
  return m ? m.name : '上下滑动'
})

// ========== 样式 ==========
const readerStyle = computed(() => ({
  background: settings.value.nightMode ? '#1a1a1a' : settings.value.bgColor,
  color: settings.value.nightMode ? '#888' : settings.value.fontColor,
}))

const contentStyle = computed(() => {
  const ff = FONT_FAMILIES.find(f => f.id === settings.value.fontFamily)
  return {
    fontSize: settings.value.fontSize + 'px',
    fontFamily: ff ? ff.value : '',
    lineHeight: settings.value.lineHeight,
    paddingTop: '24px',
    paddingBottom: '80px',
    paddingLeft: settings.value.leftMargin + 'px',
    paddingRight: settings.value.leftMargin + 'px',
    width: (settings.value.contentWidth || 80) + '%',
  }
})

// ========== 章节渲染器 ==========
const renderer = useChapterRenderer({
  contentEl,
  scrollArea,
  chapters,
  fullText,
  currentChapterIndex,
  onChapterChange: (idx) => { currentChapterIndex.value = idx },
})

// ========== 进度追踪 ==========
const { saveReadingProgress, flushReadingProgress } = useProgress({
  filePath: computed(() => props.book.filePath),
  currentChapterIndex,
  progress,
})

// ========== 自动阅读 ==========
const autoRead = useAutoRead({
  scrollArea,
  contentEl,
  settings,
  autoReading,
  appendChapterBelow: renderer.appendChapterBelow,
})

// ========== 滚动追踪 ==========
let scrollThrottle = null

function onScroll() {
  if (renderer.getIsRestoring()) return
  if (!scrollArea.value) return
  if (scrollThrottle) return
  scrollThrottle = requestAnimationFrame(() => {
    scrollThrottle = null
    if (!scrollArea.value) return

    const { scrollTop, scrollHeight, clientHeight } = scrollArea.value

    const viewportCenter = scrollTop + clientHeight / 2
    let detectedChapter = currentChapterIndex.value
    for (const [idx, dom] of renderer.chapterDomMap) {
      if (dom.offsetTop <= viewportCenter && dom.offsetTop + dom.offsetHeight >= viewportCenter) {
        detectedChapter = idx
        break
      }
    }

    if (detectedChapter !== currentChapterIndex.value) {
      currentChapterIndex.value = detectedChapter
      sliderChapter.value = detectedChapter
    }

    const totalChars = fullText.value.length
    if (totalChars > 0 && chapters.value[detectedChapter]) {
      const chMeta = chapters.value[detectedChapter]
      const chDom = renderer.chapterDomMap.get(detectedChapter)
      let chapterRatio = 0
      if (chDom && chDom.offsetHeight > clientHeight) {
        chapterRatio = Math.max(0, Math.min(1,
          (scrollTop - chDom.offsetTop) / (chDom.offsetHeight - clientHeight)
        ))
      }
      const readChars = chMeta.start + chapterRatio * (chMeta.end - chMeta.start)
      progress.value = Math.min(100, (readChars / totalChars) * 100)
    }

    saveReadingProgress()

    if (scrollTop + clientHeight >= scrollHeight - 200) {
      renderer.appendChapterBelow()
    }

    if (scrollTop <= 200 && renderer.rangeStart.value > 0) {
      renderer.prependChapterAbove()
    }
  })
}

// ========== 进度保存 ==========
function saveReadingProgressWithRatio() {
  const chDom = renderer.chapterDomMap.get(currentChapterIndex.value)
  let scrollRatio = 0
  if (chDom && scrollArea.value) {
    const chH = chDom.offsetHeight
    const containerH = scrollArea.value.clientHeight
    if (chH > containerH) {
      scrollRatio = Math.max(0, Math.min(1,
        (scrollArea.value.scrollTop - chDom.offsetTop) / (chH - containerH)
      ))
    }
  }
  saveReadingProgress(scrollRatio)
}

function restorePosition() {
  const savedChapterIndex = props.book.currentChapterIndex || 0
  const savedScrollRatio = props.book.currentScrollRatio || 0

  currentChapterIndex.value = savedChapterIndex
  sliderChapter.value = savedChapterIndex

  renderer.rebuildWindow(savedChapterIndex, savedScrollRatio)
}

// ========== 章节跳转 ==========
function jumpToChapter(index) {
  if (index < 0 || index >= totalChapters.value) return
  currentChapterIndex.value = index
  sliderChapter.value = index
  renderer.rebuildWindow(index, 0)
}
function jumpFromCatalog(index) {
  jumpToChapter(index)
  hideAllPanels()
}
function prevChapter() { jumpToChapter(currentChapterIndex.value - 1) }
function nextChapter() { jumpToChapter(currentChapterIndex.value + 1) }
function onSliderChange() { jumpToChapter(sliderChapter.value) }

// ========== 设置 ==========
function changeFontSize(delta) {
  settings.value.fontSize = Math.max(12, Math.min(36, settings.value.fontSize + delta))
  onSettingsChange()
}
function setLineHeight(value) { settings.value.lineHeight = value; onSettingsChange() }
function setTheme(theme) {
  settings.value.theme = theme.id; settings.value.fontColor = theme.fontColor
  settings.value.bgColor = theme.bgColor; settings.value.nightMode = theme.id === 'night'
  onSettingsChange()
}
function toggleNightMode() {
  settings.value.nightMode = !settings.value.nightMode
  if (settings.value.nightMode) {
    settings.value.theme = 'night'; settings.value.fontColor = '#888'; settings.value.bgColor = '#1a1a1a'
  } else {
    settings.value.theme = 'default'; settings.value.fontColor = '#2c2c2c'; settings.value.bgColor = '#f5f0e8'
  }
  onSettingsChange()
}
function onSettingsChange() { saveSettings(settings.value) }
function setAutoReadMode(mode) {
  if (settings.value.autoReadMode === mode) return
  settings.value.autoReadMode = mode
  onSettingsChange()
  if (autoReading.value) { autoRead.stopAutoRead(); autoRead.startAutoRead() }
}

// ========== 面板交互 ==========
function startAutoReadFromSettings() {
  autoReading.value = true
  hideAllPanels()
  autoRead.startAutoRead()
}

function stopAndExitAutoRead() {
  autoReading.value = false
  showAutoReadPanel.value = false
  autoRead.stopAutoRead()
}

/** 切换二级面板（带目录自动滚动） */
function handleSetLevel2(panel) {
  setLevel2(panel)
  if (panel === 'catalog') {
    nextTick(() => {
      if (!catalogList.value) return
      const activeEl = catalogList.value.querySelector('.catalog-item.active')
      if (activeEl) {
        const listRect = catalogList.value.getBoundingClientRect()
        const itemRect = activeEl.getBoundingClientRect()
        const offset = itemRect.top - listRect.top - (listRect.height / 2) + (itemRect.height / 2)
        catalogList.value.scrollTop += offset
      }
    })
  }
}

/** 选择翻页方式 */
function selectPageMode(modeId) {
  setAutoReadMode(modeId)
  closeLevel3ToReading()
}

// 面板打开时暂停自动阅读
watch([showPanelSystem, activeLevel2, showLevel3, showAutoReadPanel], () => {
  if (!autoReading.value) return
  const shouldPause = showPanelSystem.value || showLevel3.value || showAutoReadPanel.value
  if (shouldPause && !autoRead.autoReadPaused()) {
    autoRead.pauseAutoRead()
  } else if (!shouldPause && autoRead.autoReadPaused()) {
    autoRead.resumeAutoRead()
  }
})

// ========== 交互点击 ==========
function onReaderClick(e) {
  if (showAutoReadPanel.value) {
    showAutoReadPanel.value = false
    return
  }

  if (showLevel3.value) return

  if (showPanelSystem.value) {
    hideAllPanels()
    return
  }

  const rect = e.currentTarget.getBoundingClientRect()
  const zone = (e.clientY - rect.top) / rect.height
  if (zone > 0.25 && zone < 0.75) {
    if (autoReading.value) {
      showAutoRead()
    } else {
      showDefaultPanel()
    }
  } else if (zone <= 0.25) {
    scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  } else {
    scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  }
}

// ========== 键盘快捷键 ==========
function handleEscape() {
  if (showAutoReadPanel.value) {
    showAutoReadPanel.value = false
  } else if (showLevel3.value) {
    closeLevel3()
  } else if (showPanelSystem.value && activeLevel2.value && activeLevel2.value !== 'default') {
    activeLevel2.value = 'default'
  } else if (showPanelSystem.value) {
    hideAllPanels()
  } else {
    emit('back')
  }
}

useKeyboard({
  onPrev: () => scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }),
  onNext: () => scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }),
  onEscape: handleEscape,
})

// ========== 初始化 ==========
onMounted(() => {
  nextTick(() => {
    renderer.setIsRestoring(true)
    restorePosition()
    setTimeout(() => { renderer.setIsRestoring(false) }, 300)
  })
})

onUnmounted(() => {
  autoRead.stopAutoRead()
  flushReadingProgress()
})
</script>

<style lang="scss" scoped>
/* ========== 根容器 ========== */
.reader-container {
  position: relative; height: 100vh;
  display: flex; flex-direction: column; overflow: hidden;
  transition: background $duration-slow $easing-default, color $duration-slow $easing-default;
}

.reader-scroll {
  flex: 1; overflow-y: auto; scroll-behavior: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}

.reader-content {
  margin: 0 auto; word-wrap: break-word; text-align: justify; user-select: text;
}

/* 章节块 */
.chapter-block { margin-bottom: 0; }

.chapter-header {
  padding: $spacing-2xl 0 $spacing-base;
  border-bottom: 1px solid v-bind('settings.nightMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"');
  margin-bottom: $spacing-base;
}

.chapter-title-inline {
  font-size: 1.2em; font-weight: 700; text-align: center; color: inherit; opacity: 0.85;
}

.chapter-body :deep(p) {
  text-indent: 2em;
  margin-bottom: v-bind('settings.paragraphSpacing + "px"');
  line-height: inherit;
}

/* 常驻信息 */
.chapter-label-fixed {
  position: absolute; top: $spacing-sm; left: $spacing-base;
  font-size: $font-size-sm; z-index: $z-index-info;
  color: v-bind('settings.nightMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"');
  pointer-events: none; max-width: 60%;
  @include text-ellipsis;
}

.reader-info-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between;
  padding: $spacing-xs $spacing-lg;
  font-size: $font-size-xs;
  color: v-bind('settings.nightMode ? "#555" : "#bbb"');
  pointer-events: none; z-index: $z-index-info;
}

/* ========== 顶部栏 ========== */
.panel-top-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: $z-index-top-bar;
  display: flex; align-items: center; padding: 10px $spacing-base;
  background: $color-panel-bg-light; backdrop-filter: blur(10px); color: $color-panel-text;
}

.back-btn {
  background: none; border: none; color: $color-panel-text;
  font-size: $font-size-md; cursor: pointer;
  padding: $spacing-xs 10px; border-radius: $radius-sm; white-space: nowrap;

  &:hover { background: rgba(255, 255, 255, 0.1); }
}

.top-bar-title {
  flex: 1; text-align: center; font-size: $font-size-md;
  @include text-ellipsis; color: #ccc;
}

.top-spacer { width: 60px; }

/* ========== 一级面板 ========== */
.level1-panel {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: $z-index-panel-1;
  height: 56px;
  background: $color-panel-bg-light; backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: space-around;
  color: #ccc;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.l1-btn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  @include panel-btn;
  padding: $spacing-sm $spacing-lg; border-radius: $radius-md;

  &:hover { color: #ddd; background: rgba(255, 255, 255, 0.05); }
  &.active { color: $color-brand; }
}

.l1-icon { display: flex; align-items: center; justify-content: center; }

/* ========== 二级面板 — 基础 ========== */
.level2-panel {
  position: absolute; left: 0; right: 0; z-index: $z-index-panel-2;
  @include panel-base;
  bottom: 56px;
  padding: $spacing-base;

  &.panel-wide {
    margin: 0 auto;
    border-radius: $radius-2xl $radius-2xl 0 0;
  }
}

/* 默认二级：章节导航 */
.level2-panel.l2-default {
  padding: 10px $spacing-base 14px;
}

.nav-row { display: flex; align-items: center; gap: 10px; }

.nav-btn {
  background: none; border: none; color: #ccc; font-size: $font-size-base;
  cursor: pointer; padding: $spacing-sm $spacing-md; border-radius: $radius-sm; white-space: nowrap;
  transition: all $duration-fast $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.08); color: $color-white; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
}

.progress-slider { flex: 1; padding: 0 $spacing-xs; }

.slider {
  @include slider-track;

  &::-webkit-slider-thumb {
    @include slider-thumb;
  }
}

/* 目录二级 */
.level2-panel.l2-catalog {
  top: auto;
  height: calc(70vh - 56px);
  display: flex; flex-direction: column;
  border-radius: $radius-2xl $radius-2xl 0 0;
  overflow: hidden;

  &.panel-wide {
    border-radius: $radius-2xl $radius-2xl 0 0;
  }
}

.catalog-content {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
}

.catalog-tabs {
  display: flex;
  border-bottom: 1px solid $color-panel-border;
  padding: 0 $spacing-sm; flex-shrink: 0;
}

.cat-tab {
  flex: 1; padding: 10px 0; background: none; border: none;
  color: #888; font-size: $font-size-md; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all $duration-normal $easing-default;

  &:hover { color: #bbb; }
  &.active { @include tab-active; }
}

.catalog-info-bar {
  display: flex; align-items: center; gap: $spacing-sm;
  padding: $spacing-sm $spacing-base; font-size: $font-size-sm; color: #888;
  border-bottom: 1px solid $color-panel-border; flex-shrink: 0;
}

.cat-book-name { flex: 1; @include text-ellipsis; }
.cat-chapter-count { color: #666; }

.cat-sort-btn {
  background: none; border: none; color: #888; cursor: pointer;
  padding: $spacing-xs; display: flex; align-items: center;
  transition: color $duration-fast $easing-default;

  &:hover { color: $color-panel-text; }
}

.catalog-list {
  flex: 1; overflow-y: auto; padding: $spacing-xs 0;
  scrollbar-width: thin; scrollbar-color: #333 transparent;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
}

.catalog-item {
  display: flex; align-items: center; padding: 10px $spacing-base;
  cursor: pointer; font-size: $font-size-md; color: #bbb;
  transition: background $duration-fast $easing-default;

  &:hover { background: $color-panel-surface-hover; }
  &.active { @include card-active; }
}

.chapter-index {
  width: 36px; font-size: $font-size-sm; color: #666; flex-shrink: 0;
}

.catalog-item.active .chapter-index { color: $color-brand; }

.chapter-title { flex: 1; min-width: 0; @include text-ellipsis; }

/* 夜间二级 */
.night-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: $spacing-sm 0 $spacing-base;
}

.night-label { font-size: 15px; color: #ddd; }

.toggle-switch {
  position: relative; width: 44px; height: 24px;
  background: #444; border-radius: 12px;
  cursor: pointer; transition: background $duration-slow $easing-default;
  flex-shrink: 0;

  &.on { background: $color-brand; }
}

.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px; background: $color-white;
  border-radius: $radius-full; transition: transform $duration-slow $easing-default;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-switch.on .toggle-thumb { transform: translateX(20px); }

.night-colors {
  display: flex; gap: $spacing-base; flex-wrap: wrap; justify-content: center;
  padding: $spacing-sm 0;
}

.color-card {
  display: flex; flex-direction: column; align-items: center; gap: $spacing-xs;
  cursor: pointer; transition: transform $duration-fast $easing-default;

  &:hover { transform: scale(1.05); }
}

.color-swatch {
  width: 44px; height: 44px; border-radius: $radius-lg;
  border: 2px solid rgba(255, 255, 255, 0.1);
  display: flex; align-items: center; justify-content: center;
  transition: border-color $duration-normal $easing-default;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.color-card.active .color-swatch { border-color: $color-brand; }
.color-name { font-size: $font-size-xs; color: #888; }
.color-card.active .color-name { color: $color-brand; }

/* 设置二级 */
.level2-panel.l2-settings {
  max-width: 400px;
  max-height: calc(70vh - 56px);
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.setting-section {
  padding: 10px 0;
  border-bottom: 1px solid $color-panel-border;

  &:last-child { border-bottom: none; }
}

.section-label { display: block; font-size: $font-size-sm; color: #888; margin-bottom: $spacing-sm; }
.setting-row { display: flex; align-items: center; gap: 10px; justify-content: space-around; }

.font-ctrl-btn {
  width: 38px; height: 38px; border: 1px solid #555; border-radius: $radius-md;
  background: transparent; color: $color-panel-text; font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all $duration-fast $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.08); }
  &:active { background: rgba(255, 255, 255, 0.15); }
}

.font-size-val {
  min-width: 28px; text-align: center; font-size: $font-size-lg; font-weight: 600; color: $color-panel-text;
}

.font-family-wrap select {
  padding: 7px 10px; border: 1px solid #555; border-radius: $radius-md;
  background: $color-panel-surface; color: #ddd; font-size: $font-size-base;
  outline: none; cursor: pointer;
}

.preset-group { display: flex; gap: $spacing-xs; flex-wrap: wrap; justify-content: space-around; }

.preset-btn {
  padding: $spacing-sm $spacing-md; border: 1px solid #555; border-radius: $radius-md;
  background: transparent; color: #bbb; font-size: $font-size-sm;
  cursor: pointer; transition: all $duration-normal $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.06); color: #ddd; }
  &.active { background: $color-brand; border-color: $color-brand; color: $color-white; }
}

.color-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: space-around; }

.color-card-sm {
  width: 36px; height: 36px; border-radius: $radius-md;
  border: 2px solid rgba(255, 255, 255, 0.1);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all $duration-normal $easing-default;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);

  &:hover { transform: scale(1.08); }
  &.active { border-color: $color-brand; }
}

.setting-controls {
  display: flex; flex-direction: row; gap: $spacing-md;
  border-bottom: none !important;
}

.control-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: $font-size-md; color: #ccc;
}

.page-mode-trigger {
  cursor: pointer; padding: $spacing-sm 0;
  transition: color $duration-fast $easing-default;

  &:hover { color: $color-white; }
}

.pm-trigger-right { display: flex; align-items: center; gap: $spacing-xs; color: #888; }
.pm-current { font-size: $font-size-base; }
.pm-arrow { color: #666; }

/* ========== 三级面板 ========== */
.level3-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: $color-panel-overlay; z-index: $z-index-overlay;
  display: flex; align-items: center; justify-content: center;
}

.level3-panel {
  width: 100%; max-width: 480px;
  background: rgba(30, 30, 30, 0.98); backdrop-filter: blur(20px);
  border-radius: $radius-3xl; color: $color-panel-text;
  overflow: hidden;
}

.l3-header {
  display: flex; align-items: center; padding: $spacing-base $spacing-lg;
  border-bottom: 1px solid $color-panel-border;
}

.l3-back {
  display: flex; align-items: center; gap: $spacing-xs;
  background: none; border: none; color: $color-brand;
  font-size: $font-size-md; cursor: pointer; padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm; transition: background $duration-fast $easing-default;

  &:hover { background: $color-brand-light; }
}

.l3-title { flex: 1; text-align: center; font-size: $font-size-lg; font-weight: 600; }
.l3-spacer { width: 70px; }

.l3-grid {
  display: flex; flex-wrap: wrap; gap: $spacing-md;
  justify-content: center; padding: $spacing-xl $spacing-lg $spacing-2xl;
}

.pm-card {
  display: flex; flex-direction: column; align-items: center; gap: $spacing-sm;
  width: 72px; padding: 14px $spacing-xs;
  background: $color-panel-surface;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: $radius-xl; cursor: pointer;
  transition: all $duration-normal $easing-default; position: relative;

  &:hover { border-color: rgba(255, 255, 255, 0.2); background: $color-panel-surface-hover; }
  &.active { border-color: $color-brand; background: $color-brand-light; }
}

.pm-card-icon {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  color: #999;
}

.pm-card.active .pm-card-icon { color: $color-brand; }
.pm-card-icon :deep(svg) { width: 100%; height: 100%; }
.pm-card-name { font-size: $font-size-sm; color: #bbb; white-space: nowrap; }
.pm-card.active .pm-card-name { color: $color-brand; }
.pm-card-check { position: absolute; top: $spacing-xs; right: $spacing-xs; }

/* ========== 自动阅读专属面板 ========== */
.auto-read-panel {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: $z-index-auto-read;
  background: $color-panel-bg; backdrop-filter: blur(16px);
  color: $color-panel-text; padding: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);

  &.panel-wide {
    max-width: 480px;
    margin: 0 auto;
    border-radius: $radius-2xl $radius-2xl 0 0;
  }
}

.arp-speed { padding: $spacing-base $spacing-lg $spacing-md; }

.arp-speed-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px; font-size: $font-size-base; color: #aaa;
}

.speed-value { color: $color-brand; font-weight: 600; font-size: $font-size-lg; }

.arp-speed-track { display: flex; align-items: center; gap: 10px; }

.arp-speed-track input[type="range"] {
  flex: 1; @include slider-track;
}

.arp-speed-track input[type="range"]::-webkit-slider-thumb {
  @include slider-thumb(18px);
}

.speed-tip { font-size: $font-size-xs; color: #666; }

.arp-mode {
  display: flex; gap: $spacing-sm; padding: 0 $spacing-lg $spacing-base;
}

.arp-mode-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: $spacing-sm;
  padding: 10px; border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: $radius-lg; cursor: pointer;
  font-size: $font-size-base; color: #999; transition: all $duration-normal $easing-default;

  &:hover { border-color: rgba(255, 255, 255, 0.25); color: #ddd; }
  &.active { border-color: $color-brand; background: $color-brand-medium; color: $color-brand; }
}

.arp-exit-btn {
  display: block; width: calc(100% - 40px); margin: 0 $spacing-lg $spacing-base;
  padding: $spacing-md; border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: $radius-lg; background: $color-panel-surface;
  color: #ccc; font-size: $font-size-md; cursor: pointer;
  text-align: center; transition: all $duration-normal $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.08); color: $color-white; }
}
</style>
