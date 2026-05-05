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

    <!-- 阅读内容区域：滑动窗口多章渲染 -->
    <div class="reader-scroll" ref="scrollArea" @scroll="onScroll">
      <div class="reader-content" :style="contentStyle" ref="contentEl">
        <!-- 由 JS 动态管理章节 DOM，不使用 v-for 全量渲染 -->
      </div>
    </div>

    <!-- 常驻左上角章节信息 -->
    <div class="chapter-label-fixed" v-if="!showBars">{{ currentChapterLabel }}</div>

    <!-- 常驻底部信息栏 -->
    <footer class="reader-info-bar" v-if="!showBars">
      <span class="info-left">{{ Math.round(progress) }}%</span>
      <span class="info-right">{{ currentTime }}</span>
    </footer>

    <!-- 底部功能栏 -->
    <transition name="slide-up">
      <div v-if="showBars" class="reader-bottom-bar" @click.stop>
        <div class="bar-row nav-row">
          <button class="bar-btn" @click="prevChapter" :disabled="currentChapterIndex <= 0">上一章</button>
          <div class="progress-slider">
            <input type="range" min="0" :max="Math.max(totalChapters - 1, 0)"
              v-model.number="sliderChapter" @input="onSliderChange" class="slider" />
          </div>
          <button class="bar-btn" @click="nextChapter" :disabled="currentChapterIndex >= totalChapters - 1">下一章</button>
        </div>
        <div class="bar-row func-row">
          <button class="func-btn" @click="openCatalog">
            <span class="func-icon">📋</span><span>目录</span>
          </button>
          <button class="func-btn" @click="toggleNightMode">
            <span class="func-icon">{{ settings.nightMode ? '☀️' : '🌙' }}</span>
            <span>{{ settings.nightMode ? '日间' : '夜间' }}</span>
          </button>
          <button class="func-btn" @click="showSettings = !showSettings">
            <span class="func-icon">⚙️</span><span>设置</span>
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
          <div class="catalog-list" ref="catalogList">
            <div v-for="(ch, i) in chapters" :key="i"
              class="catalog-item" :class="{ active: i === currentChapterIndex }"
              @click="jumpToChapter(i)">
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
        <div class="settings-row spacing-row">
          <button v-for="preset in LINE_HEIGHT_PRESETS" :key="preset.id"
            class="preset-btn" :class="{ active: Math.abs(settings.lineHeight - preset.value) < 0.01 }"
            @click="setLineHeight(preset.value)">{{ preset.name }}</button>
          <button class="preset-btn more-btn" @click="showMoreSpacing = !showMoreSpacing">更多间距</button>
        </div>
        <transition name="expand">
          <div v-if="showMoreSpacing" class="more-settings">
            <div class="slider-row"><label>行间距</label><input type="range" min="1" max="4" step="0.1" v-model.number="settings.lineHeight" @input="onSettingsChange" /><span>{{ settings.lineHeight.toFixed(1) }}</span></div>
            <div class="slider-row"><label>段间距</label><input type="range" min="0" max="40" step="2" v-model.number="settings.paragraphSpacing" @input="onSettingsChange" /><span>{{ settings.paragraphSpacing }}px</span></div>
            <div class="slider-row"><label>左右间距</label><input type="range" min="8" max="80" step="4" v-model.number="settings.leftMargin" @input="onSettingsChange" /><span>{{ settings.leftMargin }}px</span></div>
          </div>
        </transition>
        <div class="settings-row theme-row">
          <button v-for="theme in THEMES" :key="theme.id" class="theme-btn"
            :class="{ active: settings.theme === theme.id }"
            :style="{ background: theme.bgColor, color: theme.fontColor }"
            @click="setTheme(theme)">{{ theme.name }}</button>
        </div>
        <div class="settings-row extra-row">
          <button class="func-btn-lg" @click="toggleAutoRead">
            <span class="func-icon">{{ autoReading ? '⏸' : '▶️' }}</span>
            <span>{{ autoReading ? '暂停' : '自动阅读' }}</span>
          </button>
          <div class="slider-row" v-if="autoReading" style="flex:1">
            <label>速度</label><input type="range" min="1" max="10" step="1" v-model.number="settings.autoReadSpeed" @input="onSettingsChange" /><span>{{ settings.autoReadSpeed }}</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getChapterText, calcProgress } from '../utils/chapterParser.js'
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
const autoReading = ref(false)
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
// 渲染窗口：[rangeStart, rangeEnd] 闭区间
// 当前章节始终在窗口内，窗口最大跨度 MAX_RANGE
const MAX_RANGE = 4   // 最多同时渲染的章节数
const BUFFER_AHEAD = 1 // 向前/后多渲染的章节数

const rangeStart = ref(0)
const rangeEnd = ref(0)
const chapterDomMap = new Map()  // chapterIndex -> DOM element

// ========== 设置 ==========
const settings = ref(getSettings())

// ========== 基础计算 ==========
const chapters = computed(() => props.book.chapters || [])
const totalChapters = computed(() => chapters.value.length)
const fullText = computed(() => props.book.fullText || '')

const currentChapterMeta = computed(() => chapters.value[currentChapterIndex.value] || null)
const currentChapterTitle = computed(() => currentChapterMeta.value?.title || '')
const currentChapterLabel = computed(() => currentChapterTitle.value || `第${currentChapterIndex.value + 1}章`)

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
  }
})

// ========== 核心渲染 ==========

/**
 * 渲染一个章节的 DOM 节点（同步插入所有段落）
 * @returns {HTMLElement} 章节容器
 */
function renderChapterDom(chapterIdx) {
  const meta = chapters.value[chapterIdx]
  if (!meta) return null

  const container = document.createElement('div')
  container.className = 'chapter-block'
  container.dataset.chapterIndex = chapterIdx

  // 章节标题
  const header = document.createElement('div')
  header.className = 'chapter-header'
  const title = document.createElement('h2')
  title.className = 'chapter-title-inline'
  title.textContent = meta.title
  header.appendChild(title)
  container.appendChild(header)

  // 正文容器
  const body = document.createElement('div')
  body.className = 'chapter-body'
  container.appendChild(body)

  // 同步插入所有段落
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

/**
 * 重建整个渲染窗口
 */
function rebuildWindow(centerIdx, scrollRatio = 0) {
  if (!contentEl.value) return

  // 清空
  contentEl.value.innerHTML = ''
  chapterDomMap.clear()

  // 计算窗口范围
  const start = Math.max(0, centerIdx - BUFFER_AHEAD)
  const end = Math.min(totalChapters.value - 1, centerIdx + BUFFER_AHEAD)
  rangeStart.value = start
  rangeEnd.value = end

  // 渲染窗口内所有章节
  for (let i = start; i <= end; i++) {
    const dom = renderChapterDom(i)
    if (dom) {
      contentEl.value.appendChild(dom)
      chapterDomMap.set(i, dom)
    }
  }

  // 用双层 rAF 等待浏览器完成布局，再读取 offsetTop
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
      // 延迟解锁，防止 scrollTop 赋值触发的 scroll 事件被误处理
      setTimeout(() => { isRestoring = false }, 100)
    })
  })
}

/**
 * 在底部追加下一章
 */
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

  // 如果窗口过大，移除顶部章节
  trimFromTop()
}

/**
 * 在顶部插入上一章
 */
function prependChapterAbove() {
  const prevIdx = rangeStart.value - 1
  if (prevIdx < 0) return
  if (!contentEl.value || !scrollArea.value) return

  // 记录插入前的滚动位置和总高度
  const oldScrollTop = scrollArea.value.scrollTop
  const oldScrollHeight = scrollArea.value.scrollHeight

  const dom = renderChapterDom(prevIdx)
  if (!dom) return

  contentEl.value.insertBefore(dom, contentEl.value.firstChild)
  chapterDomMap.set(prevIdx, dom)
  rangeStart.value = prevIdx

  // 用 rAF 等待布局完成，再修正 scrollTop，防止内容跳动
  isRestoring = true
  requestAnimationFrame(() => {
    if (!scrollArea.value) { isRestoring = false; return }
    const newScrollHeight = scrollArea.value.scrollHeight
    scrollArea.value.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
    isRestoring = false

    // scroll 修正完成后再 trim，避免 trim 影响高度计算
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

    // 1. 检测当前章节（通过 DOM 位置）
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

    // 2. 计算全书进度
    const totalChars = fullText.value.length
    if (totalChars > 0 && chapters.value[detectedChapter]) {
      const chMeta = chapters.value[detectedChapter]
      // 章节内滚动比例
      const chDom = chapterDomMap.get(detectedChapter)
      let chapterRatio = 0
      if (chDom && chDom.offsetHeight > clientHeight) {
        chapterRatio = Math.max(0, Math.min(1,
          (scrollTop - chDom.offsetTop) / (chDom.offsetHeight - clientHeight)
        ))
      }
      // 全书进度 = (已读字符数 / 总字符数) * 100
      const readChars = chMeta.start + chapterRatio * (chMeta.end - chMeta.start)
      progress.value = Math.min(100, (readChars / totalChars) * 100)
    }

    // 3. 保存进度（章节+比例，不存绝对 scrollTop）
    saveReadingProgress()

    // 4. 滚到底部时追加下一章
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      appendChapterBelow()
    }

    // 5. 滚到顶部时追加上一章
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
  const savedScrollRatio = props.book.currentScrollRatio || 0  // 0~1 的比例

  currentChapterIndex.value = savedChapterIndex
  sliderChapter.value = savedChapterIndex

  // 用 savedRatio 重建窗口
  rebuildWindow(savedChapterIndex, savedScrollRatio)
}

// ========== 目录 ==========
function openCatalog() {
  showCatalog.value = true
  nextTick(() => {
    if (!catalogList.value) return
    const activeEl = catalogList.value.querySelector('.catalog-item.active')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
}

// ========== 章节跳转 ==========
function jumpToChapter(index) {
  if (index < 0 || index >= totalChapters.value) return
  currentChapterIndex.value = index
  sliderChapter.value = index
  showCatalog.value = false
  // 跳转：以目标章节为中心重建窗口，从头开始
  rebuildWindow(index, 0)
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

// ========== 自动阅读 ==========
function toggleAutoRead() { autoReading.value = !autoReading.value; autoReading.value ? startAutoRead() : stopAutoRead() }
function startAutoRead() {
  stopAutoRead()
  // 每帧滚动的像素数，根据速度级别（1-10）映射到 0.3~3 px/frame
  function getPixelsPerFrame() {
    const speed = settings.value.autoReadSpeed || 3
    return 0.3 + (speed - 1) * (2.7 / 9)
  }
  let accumulated = 0
  function tick() {
    if (!scrollArea.value) return
    accumulated += getPixelsPerFrame()
    if (accumulated >= 1) {
      const px = Math.floor(accumulated)
      scrollArea.value.scrollTop += px
      accumulated -= px
    }
    autoReadRaf = requestAnimationFrame(tick)
  }
  autoReadRaf = requestAnimationFrame(tick)
}
function stopAutoRead() {
  if (autoReadRaf) { cancelAnimationFrame(autoReadRaf); autoReadRaf = null }
}

// ========== 交互 ==========
function onReaderClick(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const zone = (e.clientY - rect.top) / rect.height
  if (zone > 0.25 && zone < 0.75) {
    showBars.value = !showBars.value
    if (!showBars.value) closeSubPanels()
  } else if (zone <= 0.25) {
    scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  } else {
    scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  }
}
function closeSubPanels() { showSettings.value = false; showMoreSpacing.value = false }

// ========== 键盘快捷键 ==========
function onKeyDown(e) {
  switch (e.key) {
    case 'ArrowLeft': case 'ArrowUp': scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }); e.preventDefault(); break
    case 'ArrowRight': case 'ArrowDown': case ' ': scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }); e.preventDefault(); break
    case 'Escape': handleEscape(); e.preventDefault(); break
  }
}
function handleEscape() {
  if (showCatalog.value) showCatalog.value = false
  else if (showSettings.value) showSettings.value = false
  else if (showBars.value) { showBars.value = false; closeSubPanels() }
  else emit('back')
}

function updateClock() {
  const now = new Date()
  currentTime.value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
}

// ========== 初始化 ==========
let clockTimer = null

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 10000)
  document.addEventListener('keydown', onKeyDown)

  // 首次渲染：恢复阅读位置
  nextTick(() => {
    isRestoring = true
    restorePosition()
    // 给 DOM 一点时间完成渲染再开启滚动追踪
    setTimeout(() => { isRestoring = false }, 300)
  })
})

onUnmounted(() => {
  clearInterval(clockTimer)
  stopAutoRead()
  flushProgress()
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.reader-container {
  position: relative; height: 100vh;
  display: flex; flex-direction: column; overflow: hidden;
  transition: background 0.3s, color 0.3s;
}
.reader-top-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 20;
  display: flex; align-items: center; padding: 10px 16px;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); color: #eee;
}
.bar-btn { background: none; border: none; color: #eee; font-size: 14px; cursor: pointer; padding: 4px 10px; border-radius: 4px; white-space: nowrap; }
.bar-btn:hover { background: rgba(255,255,255,0.1); }
.bar-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.chapter-name-top { flex: 1; text-align: center; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc; }
.top-spacer { width: 60px; }
.chapter-label-fixed {
  position: absolute; top: 8px; left: 16px; font-size: 12px; z-index: 5;
  color: v-bind('settings.nightMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"');
  pointer-events: none; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.reader-scroll { flex: 1; overflow-y: auto; scroll-behavior: auto; scrollbar-width: none; -ms-overflow-style: none; }
.reader-scroll::-webkit-scrollbar { display: none; }
.reader-content { max-width: 800px; margin: 0 auto; word-wrap: break-word; text-align: justify; user-select: text; }

/* 章节块 */
.chapter-block { margin-bottom: 0; }
.chapter-header { padding: 28px 0 16px; border-bottom: 1px solid v-bind('settings.nightMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"'); margin-bottom: 16px; }
.chapter-title-inline { font-size: 1.2em; font-weight: 700; text-align: center; color: inherit; opacity: 0.85; }
.chapter-body :deep(p) { text-indent: 2em; margin-bottom: v-bind('settings.paragraphSpacing + "px"'); line-height: inherit; }

.reader-info-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; padding: 4px 20px;
  font-size: 11px; color: v-bind('settings.nightMode ? "#555" : "#bbb"');
  pointer-events: none; z-index: 5;
}
.reader-bottom-bar {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 20;
  background: rgba(0,0,0,0.9); backdrop-filter: blur(10px); padding: 12px 16px 20px; color: #eee;
}
.bar-row { display: flex; align-items: center; gap: 10px; }
.nav-row { margin-bottom: 14px; }
.progress-slider { flex: 1; padding: 0 4px; }
.slider { width: 100%; height: 4px; -webkit-appearance: none; appearance: none; background: #444; border-radius: 2px; outline: none; }
.slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #e67e22; cursor: pointer; }
.func-row { display: flex; justify-content: space-around; }
.func-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: #ccc; font-size: 11px; cursor: pointer; padding: 4px 12px; }
.func-btn:hover { color: #fff; }
.func-icon { font-size: 20px; }

.catalog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 50; }
.catalog-panel { position: absolute; left: 0; top: 0; bottom: 0; width: 320px; max-width: 80vw; background: #fff; box-shadow: 4px 0 16px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
.night-mode .catalog-panel { background: #222; }
.catalog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.night-mode .catalog-header { border-color: #444; }
.catalog-header h3 { font-size: 16px; color: #333; }
.night-mode .catalog-header h3 { color: #ddd; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 4px; }
.catalog-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.catalog-item { display: flex; align-items: center; padding: 10px 20px; cursor: pointer; font-size: 14px; color: #555; transition: background 0.15s; }
.night-mode .catalog-item { color: #bbb; }
.catalog-item:hover { background: #f5f5f5; }
.night-mode .catalog-item:hover { background: #333; }
.catalog-item.active { color: #e67e22; background: #fff8f0; }
.night-mode .catalog-item.active { background: #3a2a10; }
.chapter-index { width: 32px; font-size: 12px; color: #bbb; flex-shrink: 0; }
.chapter-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.settings-panel { position: absolute; bottom: 0; left: 0; right: 0; z-index: 30; background: rgba(0,0,0,0.92); backdrop-filter: blur(10px); padding: 16px; color: #eee; max-height: 70vh; overflow-y: auto; }
.settings-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; flex-wrap: wrap; }
.font-ctrl-btn { width: 40px; height: 40px; border: 1px solid #555; border-radius: 8px; background: transparent; color: #eee; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.font-ctrl-btn:hover { background: #333; }
.font-size-display { min-width: 30px; text-align: center; font-size: 16px; font-weight: 600; }
.font-family-select select { padding: 6px 10px; border: 1px solid #555; border-radius: 6px; background: #333; color: #eee; font-size: 13px; outline: none; cursor: pointer; }
.preset-btn { padding: 6px 12px; border: 1px solid #555; border-radius: 6px; background: transparent; color: #ccc; font-size: 12px; cursor: pointer; transition: all 0.2s; }
.preset-btn:hover { background: #333; }
.preset-btn.active { background: #e67e22; border-color: #e67e22; color: #fff; }
.more-btn { border-style: dashed; }
.theme-btn { width: 48px; height: 32px; border: 2px solid transparent; border-radius: 6px; font-size: 10px; cursor: pointer; transition: border-color 0.2s; }
.theme-btn.active { border-color: #e67e22; }
.func-btn-lg { display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: none; color: #ccc; font-size: 11px; cursor: pointer; padding: 4px 10px; }
.func-btn-lg:hover { color: #fff; }
.more-settings { padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin: 4px 0; }
.slider-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 12px; color: #aaa; }
.slider-row label { min-width: 60px; }
.slider-row input[type="range"] { flex: 1; height: 3px; -webkit-appearance: none; appearance: none; background: #555; border-radius: 2px; outline: none; }
.slider-row input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #e67e22; cursor: pointer; }
.slider-row span { min-width: 40px; text-align: right; font-size: 11px; }
.extra-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

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
