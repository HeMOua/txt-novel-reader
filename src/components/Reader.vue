<template>
  <div
    class="reader-container"
    :class="{ 'night-mode': settings.nightMode }"
    :style="readerStyle"
    @click="onReaderClick"
  >
    <!-- 阅读内容区域：滚动模式或翻页模式 -->
    <ReaderContent
      v-if="!isPaged"
      ref="readerContentRef"
      :content-style="contentStyle"
      :night-mode="settings.nightMode"
      :paragraph-spacing="settings.paragraphSpacing"
      @scroll="onScroll"
    />
    <PagedContent
      v-else
      ref="pagedRef"
      :viewport-style="viewportStyle"
      :night-mode="settings.nightMode"
      :paragraph-spacing="settings.paragraphSpacing"
      :page-background="settings.nightMode ? '#1a1a1a' : settings.bgColor"
    />

    <!-- 常驻左上角章节信息 -->
    <div class="chapter-label-fixed" v-if="!showAnyPanel">{{ currentChapterLabel }}</div>

    <!-- 常驻底部信息栏 -->
    <ReaderInfoBar
      v-if="!showAnyPanel"
      :progress="progress"
      :current-time="currentTime"
      :night-mode="settings.nightMode"
    />

    <!-- 顶部栏 - 面板可见时显示 -->
    <transition name="slide-down">
      <ReaderTopBar
        v-if="showAnyPanel"
        :chapter-label="currentChapterLabel"
        @back="emit('back')"
      />
    </transition>

    <!-- 自动阅读专属面板 -->
    <transition name="slide-up">
      <AutoReadPanel
        v-if="showAutoReadPanel"
        :settings="settings"
        :is-wide-window="isWideWindow"
        @exit="stopAndExitAutoRead"
        @set-mode="setReadingMode"
        @update:auto-read-speed="onAutoReadSpeedChange"
      />
    </transition>

    <!-- 二级面板（外层为面板容器，内容按 activeLevel2 切换为子组件） -->
    <transition name="slide-up">
      <div
        v-if="showPanelSystem && activeLevel2"
        class="level2-panel"
        :class="['l2-' + activeLevel2, { 'panel-wide': isWideWindow }]"
        @click.stop
      >
        <ChapterNavPanel
          v-if="activeLevel2 === 'default'"
          :current-chapter-index="currentChapterIndex"
          :total-chapters="totalChapters"
          :slider-chapter="sliderChapter"
          @prev="prevChapter"
          @next="nextChapter"
          @slider-change="onSliderChange"
        />
        <CatalogPanel
          v-else-if="activeLevel2 === 'catalog'"
          :book-title="bookTitle"
          :total-chapters="totalChapters"
          :current-chapter-index="currentChapterIndex"
          :display-chapters="displayChapters"
          :catalog-tabs="catalogTabs"
          v-model:active-catalog-tab="activeCatalogTab"
          v-model:catalog-reverse="catalogReverse"
          @jump-from-catalog="jumpFromCatalog"
        />
        <NightPanel
          v-else-if="activeLevel2 === 'night'"
          :night-mode="settings.nightMode"
          :current-theme="settings.theme"
          :themes="THEMES"
          @toggle-night="toggleNightMode"
          @set-theme="setTheme"
        />
        <SettingsPanel
          v-else-if="activeLevel2 === 'settings'"
          :settings="settings"
          :themes="THEMES"
          :font-families="FONT_FAMILIES"
          :line-height-presets="LINE_HEIGHT_PRESETS"
          :auto-reading="autoReading"
          @change-font-size="changeFontSize"
          @set-line-height="setLineHeight"
          @set-theme="setTheme"
          @change-font-family="changeFontFamily"
          @start-auto-read="startAutoReadFromSettings"
          @set-reading-mode="setReadingMode"
        />
      </div>
    </transition>

    <!-- 一级面板 -->
    <transition name="slide-up">
      <Level1Panel
        v-if="showPanelSystem && !autoReading"
        :active-level2="activeLevel2"
        :night-mode="settings.nightMode"
        @set-level2="setLevel2"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { getSettings, saveSettings, THEMES, LINE_HEIGHT_PRESETS, FONT_FAMILIES } from '@/utils/bookStore.js'

// 阅读器子组件
import ReaderContent from '@/modules/reader/components/ReaderContent.vue'
import PagedContent from '@/modules/reader/components/PagedContent.vue'
import ReaderInfoBar from '@/modules/reader/components/ReaderInfoBar.vue'
import ReaderTopBar from '@/modules/reader/components/ReaderTopBar.vue'
import AutoReadPanel from '@/modules/reader/components/AutoReadPanel.vue'
import Level1Panel from '@/modules/reader/components/Level1Panel.vue'
import ChapterNavPanel from '@/modules/reader/components/ChapterNavPanel.vue'
import CatalogPanel from '@/modules/reader/components/CatalogPanel.vue'
import NightPanel from '@/modules/reader/components/NightPanel.vue'
import SettingsPanel from '@/modules/reader/components/SettingsPanel.vue'
import { CATALOG_TABS } from '@/modules/reader/constants.js'

// Composables
import { useClock } from '@/composables/useClock'
import { useWindowWidth } from '@/composables/useWindowWidth'
import { usePanelSystem } from '@/composables/usePanelSystem'
import { useKeyboard } from '@/composables/useKeyboard'
import { useProgress } from '@/composables/useProgress'
import { useChapterRenderer } from '@/composables/useChapterRenderer'
import { useAutoRead } from '@/composables/useAutoRead'
import { usePagedReader } from '@/composables/usePagedReader'

const props = defineProps({
  book: { type: Object, required: true }
})
const emit = defineEmits(['back'])

// ========== Composables ==========
const { currentTime } = useClock()
const { isWideWindow } = useWindowWidth()
const {
  showPanelSystem, activeLevel2, showAutoReadPanel, showAnyPanel,
  setLevel2, closeAllPanels, showDefaultPanel, showAutoRead, hideAutoRead, hideAllPanels,
} = usePanelSystem()

// ========== 自动阅读状态 ==========
const autoReading = ref(false)

// ========== 目录状态 ==========
const activeCatalogTab = ref('catalog')
const catalogReverse = ref(false)
const catalogTabs = CATALOG_TABS

// ========== 基础状态 ==========
const progress = ref(props.book.progress || 0)
const sliderChapter = ref(props.book.currentChapterIndex || 0)
const readerContentRef = ref(null)
const scrollArea = ref(null)
const contentEl = ref(null)
const currentChapterIndex = ref(props.book.currentChapterIndex || 0)

// ========== 翻页模式状态 ==========
const isPaged = computed(() => settings.value.readingMode === 'paged')
const pagedRef = ref(null)
const pagedViewport = ref(null)
const pagedBaseLayer = ref(null)
const pagedBaseFlow = ref(null)
const pagedCoverMask = ref(null)
const pagedIncomingLayer = ref(null)
const pagedIncomingFlow = ref(null)

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

// ========== 样式 ==========
const readerStyle = computed(() => ({
  background: settings.value.nightMode ? '#1a1a1a' : settings.value.bgColor,
  color: settings.value.nightMode ? '#888' : settings.value.fontColor,
}))

const baseTextStyle = computed(() => {
  const ff = FONT_FAMILIES.find(f => f.id === settings.value.fontFamily)
  return {
    fontSize: settings.value.fontSize + 'px',
    fontFamily: ff ? ff.value : '',
    lineHeight: settings.value.lineHeight,
  }
})

const contentStyle = computed(() => ({
  ...baseTextStyle.value,
  paddingTop: '24px',
  paddingBottom: '80px',
  paddingLeft: settings.value.leftMargin + 'px',
  paddingRight: settings.value.leftMargin + 'px',
  width: (settings.value.contentWidth || 80) + '%',
}))

const viewportStyle = computed(() => ({
  ...baseTextStyle.value,
  paddingLeft: (settings.value.leftMargin || 0) + 'px',
  width: (settings.value.contentWidth || 80) + '%',
  margin: '0 auto',
}))

// ========== 章节渲染器 ==========
const renderer = useChapterRenderer({
  contentEl,
  scrollArea,
  chapters,
  fullText,
  currentChapterIndex,
  onChapterChange: (idx) => { currentChapterIndex.value = idx },
})

// ========== 分页引擎 ==========
const paged = usePagedReader({
  viewportEl: pagedViewport,
  baseLayerEl: pagedBaseLayer,
  baseFlowEl: pagedBaseFlow,
  coverMaskEl: pagedCoverMask,
  incomingLayerEl: pagedIncomingLayer,
  incomingFlowEl: pagedIncomingFlow,
  settings,
  chapters,
  fullText,
  currentChapterIndex,
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
  isPaged,
  pagedTurnNext: (duration) => paged.turnNext(duration),
  afterPagedTurn,
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
/** 滚屏模式下当前章内滚动比例（0~1） */
function currentScrollRatio() {
  const chDom = renderer.chapterDomMap.get(currentChapterIndex.value)
  if (chDom && scrollArea.value) {
    const chH = chDom.offsetHeight
    const containerH = scrollArea.value.clientHeight
    if (chH > containerH) {
      return Math.max(0, Math.min(1,
        (scrollArea.value.scrollTop - chDom.offsetTop) / (chH - containerH)
      ))
    }
  }
  return 0
}

function saveReadingProgressWithRatio() {
  saveReadingProgress(currentScrollRatio())
}

function restorePosition() {
  const savedChapterIndex = props.book.currentChapterIndex || 0
  const savedScrollRatio = props.book.currentScrollRatio || 0

  currentChapterIndex.value = savedChapterIndex
  sliderChapter.value = savedChapterIndex

  renderer.rebuildWindow(savedChapterIndex, savedScrollRatio)
}

// ========== 翻页操作 ==========
const MANUAL_TURN_MS = 280

async function pagedNext() {
  if (paged.isAnimating()) return
  const { atEnd } = await paged.turnNext(MANUAL_TURN_MS)
  if (!atEnd) afterPagedTurn()
}
async function pagedPrev() {
  if (paged.isAnimating()) return
  const { atStart } = await paged.turnPrev(MANUAL_TURN_MS)
  if (!atStart) afterPagedTurn()
}
function afterPagedTurn() {
  updatePagedProgress()
  sliderChapter.value = currentChapterIndex.value
  saveReadingProgress(paged.pageRatio())
}
function updatePagedProgress() {
  const totalChars = fullText.value.length
  const chMeta = chapters.value[currentChapterIndex.value]
  if (totalChars > 0 && chMeta) {
    const readChars = chMeta.start + paged.pageRatio() * (chMeta.end - chMeta.start)
    progress.value = Math.min(100, (readChars / totalChars) * 100)
  }
}

// ========== 章节跳转 ==========
function jumpToChapter(index) {
  if (index < 0 || index >= totalChapters.value) return
  currentChapterIndex.value = index
  sliderChapter.value = index
  if (isPaged.value) { paged.layout(0); updatePagedProgress() }
  else { renderer.rebuildWindow(index, 0) }
}
function jumpFromCatalog(index) {
  jumpToChapter(index)
  hideAllPanels()
}
function prevChapter() { jumpToChapter(currentChapterIndex.value - 1) }
function nextChapter() { jumpToChapter(currentChapterIndex.value + 1) }
function onSliderChange(value) {
  sliderChapter.value = Number(value)
  jumpToChapter(sliderChapter.value)
}

// ========== 设置 ==========
function changeFontSize(delta) {
  settings.value.fontSize = Math.max(12, Math.min(36, settings.value.fontSize + delta))
  onSettingsChange()
}
function setLineHeight(value) { settings.value.lineHeight = value; onSettingsChange() }
function changeFontFamily(value) { settings.value.fontFamily = value; onSettingsChange() }
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
function onSettingsChange() {
  saveSettings(settings.value)
  if (isPaged.value) {
    const ratio = paged.pageRatio()
    nextTick(() => { paged.layout(null, ratio); updatePagedProgress() })
  }
}
function onAutoReadSpeedChange(value) {
  settings.value.autoReadSpeed = value
  onSettingsChange()
}
function setReadingMode(mode) {
  if (settings.value.readingMode === mode) return
  const wasAuto = autoReading.value
  if (wasAuto) autoRead.stopAutoRead()
  // 切换前捕获当前章内位置比例，切换后沿用以保持阅读进度
  const ratio = isPaged.value ? paged.pageRatio() : currentScrollRatio()
  settings.value.readingMode = mode
  saveSettings(settings.value)
  nextTick(() => {
    if (isPaged.value) {
      bindPagedEls()
      paged.layout(null, ratio)
      updatePagedProgress()
    } else {
      scrollArea.value = readerContentRef.value?.scrollArea || null
      contentEl.value = readerContentRef.value?.contentEl || null
      renderer.rebuildWindow(currentChapterIndex.value, ratio)
    }
    if (wasAuto) { autoReading.value = true; autoRead.startAutoRead() }
  })
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

// 面板打开时暂停自动阅读
watch([showPanelSystem, activeLevel2, showAutoReadPanel], () => {
  if (!autoReading.value) return
  const shouldPause = showPanelSystem.value || showAutoReadPanel.value
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

  if (showPanelSystem.value) {
    hideAllPanels()
    return
  }

  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  if (isPaged.value) {
    if (x > 0.33 && x < 0.67) {
      autoReading.value ? showAutoRead() : showDefaultPanel()
    } else if (x <= 0.33) {
      pagedPrev()
    } else {
      pagedNext()
    }
    return
  }
  if (y > 0.25 && y < 0.75) {
    if (autoReading.value) { showAutoRead() } else { showDefaultPanel() }
  } else if (y <= 0.25) {
    scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  } else {
    scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  }
}

// ========== 键盘快捷键 ==========
function handleEscape() {
  if (showAutoReadPanel.value) {
    showAutoReadPanel.value = false
  } else if (showPanelSystem.value && activeLevel2.value && activeLevel2.value !== 'default') {
    activeLevel2.value = 'default'
  } else if (showPanelSystem.value) {
    hideAllPanels()
  } else {
    emit('back')
  }
}

useKeyboard({
  onPrev: () => isPaged.value
    ? pagedPrev()
    : scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }),
  onNext: () => isPaged.value
    ? pagedNext()
    : scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }),
  onEscape: handleEscape,
})

// ========== 初始化 ==========
function bindPagedEls() {
  const c = pagedRef.value
  if (!c) return
  pagedViewport.value = c.viewport
  pagedBaseLayer.value = c.baseLayer
  pagedBaseFlow.value = c.baseFlow
  pagedCoverMask.value = c.coverMask
  pagedIncomingLayer.value = c.incomingLayer
  pagedIncomingFlow.value = c.incomingFlow
}

let pagedResizeRaf = null
function onPagedResize() {
  if (!isPaged.value || pagedResizeRaf) return
  pagedResizeRaf = requestAnimationFrame(() => {
    pagedResizeRaf = null
    if (!isPaged.value) return
    const ratio = paged.pageRatio()
    paged.layout(null, ratio)
    updatePagedProgress()
  })
}

onMounted(() => {
  nextTick(() => {
    const ratio = props.book.currentScrollRatio || 0
    currentChapterIndex.value = props.book.currentChapterIndex || 0
    sliderChapter.value = currentChapterIndex.value
    if (isPaged.value) {
      bindPagedEls()
      paged.layout(null, ratio)
      updatePagedProgress()
    } else {
      scrollArea.value = readerContentRef.value?.scrollArea || null
      contentEl.value = readerContentRef.value?.contentEl || null
      renderer.setIsRestoring(true)
      restorePosition()
      setTimeout(() => { renderer.setIsRestoring(false) }, 300)
    }
  })
  window.addEventListener('resize', onPagedResize)
})

onUnmounted(() => {
  autoRead.stopAutoRead()
  flushReadingProgress()
  window.removeEventListener('resize', onPagedResize)
  paged.destroy()
})
</script>

<style lang="scss" scoped>
/* ========== 根容器 ========== */
.reader-container {
  position: relative; height: 100vh;
  display: flex; flex-direction: column; overflow: hidden;
  transition: background $duration-slow $easing-default, color $duration-slow $easing-default;
}

/* 常驻左上角章节信息 */
.chapter-label-fixed {
  position: absolute; top: $spacing-sm; left: $spacing-base;
  font-size: $font-size-sm; z-index: $z-index-info;
  color: v-bind('settings.nightMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"');
  pointer-events: none; max-width: 60%;
  @include text-ellipsis;
}

/* ========== 二级面板容器（内容由子组件渲染） ========== */
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

/* 设置二级 */
.level2-panel.l2-settings {
  max-width: 400px;
  max-height: calc(70vh - 56px);
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}
</style>
