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
        <button class="l1-btn" :class="{ active: activeLevel2 === 'catalog' }" @click="setLevel2('catalog')">
          <span class="l1-icon"><SvgIcon name="catalog" :size="22" /></span>
          <span>目录</span>
        </button>
        <button class="l1-btn" :class="{ active: activeLevel2 === 'night' }" @click="setLevel2('night')">
          <span class="l1-icon"><SvgIcon :name="settings.nightMode ? 'sun' : 'moon'" :size="22" /></span>
          <span>{{ settings.nightMode ? '日间' : '夜间' }}</span>
        </button>
        <button class="l1-btn" :class="{ active: activeLevel2 === 'settings' }" @click="setLevel2('settings')">
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
import { getChapterText, calcProgress } from '../utils/chapterParser.js'
import { getSettings, saveSettings, THEMES, LINE_HEIGHT_PRESETS, FONT_FAMILIES, updateProgress, flushProgress } from '../utils/bookStore.js'
import SvgIcon from './SvgIcon.vue'

const props = defineProps({
  book: { type: Object, required: true }
})
const emit = defineEmits(['back'])

// ========== 面板状态 ==========
const showPanelSystem = ref(false)  // 一级+二级面板系统可见
const activeLevel2 = ref(null)       // 'default' | 'catalog' | 'night' | 'settings' | null
const showLevel3 = ref(false)        // 三级面板（翻页方式）
const showAutoReadPanel = ref(false) // 自动阅读专属面板
const prevLevel2 = ref(null)         // 三级面板打开前的二级面板记忆

const showAnyPanel = computed(() => showPanelSystem.value || showAutoReadPanel.value || showLevel3.value)

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

const currentPageModeName = computed(() => {
  const m = pageModes.find(p => p.id === settings.value.autoReadMode)
  return m ? m.name : '上下滑动'
})

// ========== 基础状态 ==========
const isWideWindow = ref(false)
const currentTime = ref('')
const progress = ref(props.book.progress || 0)
const sliderChapter = ref(props.book.currentChapterIndex || 0)
const scrollArea = ref(null)
const contentEl = ref(null)
const catalogList = ref(null)
const currentChapterIndex = ref(props.book.currentChapterIndex || 0)

let autoReadTimer = null
let autoReadRaf = null

// ========== 滑动窗口渲染 ==========
const MAX_RANGE = 4
const BUFFER_AHEAD = 1

const rangeStart = ref(0)
const rangeEnd = ref(0)
const chapterDomMap = new Map()

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

// ========== 核心渲染 ==========

function renderChapterDom(chapterIdx) {
  const meta = chapters.value[chapterIdx]
  if (!meta) return null

  const container = document.createElement('div')
  container.className = 'chapter-block'
  container.dataset.chapterIndex = chapterIdx

  const header = document.createElement('div')
  header.className = 'chapter-header'
  const title = document.createElement('h2')
  title.className = 'chapter-title-inline'
  title.textContent = meta.title
  header.appendChild(title)
  container.appendChild(header)

  const body = document.createElement('div')
  body.className = 'chapter-body'
  container.appendChild(body)

  const text = getChapterText(fullText.value, meta)
  const lines = text.split('\n').filter(l => l.trim())

  if (lines.length === 0) {
    body.innerHTML = '<p style="color:#999;text-align:center">（本章无内容）</p>'
    return container
  }

  const fragment = document.createDocumentFragment()
  for (const line of lines) {
    const p = document.createElement('p')
    p.textContent = line.trim()
    fragment.appendChild(p)
  }
  body.appendChild(fragment)

  return container
}

function rebuildWindow(centerIdx, scrollRatio = 0) {
  if (!contentEl.value) return

  contentEl.value.innerHTML = ''
  chapterDomMap.clear()

  const start = Math.max(0, centerIdx - BUFFER_AHEAD)
  const end = Math.min(totalChapters.value - 1, centerIdx + BUFFER_AHEAD)
  rangeStart.value = start
  rangeEnd.value = end

  for (let i = start; i <= end; i++) {
    const dom = renderChapterDom(i)
    if (dom) {
      contentEl.value.appendChild(dom)
      chapterDomMap.set(i, dom)
    }
  }

  isRestoring = true
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!scrollArea.value) return
      const targetDom = chapterDomMap.get(centerIdx)
      if (targetDom && scrollRatio > 0) {
        const chapterH = targetDom.offsetHeight
        const containerH = scrollArea.value.clientHeight
        scrollArea.value.scrollTop = targetDom.offsetTop + Math.round(scrollRatio * Math.max(0, chapterH - containerH))
      } else if (targetDom) {
        scrollArea.value.scrollTop = targetDom.offsetTop
      }
      setTimeout(() => { isRestoring = false }, 100)
    })
  })
}

function appendChapterBelow() {
  const nextIdx = rangeEnd.value + 1
  if (nextIdx >= totalChapters.value) return
  if (!contentEl.value) return

  const dom = renderChapterDom(nextIdx)
  if (dom) {
    contentEl.value.appendChild(dom)
    chapterDomMap.set(nextIdx, dom)
    rangeEnd.value = nextIdx
  }

  trimFromTop()
}

function prependChapterAbove() {
  const prevIdx = rangeStart.value - 1
  if (prevIdx < 0) return
  if (!contentEl.value || !scrollArea.value) return

  const oldScrollTop = scrollArea.value.scrollTop
  const oldScrollHeight = scrollArea.value.scrollHeight

  const dom = renderChapterDom(prevIdx)
  if (!dom) return

  contentEl.value.insertBefore(dom, contentEl.value.firstChild)
  chapterDomMap.set(prevIdx, dom)
  rangeStart.value = prevIdx

  isRestoring = true
  requestAnimationFrame(() => {
    if (!scrollArea.value) { isRestoring = false; return }
    const newScrollHeight = scrollArea.value.scrollHeight
    scrollArea.value.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
    isRestoring = false

    trimFromBottom()
  })
}

function trimFromTop() {
  while (rangeEnd.value - rangeStart.value + 1 > MAX_RANGE && rangeStart.value < currentChapterIndex.value - 1) {
    const dom = chapterDomMap.get(rangeStart.value)
    if (dom) dom.remove()
    chapterDomMap.delete(rangeStart.value)
    rangeStart.value++
  }
}

function trimFromBottom() {
  while (rangeEnd.value - rangeStart.value + 1 > MAX_RANGE && rangeEnd.value > currentChapterIndex.value + 1) {
    const dom = chapterDomMap.get(rangeEnd.value)
    if (dom) dom.remove()
    chapterDomMap.delete(rangeEnd.value)
    rangeEnd.value--
  }
}

// ========== 滚动追踪 ==========
let isRestoring = false
let scrollThrottle = null

function onScroll() {
  if (isRestoring) return
  if (!scrollArea.value) return
  if (scrollThrottle) return
  scrollThrottle = requestAnimationFrame(() => {
    scrollThrottle = null
    if (!scrollArea.value) return

    const { scrollTop, scrollHeight, clientHeight } = scrollArea.value

    const viewportCenter = scrollTop + clientHeight / 2
    let detectedChapter = currentChapterIndex.value
    for (const [idx, dom] of chapterDomMap) {
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
      const chDom = chapterDomMap.get(detectedChapter)
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
      appendChapterBelow()
    }

    if (scrollTop <= 200 && rangeStart.value > 0) {
      prependChapterAbove()
    }
  })
}

// ========== 进度保存/恢复 ==========
function saveReadingProgress() {
  const chDom = chapterDomMap.get(currentChapterIndex.value)
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
  updateProgress(props.book.filePath, currentChapterIndex.value, scrollRatio, progress.value)
}

function restorePosition() {
  const savedChapterIndex = props.book.currentChapterIndex || 0
  const savedScrollRatio = props.book.currentScrollRatio || 0

  currentChapterIndex.value = savedChapterIndex
  sliderChapter.value = savedChapterIndex

  rebuildWindow(savedChapterIndex, savedScrollRatio)
}

// ========== 章节跳转 ==========
function jumpToChapter(index) {
  if (index < 0 || index >= totalChapters.value) return
  currentChapterIndex.value = index
  sliderChapter.value = index
  rebuildWindow(index, 0)
}
function jumpFromCatalog(index) {
  jumpToChapter(index)
  showPanelSystem.value = false
  activeLevel2.value = null
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
  if (autoReading.value) { stopAutoRead(); startAutoRead() }
}

// ========== 自动阅读引擎 ==========
let coverOverlayEl = null
let autoReadPaused = false

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
      isRestoring = true
      scrollEl.scrollTop = scrollEl.scrollTop + pageStep
      if (scrollEl.scrollTop + H >= scrollEl.scrollHeight - 200) {
        appendChapterBelow()
      }
      requestAnimationFrame(() => {
        isRestoring = false
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

// ========== 面板交互逻辑 ==========

/** 从设置面板开启自动阅读 */
function startAutoReadFromSettings() {
  autoReading.value = true
  showPanelSystem.value = false
  activeLevel2.value = null
  startAutoRead()
}

/** 从自动阅读面板退出 */
function stopAndExitAutoRead() {
  autoReading.value = false
  showAutoReadPanel.value = false
  stopAutoRead()
}

/** 切换二级面板 */
function setLevel2(panel) {
  if (activeLevel2.value === panel) return
  activeLevel2.value = panel
  if (!showPanelSystem.value) showPanelSystem.value = true

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

/** 选择翻页方式 */
function selectPageMode(modeId) {
  setAutoReadMode(modeId)
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

// 面板打开时暂停自动阅读
watch([showPanelSystem, activeLevel2, showLevel3, showAutoReadPanel], () => {
  if (!autoReading.value) return
  const shouldPause = showPanelSystem.value || showLevel3.value || showAutoReadPanel.value
  if (shouldPause && !autoReadPaused) {
    autoReadPaused = true
    if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
    if (coverOverlayEl) { coverOverlayEl.remove(); coverOverlayEl = null }
  } else if (!shouldPause && autoReadPaused) {
    autoReadPaused = false
    startAutoRead()
  }
})

// ========== 交互点击 ==========
function onReaderClick(e) {
  // 优先级 1：自动阅读面板打开 → 关闭它
  if (showAutoReadPanel.value) {
    showAutoReadPanel.value = false
    return
  }

  // 优先级 2：三级面板打开 → 由 overlay 处理，不会到这里
  if (showLevel3.value) return

  // 优先级 3：普通面板打开 → 关闭所有面板
  if (showPanelSystem.value) {
    showPanelSystem.value = false
    activeLevel2.value = null
    return
  }

  // 优先级 4：无面板 → 按区域处理
  const rect = e.currentTarget.getBoundingClientRect()
  const zone = (e.clientY - rect.top) / rect.height
  if (zone > 0.25 && zone < 0.75) {
    if (autoReading.value) {
      // 自动阅读状态 → 显示专属面板
      showAutoReadPanel.value = true
    } else {
      // 普通状态 → 显示一级面板 + 默认二级面板
      showPanelSystem.value = true
      activeLevel2.value = 'default'
    }
  } else if (zone <= 0.25) {
    scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  } else {
    scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  }
}

// ========== 键盘快捷键 ==========
function onKeyDown(e) {
  switch (e.key) {
    case 'ArrowLeft': case 'ArrowUp':
      scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }); e.preventDefault(); break
    case 'ArrowRight': case 'ArrowDown': case ' ':
      scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }); e.preventDefault(); break
    case 'Escape': handleEscape(); e.preventDefault(); break
  }
}

function handleEscape() {
  if (showAutoReadPanel.value) {
    showAutoReadPanel.value = false
  } else if (showLevel3.value) {
    closeLevel3()
  } else if (showPanelSystem.value && activeLevel2.value && activeLevel2.value !== 'default') {
    activeLevel2.value = 'default'
  } else if (showPanelSystem.value) {
    showPanelSystem.value = false
    activeLevel2.value = null
  } else {
    emit('back')
  }
}

function updateClock() {
  const now = new Date()
  currentTime.value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
}

// ========== 初始化 ==========
let clockTimer = null

function checkWindowWidth() {
  isWideWindow.value = window.innerWidth >= 600
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 10000)
  document.addEventListener('keydown', onKeyDown)
  checkWindowWidth()
  window.addEventListener('resize', checkWindowWidth)

  nextTick(() => {
    isRestoring = true
    restorePosition()
    setTimeout(() => { isRestoring = false }, 300)
  })
})

onUnmounted(() => {
  clearInterval(clockTimer)
  stopAutoRead()
  flushProgress()
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', checkWindowWidth)
})
</script>

<style scoped>
/* ========== 阅读区域 ========== */
.reader-container {
  position: relative; height: 100vh;
  display: flex; flex-direction: column; overflow: hidden;
  transition: background 0.3s, color 0.3s;
}
.reader-scroll { flex: 1; overflow-y: auto; scroll-behavior: auto; scrollbar-width: none; -ms-overflow-style: none; }
.reader-scroll::-webkit-scrollbar { display: none; }
.reader-content { margin: 0 auto; word-wrap: break-word; text-align: justify; user-select: text; }

/* 章节块 */
.chapter-block { margin-bottom: 0; }
.chapter-header { padding: 28px 0 16px; border-bottom: 1px solid v-bind('settings.nightMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"'); margin-bottom: 16px; }
.chapter-title-inline { font-size: 1.2em; font-weight: 700; text-align: center; color: inherit; opacity: 0.85; }
.chapter-body :deep(p) { text-indent: 2em; margin-bottom: v-bind('settings.paragraphSpacing + "px"'); line-height: inherit; }

/* 常驻信息 */
.chapter-label-fixed {
  position: absolute; top: 8px; left: 16px; font-size: 12px; z-index: 5;
  color: v-bind('settings.nightMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"');
  pointer-events: none; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.reader-info-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; padding: 4px 20px;
  font-size: 11px; color: v-bind('settings.nightMode ? "#555" : "#bbb"');
  pointer-events: none; z-index: 5;
}

/* ========== 顶部栏 ========== */
.panel-top-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 40;
  display: flex; align-items: center; padding: 10px 16px;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); color: #eee;
}
.back-btn { background: none; border: none; color: #eee; font-size: 14px; cursor: pointer; padding: 4px 10px; border-radius: 4px; white-space: nowrap; }
.back-btn:hover { background: rgba(255,255,255,0.1); }
.top-bar-title { flex: 1; text-align: center; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc; }
.top-spacer { width: 60px; }

/* ========== 一级面板 ========== */
.level1-panel {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 30;
  height: 56px;
  background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: space-around;
  color: #ccc;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.l1-btn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  background: none; border: none; color: #999; font-size: 11px;
  cursor: pointer; padding: 6px 20px; border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.l1-btn:hover { color: #ddd; background: rgba(255,255,255,0.05); }
.l1-btn.active { color: #e67e22; }
.l1-icon { display: flex; align-items: center; justify-content: center; }

/* ========== 二级面板 - 基础 ========== */
.level2-panel {
  position: absolute; left: 0; right: 0; z-index: 25;
  background: rgba(0,0,0,0.95); backdrop-filter: blur(16px);
  color: #eee;
}
.level2-panel.panel-wide {
  max-width: 520px;
  margin: 0 auto;
  border-radius: 14px 14px 0 0;
}

/* 默认二级：章节导航 */
.level2-panel.l2-default {
  bottom: 56px;
  padding: 10px 16px 14px;
}
.nav-row { display: flex; align-items: center; gap: 10px; }
.nav-btn {
  background: none; border: none; color: #ccc; font-size: 13px;
  cursor: pointer; padding: 6px 12px; border-radius: 6px; white-space: nowrap;
  transition: all 0.15s;
}
.nav-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.progress-slider { flex: 1; padding: 0 4px; }
.slider { width: 100%; height: 4px; -webkit-appearance: none; appearance: none; background: #444; border-radius: 2px; outline: none; }
.slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #e67e22; cursor: pointer; }

/* 目录二级 */
.level2-panel.l2-catalog {
  bottom: auto; top: 44px; /* 顶部栏高度 */
  height: calc(50vh - 44px);
  display: flex; flex-direction: column;
  border-radius: 0 0 14px 14px;
  overflow: hidden;
}
.level2-panel.l2-catalog.panel-wide {
  max-width: 600px;
  border-radius: 0 0 14px 14px;
}
.catalog-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.catalog-tabs {
  display: flex; border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 0 8px; flex-shrink: 0;
}
.cat-tab {
  flex: 1; padding: 10px 0; background: none; border: none;
  color: #888; font-size: 14px; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.2s;
}
.cat-tab:hover { color: #bbb; }
.cat-tab.active { color: #e67e22; border-bottom-color: #e67e22; }
.catalog-info-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; font-size: 12px; color: #888;
  border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.cat-book-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-chapter-count { color: #666; }
.cat-sort-btn {
  background: none; border: none; color: #888; cursor: pointer;
  padding: 4px; display: flex; align-items: center; transition: color 0.15s;
}
.cat-sort-btn:hover { color: #eee; }
.catalog-list {
  flex: 1; overflow-y: auto; padding: 4px 0;
  scrollbar-width: thin; scrollbar-color: #333 transparent;
}
.catalog-list::-webkit-scrollbar { width: 4px; }
.catalog-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
.catalog-item {
  display: flex; align-items: center; padding: 10px 16px;
  cursor: pointer; font-size: 14px; color: #bbb; transition: background 0.15s;
}
.catalog-item:hover { background: rgba(255,255,255,0.05); }
.catalog-item.active { color: #e67e22; background: rgba(230,126,34,0.1); }
.chapter-index { width: 36px; font-size: 12px; color: #666; flex-shrink: 0; }
.catalog-item.active .chapter-index { color: #e67e22; }
.chapter-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 夜间二级 */
.level2-panel.l2-night {
  bottom: 56px;
  padding: 16px;
}
.night-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0 16px;
}
.night-label { font-size: 15px; color: #ddd; }
.toggle-switch {
  position: relative; width: 44px; height: 24px;
  background: #444; border-radius: 12px;
  cursor: pointer; transition: background 0.3s;
  flex-shrink: 0;
}
.toggle-switch.on { background: #e67e22; }
.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px; background: #fff;
  border-radius: 50%; transition: transform 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle-switch.on .toggle-thumb { transform: translateX(20px); }
.night-colors {
  display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;
  padding: 8px 0;
}
.color-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer; transition: transform 0.15s;
}
.color-card:hover { transform: scale(1.05); }
.color-swatch {
  width: 44px; height: 44px; border-radius: 10px;
  border: 2px solid rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.color-card.active .color-swatch { border-color: #e67e22; }
.color-name { font-size: 11px; color: #888; }
.color-card.active .color-name { color: #e67e22; }

/* 设置二级 */
.level2-panel.l2-settings {
  bottom: 56px;
  padding: 12px 16px 16px;
  max-height: calc(70vh - 56px);
  overflow-y: auto;
  scrollbar-width: none;
}
.level2-panel.l2-settings::-webkit-scrollbar { display: none; }
.setting-section {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.setting-section:last-child { border-bottom: none; }
.section-label { display: block; font-size: 12px; color: #888; margin-bottom: 8px; }
.setting-row { display: flex; align-items: center; gap: 10px; }
.font-ctrl-btn {
  width: 38px; height: 38px; border: 1px solid #555; border-radius: 8px;
  background: transparent; color: #eee; font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.font-ctrl-btn:hover { background: rgba(255,255,255,0.08); }
.font-ctrl-btn:active { background: rgba(255,255,255,0.15); }
.font-size-val {
  min-width: 28px; text-align: center; font-size: 16px; font-weight: 600; color: #eee;
}
.font-family-wrap select {
  padding: 7px 10px; border: 1px solid #555; border-radius: 8px;
  background: rgba(255,255,255,0.06); color: #ddd; font-size: 13px;
  outline: none; cursor: pointer;
}
.preset-group { display: flex; gap: 6px; flex-wrap: wrap; }
.preset-btn {
  padding: 6px 12px; border: 1px solid #555; border-radius: 8px;
  background: transparent; color: #bbb; font-size: 12px;
  cursor: pointer; transition: all 0.2s;
}
.preset-btn:hover { background: rgba(255,255,255,0.06); color: #ddd; }
.preset-btn.active { background: #e67e22; border-color: #e67e22; color: #fff; }
.color-row { display: flex; gap: 10px; flex-wrap: wrap; }
.color-card-sm {
  width: 36px; height: 36px; border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.1);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.color-card-sm:hover { transform: scale(1.08); }
.color-card-sm.active { border-color: #e67e22; }
.setting-controls { display: flex; flex-direction: column; gap: 12px; border-bottom: none !important; }
.control-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 14px; color: #ccc;
}
.page-mode-trigger {
  cursor: pointer; padding: 8px 0;
  transition: color 0.15s;
}
.page-mode-trigger:hover { color: #fff; }
.pm-trigger-right { display: flex; align-items: center; gap: 6px; color: #888; }
.pm-current { font-size: 13px; }
.pm-arrow { color: #666; }

/* ========== 三级面板 ========== */
.level3-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); z-index: 60;
  display: flex; align-items: center; justify-content: center;
}
.level3-panel {
  width: 100%; max-width: 480px;
  background: rgba(30,30,30,0.98); backdrop-filter: blur(20px);
  border-radius: 16px; color: #eee;
  overflow: hidden;
}
.l3-header {
  display: flex; align-items: center; padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.l3-back {
  display: flex; align-items: center; gap: 4px;
  background: none; border: none; color: #e67e22;
  font-size: 14px; cursor: pointer; padding: 4px 8px;
  border-radius: 6px; transition: background 0.15s;
}
.l3-back:hover { background: rgba(230,126,34,0.1); }
.l3-title { flex: 1; text-align: center; font-size: 16px; font-weight: 600; }
.l3-spacer { width: 70px; }
.l3-grid {
  display: flex; flex-wrap: wrap; gap: 12px;
  justify-content: center; padding: 24px 20px 28px;
}
.pm-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  width: 72px; padding: 14px 6px;
  background: rgba(255,255,255,0.04);
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 12px; cursor: pointer;
  transition: all 0.2s; position: relative;
}
.pm-card:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); }
.pm-card.active { border-color: #e67e22; background: rgba(230,126,34,0.1); }
.pm-card-icon {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  color: #999;
}
.pm-card.active .pm-card-icon { color: #e67e22; }
.pm-card-icon :deep(svg) { width: 100%; height: 100%; }
.pm-card-name { font-size: 12px; color: #bbb; white-space: nowrap; }
.pm-card.active .pm-card-name { color: #e67e22; }
.pm-card-check { position: absolute; top: 6px; right: 6px; }

/* ========== 自动阅读专属面板 ========== */
.auto-read-panel {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 35;
  background: rgba(0,0,0,0.96); backdrop-filter: blur(16px);
  color: #eee; padding: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.auto-read-panel.panel-wide {
  max-width: 480px;
  margin: 0 auto;
  border-radius: 14px 14px 0 0;
}
.arp-speed { padding: 16px 20px 12px; }
.arp-speed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; color: #aaa; }
.speed-value { color: #e67e22; font-weight: 600; font-size: 16px; }
.arp-speed-track { display: flex; align-items: center; gap: 10px; }
.arp-speed-track input[type="range"] {
  flex: 1; height: 4px; -webkit-appearance: none; appearance: none;
  background: #444; border-radius: 2px; outline: none;
}
.arp-speed-track input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 18px; height: 18px; border-radius: 50%;
  background: #e67e22; cursor: pointer;
}
.speed-tip { font-size: 11px; color: #666; }
.arp-mode {
  display: flex; gap: 8px; padding: 0 20px 16px;
}
.arp-mode-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; cursor: pointer;
  font-size: 13px; color: #999; transition: all 0.2s;
}
.arp-mode-item:hover { border-color: rgba(255,255,255,0.25); color: #ddd; }
.arp-mode-item.active { border-color: #e67e22; background: rgba(230,126,34,0.12); color: #e67e22; }
.arp-exit-btn {
  display: block; width: calc(100% - 40px); margin: 0 20px 16px;
  padding: 12px; border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px; background: rgba(255,255,255,0.04);
  color: #ccc; font-size: 14px; cursor: pointer;
  text-align: center; transition: all 0.2s;
}
.arp-exit-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

/* ========== Transitions ========== */
.slide-down-enter-active, .slide-down-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

.fade-scale-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-scale-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.95); }
</style>
