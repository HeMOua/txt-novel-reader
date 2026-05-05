# TXT Novel Reader — 项目结构重构方案

> 基于 Vite + Vue3 + Electron 的渐进式重构，确保过程中项目始终可运行。

---

## 现状诊断

| 维度 | 现状 | 问题 |
|------|------|------|
| 目录结构 | `src/components/` 3 个组件平铺 | 无分层，无模块化 |
| 组件体积 | Reader.vue **1328 行** | 巨石组件，面板/渲染/自动阅读/设置全混在一起 |
| 样式 | 纯 CSS，全在 SFC `<style>` 内 | 零 SCSS，零变量，#e67e22 等魔法值散落 30+ 处 |
| 主题/夜间模式 | Bookshelf 用 `.night-mode` 类名，Reader 用 `v-bind()` | 两套实现，不统一 |
| Composables | 完全没有 | 所有逻辑内联在组件里 |
| 路由 | 手动 `ref('shelf'|'reader')` 切换 | 无法扩展 |
| 状态管理 | 无 | props/emit + localStorage 直接读写 |
| Electron | main/preload/chapterParser 3 文件 | chapterParser 与 src/utils/ 重复 |
| 工具层 | bookStore.js = 存储+常量+格式化混合 | 职责不清 |

---

## 一、目标目录结构

```
txt-novel-reader/
├── electron/                        # Electron 主进程层
│   ├── main/
│   │   ├── index.js                 # 主进程入口（createWindow、app 生命周期）
│   │   ├── ipc/                     # IPC 处理器（按功能拆分）
│   │   │   ├── fileHandler.js       # open-files / open-book
│   │   │   └── index.js             # 统一注册
│   │   └── utils/
│   │       ├── encoding.js          # 编码检测逻辑
│   │       └── chapterParser.js     # 章节解析（唯一源，主进程用）
│   ├── preload/
│   │   └── index.js                 # contextBridge 桥接
│   └── shared/                      # 主进程/渲染进程共享
│       └── chapterParser.js         # → 改为 ESM，由 preload 暴露或构建时共享
│
├── src/                             # 渲染进程（Vue 3 前端）
│   ├── main.js                      # Vue 入口
│   ├── App.vue                      # 根组件
│   │
│   ├── router/                      # Vue Router
│   │   └── index.js
│   │
│   ├── stores/                      # Pinia 状态管理
│   │   ├── useBookStore.js          # 书籍数据 + 进度
│   │   └── useSettingsStore.js      # 全局设置（主题、字号、间距等）
│   │
│   ├── composables/                 # 可复用逻辑 Hooks
│   │   ├── useAutoRead.js           # 自动阅读引擎（scroll + cover）
│   │   ├── useChapterRenderer.js    # 滑动窗口章节 DOM 管理
│   │   ├── usePanelSystem.js        # 三级面板状态机
│   │   ├── useKeyboard.js           # 键盘快捷键
│   │   ├── useProgress.js           # 阅读进度追踪与持久化
│   │   ├── useClock.js              # 时钟更新
│   │   └── useWindowWidth.js        # 窗口宽度检测
│   │
│   ├── components/                  # 通用 UI 组件（无业务逻辑）
│   │   ├── common/
│   │   │   ├── SvgIcon.vue          # SVG 图标
│   │   │   ├── ToggleSwitch.vue     # 开关组件
│   │   │   ├── Slider.vue           # 滑块组件
│   │   │   └── ColorCard.vue        # 颜色选择卡片
│   │   └── transitions/
│   │       ├── SlideDown.vue        # 或直接用 CSS transition class
│   │       ├── SlideUp.vue
│   │       └── FadeScale.vue
│   │
│   ├── views/                       # 页面级组件
│   │   ├── BookshelfView.vue        # 书架页
│   │   └── ReaderView.vue           # 阅读页（编排层，调用 composables）
│   │
│   ├── modules/                     # 按业务模块组织（未来扩展）
│   │   └── reader/                  # 阅读器模块
│   │       ├── components/
│   │       │   ├── ReaderContent.vue     # 章节内容渲染区
│   │       │   ├── ReaderInfoBar.vue     # 底部信息栏
│   │       │   ├── ReaderTopBar.vue      # 顶部栏
│   │       │   ├── ChapterNavPanel.vue   # 二级面板-章节导航
│   │       │   ├── CatalogPanel.vue      # 二级面板-目录
│   │       │   ├── NightPanel.vue        # 二级面板-夜间/主题
│   │       │   ├── SettingsPanel.vue     # 二级面板-设置
│   │       │   ├── Level1Panel.vue       # 一级面板（目录/夜间/设置）
│   │       │   ├── Level3PageMode.vue    # 三级面板-翻页方式
│   │       │   └── AutoReadPanel.vue     # 自动阅读专属面板
│   │       └── constants.js         # 阅读器相关常量
│   │
│   ├── services/                    # 服务层（调用 Electron API / 本地存储）
│   │   ├── electronApi.js           # 封装 window.electronAPI 调用
│   │   └── storage.js               # localStorage 读写（从 bookStore.js 迁移）
│   │
│   ├── utils/                       # 纯函数工具
│   │   ├── chapterParser.js         # 渲染进程版章节解析（如仍需要）
│   │   ├── format.js                # formatTime 等格式化函数
│   │   └── color.js                 # 封面颜色计算等
│   │
│   ├── styles/                      # SCSS 样式体系
│   │   ├── variables.scss           # 设计变量
│   │   ├── mixins.scss              # 可复用混入
│   │   ├── reset.scss               # CSS 重置
│   │   ├── global.scss              # 全局样式
│   │   ├── transitions.scss         # 动画/过渡
│   │   └── themes/                  # 主题
│   │       ├── _default.scss        # 默认主题变量覆盖
│   │       ├── _night.scss          # 夜间主题
│   │       ├── _eye.scss            # 护眼主题
│   │       ├── _parchment.scss      # 羊皮纸主题
│   │       └── _blue.scss           # 淡蓝主题
│   │
│   └── assets/
│       └── icons/
│           └── svg/
│
├── index.html
├── vite.config.js
└── package.json
```

---

## 二、样式体系（SCSS）— 重点

### 2.1 SCSS 文件详细设计

#### `styles/variables.scss`

```scss
// ========== 颜色 ==========
// 品牌色
$color-brand: #e67e22;
$color-brand-hover: #d35400;
$color-brand-light: rgba(230, 126, 34, 0.1);
$color-brand-medium: rgba(230, 126, 34, 0.12);

// 日间模式
$color-bg-day: #f5f0e8;
$color-text-day: #2c2c2c;
$color-text-secondary-day: #999;
$color-text-muted-day: #bbb;
$color-border-day: rgba(0, 0, 0, 0.06);

// 夜间模式
$color-bg-night: #1a1a1a;
$color-text-night: #888;
$color-text-secondary-night: #555;
$color-text-muted-night: #666;
$color-border-night: rgba(255, 255, 255, 0.06);

// 书架
$color-shelf-bg-day: #f0ebe3;
$color-shelf-bg-night: #1a1a1a;
$color-shelf-header-day: rgba(255, 255, 255, 0.7);
$color-shelf-header-night: rgba(30, 30, 30, 0.9);

// 面板
$color-panel-bg: rgba(0, 0, 0, 0.95);
$color-panel-bg-light: rgba(0, 0, 0, 0.92);
$color-panel-text: #eee;
$color-panel-text-muted: #999;
$color-panel-border: rgba(255, 255, 255, 0.08);
$color-panel-surface: rgba(255, 255, 255, 0.04);
$color-panel-surface-hover: rgba(255, 255, 255, 0.06);
$color-panel-overlay: rgba(0, 0, 0, 0.6);

// 通用
$color-danger: #e74c3c;
$color-white: #fff;
$color-black: #000;

// ========== 字体 ==========
$font-family-base: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
$font-family-songti: "SimSun", "Songti SC", serif;
$font-family-heiti: "SimHei", "Heiti SC", sans-serif;
$font-family-kaiti: "KaiTi", "STKaiti", serif;
$font-family-fangsong: "FangSong", "STFangsong", serif;

$font-size-xs: 11px;
$font-size-sm: 12px;
$font-size-base: 13px;
$font-size-md: 14px;
$font-size-lg: 16px;
$font-size-xl: 18px;
$font-size-2xl: 22px;

// ========== 间距 ==========
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 12px;
$spacing-base: 16px;
$spacing-lg: 20px;
$spacing-xl: 24px;
$spacing-2xl: 28px;

// ========== 圆角 ==========
$radius-sm: 6px;
$radius-md: 8px;
$radius-lg: 10px;
$radius-xl: 12px;
$radius-2xl: 14px;
$radius-3xl: 16px;
$radius-full: 50%;

// ========== 滚动条 ==========
$scrollbar-width: 6px;
$scrollbar-thumb: rgba(0, 0, 0, 0.12);
$scrollbar-thumb-hover: rgba(0, 0, 0, 0.2);

// ========== 动画 ==========
$duration-fast: 0.15s;
$duration-normal: 0.2s;
$duration-slow: 0.3s;
$easing-default: ease;
$easing-slide: cubic-bezier(0.32, 0.72, 0, 1);

// ========== 层级 ==========
$z-index-info: 5;
$z-index-panel-2: 25;
$z-index-panel-1: 30;
$z-index-auto-read: 35;
$z-index-top-bar: 40;
$z-index-overlay: 60;
$z-index-context-menu: 100;

// ========== 断点 ==========
$breakpoint-wide: 600px;
```

#### `styles/mixins.scss`

```scss
@use 'variables' as *;

// 夜间模式样式
@mixin night-mode {
  .night-mode & {
    @content;
  }
}

// 面板通用样式
@mixin panel-base {
  position: absolute;
  left: 0;
  right: 0;
  background: $color-panel-bg;
  backdrop-filter: blur(16px);
  color: $color-panel-text;
}

@mixin panel-wide {
  &.panel-wide {
    max-width: 600px;
    margin: 0 auto;
    border-radius: $radius-2xl $radius-2xl 0 0;
  }
}

// 滑块样式
@mixin slider-thumb($size: 16px, $color: $color-brand) {
  -webkit-appearance: none;
  appearance: none;
  width: $size;
  height: $size;
  border-radius: $radius-full;
  background: $color;
  cursor: pointer;
}

@mixin slider-track {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #444;
  border-radius: 2px;
  outline: none;
}

// 文字截断
@mixin text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin text-clamp($lines: 2) {
  display: -webkit-box;
  -webkit-line-clamp: $lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// 面板按钮
@mixin panel-btn {
  background: none;
  border: none;
  color: $color-panel-text-muted;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: color $duration-fast $easing-default,
              background $duration-fast $easing-default;
}

// 选项卡激活态
@mixin tab-active($color: $color-brand) {
  color: $color;
  border-bottom-color: $color;
}

// 卡片选中态
@mixin card-active($color: $color-brand) {
  border-color: $color;
  background: rgba($color, 0.1);
}
```

#### `styles/reset.scss`

```scss
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }

body {
  font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

#app, .app-root { height: 100%; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
```

#### `styles/global.scss`

```scss
@use 'variables' as *;
@use 'mixins' as *;

// 全局通用样式
.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}

// 全局 transition 类
.fade-enter-active, .fade-leave-active {
  transition: opacity $duration-normal $easing-default;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
```

#### `styles/transitions.scss`

```scss
@use 'variables' as *;

// slide-down：顶部栏
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

// slide-up：底部面板
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

// fade-scale：三级面板
.fade-scale-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-scale-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
```

#### `styles/themes/_default.scss`

```scss
// 默认主题变量覆盖（直接使用 variables.scss 中的日间值即可）
// 此文件为占位，主题切换时通过 CSS 变量覆盖
:root {
  --theme-bg: #{$color-bg-day};
  --theme-text: #{$color-text-day};
  --theme-border: #{$color-border-day};
}
```

### 2.2 Vite 中全局引入 SCSS

```js
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // 全局注入 variables 和 mixins，组件中无需手动 @import
        additionalData: `
          @use "@/styles/variables" as *;
          @use "@/styles/mixins" as *;
        `,
      }
    }
  },
  server: { port: 5173 },
  build: { outDir: 'dist', assetsDir: 'assets' }
})
```

> **关键**：需要先安装 `sass` 依赖：`npm install -D sass`

### 2.3 组件中使用变量/mixin 示例

**之前（Reader.vue 中散落的魔法值）：**

```vue
<style scoped>
.l1-btn.active { color: #e67e22; }
.slider::-webkit-slider-thumb { background: #e67e22; }
.night-mode .shelf-title { color: #ddd; }
</style>
```

**之后（SCSS 变量 + mixin）：**

```vue
<style lang="scss" scoped>
.l1-btn.active {
  color: $color-brand;
}

.slider::-webkit-slider-thumb {
  @include slider-thumb;
}

.shelf-title {
  color: $color-text-day;
  @include night-mode {
    color: #ddd;
  }
}
</style>
```

### 2.4 main.js 中引入全局样式

```js
// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

// 样式引入（顺序重要）
import '@/styles/reset.scss'
import '@/styles/global.scss'
import '@/styles/transitions.scss'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

---

## 三、组件与逻辑拆分

### 3.1 Reader.vue 拆分方案

Reader.vue 1328 行，按职责拆为以下模块：

```
Reader.vue (1328行)
│
├── 视图层拆分 ─────────────────────────────────────
│   ├── ReaderContent.vue        ← 滚动容器 + 章节内容
│   ├── ReaderInfoBar.vue        ← 底部进度/时间
│   ├── ReaderTopBar.vue         ← 顶部返回/标题栏
│   ├── Level1Panel.vue          ← 一级面板（目录/夜间/设置按钮）
│   ├── ChapterNavPanel.vue      ← 二级面板-章节导航（上一章/滑块/下一章）
│   ├── CatalogPanel.vue         ← 二级面板-目录列表
│   ├── NightPanel.vue           ← 二级面板-夜间/主题切换
│   ├── SettingsPanel.vue        ← 二级面板-字体/行高/背景色
│   ├── Level3PageMode.vue       ← 三级面板-翻页方式选择
│   └── AutoReadPanel.vue        ← 自动阅读专属面板
│
├── Composables 拆分 ───────────────────────────────
│   ├── useChapterRenderer.js    ← 滑动窗口 DOM 管理（renderChapterDom, rebuildWindow, append/prepend/trim）
│   ├── useAutoRead.js           ← 自动阅读引擎（scroll/cover 两种模式）
│   ├── usePanelSystem.js        ← 面板状态机（3级面板切换逻辑）
│   ├── useProgress.js           ← 进度追踪 + 节流持久化
│   ├── useKeyboard.js           ← 键盘快捷键
│   ├── useClock.js              ← 时钟更新
│   └── useWindowWidth.js        ← 窗口宽度响应式
│
└── 常量提取 ──────────────────────────────────────
    └── constants.js             ← pageModes, catalogTabs, COVER_COLORS 等
```

### 3.2 Composable 设计示例

#### `usePanelSystem.js`

```js
// src/composables/usePanelSystem.js
import { ref, computed } from 'vue'

export function usePanelSystem() {
  const showPanelSystem = ref(false)
  const activeLevel2 = ref(null)       // 'default' | 'catalog' | 'night' | 'settings'
  const showLevel3 = ref(false)
  const showAutoReadPanel = ref(false)
  const prevLevel2 = ref(null)

  const showAnyPanel = computed(() =>
    showPanelSystem.value || showAutoReadPanel.value || showLevel3.value
  )

  function setLevel2(panel) {
    if (activeLevel2.value === panel) return
    activeLevel2.value = panel
    if (!showPanelSystem.value) showPanelSystem.value = true
  }

  function openLevel3() {
    prevLevel2.value = activeLevel2.value
    showLevel3.value = true
  }

  function closeLevel3() {
    showLevel3.value = false
  }

  function closeAllPanels() {
    showLevel3.value = false
    showPanelSystem.value = false
    activeLevel2.value = null
    showAutoReadPanel.value = false
  }

  function showDefaultPanel() {
    showPanelSystem.value = true
    activeLevel2.value = 'default'
  }

  function showAutoRead() {
    showAutoReadPanel.value = true
  }

  function hideAutoRead() {
    showAutoReadPanel.value = false
  }

  return {
    showPanelSystem, activeLevel2, showLevel3, showAutoReadPanel, showAnyPanel,
    setLevel2, openLevel3, closeLevel3, closeAllPanels,
    showDefaultPanel, showAutoRead, hideAutoRead,
  }
}
```

#### `useChapterRenderer.js`

```js
// src/composables/useChapterRenderer.js
import { ref } from 'vue'
import { getChapterText } from '@/utils/chapterParser'

const MAX_RANGE = 4
const BUFFER_AHEAD = 1

export function useChapterRenderer({ contentEl, scrollArea, chapters, fullText, onChapterChange }) {
  const rangeStart = ref(0)
  const rangeEnd = ref(0)
  const chapterDomMap = new Map()
  let isRestoring = false

  function renderChapterDom(chapterIdx) { /* ... 原 Reader.vue 逻辑 ... */ }
  function rebuildWindow(centerIdx, scrollRatio = 0) { /* ... */ }
  function appendChapterBelow() { /* ... */ }
  function prependChapterAbove() { /* ... */ }
  function trimFromTop() { /* ... */ }
  function trimFromBottom() { /* ... */ }

  return {
    rangeStart, rangeEnd, isRestoring,
    renderChapterDom, rebuildWindow, appendChapterBelow, prependChapterAbove,
  }
}
```

#### `useAutoRead.js`

```js
// src/composables/useAutoRead.js
import { ref, watch } from 'vue'

export function useAutoRead({ scrollArea, contentEl, settings, onAppendChapter }) {
  const autoReading = ref(false)
  let autoReadRaf = null
  let autoReadPaused = false
  let coverOverlayEl = null

  function startAutoRead() { /* ... */ }
  function stopAutoRead() { /* ... */ }
  function startScrollAutoRead() { /* ... */ }
  function startCoverAutoRead() { /* ... */ }
  function cleanupCoverOverlay() { /* ... */ }

  return { autoReading, autoReadPaused, startAutoRead, stopAutoRead }
}
```

### 3.3 组件职责定义

**ReaderView.vue（编排层）**

```vue
<template>
  <div class="reader-container" :class="{ 'night-mode': settings.nightMode }" :style="readerStyle" @click="onReaderClick">
    <ReaderContent ref="readerContent" ... />
    <ReaderInfoBar v-if="!showAnyPanel" ... />
    <ReaderTopBar v-if="showAnyPanel && !showLevel3" ... />
    <Level1Panel v-if="showPanelSystem && !autoReading && !showLevel3" ... />
    <ChapterNavPanel v-if="activeLevel2 === 'default'" ... />
    <CatalogPanel v-if="activeLevel2 === 'catalog'" ... />
    <NightPanel v-if="activeLevel2 === 'night'" ... />
    <SettingsPanel v-if="activeLevel2 === 'settings'" ... />
    <Level3PageMode v-if="showLevel3" ... />
    <AutoReadPanel v-if="showAutoReadPanel" ... />
  </div>
</template>

<script setup>
// 编排层：只做组合，不含业务逻辑
import { usePanelSystem } from '@/composables/usePanelSystem'
import { useChapterRenderer } from '@/composables/useChapterRenderer'
import { useAutoRead } from '@/composables/useAutoRead'
import { useProgress } from '@/composables/useProgress'
import { useKeyboard } from '@/composables/useKeyboard'
import { useSettingsStore } from '@/stores/useSettingsStore'
// ... 组件导入
</script>
```

**子组件（纯 UI）**

```vue
<!-- ChapterNavPanel.vue — 只负责渲染 + 事件分发 -->
<template>
  <div class="l2-default">
    <div class="nav-row">
      <button @click="$emit('prev')" :disabled="!canPrev">上一章</button>
      <input type="range" :min="0" :max="maxChapter" :value="currentChapter"
        @input="$emit('slide', $event.target.value)" />
      <button @click="$emit('next')" :disabled="!canNext">下一章</button>
    </div>
  </div>
</template>
```

### 3.4 Composable 设计原则

| 原则 | 说明 |
|------|------|
| 单一职责 | 每个 composable 只管一件事（如 usePanelSystem 不管渲染） |
| 不耦合 UI | composable 不操作 DOM（useChapterRenderer 是例外，它的核心职责就是 DOM 管理） |
| 可复用 | 通过参数注入依赖，不硬编码 |
| 可测试 | 纯逻辑可独立单元测试 |

---

## 四、工具与服务层

### 4.1 分层架构

```
组件/视图
   ↓ 调用
composables（编排逻辑）
   ↓ 调用
services（数据获取层）
   ↓ 调用
utils（纯函数）
```

### 4.2 services/electronApi.js

```js
// src/services/electronApi.js
// 封装所有 Electron IPC 调用，composables 不直接访问 window.electronAPI

/**
 * 打开文件选择对话框
 * @returns {Promise<Array<{filePath, fileName, content, encoding} | {error: string}>>}
 */
export async function openFiles() {
  if (!window.electronAPI) {
    throw new Error('Electron API 不可用')
  }
  return window.electronAPI.openFiles()
}

/**
 * 打开一本书：读文件 + 建章节索引
 * @param {string} filePath
 * @returns {Promise<{filePath, fileName, encoding, fullText, chapters, totalChapters}>}
 */
export async function openBook(filePath) {
  if (!window.electronAPI) {
    throw new Error('Electron API 不可用')
  }
  const result = await window.electronAPI.openBook(filePath)
  if (result.error) {
    throw new Error(result.error)
  }
  return result
}
```

### 4.3 services/storage.js

```js
// src/services/storage.js
// 从 bookStore.js 拆出纯存储操作

const BOOKS_KEY = 'txt-novel-reader-books'
const SETTINGS_KEY = 'txt-novel-reader-settings'

export function loadBooks() { /* ... */ }
export function saveBooks(books) { /* ... */ }
export function loadSettings() { /* ... */ }
export function saveSettings(settings) { /* ... */ }
```

### 4.4 utils/format.js

```js
// src/utils/format.js
// 从 bookStore.js 拆出纯函数

export function formatTime(timestamp) { /* ... */ }

export function getDisplayName(fileName) {
  return fileName.replace(/\.txt$/i, '')
}
```

### 4.5 bookStore.js 重构路径

原 `bookStore.js` 承担了 4 种职责，拆分如下：

| 原职责 | 目标位置 |
|--------|---------|
| localStorage 读写 | `services/storage.js` |
| 常量（THEMES, FONT_FAMILIES 等） | `stores/useSettingsStore.js` 或 `constants.js` |
| formatTime | `utils/format.js` |
| 进度节流逻辑 | `composables/useProgress.js` 或 `stores/useBookStore.js` |

---

## 五、Electron 结构优化

### 5.1 目录重组

**现状：**
```
electron/
├── main.js          # 102 行，混合了窗口创建、IPC、编码检测
├── preload.js       # 8 行，OK
└── chapterParser.js # CJS 版
```

**目标：**
```
electron/
├── main/
│   ├── index.js              # 精简入口：app 生命周期 + createWindow
│   ├── ipc/
│   │   ├── index.js          # registerAllIpc(mainWindow)
│   │   └── fileHandler.js    # open-files / open-book 处理逻辑
│   └── utils/
│       ├── encoding.js       # readFileWithEncoding()
│       └── chapterParser.js  # 唯一的章节解析器
├── preload/
│   └── index.js              # contextBridge（不变）
```

### 5.2 main/index.js（精简版）

```js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { registerAllIpc } = require('./ipc')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, height: 750,
    minWidth: 600, minHeight: 400,
    title: 'TXT 小说阅读器',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
  registerAllIpc(mainWindow)
}

app.whenReady().then(() => {
  if (process.argv.includes('--dev')) process.env.NODE_ENV = 'development'
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

### 5.3 main/ipc/fileHandler.js

```js
const { ipcMain, dialog } = require('electron')
const path = require('path')
const { readFileWithEncoding } = require('../utils/encoding')
const { buildChapterIndex } = require('../utils/chapterParser')

function registerFileIpc(mainWindow) {
  ipcMain.handle('open-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths.map(filePath => {
      try {
        const { content, encoding } = readFileWithEncoding(filePath)
        return { filePath, fileName: path.basename(filePath), content, encoding }
      } catch (err) {
        return { filePath, error: err.message }
      }
    })
  })

  ipcMain.handle('open-book', async (_event, filePath) => {
    try {
      const { content: fullText, encoding } = readFileWithEncoding(filePath)
      const chapters = buildChapterIndex(fullText)
      return {
        filePath, fileName: path.basename(filePath), encoding,
        fullText, chapters, totalChapters: chapters.length
      }
    } catch (err) {
      return { error: err.message }
    }
  })
}

module.exports = { registerFileIpc }
```

### 5.4 共享代码处理

`chapterParser.js` 目前有两个版本（CJS + ESM），建议：

1. **主进程**：保留 `electron/main/utils/chapterParser.js`（CJS）
2. **渲染进程**：`src/utils/chapterParser.js` 保留 ESM 版
3. **未来方案**：用 Vite 的 `build.rollupOptions` 或 `shared` 目录 + 构建工具统一

> 当前不建议强求共享，因为 Electron 主进程是 CJS 环境，渲染进程是 ESM，强统一会增加构建复杂度。

---

## 六、渐进式重构策略（核心）

> **原则：每一步完成后项目必须可运行。每一步独立可验证。**

### 阶段一：样式基础设施（1-2 天）

**目标**：建立 SCSS 体系，不改变任何组件逻辑。

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1.1 | `npm install -D sass` | 安装成功 |
| 1.2 | 创建 `src/styles/variables.scss`、`mixins.scss`、`reset.scss`、`global.scss`、`transitions.scss` | 文件就位 |
| 1.3 | 修改 `vite.config.js`，添加 `css.preprocessorOptions.scss.additionalData` | Vite 启动无报错 |
| 1.4 | 将 `App.vue` 中 `<style>` 的全局 reset 移入 `reset.scss`，在 `main.js` 中 import | 全局样式不变 |
| 1.5 | 将 Reader.vue 中 transition 类移入 `transitions.scss` | 动画不变 |
| 1.6 | **可选**：将 Bookshelf.vue 和 Reader.vue 的 `<style>` 改为 `<style lang="scss" scoped>`，用变量替换魔法值 | 样式不变，但代码更可维护 |

**验证点**：`npm run dev` + `npm run electron:dev` 均正常运行，视觉无差异。

### 阶段二：Composables 抽离（2-3 天）

**目标**：将 Reader.vue 中的非 UI 逻辑抽为独立 composable，组件只做编排。

| 步骤 | 操作 | 验证 |
|------|------|------|
| 2.1 | 创建 `src/composables/` 目录 | - |
| 2.2 | 抽 `useClock.js`（最简单，独立无依赖） | Reader.vue 中 `currentTime` + `updateClock` 替换 |
| 2.3 | 抽 `useWindowWidth.js` | `isWideWindow` 替换 |
| 2.4 | 抽 `usePanelSystem.js`（面板状态机） | 面板交互逻辑不变 |
| 2.5 | 抽 `useProgress.js`（进度追踪 + 节流持久化） | 进度保存/恢复不变 |
| 2.6 | 抽 `useKeyboard.js`（键盘快捷键） | 快捷键功能不变 |
| 2.7 | 抽 `useChapterRenderer.js`（滑动窗口） | 章节渲染不变 |
| 2.8 | 抽 `useAutoRead.js`（自动阅读引擎） | 自动阅读不变 |
| 2.9 | Reader.vue 精简为编排层 | 行数从 1328 降到 ~200 |

**验证点**：每抽一个 composable 后立即运行验证，确保功能不变。

### 阶段三：组件拆分（2-3 天）

**目标**：将 Reader.vue 模板拆为独立子组件。

| 步骤 | 操作 | 验证 |
|------|------|------|
| 3.1 | 创建 `src/modules/reader/components/` 目录 | - |
| 3.2 | 创建 `src/components/common/` 目录，抽 `ToggleSwitch.vue`、`ColorCard.vue` | 通用组件可复用 |
| 3.3 | 抽 `ReaderContent.vue`（滚动容器 + 章节内容） | 内容渲染不变 |
| 3.4 | 抽 `ReaderInfoBar.vue`（底部信息栏） | 信息栏不变 |
| 3.5 | 抽 `ReaderTopBar.vue`（顶部栏） | 顶部栏不变 |
| 3.6 | 抽 `Level1Panel.vue`（一级面板） | 一级面板不变 |
| 3.7 | 抽 `ChapterNavPanel.vue` | 章节导航不变 |
| 3.8 | 抽 `CatalogPanel.vue` | 目录不变 |
| 3.9 | 抽 `NightPanel.vue` | 夜间模式不变 |
| 3.10 | 抽 `SettingsPanel.vue` | 设置面板不变 |
| 3.11 | 抽 `Level3PageMode.vue` | 翻页选择不变 |
| 3.12 | 抽 `AutoReadPanel.vue` | 自动阅读面板不变 |
| 3.13 | 重命名 Reader.vue → `ReaderView.vue`，移入 `src/views/` | 路由或 App.vue 更新 |

**验证点**：每拆一个组件后验证对应功能。

### 阶段四：服务层 + 状态管理（1-2 天）

| 步骤 | 操作 | 验证 |
|------|------|------|
| 4.1 | `npm install pinia vue-router` | 安装成功 |
| 4.2 | 创建 `src/services/electronApi.js`，封装 `window.electronAPI` | - |
| 4.3 | 创建 `src/services/storage.js`，从 bookStore.js 迁移 localStorage 操作 | - |
| 4.4 | 创建 `src/utils/format.js`，从 bookStore.js 迁移 formatTime | - |
| 4.5 | 创建 `src/stores/useSettingsStore.js`，用 Pinia 管理设置（替代 `ref(getSettings())`） | 设置持久化不变 |
| 4.6 | 创建 `src/stores/useBookStore.js`，用 Pinia 管理书籍数据 | 书架数据不变 |
| 4.7 | 替换所有直接调用 `bookStore.js` 的地方为 store/service | - |
| 4.8 | 创建 `src/router/index.js`，用 Vue Router 替代手动 `ref` 切换 | 页面切换不变 |

**验证点**：书架增删、阅读进度保存、主题切换等核心流程完整。

### 阶段五：Electron 结构优化（1 天）

| 步骤 | 操作 | 验证 |
|------|------|------|
| 5.1 | 创建 `electron/main/`、`electron/main/ipc/`、`electron/main/utils/` 目录 | - |
| 5.2 | 将 `electron/main.js` 拆为 `main/index.js` + `main/ipc/fileHandler.js` | - |
| 5.3 | 将编码检测逻辑抽为 `main/utils/encoding.js` | - |
| 5.4 | `chapterParser.js` 移入 `main/utils/` | - |
| 5.5 | 重命名 `electron/preload.js` → `electron/preload/index.js` | - |
| 5.6 | 更新 `package.json` 的 `"main"` 字段和 `preload` 路径 | electron:dev 正常 |

**验证点**：`npm run electron:dev` + `npm run electron:build` 均正常。

### 阶段六：收尾（1 天）

| 步骤 | 操作 |
|------|------|
| 6.1 | 删除旧的 `bookStore.js`（已全部迁移） |
| 6.2 | 删除旧的 `electron/main.js`、`electron/preload.js`（已迁移到新位置） |
| 6.3 | 统一夜间模式实现：全部通过 `useSettingsStore.nightMode` + CSS 变量 / SCSS mixin |
| 6.4 | 全局搜索残留的魔法值颜色，替换为 SCSS 变量 |
| 6.5 | 添加 `src/styles/themes/` 主题文件（如果需要动态主题切换） |
| 6.6 | 验证全流程 |

---

## 七、重构前后对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 最大组件 | Reader.vue 1328 行 | ReaderView.vue ~200 行 + 10 个子组件 |
| Composables | 0 | 7 个（各 < 100 行） |
| SCSS | 无 | 完整变量/mixin/全局样式体系 |
| 魔法值 | 30+ 处硬编码颜色 | 全部通过 SCSS 变量管理 |
| 夜间模式 | 2 套实现 | 统一通过 `@include night-mode` |
| 状态管理 | 直接操作 localStorage | Pinia store |
| 路由 | ref 手动切换 | Vue Router |
| 服务层 | 组件直接调 `window.electronAPI` | `services/electronApi.js` 封装 |
| Electron | 1 个 main.js | 分层：main/ipc/utils |
| 代码重复 | chapterParser 2 份 | 职责明确，各自位置合理 |

---

## 八、关键注意事项

1. **不要同时改结构 + 逻辑**：每个步骤只改一个维度，改完验证再下一步
2. **SCSS additionalData 的坑**：`@use` 语法在 `additionalData` 中有版本要求，确保 `sass` 版本 >= 1.23.0；如果遇到问题，可退回 `@import` 语法
3. **Vite SCSS 全局注入限制**：`additionalData` 会注入到每个 SCSS 编译单元，不要在里面放实际的 CSS 规则（只放变量、mixin、function）
4. **Pinia + Electron 的持久化**：可用 `pinia-plugin-persistedstate` 插件自动同步 localStorage，替代手动读写
5. **Vue Router + Electron**：需要注意 `createWebHashHistory()` 代替 `createWebHistory()`，因为 Electron 的 `file://` 协议不支持 HTML5 History
6. **组件拆分粒度**：不要过度拆分。如果一个子组件只有一个按钮，不值得独立。优先拆有独立状态的组件
7. **chapterParser 重复问题**：当前方案保留两份是务实的，因为主进程 CJS 和渲染进程 ESM 的模块系统不同，硬统一会引入构建复杂度。后续可考虑用 `esbuild` 做共享构建
