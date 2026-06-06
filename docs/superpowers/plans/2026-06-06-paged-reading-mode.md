# 分页阅读模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 CSS 多列分页重建"翻页"阅读模式，整页不切行，覆盖动画统一为"下一页自上而下覆盖"的单一动作，与现有滚屏模式并存。

**Architecture:** 新增纯函数分页数学模块 + `usePagedReader` 引擎（CSS 多列、两层 DOM）+ `PagedContent.vue`。`Reader.vue` 按 `settings.readingMode`（`scroll`/`paged`）二选一渲染内容区。自动阅读在 `useAutoRead` 新增 `startPagedAutoRead` 分支，删除旧的 `startCoverAutoRead`（克隆/遮罩/底部条）。清理空壳的 `autoReadMode` 与三级"翻页方式"面板。

**Tech Stack:** Vue 3 `<script setup>` + Composition API、CSS multi-column、Vite、Electron（渲染层无关）。无测试框架，纯函数用 Node 断言脚本验证，DOM/视觉用手动回归清单 + `vite build`。

参考 spec：`docs/superpowers/specs/2026-06-06-paged-reading-mode-design.md`

---

### Task 1: 分页数学纯函数模块

**Files:**
- Create: `src/modules/reader/pagination.js`
- Test: `scripts/test-pagination.mjs`（一次性 Node 断言脚本）

- [ ] **Step 1: 写失败测试**

`scripts/test-pagination.mjs`：

```js
import {
  computePageCount, ratioToPageIndex, pageIndexToRatio, clampPage,
  resolveNextPage, resolvePrevPage,
} from '../src/modules/reader/pagination.js'

let pass = 0, fail = 0
const eq = (got, exp, msg) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  console.log((ok ? 'PASS' : 'FAIL ❌') + ' ' + msg + (ok ? '' : ` got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`))
  ok ? pass++ : fail++
}

// computePageCount：四舍五入，至少 1 页
eq(computePageCount(0, 300), 1, 'pageCount 空内容=1')
eq(computePageCount(900, 300), 3, 'pageCount 900/300=3')
eq(computePageCount(901, 300), 3, 'pageCount 901/300≈3')
eq(computePageCount(300, 0), 1, 'pageCount step=0 兜底=1')

// ratio ↔ pageIndex（ratio 以 pageCount 为分母）
eq(ratioToPageIndex(0, 5), 0, 'ratio0→page0')
eq(ratioToPageIndex(0.8, 5), 4, 'ratio0.8×5=4')
eq(ratioToPageIndex(1, 5), 4, 'ratio1 夹到末页4')
eq(pageIndexToRatio(0, 5), 0, 'page0→ratio0')
eq(pageIndexToRatio(4, 5), 0.8, 'page4/5=0.8')
eq(pageIndexToRatio(0, 0), 0, 'pageCount0→ratio0')

// clampPage
eq(clampPage(-2, 5), 0, 'clamp 下界')
eq(clampPage(9, 5), 4, 'clamp 上界')

// resolveNextPage
eq(resolveNextPage({ pageIndex: 0, pageCount: 3, chapterIndex: 1, totalChapters: 4 }),
   { chapterIndex: 1, pageIndex: 1, crossedChapter: false, atEnd: false }, 'next 同章')
eq(resolveNextPage({ pageIndex: 2, pageCount: 3, chapterIndex: 1, totalChapters: 4 }),
   { chapterIndex: 2, pageIndex: 0, crossedChapter: true, atEnd: false }, 'next 跨章')
eq(resolveNextPage({ pageIndex: 2, pageCount: 3, chapterIndex: 3, totalChapters: 4 }),
   { chapterIndex: 3, pageIndex: 2, crossedChapter: false, atEnd: true }, 'next 全书末页')

// resolvePrevPage（跨章用 pageIndex:-1 表示"上一章末页"）
eq(resolvePrevPage({ pageIndex: 2, chapterIndex: 1 }),
   { chapterIndex: 1, pageIndex: 1, crossedChapter: false, atStart: false }, 'prev 同章')
eq(resolvePrevPage({ pageIndex: 0, chapterIndex: 1 }),
   { chapterIndex: 0, pageIndex: -1, crossedChapter: true, atStart: false }, 'prev 跨章→末页哨兵')
eq(resolvePrevPage({ pageIndex: 0, chapterIndex: 0 }),
   { chapterIndex: 0, pageIndex: 0, crossedChapter: false, atStart: true }, 'prev 全书首页')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-pagination.mjs`
Expected: FAIL（`Cannot find module .../pagination.js`）

- [ ] **Step 3: 实现 pagination.js**

`src/modules/reader/pagination.js`：

```js
/**
 * 翻页分页纯函数（无 DOM，可单测）
 * ratio：章内阅读比例 0~1，以 pageCount 为分母（page p → p/pageCount）
 */

/** 页数 = 内容总宽 / 单页步长，四舍五入，至少 1 页 */
export function computePageCount(scrollWidth, step) {
  if (!step || step <= 0) return 1
  return Math.max(1, Math.round(scrollWidth / step))
}

/** 夹取页码到 [0, pageCount-1] */
export function clampPage(pageIndex, pageCount) {
  if (pageCount <= 0) return 0
  return Math.min(pageCount - 1, Math.max(0, pageIndex))
}

/** 章内比例 → 页码 */
export function ratioToPageIndex(ratio, pageCount) {
  const r = Math.min(1, Math.max(0, ratio || 0))
  return clampPage(Math.round(r * pageCount), pageCount)
}

/** 页码 → 章内比例 */
export function pageIndexToRatio(pageIndex, pageCount) {
  if (pageCount <= 0) return 0
  return Math.min(1, Math.max(0, pageIndex / pageCount))
}

/** 下一页目标（可能跨章）；atEnd=全书末页 */
export function resolveNextPage({ pageIndex, pageCount, chapterIndex, totalChapters }) {
  if (pageIndex < pageCount - 1) {
    return { chapterIndex, pageIndex: pageIndex + 1, crossedChapter: false, atEnd: false }
  }
  if (chapterIndex < totalChapters - 1) {
    return { chapterIndex: chapterIndex + 1, pageIndex: 0, crossedChapter: true, atEnd: false }
  }
  return { chapterIndex, pageIndex, crossedChapter: false, atEnd: true }
}

/** 上一页目标（可能跨章）；跨章用 pageIndex:-1 表示"上一章末页"，由调用方 layout 后定位；atStart=全书首页 */
export function resolvePrevPage({ pageIndex, chapterIndex }) {
  if (pageIndex > 0) {
    return { chapterIndex, pageIndex: pageIndex - 1, crossedChapter: false, atStart: false }
  }
  if (chapterIndex > 0) {
    return { chapterIndex: chapterIndex - 1, pageIndex: -1, crossedChapter: true, atStart: false }
  }
  return { chapterIndex, pageIndex: 0, crossedChapter: false, atStart: true }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/test-pagination.mjs`
Expected: PASS（`18 passed, 0 failed`，行数以实际为准）

- [ ] **Step 5: 提交**

```bash
git add src/modules/reader/pagination.js scripts/test-pagination.mjs
git commit -m "feat: 新增分页数学纯函数模块 + Node 断言测试"
```

---

### Task 2: 设置模型新增 readingMode

**Files:**
- Modify: `src/utils/bookStore.js`（默认设置对象）

- [ ] **Step 1: 查看现有默认设置**

Run: `grep -n "autoReadMode\|autoReadSpeed\|leftMargin\|DEFAULT_SETTINGS\|function getSettings" src/utils/bookStore.js`
记录默认设置对象所在位置与字段。

- [ ] **Step 2: 加入 readingMode 字段**

在默认设置对象中（与 `autoReadSpeed` 同级）新增：

```js
  readingMode: 'scroll',   // 'scroll' 滚屏 | 'paged' 翻页
```

> 暂不删除 `autoReadMode`（Task 7 统一清理），保证中间状态可构建。

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错。

- [ ] **Step 4: 提交**

```bash
git add src/utils/bookStore.js
git commit -m "feat: 设置新增 readingMode 字段（默认 scroll）"
```

---

### Task 3: 分页引擎 usePagedReader

**Files:**
- Create: `src/composables/usePagedReader.js`

- [ ] **Step 1: 实现 usePagedReader.js**

`src/composables/usePagedReader.js`：

```js
import { ref } from 'vue'
import { getChapterText } from '@/utils/chapterParser.js'
import {
  computePageCount, ratioToPageIndex, pageIndexToRatio, clampPage,
  resolveNextPage, resolvePrevPage,
} from '@/modules/reader/pagination.js'

/**
 * 分页阅读引擎：把当前章排成 CSS 多列页面，提供页导航与覆盖翻页动画。
 * 覆盖动画唯一动作：incoming 层遮罩高度 0→满（下一页自上而下覆盖当前页）。
 *
 * @param {Object} o
 * @param {Ref<HTMLElement>} o.viewportEl    可视页框（决定页宽/页高，承载排版样式）
 * @param {Ref<HTMLElement>} o.baseLayerEl   底层（translateX 显示当前页）
 * @param {Ref<HTMLElement>} o.baseFlowEl    底层多列内容容器
 * @param {Ref<HTMLElement>} o.coverMaskEl   上层遮罩（高度 0→满）
 * @param {Ref<HTMLElement>} o.incomingLayerEl 上层（translateX 显示下一页）
 * @param {Ref<HTMLElement>} o.incomingFlowEl  上层多列内容容器
 * @param {Ref} o.settings
 * @param {Ref<Array>} o.chapters
 * @param {Ref<string>} o.fullText
 * @param {Ref<number>} o.currentChapterIndex
 */
export function usePagedReader(o) {
  const {
    viewportEl, baseLayerEl, baseFlowEl, coverMaskEl, incomingLayerEl, incomingFlowEl,
    settings, chapters, fullText, currentChapterIndex,
  } = o

  const pageIndex = ref(0)
  const pageCount = ref(1)
  let step = 0
  let animating = false
  let raf = null

  const sideMargin = () => Math.max(0, settings.value.leftMargin || 0)
  const V_PAD_TOP = 24
  const V_PAD_BOTTOM = 48

  /** 填充某章正文到 flow（标题 + 段落） */
  function fillFlow(flowEl, chapterIdx) {
    flowEl.innerHTML = ''
    const meta = chapters.value[chapterIdx]
    if (!meta) return
    const text = getChapterText(fullText.value, meta)
    const lines = text.split('\n').filter(l => l.trim())
    const frag = document.createDocumentFragment()
    const h = document.createElement('h2')
    h.className = 'paged-chapter-title'
    h.textContent = meta.title
    frag.appendChild(h)
    if (lines.length === 0) {
      const p = document.createElement('p')
      p.textContent = '（本章无内容）'
      frag.appendChild(p)
    } else {
      for (const line of lines) {
        const p = document.createElement('p')
        p.textContent = line.trim()
        frag.appendChild(p)
      }
    }
    flowEl.appendChild(frag)
  }

  /** 列化 flow：列宽=内容宽、列高=内容高、列隙=2×边距。返回 step（页间距）。 */
  function applyColumns(flowEl) {
    const vp = viewportEl.value
    const lm = sideMargin()
    const colW = Math.max(1, vp.clientWidth - 2 * lm)
    const colH = Math.max(1, vp.clientHeight - V_PAD_TOP - V_PAD_BOTTOM)
    const gap = 2 * lm
    flowEl.style.columnWidth = colW + 'px'
    flowEl.style.columnGap = gap + 'px'
    flowEl.style.height = colH + 'px'
    flowEl.style.columnFill = 'auto'
    return colW + gap
  }

  function setLayerPage(layerEl, p) {
    layerEl.style.transform = `translateX(${-p * step}px)`
  }

  /** 预备 incoming 层为"下一页"（同章 +1 或下一章首页） */
  function prepareIncoming() {
    if (!incomingFlowEl.value || !incomingLayerEl.value || !coverMaskEl.value) return
    coverMaskEl.value.style.height = '0px'
    const nxt = resolveNextPage({
      pageIndex: pageIndex.value, pageCount: pageCount.value,
      chapterIndex: currentChapterIndex.value, totalChapters: chapters.value.length,
    })
    const idx = nxt.atEnd ? currentChapterIndex.value : nxt.chapterIndex
    fillFlow(incomingFlowEl.value, idx)
    applyColumns(incomingFlowEl.value)
    setLayerPage(incomingLayerEl.value, nxt.atEnd ? pageIndex.value : nxt.pageIndex)
  }

  /**
   * 重新排版当前章并测量页数。
   * @param {number|null} targetPageIndex  指定页码；-1=末页；null=用 ratio 或保持
   * @param {number|null} ratio
   */
  function layout(targetPageIndex = null, ratio = null) {
    const vp = viewportEl.value
    if (!vp || !baseFlowEl.value || !baseLayerEl.value) return
    fillFlow(baseFlowEl.value, currentChapterIndex.value)
    step = applyColumns(baseFlowEl.value)
    // 强制布局后测量
    pageCount.value = computePageCount(baseFlowEl.value.scrollWidth, step)

    let p
    if (targetPageIndex === -1) p = pageCount.value - 1
    else if (targetPageIndex != null) p = targetPageIndex
    else if (ratio != null) p = ratioToPageIndex(ratio, pageCount.value)
    else p = pageIndex.value
    pageIndex.value = clampPage(p, pageCount.value)

    setLayerPage(baseLayerEl.value, pageIndex.value)
    prepareIncoming()
  }

  function cancelAnim() {
    if (raf) { cancelAnimationFrame(raf); raf = null }
    animating = false
  }

  /** 覆盖动画：遮罩 0→满，时长 duration ms，结束 resolve */
  function animateCover(fromFull, duration) {
    return new Promise(resolve => {
      const vp = viewportEl.value
      const full = vp ? vp.clientHeight : 0
      const start = performance.now()
      const tick = (t) => {
        const p = Math.min(1, (t - start) / Math.max(1, duration))
        const h = fromFull ? full * (1 - p) : full * p
        if (coverMaskEl.value) coverMaskEl.value.style.height = h + 'px'
        if (p >= 1) { raf = null; resolve(); return }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
  }

  /** 翻到下一页：播放覆盖动画后提交。返回 {atEnd} */
  async function turnNext(duration) {
    if (animating) return { atEnd: false }
    const nxt = resolveNextPage({
      pageIndex: pageIndex.value, pageCount: pageCount.value,
      chapterIndex: currentChapterIndex.value, totalChapters: chapters.value.length,
    })
    if (nxt.atEnd) return { atEnd: true }
    animating = true
    await animateCover(false, duration)   // 遮罩 0→满
    // 提交
    if (nxt.crossedChapter) {
      currentChapterIndex.value = nxt.chapterIndex
      layout(0)
    } else {
      pageIndex.value = nxt.pageIndex
      setLayerPage(baseLayerEl.value, pageIndex.value)
      prepareIncoming()
    }
    animating = false
    return { atEnd: false }
  }

  /** 翻到上一页。同章=反向覆盖动画；跨章=瞬切上一章末页。返回 {atStart} */
  async function turnPrev(duration) {
    if (animating) return { atStart: false }
    const prv = resolvePrevPage({ pageIndex: pageIndex.value, chapterIndex: currentChapterIndex.value })
    if (prv.atStart) return { atStart: true }
    if (prv.crossedChapter) {
      currentChapterIndex.value = prv.chapterIndex
      layout(-1)
      return { atStart: false }
    }
    // 同章反向：base=上一页，incoming=当前页，遮罩满→0
    animating = true
    const curr = pageIndex.value
    fillFlow(incomingFlowEl.value, currentChapterIndex.value)
    applyColumns(incomingFlowEl.value)
    setLayerPage(incomingLayerEl.value, curr)
    setLayerPage(baseLayerEl.value, prv.pageIndex)
    const vp = viewportEl.value
    if (coverMaskEl.value && vp) coverMaskEl.value.style.height = vp.clientHeight + 'px'
    await animateCover(true, duration)    // 遮罩 满→0
    pageIndex.value = prv.pageIndex
    setLayerPage(baseLayerEl.value, pageIndex.value)
    prepareIncoming()
    animating = false
    return { atStart: false }
  }

  function destroy() { cancelAnim() }

  const pageRatio = () => pageIndexToRatio(pageIndex.value, pageCount.value)
  const isAnimating = () => animating

  return {
    pageIndex, pageCount, pageRatio, isAnimating,
    layout, turnNext, turnPrev, prepareIncoming, destroy,
  }
}
```

- [ ] **Step 2: 构建验证（引擎尚未被引用，仅验证语法/导入）**

Run: `npm run build`
Expected: 构建成功（该文件此时未被任何组件 import，Vite 不会编译它；如需即时校验语法可临时在 Task 4 引用后再验）。

- [ ] **Step 3: 提交**

```bash
git add src/composables/usePagedReader.js
git commit -m "feat: 新增 CSS 多列分页引擎 usePagedReader"
```

---

### Task 4: 翻页内容区组件 PagedContent.vue

**Files:**
- Create: `src/modules/reader/components/PagedContent.vue`

- [ ] **Step 1: 实现 PagedContent.vue**

`src/modules/reader/components/PagedContent.vue`：

```vue
<template>
  <div class="paged-viewport" ref="viewport" :style="viewportStyle">
    <!-- 底层：当前页 -->
    <div class="paged-layer base" ref="baseLayer">
      <div class="paged-flow" ref="baseFlow"></div>
    </div>
    <!-- 上层：下一页，被遮罩自上而下露出 -->
    <div class="cover-mask" ref="coverMask">
      <div class="paged-layer incoming" ref="incomingLayer">
        <div class="paged-flow" ref="incomingFlow"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  viewportStyle: { type: Object, required: true },
  nightMode: { type: Boolean, default: false },
  paragraphSpacing: { type: Number, default: 12 },
})

const viewport = ref(null)
const baseLayer = ref(null)
const baseFlow = ref(null)
const coverMask = ref(null)
const incomingLayer = ref(null)
const incomingFlow = ref(null)

defineExpose({ viewport, baseLayer, baseFlow, coverMask, incomingLayer, incomingFlow })
</script>

<style lang="scss" scoped>
.paged-viewport {
  flex: 1; position: relative; overflow: hidden;
  padding: 24px v-bind('($props.viewportStyle.paddingLeft) || "0"') 48px;
  user-select: text;
}

.paged-layer {
  position: absolute; top: 24px; bottom: 48px; left: 0; right: 0;
  will-change: transform;
}

.paged-flow {
  width: 100%;
  text-align: justify; word-wrap: break-word;
  /* column-* / height 由 JS 引擎按视口注入 */
}

.cover-mask {
  position: absolute; top: 0; left: 0; right: 0; height: 0;
  overflow: hidden; will-change: height; z-index: 2;
  background: v-bind('nightMode ? "#1a1a1a" : "transparent"');
}

/* incoming 层在遮罩内，仍需与 base 同样的内边距定位 */
.cover-mask .paged-layer.incoming { top: 24px; }

:deep(.paged-chapter-title) {
  font-size: 1.2em; font-weight: 700; text-align: center;
  opacity: 0.85; margin-bottom: 1em;
  break-inside: avoid;
}

:deep(.paged-flow p) {
  text-indent: 2em;
  margin: 0 0 v-bind('paragraphSpacing + "px"');
  line-height: inherit;
}
</style>
```

> 说明：viewport 承载排版样式（字号/字体/行高/颜色/背景由父组件通过 `viewportStyle` 传入并由 `:style` 应用；side padding 用 `paddingLeft`）。`background` 走父组件 readerStyle（容器级），此处遮罩夜间用纯色挡住下层。

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功（组件此时未被引用，下一 Task 接入；仅确认 SCSS/模板无语法错）。如需强制编译，可先完成 Task 5 再统一验。

- [ ] **Step 3: 提交**

```bash
git add src/modules/reader/components/PagedContent.vue
git commit -m "feat: 新增翻页内容区组件 PagedContent（两层 DOM + 遮罩）"
```

---

### Task 5: Reader.vue 接入翻页模式（渲染切换 + 交互 + 进度）

**Files:**
- Modify: `src/components/Reader.vue`

- [ ] **Step 1: 引入组件与引擎，新增 paged 状态**

在 `<script setup>` 顶部 import 区追加：

```js
import PagedContent from '@/modules/reader/components/PagedContent.vue'
import { usePagedReader } from '@/composables/usePagedReader'
```

在"基础状态"区追加 paged 相关 ref：

```js
const isPaged = computed(() => settings.value.readingMode === 'paged')
const pagedRef = ref(null)
const pagedViewport = ref(null)
const pagedBaseLayer = ref(null)
const pagedBaseFlow = ref(null)
const pagedCoverMask = ref(null)
const pagedIncomingLayer = ref(null)
const pagedIncomingFlow = ref(null)
```

- [ ] **Step 2: 新增 viewportStyle 计算属性（排版样式给 PagedContent）**

在 `contentStyle` 计算属性后追加：

```js
const viewportStyle = computed(() => {
  const ff = FONT_FAMILIES.find(f => f.id === settings.value.fontFamily)
  return {
    fontSize: settings.value.fontSize + 'px',
    fontFamily: ff ? ff.value : '',
    lineHeight: settings.value.lineHeight,
    paddingLeft: (settings.value.leftMargin || 0) + 'px',
    width: (settings.value.contentWidth || 80) + '%',
    margin: '0 auto',
  }
})
```

- [ ] **Step 3: 创建分页引擎实例**

在 `useChapterRenderer(...)` 实例（`renderer`）之后追加：

```js
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
```

- [ ] **Step 4: 模板内容区按模式二选一**

把 `<ReaderContent ... />` 整段替换为：

```vue
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
    />
```

- [ ] **Step 5: 翻页模式手动翻页 + 进度**

新增翻页手动操作与进度计算函数（放在 `jumpToChapter` 附近）：

```js
const MANUAL_TURN_MS = 280

async function pagedNext() {
  const { atEnd } = await paged.turnNext(MANUAL_TURN_MS)
  if (!atEnd) afterPagedTurn()
}
async function pagedPrev() {
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
```

- [ ] **Step 6: 点按/键盘按模式分流**

把 `onReaderClick` 的"中部/上下"分支改为按模式处理。将原函数体中"非面板态"的区域判断替换为：

```js
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
  // —— 以下为滚屏模式原逻辑（保持不变）——
  if (y > 0.25 && y < 0.75) {
    if (autoReading.value) { showAutoRead() } else { showDefaultPanel() }
  } else if (y <= 0.25) {
    scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  } else {
    scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' })
  }
```

把 `useKeyboard` 的 onPrev/onNext 改为按模式分流：

```js
useKeyboard({
  onPrev: () => isPaged.value
    ? pagedPrev()
    : scrollArea.value?.scrollBy({ top: -scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }),
  onNext: () => isPaged.value
    ? pagedNext()
    : scrollArea.value?.scrollBy({ top: scrollArea.value.clientHeight * 0.8, behavior: 'smooth' }),
  onEscape: handleEscape,
})
```

- [ ] **Step 7: 初始化 / 章节跳转 / 设置变更 按模式分流**

修改 `onMounted`：根据模式初始化对应引擎。把现有 `onMounted` 内容替换为：

```js
onMounted(() => {
  nextTick(() => {
    const ratio = props.book.currentScrollRatio || 0
    currentChapterIndex.value = props.book.currentChapterIndex || 0
    sliderChapter.value = currentChapterIndex.value
    if (isPaged.value) {
      // 绑定 PagedContent 暴露的真实 DOM
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
})

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
```

修改 `jumpToChapter` / `jumpFromCatalog`：翻页模式走 paged.layout：

```js
function jumpToChapter(index) {
  if (index < 0 || index >= totalChapters.value) return
  currentChapterIndex.value = index
  sliderChapter.value = index
  if (isPaged.value) { paged.layout(0); updatePagedProgress() }
  else { renderer.rebuildWindow(index, 0) }
}
```

新增：排版相关设置变化时，翻页模式按 ratio 重排（字号/行距/字体/边距/宽度/段间距）。在 `onSettingsChange` 内追加：

```js
function onSettingsChange() {
  saveSettings(settings.value)
  if (isPaged.value) {
    const ratio = paged.pageRatio()
    nextTick(() => { paged.layout(null, ratio); updatePagedProgress() })
  }
}
```

新增 resize 重排（onMounted 内追加监听，onUnmounted 移除）：

```js
function onPagedResize() {
  if (!isPaged.value) return
  const ratio = paged.pageRatio()
  paged.layout(null, ratio)
  updatePagedProgress()
}
window.addEventListener('resize', onPagedResize)
```

在 `onUnmounted` 内追加：

```js
  window.removeEventListener('resize', onPagedResize)
  paged.destroy()
```

- [ ] **Step 8: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错（57+ 模块）。

- [ ] **Step 9: 提交**

```bash
git add src/components/Reader.vue
git commit -m "feat: Reader 接入翻页模式（渲染切换/左右点按/键盘/进度/重排）"
```

---

### Task 6: 翻页自动阅读 + 删除旧覆盖实现

**Files:**
- Modify: `src/composables/useAutoRead.js`
- Modify: `src/components/Reader.vue`（自动阅读分支接线）

- [ ] **Step 1: useAutoRead 删除旧覆盖、新增分页分支**

打开 `src/composables/useAutoRead.js`：

1. 删除整个 `startCoverAutoRead` 函数（含 overlay/mask/line/bottomCover/clone/computePageStep/snapshotNextPage/animateCover 相关全部局部代码）与 `cleanupCoverOverlay`、`coverOverlayEl` 变量。
2. 新增依赖参数：`useAutoRead` 入参增加 `isPaged`（Ref<boolean>）、`pagedTurnNext`（()=>Promise<{atEnd}>）、`afterPagedTurn`（()=>void）。
3. `startAutoRead()` 改为按模式选择分支：

```js
  function startAutoRead() {
    stopAutoRead()
    if (!scrollArea.value && !isPaged.value) return
    if (isPaged.value) {
      startPagedAutoRead()
    } else {
      startScrollAutoRead()
    }
  }
```

4. 新增分页自动阅读（覆盖动画时长 = 每页停留 dwell；速度滑块映射 dwell）：

```js
  let pagedLoopStop = false

  function dwellMs() {
    const speed = Math.max(0, Math.min(100, settings.value.autoReadSpeed ?? 30))
    // 速度 0→慢(约 12s/页)，100→快(约 1.2s/页)
    return Math.max(1200, 12000 - speed * 108)
  }

  async function startPagedAutoRead() {
    pagedLoopStop = false
    while (!pagedLoopStop && autoReading.value) {
      const { atEnd } = await pagedTurnNext(dwellMs())
      if (atEnd) { autoReading.value = false; break }
      if (pagedLoopStop || !autoReading.value) break
      afterPagedTurn()
    }
  }
```

5. `stopAutoRead()` / `pauseAutoRead()` 内追加 `pagedLoopStop = true`（停止 while 循环）；移除对 coverOverlay 的清理引用。

- [ ] **Step 2: Reader.vue 接线新参数**

修改 `useAutoRead({...})` 调用，追加三个参数：

```js
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
```

> `afterPagedTurn` 已在 Task 5 定义；`isPaged`/`paged` 已存在。

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，无报错。`grep -n "startCoverAutoRead\|coverOverlayEl\|computePageStep" src/composables/useAutoRead.js` 应无输出。

- [ ] **Step 4: 提交**

```bash
git add src/composables/useAutoRead.js src/components/Reader.vue
git commit -m "feat: 翻页模式自动阅读（覆盖节奏）并删除旧克隆/遮罩实现"
```

---

### Task 7: 设置/面板 UI 整合，删除 autoReadMode 与三级翻页方式

**Files:**
- Modify: `src/modules/reader/components/SettingsPanel.vue`
- Modify: `src/modules/reader/components/AutoReadPanel.vue`
- Modify: `src/components/Reader.vue`
- Modify: `src/composables/usePanelSystem.js`
- Modify: `src/modules/reader/constants.js`
- Modify: `src/utils/bookStore.js`
- Delete: `src/modules/reader/components/Level3PageMode.vue`

- [ ] **Step 1: SettingsPanel 用阅读模式开关替换"翻页类型"**

把 `SettingsPanel.vue` 中"翻页类型"那行 `.page-mode-trigger`（含 `@click="$emit('open-level3')"`）替换为阅读模式两态切换：

```vue
      <div class="control-row">
        <span>阅读模式</span>
        <div class="mode-switch">
          <button :class="{ active: settings.readingMode === 'scroll' }" @click="$emit('set-reading-mode', 'scroll')">滚屏</button>
          <button :class="{ active: settings.readingMode === 'paged' }" @click="$emit('set-reading-mode', 'paged')">翻页</button>
        </div>
      </div>
```

`defineEmits` 去掉 `open-level3`，加入 `set-reading-mode`。补充样式：

```scss
.mode-switch { display: flex; gap: $spacing-xs; }
.mode-switch button {
  padding: $spacing-xs $spacing-md; border: 1px solid #555; border-radius: $radius-md;
  background: transparent; color: #bbb; font-size: $font-size-sm; cursor: pointer;
  &.active { background: $color-brand; border-color: $color-brand; color: $color-white; }
}
```

并删除 `currentPageModeName` prop（不再使用）。

- [ ] **Step 2: AutoReadPanel 模式切换对应 readingMode**

`AutoReadPanel.vue` 中两个 `.arp-mode-item`：把 `settings.autoReadMode === 'scroll'/'cover'` 改为 `settings.readingMode === 'scroll'/'paged'`，`@click="$emit('set-mode', 'scroll')"` 改为 `'paged'`，文案"覆盖翻页"保留。`set-mode` 语义改为设置 readingMode。

```vue
      <div class="arp-mode-item" :class="{ active: settings.readingMode === 'scroll' }" @click="$emit('set-mode', 'scroll')">
        ... <span>滚屏翻页</span>
      </div>
      <div class="arp-mode-item" :class="{ active: settings.readingMode === 'paged' }" @click="$emit('set-mode', 'paged')">
        ... <span>覆盖翻页</span>
      </div>
```

- [ ] **Step 3: Reader.vue 收口**

1. 删除模板中 `<Level3PageMode .../>` 整段及其 `<transition>` 包裹。
2. 删除 import：`Level3PageMode`、`PAGE_MODES`（保留 `CATALOG_TABS`）。
3. 删除 `pageModes`、`currentPageModeName`、`selectPageMode`、`openLevel3/closeLevel3/closeLevel3ToReading`/`showLevel3` 相关使用；从 `usePanelSystem()` 解构中移除 level3 项。
4. SettingsPanel 绑定调整：移除 `@open-level3` 与 `:current-page-mode-name`，新增 `@set-reading-mode="setReadingMode"`。
5. AutoReadPanel 的 `@set-mode` 改绑 `setReadingMode`（替换原 `setAutoReadMode`）。
6. 新增 `setReadingMode`，并删除 `setAutoReadMode`：

```js
function setReadingMode(mode) {
  if (settings.value.readingMode === mode) return
  const wasAuto = autoReading.value
  if (wasAuto) autoRead.stopAutoRead()
  settings.value.readingMode = mode
  saveSettings(settings.value)
  nextTick(() => {
    if (isPaged.value) { bindPagedEls(); paged.layout(null, props.book.currentScrollRatio || 0); updatePagedProgress() }
    else {
      scrollArea.value = readerContentRef.value?.scrollArea || null
      contentEl.value = readerContentRef.value?.contentEl || null
      renderer.rebuildWindow(currentChapterIndex.value, 0)
    }
    if (wasAuto) { autoReading.value = true; autoRead.startAutoRead() }
  })
}
```

> 注意：模板里 `showLevel3` 条件（`!showLevel3`）需一并移除（直接删掉该条件项），因为 level3 已不存在。

- [ ] **Step 4: usePanelSystem 删除 level3**

`src/composables/usePanelSystem.js`：删除 `showLevel3` ref、`openLevel3/closeLevel3/closeLevel3ToReading`，并从 `showAnyPanel` 计算与导出中移除。其余面板逻辑不变。

- [ ] **Step 5: constants 删除 PAGE_MODES，bookStore 删除 autoReadMode**

- `src/modules/reader/constants.js`：删除 `PAGE_MODES` 导出（保留 `CATALOG_TABS`）。
- `src/utils/bookStore.js`：从默认设置删除 `autoReadMode` 字段。

- [ ] **Step 6: 删除 Level3PageMode 组件**

```bash
git rm src/modules/reader/components/Level3PageMode.vue
```

- [ ] **Step 7: 构建 + 残留扫描**

Run: `npm run build`
Expected: 构建成功。
Run: `grep -rn "autoReadMode\|Level3PageMode\|PAGE_MODES\|showLevel3\|openLevel3" src/`
Expected: 无输出（全部清除）。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "refactor: 用 readingMode 统一模式，删除 autoReadMode 与空壳翻页方式面板"
```

---

### Task 8: 终检 + 手动回归

**Files:** 无代码改动（除非回归发现问题）

- [ ] **Step 1: 纯函数测试 + 构建**

Run: `node scripts/test-pagination.mjs && npm run build`
Expected: 测试全过 + 构建成功。

- [ ] **Step 2: 启动应用手动回归**

Run: `npm run electron:dev`（用户执行）
逐项核对：

1. **滚屏模式完全不受影响**：开书渲染/滚动/上下点按/键盘/章节进度/退出再进恢复。
2. 设置面板切到**翻页**模式：正文按页显示，**任意页首尾无切行/丢字/重复**。
3. 翻页模式：左 1/3 点击=上一页、右 1/3=下一页、中部=呼面板；键盘 ←/→ 翻页。
4. 跨章：末页再翻进入下一章首页；首页再翻退回上一章末页。
5. 自动阅读（翻页模式）：下一页自上而下覆盖、盖满翻页；速度滑块改变停留时长；到全书末页自动停止；面板打开暂停、关闭恢复。
6. 设置变更（字号/行距/字体/边距/宽度/段间距/主题/夜间）后**阅读位置不丢**（按 ratio 还原）；窗口 resize 同理。
7. 退出再进、切换 滚屏↔翻页：位置大致接续（同一 ratio）。
8. 底部进度百分比两模式口径一致。

- [ ] **Step 3: 标记完成 / 修复回归**

若发现问题，按 `superpowers:systematic-debugging` 定位修复并补提交；全部通过则结束。

---

## Self-Review

**Spec 覆盖核对：**
- 保留滚屏：Task 5 渲染分流、Task 8 回归项 1 ✓
- 翻页模式手动+自动整页：Task 5（手动/键盘）、Task 6（自动）✓
- 整页不切行（CSS 多列）：Task 3 `applyColumns`、Task 8 回归项 2 ✓
- 下一页自上而下覆盖、一体节奏：Task 3 `turnNext/animateCover`、Task 6 `startPagedAutoRead` ✓
- 一种动画做精：仅覆盖动画（turnNext/turnPrev 共用）✓
- 清理 autoReadMode/翻页方式空壳：Task 7 ✓
- 进度持久化（ratio↔page，不新增字段）：Task 5 Step 5/7、Task 7 setReadingMode ✓
- 测试策略（纯函数 + 手动清单）：Task 1、Task 8 ✓

**占位符扫描：** 无 TBD/TODO；代码步骤均含完整代码。

**类型/命名一致性：** `usePagedReader` 导出 `{ pageIndex, pageCount, pageRatio, isAnimating, layout, turnNext, turnPrev, prepareIncoming, destroy }`，Task 5/6 调用一致；`afterPagedTurn`/`updatePagedProgress`/`bindPagedEls`/`isPaged` 跨 Task 命名一致；`useAutoRead` 新增入参 `isPaged/pagedTurnNext/afterPagedTurn` 在 Task 6 定义、Task 6 Step 2 接线一致。
