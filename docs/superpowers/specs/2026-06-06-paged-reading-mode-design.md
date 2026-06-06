# 分页阅读模式重构设计

日期：2026-06-06
状态：已评审通过，待实现

## 背景与目标

当前阅读器底层是**连续滚动**架构（滑动窗口、`scrollTop` 驱动、章节为变高块）。在其上硬接的"覆盖式自动阅读"通过 `cloneNode(true)` 整窗克隆 + 遮罩 + 底部条 + 按理论行高计算 `pageStep` 来模拟翻页，导致一系列问题：

- **截行 / 丢字 / 重复行**：视口高度非行高整数倍，页边界落在行中间。
- 克隆层脱离内容样式作用域，丢失 `v-bind` 注入的 CSS 自定义属性（段间距、分隔线色），预览与落定不一致。
- 每翻一页深拷贝整个滑动窗口（可能上千节点），性能与一致性双隐患。
- 分页范式与滚动范式对冲，边界 case 反复出现。

用户已确认核心痛点是 **分页边界不干净（截行/重复）** 与 **节奏/操作别扭**，并决定**完全重构**该方案。

### 目标

1. 保留**滚屏**阅读模式（现状不变）。
2. 新增/重做**翻页**阅读模式：手动（点按/键盘）+ 自动阅读都翻**整页**。
3. **硬指标**：整页干净显示，任何文字都不被切断/丢失/重复。
4. 自动阅读：**下一页从顶部随阅读进度逐渐覆盖下来**，盖满即翻页（一体动作）。
5. 一种翻页动画做精；顺手清理现有混乱的 `autoReadMode` / 空壳"翻页方式"选项。

### 非目标（YAGNI）

- 不做仿真翻书卷曲、平移、无动效等**从未实现**的多种翻页动画——本次删除这些空壳选项。
- 不引入正式测试框架。
- 不改动滚屏模式的既有交互与渲染。

## 核心技术选型：CSS 多列分页

把当前章正文放进一个 CSS 多列容器，浏览器自动将文字排成一列列，**每列即一页**。

```scss
.paged-flow {
  column-width: <页宽>px;    // 一列 = 一页
  column-gap:   <2×边距>px;   // 列间隙兼作左右页边距
  height: 100%;              // 列高 = 视口高 → 行只在行间断，绝不横切
}
```

翻到第 `p` 页 = `transform: translateX(-(p × 步长))`，步长 = 页宽 + 列间隙。

**为什么选它**：浏览器的列分裂只在行与行之间断行，从根上消灭截行/丢字/重复；字号、行距、字体、边距、主题、段间距全部作为普通 CSS 自动生效；覆盖动画用两层真实列渲染，天然像素对齐。

被否决的备选：

- **B. JS 手动按行装箱**——重写浏览器已做好的事，代码多、正是当前 bug 的温床。
- **C. 继续滚动 + 整页吸附**——即现状，已证明脆弱。

## 架构

新增分页引擎与现有滚屏渲染器平级、互不干扰。按 `readingMode` 在 `Reader.vue` 内二选一渲染内容区。

### 组件 / 模块

| 文件 | 职责 |
|---|---|
| `src/composables/usePagedReader.js`（新增） | 分页引擎：排版当前章、测量页数、页导航 |
| `src/modules/reader/components/PagedContent.vue`（新增） | 翻页模式内容区：两层 DOM + flow，`defineExpose` 真实 DOM 给父组件 |
| `src/components/Reader.vue`（改） | 按 `readingMode` 切换内容区；翻页模式点按/键盘交互 |
| `src/modules/reader/components/SettingsPanel.vue`（改） | "翻页类型"行换成 `滚屏 / 翻页` 阅读模式开关 |
| `src/modules/reader/components/AutoReadPanel.vue`（改） | 两个模式切换对应到 `readingMode` |
| `src/composables/useAutoRead.js`（改） | 删除 `startCoverAutoRead`（克隆/遮罩/底部条/`computePageStep`） |
| `src/composables/usePanelSystem.js`（改） | 删除三级面板 level3 相关状态 |
| `src/modules/reader/constants.js`（改） | 删除 `PAGE_MODES` |
| `src/modules/reader/components/Level3PageMode.vue`（删） | 空壳"翻页方式"选择器 |
| `src/utils/bookStore.js`（改） | 默认设置去 `autoReadMode`、加 `readingMode` |

### 分页引擎 `usePagedReader`

DOM 结构（翻页模式下取代 ReaderContent）：

```
.paged-viewport            ← 固定尺寸、overflow:hidden（可视页框）
  .paged-layer.base        ← 底层：显示当前页
    .paged-flow            ← CSS 多列容器，装当前章所有 <p>
  .paged-layer.incoming    ← 上层：显示"下一页"，被遮罩自上而下露出
    .cover-mask            ← 高度 0→满 的遮罩
      .paged-flow          ← 同样多列内容（下一页 / 跨章时为下一章首页）
```

对外接口：

```
usePagedReader({ viewportEl, settings, chapters, fullText, currentChapterIndex })
→ {
  pageIndex, pageCount, pageRatio,    // 响应式
  layout(),                           // 排版当前章 + 测量页数（scrollWidth/步长）
  nextPage(), prevPage(),             // 返回 { turned, crossedChapter }
}
```

- 页数 = `flow.scrollWidth / 步长`，布局后量一次，无需逐行计算。
- `nextPage()` 在末页 → 进入下一章、`layout()`、page 0；`prevPage()` 在首页 → 上一章末页。
- 设置变化或 resize → 记住 `ratio` → 重新 `layout()` → 用 ratio 还原页码。
- 一次只排一章（内存可控）；可选优化：提前把下一章排进 incoming 层消除切章停顿。

### 覆盖动画与节奏

核心动作唯一：incoming 层 `.cover-mask` 高度 0→满 = "下一页自上而下覆盖当前页"。两层均为真实多列排版、像素对齐，盖满瞬间提交 `p→p+1`、遮罩归零。三种触发只是速度不同：

| 触发 | 遮罩 0→满 时长 | 说明 |
|---|---|---|
| 自动阅读 | `dwell` 秒（速度滑块控制） | 随阅读进度匀速覆盖，盖满即翻页 |
| 手动下一页 | ~280ms | 点右侧/键盘 →，同一覆盖动画快放 |
| 手动上一页 | ~280ms | 点左侧/键盘 ←，反向：当前页向下退、露出上一页 |

自动阅读分支（在 `useAutoRead` 内新增 `startPagedAutoRead`，与 `startScrollAutoRead` 并列，由 `readingMode` 选择）：

- `requestAnimationFrame` 按时间推 mask 到满 → `nextPage()` → 重置 mask → 继续。
- 速度滑块映射 `dwell`（快=停留短），沿用 `autoReadSpeed`。
- 到全书最后一页 → 自动停止。
- 面板打开暂停、关闭恢复（沿用现有 pause/resume）。
- 跨章时 incoming 装下一章首页；动画进行中对新触发做节流（忽略或排队），避免错乱。

**速度语义按模式解释**：滚屏=像素/秒，翻页=每页停留秒数，同一滑块同一字段 `autoReadSpeed`。

### 模式与设置整合

- 新增 `readingMode: 'scroll' | 'paged'`，默认 `scroll`（保持老用户现状）。
- **删除** `autoReadMode` 字段，以及三级面板"翻页方式" 5 选项（real/none/slide 本就是空壳）。
- 保留 `autoReadSpeed`。
- SettingsPanel："翻页类型"行 → `滚屏 / 翻页` 开关。
- AutoReadPanel：原"滚屏翻页 / 覆盖翻页"对应 `readingMode`（滚屏=scroll、覆盖=paged）。
- 移除 `Level3PageMode.vue`、`openLevel3/closeLevel3/showLevel3`、`PAGE_MODES`。

### Reader.vue 交互

按 `readingMode` 二选一渲染内容区（`ReaderContent` / `PagedContent`）。

点按分区（`onReaderClick` 按模式分流）：

| 区域 | 滚屏模式（现状） | 翻页模式（新） |
|---|---|---|
| 左 1/3 | — | 上一页 |
| 中部 | 呼出面板 | 呼出面板 |
| 右 1/3 | — | 下一页 |
| 上/下 1/4 | 上翻/下翻 0.8 屏 | （不适用） |

键盘：翻页模式 ←/→（或 ↑/↓）= 上/下一页；滚屏模式保持现有滚动。自动阅读时中部点击呼出自动阅读面板（沿用现状）。面板暂停逻辑沿用现有 watch。

### 进度持久化（跨模式兼容）

- 沿用现有字段 `currentChapterIndex` + `currentScrollRatio`（章内比例 0~1），**不新增字段**，两模式互通。
- 翻页模式：保存 `ratio = pageIndex / pageCount`；打开/切换时 `pageIndex = round(ratio × pageCount)`。
- 滚屏模式：维持现状。
- 全书百分比：翻页模式 `(章起始字符 + ratio × 本章字符数) / 全书字符数`，与滚屏口径一致。

## 测试策略

项目无测试框架，DOM 布局难自动化：

- **分页数学**（ratio↔pageIndex、步长、跨章边界判定）抽成纯函数 + 一次性 Node 断言脚本，自动验证。
- 覆盖动画/排版属视觉行为，产出**手动回归清单**，由用户实机验证：
  1. 翻页不切字、不丢字、不重复；
  2. 切章无明显停顿；
  3. 设置变更（字号/行距/字体/边距/主题/宽度）与 resize 后阅读位置不丢；
  4. 自动阅读节奏（速度滑块）、覆盖动画顺滑；
  5. 面板打开暂停、关闭恢复；
  6. 退出再进恢复到原位置；进度百分比正确；
  7. **滚屏模式完全不受影响**。
- 每步 `vite build` 通过。

## 收尾

删除旧覆盖自动阅读全部代码：`startCoverAutoRead`、克隆逻辑、`.cover-mask`/`.cover-line`/`.cover-bottom`、`computePageStep`。
