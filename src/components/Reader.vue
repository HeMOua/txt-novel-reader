<template>
  <div
    class="reader-container"
    :class="{ 'night-mode': settings.nightMode }"
    :style="readerStyle"
    @click="onReaderClick"
  >
    <!-- 顶部标题栏 -->
    <transition name="slide-down">
      <header v-if="showBars" class="reader-top-bar">
        <button class="bar-btn" @click.stop="$emit('back')">← 返回</button>
        <span class="chapter-name-top">{{ currentChapterLabel }}</span>
        <span class="top-spacer"></span>
      </header>
    </transition>

    <!-- 阅读内容区域 — 所有章节连续渲染 -->
    <div class="reader-scroll" ref="scrollArea" @scroll="onScroll">
      <div class="reader-content" :style="contentStyle">
        <div
          v-for="(ch, i) in chapters"
          :key="i"
          class="chapter-block"
          :data-chapter-index="i"
          :ref="el => setChapterRef(el, i)"
        >
          <div class="chapter-header">
            <h2 class="chapter-title-inline">{{ ch.title }}</h2>
          </div>
          <div class="chapter-body" v-html="renderChapterContent(ch.content)"></div>
        </div>
      </div>
    </div>

    <!-- 覆盖翻页模式 -->
    <div v-if="isCoverMode && !showBars" class="cover-page-container" :style="contentStyle">
      <div class="cover-page" v-html="coverPageContent"></div>
    </div>

    <!-- 常驻左上角章节信息 -->
    <div class="chapter-label-fixed" v-if="!showBars">
      {{ currentChapterLabel }}
    </div>

    <!-- 常驻底部信息栏 -->
    <footer class="reader-info-bar" v-if="!showBars">
      <span class="info-left">{{ Math.round(progress) }}%</span>
      <span class="info-right">{{ currentTime }}</span>
    </footer>

    <!-- 底部功能栏 -->
    <transition name="slide-up">
      <div v-if="showBars" class="reader-bottom-bar" @click.stop>
        <!-- 第一行：章节导航 + 进度条 -->
        <div class="bar-row nav-row">
          <button class="bar-btn" @click="prevChapter" :disabled="currentChapterIndex <= 0">
            上一章
          </button>
          <div class="progress-slider">
            <input
              type="range"
              min="0"
              :max="Math.max(totalChapters - 1, 0)"
              v-model.number="sliderChapter"
              @input="onSliderChange"
              class="slider"
            />
          </div>
          <button class="bar-btn" @click="nextChapter" :disabled="currentChapterIndex >= totalChapters - 1">
            下一章
          </button>
        </div>

        <!-- 第二行：功能按钮 -->
        <div class="bar-row func-row">
          <button class="func-btn" @click="showCatalog = true">
            <span class="func-icon">📋</span>
            <span>目录</span>
          </button>
          <button class="func-btn" @click="toggleNightMode">
            <span class="func-icon">{{ settings.nightMode ? '☀️' : '🌙' }}</span>
            <span>{{ settings.nightMode ? '日间' : '夜间' }}</span>
          </button>
          <button class="func-btn" @click="showSettings = !showSettings">
            <span class="func-icon">⚙️</span>
            <span>设置</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 目录侧边栏 -->
    <transition name="slide-left">
      <div v-if="showCatalog" class="catalog-overlay" @click="showCatalog = false">
        <div class="catalog-panel" @click.stop>
          <div class="catalog-header">
            <h3>目录</h3>
            <button class="close-btn" @click="showCatalog = false">✕</button>
          </div>
          <div class="catalog-list">
            <div
              v-for="(ch, i) in chapters"
              :key="i"
              class="catalog-item"
              :class="{ active: i === currentChapterIndex }"
              @click="jumpToChapter(i)"
            >
              <span class="chapter-index">{{ i + 1 }}</span>
              <span class="chapter-title">{{ ch.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 设置面板 -->
    <transition name="slide-up">
      <div v-if="showSettings" class="settings-panel" @click.stop>
        <!-- 第一行：字体控制 -->
        <div class="settings-row font-row">
          <button class="font-ctrl-btn" @click="changeFontSize(-1)">A-</button>
          <span class="font-size-display">{{ settings.fontSize }}</span>
          <button class="font-ctrl-btn" @click="changeFontSize(1)">A+</button>
          <div class="font-family-select">
            <select v-model="settings.fontFamily" @change="onSettingsChange">
              <option v-for="f in FONT_FAMILIES" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </div>
        </div>

        <!-- 第二行：行间距 -->
        <div class="settings-row spacing-row">
          <button
            v-for="preset in LINE_HEIGHT_PRESETS"
            :key="preset.id"
            class="preset-btn"
            :class="{ active: Math.abs(settings.lineHeight - preset.value) < 0.01 }"
            @click="setLineHeight(preset.value)"
          >
            {{ preset.name }}
          </button>
          <button class="preset-btn more-btn" @click="showMoreSpacing = !showMoreSpacing">
            更多间距
          </button>
        </div>

        <!-- 更多间距 -->
        <transition name="expand">
          <div v-if="showMoreSpacing" class="more-settings">
            <div class="slider-row">
              <label>行间距</label>
              <input type="range" min="1" max="4" step="0.1" v-model.number="settings.lineHeight" @input="onSettingsChange" />
              <span>{{ settings.lineHeight.toFixed(1) }}</span>
            </div>
            <div class="slider-row">
              <label>段间距</label>
              <input type="range" min="0" max="40" step="2" v-model.number="settings.paragraphSpacing" @input="onSettingsChange" />
              <span>{{ settings.paragraphSpacing }}px</span>
            </div>
            <div class="slider-row">
              <label>上间距</label>
              <input type="range" min="0" max="60" step="4" v-model.number="settings.topMargin" @input="onSettingsChange" />
              <span>{{ settings.topMargin }}px</span>
            </div>
            <div class="slider-row">
              <label>下间距</label>
              <input type="range" min="0" max="60" step="4" v-model.number="settings.bottomMargin" @input="onSettingsChange" />
              <span>{{ settings.bottomMargin }}px</span>
            </div>
            <div class="slider-row">
              <label>左右间距</label>
              <input type="range" min="8" max="80" step="4" v-model.number="settings.leftMargin" @input="onSettingsChange" />
              <span>{{ settings.leftMargin }}px</span>
            </div>
          </div>
        </transition>

        <!-- 第三行：背景设置 -->
        <div class="settings-row theme-row">
          <button
            v-for="theme in THEMES"
            :key="theme.id"
            class="theme-btn"
            :class="{ active: settings.theme === theme.id }"
            :style="{ background: theme.bgColor, color: theme.fontColor }"
            @click="setTheme(theme)"
          >
            {{ theme.name }}
          </button>
          <button class="preset-btn more-btn" @click="showMoreBg = !showMoreBg">
            更多背景
          </button>
        </div>

        <!-- 更多背景 -->
        <transition name="expand">
          <div v-if="showMoreBg" class="more-settings">
            <div class="color-row">
              <label>字体颜色</label>
              <input type="color" v-model="settings.fontColor" @input="onSettingsChange" />
              <span>{{ settings.fontColor }}</span>
            </div>
            <div class="color-row">
              <label>背景颜色</label>
              <input type="color" v-model="settings.bgColor" @input="onSettingsChange" />
              <span>{{ settings.bgColor }}</span>
            </div>
          </div>
        </transition>

        <!-- 第四行：自动阅读、翻页方式、更多 -->
        <div class="settings-row extra-row">
          <button class="func-btn-lg" @click="toggleAutoRead">
            <span class="func-icon">{{ autoReading ? '⏸' : '▶️' }}</span>
            <span>{{ autoReading ? '暂停阅读' : '自动阅读' }}</span>
          </button>
          <button class="func-btn-lg" @click="cyclePageTurnMode">
            <span class="func-icon">{{ pageTurnIcon }}</span>
            <span>{{ pageTurnLabel }}</span>
          </button>
          <button class="func-btn-lg" @click="showMoreSettings = !showMoreSettings">
            <span class="func-icon">🔧</span>
            <span>更多设置</span>
          </button>
        </div>

        <!-- 更多设置 -->
        <transition name="expand">
          <div v-if="showMoreSettings" class="more-settings">
            <div class="slider-row" v-if="autoReading">
              <label>自动阅读速度</label>
              <input type="range" min="1" max="10" step="1" v-model.number="settings.autoReadSpeed" @input="onSettingsChange" />
              <span>{{ settings.autoReadSpeed }}行/秒</span>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { parseChapters, calcProgress } from '../utils/chapterParser.js'
import { getSettings, saveSettings, THEMES, LINE_HEIGHT_PRESETS, FONT_FAMILIES, updateProgress, flushProgress } from '../utils/bookStore.js'

const props = defineProps({
  book: { type: Object, required: true }
})

const emit = defineEmits(['back'])

// ========== 状态 ==========
const showBars = ref(false)
const showCatalog = ref(false)
const showSettings = ref(false)
const showMoreSpacing = ref(false)
const showMoreBg = ref(false)
const showMoreSettings = ref(false)
const autoReading = ref(false)
const currentTime = ref('')
const progress = ref(props.book.progress || 0)
const sliderChapter = ref(0)
const scrollArea = ref(null)
const currentChapterIndex = ref(props.book.currentChapterIndex || 0)

let autoReadTimer = null
let chapterRefs = {}
let isRestoringPosition = false

// ========== 设置 ==========
const settings = ref(getSettings())

// ========== 章节解析 ==========
const chapters = computed(() => {
  if (!props.book?.content) return []
  return parseChapters(props.book.content)
})

const totalChapters = computed(() => chapters.value.length)

const currentChapterName = computed(() => {
  if (chapters.value.length === 0) return ''
  return chapters.value[currentChapterIndex.value]?.title || ''
})

const currentChapterLabel = computed(() => {
  if (chapters.value.length === 0) return ''
  const idx = currentChapterIndex.value
  const ch = chapters.value[idx]
  if (!ch) return ''
  return `第${idx + 1}章 ${ch.title}`
})

// ========== 翻页模式 ==========
// scroll: 连续滚动  cover: 覆盖翻页
const PAGE_TURN_MODES = ['scroll', 'cover']
const PAGE_TURN_LABELS = { scroll: '滚屏', cover: '覆盖' }
const PAGE_TURN_ICONS = { scroll: '📜', cover: '📄' }

const isCoverMode = computed(() => settings.value.pageTurnMode === 'cover')

const pageTurnLabel = computed(() => PAGE_TURN_LABELS[settings.value.pageTurnMode] || '滚屏')
const pageTurnIcon = computed(() => PAGE_TURN_ICONS[settings.value.pageTurnMode] || '📜')

function cyclePageTurnMode() {
  const idx = PAGE_TURN_MODES.indexOf(settings.value.pageTurnMode)
  const next = PAGE_TURN_MODES[(idx + 1) % PAGE_TURN_MODES.length]
  settings.value.pageTurnMode = next
  onSettingsChange()
  // 如果切到覆盖模式，启动自动阅读相关逻辑
  if (autoReading.value) {
    startAutoRead()
  }
}

// ========== 渲染 ==========
function renderChapterContent(content) {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${escapeHtml(line.trim())}</p>`)
    .join('')
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ========== 覆盖翻页内容 ==========
const coverPageLines = computed(() => {
  // 收集当前章节及后续章节的所有段落行
  const allLines = []
  for (let i = currentChapterIndex.value; i < chapters.value.length; i++) {
    const ch = chapters.value[i]
    const lines = ch.content.split('\n').filter(l => l.trim())
    allLines.push(...lines)
  }
  return allLines
})

const linesPerPage = computed(() => {
  // 根据容器高度和字体大小计算每页行数
  const viewHeight = 600 // 近似值
  const lineH = settings.value.fontSize * settings.value.lineHeight
  return Math.max(1, Math.floor(viewHeight / lineH))
})

const coverPageIndex = ref(0)

const coverPageContent = computed(() => {
  const start = coverPageIndex.value * linesPerPage.value
  const pageLines = coverPageLines.value.slice(start, start + linesPerPage.value)
  if (pageLines.length === 0) return '<p style="text-align:center;color:#999;">已到最后</p>'
  return pageLines.map(line => `<p>${escapeHtml(line.trim())}</p>`).join('')
})

// ========== 样式计算 ==========
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
    paddingTop: settings.value.topMargin + 'px',
    paddingBottom: settings.value.bottomMargin + 'px',
    paddingLeft: settings.value.leftMargin + 'px',
    paddingRight: settings.value.rightMargin + 'px',
  }
})

// ========== 章节引用收集 ==========
function setChapterRef(el, index) {
  if (el) {
    chapterRefs[index] = el
  }
}

// ========== 交互 ==========
function onReaderClick(e) {
  // 覆盖模式下直接切换工具栏
  if (isCoverMode.value) {
    showBars.value = !showBars.value
    if (!showBars.value) {
      closeSubPanels()
    }
    return
  }

  const rect = e.currentTarget.getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height
  const zone = y / height

  if (zone > 0.25 && zone < 0.75) {
    showBars.value = !showBars.value
    if (!showBars.value) {
      closeSubPanels()
    }
  } else if (zone <= 0.25) {
    scrollUp()
  } else {
    scrollDown()
  }
}

function closeSubPanels() {
  showSettings.value = false
  showMoreSpacing.value = false
  showMoreBg.value = false
  showMoreSettings.value = false
}

function scrollUp() {
  if (!scrollArea.value) return
  scrollArea.value.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'auto' })
}

function scrollDown() {
  if (!scrollArea.value) return
  scrollArea.value.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'auto' })
}

// ========== 滚动追踪当前章节 ==========
function onScroll() {
  if (isRestoringPosition) return
  if (!scrollArea.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollArea.value

  // 通过章节 DOM 元素追踪当前可见章节
  const viewportTop = scrollTop + 60 // 偏移一点
  let detectedChapter = 0

  for (let i = totalChapters.value - 1; i >= 0; i--) {
    const el = chapterRefs[i]
    if (el && el.offsetTop <= viewportTop) {
      detectedChapter = i
      break
    }
  }

  if (detectedChapter !== currentChapterIndex.value) {
    currentChapterIndex.value = detectedChapter
    sliderChapter.value = detectedChapter
  }

  // 计算总进度
  if (scrollHeight <= clientHeight) {
    progress.value = 0
  } else {
    progress.value = Math.min(100, (scrollTop / (scrollHeight - clientHeight)) * 100)
  }

  // 保存进度
  updateProgress(props.book.filePath, currentChapterIndex.value, scrollTop, progress.value)
}

// ========== 章节导航 ==========
function prevChapter() {
  if (currentChapterIndex.value > 0) {
    jumpToChapter(currentChapterIndex.value - 1)
  }
}

function nextChapter() {
  if (currentChapterIndex.value < totalChapters.value - 1) {
    jumpToChapter(currentChapterIndex.value + 1)
  }
}

function jumpToChapter(index) {
  currentChapterIndex.value = index
  sliderChapter.value = index
  showCatalog.value = false

  if (isCoverMode.value) {
    coverPageIndex.value = 0
    return
  }

  // 滚动到对应章节
  nextTick(() => {
    const el = chapterRefs[index]
    if (el && scrollArea.value) {
      scrollArea.value.scrollTo({ top: el.offsetTop - 10, behavior: 'auto' })
    }
  })
}

function onSliderChange() {
  jumpToChapter(sliderChapter.value)
}

// ========== 设置操作 ==========
function changeFontSize(delta) {
  settings.value.fontSize = Math.max(12, Math.min(36, settings.value.fontSize + delta))
  onSettingsChange()
}

function setLineHeight(value) {
  settings.value.lineHeight = value
  onSettingsChange()
}

function setTheme(theme) {
  settings.value.theme = theme.id
  settings.value.fontColor = theme.fontColor
  settings.value.bgColor = theme.bgColor
  settings.value.nightMode = theme.id === 'night'
  onSettingsChange()
}

function toggleNightMode() {
  settings.value.nightMode = !settings.value.nightMode
  if (settings.value.nightMode) {
    settings.value.theme = 'night'
    settings.value.fontColor = '#888'
    settings.value.bgColor = '#1a1a1a'
  } else {
    settings.value.theme = 'default'
    settings.value.fontColor = '#2c2c2c'
    settings.value.bgColor = '#f5f0e8'
  }
  onSettingsChange()
}

// ========== 自动阅读 ==========
function toggleAutoRead() {
  autoReading.value = !autoReading.value
  if (autoReading.value) {
    startAutoRead()
  } else {
    stopAutoRead()
  }
}

function startAutoRead() {
  stopAutoRead()

  if (isCoverMode.value) {
    // 覆盖翻页模式：按间隔翻页
    const interval = 60000 / (settings.value.autoReadSpeed * 10) // 每页停留时间
    autoReadTimer = setInterval(() => {
      const maxPage = Math.ceil(coverPageLines.value.length / linesPerPage.value) - 1
      if (coverPageIndex.value < maxPage) {
        coverPageIndex.value++
      }
    }, interval)
  } else {
    // 滚屏模式：持续滚动
    const interval = 1000 / (settings.value.autoReadSpeed || 3)
    autoReadTimer = setInterval(() => {
      if (scrollArea.value) {
        scrollArea.value.scrollBy({ top: settings.value.fontSize * settings.value.lineHeight, behavior: 'auto' })
      }
    }, interval)
  }
}

function stopAutoRead() {
  if (autoReadTimer) {
    clearInterval(autoReadTimer)
    autoReadTimer = null
  }
}

function onSettingsChange() {
  saveSettings(settings.value)
  if (autoReading.value) {
    startAutoRead()
  }
}

// ========== 时钟 ==========
function updateClock() {
  const now = new Date()
  currentTime.value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
}

// ========== 键盘快捷键 ==========
function onKeyDown(e) {
  if (isCoverMode.value) {
    // 覆盖模式下的键盘操作
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      const maxPage = Math.ceil(coverPageLines.value.length / linesPerPage.value) - 1
      if (coverPageIndex.value < maxPage) coverPageIndex.value++
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (coverPageIndex.value > 0) coverPageIndex.value--
      e.preventDefault()
    } else if (e.key === 'Escape') {
      handleEscape()
      e.preventDefault()
    }
    return
  }

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      scrollUp()
      e.preventDefault()
      break
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
      scrollDown()
      e.preventDefault()
      break
    case 'Escape':
      handleEscape()
      e.preventDefault()
      break
  }
}

function handleEscape() {
  if (showCatalog.value) showCatalog.value = false
  else if (showSettings.value) showSettings.value = false
  else if (showBars.value) { showBars.value = false; closeSubPanels() }
  else emit('back')
}

// ========== 初始化 ==========
onMounted(() => {
  sliderChapter.value = currentChapterIndex.value
  updateClock()
  const clockTimer = setInterval(updateClock, 10000)

  document.addEventListener('keydown', onKeyDown)

  // 恢复阅读位置（等 DOM 渲染完）
  if (isCoverMode.value) {
    // 覆盖模式不恢复滚动位置
  } else {
    nextTick(() => {
      const savedScrollTop = props.book.currentScrollTop
      if (savedScrollTop && savedScrollTop > 0 && scrollArea.value) {
        isRestoringPosition = true
        scrollArea.value.scrollTop = savedScrollTop
        // 等滚动完成后再开启追踪
        setTimeout(() => {
          isRestoringPosition = false
        }, 100)
      }
    })
  }

  onUnmounted(() => {
    clearInterval(clockTimer)
    stopAutoRead()
    // 确保进度已写入
    flushProgress()
    document.removeEventListener('keydown', onKeyDown)
  })
})
</script>

<style scoped>
.reader-container {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 0.3s, color 0.3s;
}

/* ===== 顶部栏 ===== */
.reader-top-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(10px);
  color: #eee;
}
.night-mode .reader-top-bar { background: rgba(0,0,0,0.95); }

.bar-btn {
  background: none; border: none; color: #eee;
  font-size: 14px; cursor: pointer; padding: 4px 10px;
  border-radius: 4px; white-space: nowrap;
}
.bar-btn:hover { background: rgba(255,255,255,0.1); }
.bar-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.chapter-name-top {
  flex: 1; text-align: center; font-size: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc;
}
.top-spacer { width: 60px; }

/* ===== 左上角常驻章节信息 ===== */
.chapter-label-fixed {
  position: absolute;
  top: 8px; left: 16px;
  font-size: 12px;
  color: v-bind('settings.nightMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"');
  pointer-events: none;
  z-index: 5;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.3s;
}

/* ===== 滚动区域 ===== */
.reader-scroll {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: auto;
}
.reader-scroll::-webkit-scrollbar { width: 6px; }
.reader-scroll::-webkit-scrollbar-track { background: transparent; }
.reader-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
.night-mode .reader-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }

.reader-content {
  max-width: 800px;
  margin: 0 auto;
  word-wrap: break-word;
  text-align: justify;
  user-select: text;
}

/* ===== 章节块 ===== */
.chapter-block {
  margin-bottom: 0;
}

.chapter-header {
  padding: 28px 0 16px;
  border-bottom: 1px solid v-bind('settings.nightMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"');
  margin-bottom: 16px;
}

.chapter-title-inline {
  font-size: 1.2em;
  font-weight: 700;
  text-align: center;
  text-indent: 0;
  color: inherit;
  opacity: 0.85;
}

.chapter-body :deep(p) {
  text-indent: 2em;
  margin-bottom: v-bind('settings.paragraphSpacing + "px"');
}

/* ===== 覆盖翻页容器 ===== */
.cover-page-container {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 4;
  overflow: hidden;
  max-width: 800px;
  margin: 0 auto;
  padding-top: 28px;
}

.cover-page {
  user-select: text;
  text-align: justify;
  word-wrap: break-word;
}

.cover-page :deep(p) {
  text-indent: 2em;
  margin-bottom: v-bind('settings.paragraphSpacing + "px"');
}

/* ===== 常驻底部信息栏 ===== */
.reader-info-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between;
  padding: 4px 20px;
  font-size: 11px;
  color: v-bind('settings.nightMode ? "#555" : "#bbb"');
  pointer-events: none;
  z-index: 5;
  transition: color 0.3s;
}

/* ===== 底部功能栏 ===== */
.reader-bottom-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 20;
  background: rgba(0,0,0,0.9);
  backdrop-filter: blur(10px);
  padding: 12px 16px 20px;
  color: #eee;
}
.night-mode .reader-bottom-bar { background: rgba(0,0,0,0.95); }

.bar-row { display: flex; align-items: center; gap: 10px; }
.nav-row { margin-bottom: 14px; }
.progress-slider { flex: 1; padding: 0 4px; }

.slider {
  width: 100%; height: 4px;
  -webkit-appearance: none; appearance: none;
  background: #444; border-radius: 2px; outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 16px; height: 16px; border-radius: 50%;
  background: #e67e22; cursor: pointer;
}

.func-row { display: flex; justify-content: space-around; }
.func-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: none; border: none; color: #ccc; font-size: 11px;
  cursor: pointer; padding: 4px 12px;
}
.func-btn:hover { color: #fff; }
.func-icon { font-size: 20px; }

/* ===== 目录 ===== */
.catalog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 50;
}
.catalog-panel {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 320px; max-width: 80vw;
  background: #fff; box-shadow: 4px 0 16px rgba(0,0,0,0.2);
  display: flex; flex-direction: column;
}
.night-mode .catalog-panel { background: #222; }

.catalog-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #eee;
}
.night-mode .catalog-header { border-color: #444; }
.catalog-header h3 { font-size: 16px; color: #333; }
.night-mode .catalog-header h3 { color: #ddd; }

.close-btn {
  background: none; border: none; font-size: 18px;
  cursor: pointer; color: #999; padding: 4px;
}

.catalog-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.catalog-item {
  display: flex; align-items: center; padding: 10px 20px;
  cursor: pointer; font-size: 14px; color: #555; transition: background 0.15s;
}
.night-mode .catalog-item { color: #bbb; }
.catalog-item:hover { background: #f5f5f5; }
.night-mode .catalog-item:hover { background: #333; }
.catalog-item.active { color: #e67e22; background: #fff8f0; }
.night-mode .catalog-item.active { background: #3a2a10; }

.chapter-index { width: 32px; font-size: 12px; color: #bbb; flex-shrink: 0; }
.chapter-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== 设置面板 ===== */
.settings-panel {
  position: absolute; bottom: 0; left: 0; right: 0;
  z-index: 30; background: rgba(0,0,0,0.92); backdrop-filter: blur(10px);
  padding: 16px; color: #eee; max-height: 70vh; overflow-y: auto;
}
.settings-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; flex-wrap: wrap; }
.font-row { gap: 10px; }

.font-ctrl-btn {
  width: 40px; height: 40px; border: 1px solid #555; border-radius: 8px;
  background: transparent; color: #eee; font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.font-ctrl-btn:hover { background: #333; }
.font-size-display { min-width: 30px; text-align: center; font-size: 16px; font-weight: 600; }

.font-family-select select {
  padding: 6px 10px; border: 1px solid #555; border-radius: 6px;
  background: #333; color: #eee; font-size: 13px; outline: none; cursor: pointer;
}

.preset-btn {
  padding: 6px 12px; border: 1px solid #555; border-radius: 6px;
  background: transparent; color: #ccc; font-size: 12px; cursor: pointer;
  transition: all 0.2s;
}
.preset-btn:hover { background: #333; }
.preset-btn.active { background: #e67e22; border-color: #e67e22; color: #fff; }
.more-btn { border-style: dashed; }

.theme-btn {
  width: 48px; height: 32px; border: 2px solid transparent;
  border-radius: 6px; font-size: 10px; cursor: pointer; transition: border-color 0.2s;
}
.theme-btn.active { border-color: #e67e22; }
.theme-btn:hover { opacity: 0.85; }

.func-btn-lg {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: none; border: none; color: #ccc; font-size: 11px;
  cursor: pointer; padding: 4px 10px;
}
.func-btn-lg:hover { color: #fff; }

.more-settings {
  padding: 8px 12px; background: rgba(255,255,255,0.05);
  border-radius: 8px; margin: 4px 0;
}
.slider-row {
  display: flex; align-items: center; gap: 10px; padding: 6px 0;
  font-size: 12px; color: #aaa;
}
.slider-row label { min-width: 60px; }
.slider-row input[type="range"] {
  flex: 1; height: 3px; -webkit-appearance: none; appearance: none;
  background: #555; border-radius: 2px; outline: none;
}
.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: #e67e22; cursor: pointer;
}
.slider-row span { min-width: 40px; text-align: right; font-size: 11px; }

.color-row {
  display: flex; align-items: center; gap: 10px; padding: 6px 0;
  font-size: 12px; color: #aaa;
}
.color-row label { min-width: 60px; }
.color-row input[type="color"] {
  width: 36px; height: 28px; border: none; border-radius: 4px;
  cursor: pointer; background: none;
}
.color-row span { font-size: 11px; font-family: monospace; }

/* ===== 动画 ===== */
.slide-down-enter-active, .slide-down-leave-active { transition: transform 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.25s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

.slide-left-enter-active, .slide-left-leave-active { transition: opacity 0.2s ease; }
.slide-left-enter-from, .slide-left-leave-to { opacity: 0; }
.slide-left-enter-active .catalog-panel { transition: transform 0.25s ease; }
.slide-left-enter-from .catalog-panel { transform: translateX(-100%); }

.expand-enter-active, .expand-leave-active { transition: all 0.2s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; padding: 0 12px; }
</style>
