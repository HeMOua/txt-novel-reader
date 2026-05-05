<template>
  <div class="bookshelf" :class="{ 'night-mode': nightMode }">
    <!-- 顶部栏 -->
    <header class="shelf-header">
      <h1 class="shelf-title"><SvgIcon name="bookshelf" :size="22" /> 我的书架</h1>
      <div class="shelf-actions">
        <div class="sort-select">
          <select v-model="sortBy" @change="onSortChange">
            <option v-for="opt in SORT_OPTIONS" :key="opt.id" :value="opt.id">
              {{ opt.name }}
            </option>
          </select>
        </div>
        <button class="btn-add" @click="$emit('add-book')">
          <span>＋</span> 添加书籍
        </button>
      </div>
    </header>

    <!-- 书籍网格 -->
    <div class="shelf-grid" v-if="books.length > 0">
      <div
        class="book-card"
        v-for="book in books"
        :key="book.filePath"
        @click="$emit('open-book', book)"
        @contextmenu.prevent="showContextMenu($event, book)"
      >
        <div class="book-cover" :style="getCoverStyle(book)">
          <span class="book-cover-title">{{ getDisplayName(book.fileName) }}</span>
        </div>
        <div class="book-info">
          <div class="book-name" :title="book.fileName">{{ getDisplayName(book.fileName) }}</div>
          <div class="book-meta">
            <span class="book-progress">{{ book.progress ? Math.round(book.progress) : 0 }}%</span>
            <span class="book-time">{{ formatTime(book.lastReadTime) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-shelf" v-else>
      <div class="empty-icon"><SvgIcon name="book-open" :size="72" /></div>
      <p class="empty-text">书架空空如也</p>
      <p class="empty-hint">点击右上角「添加书籍」开始阅读之旅</p>
    </div>

    <!-- 右键菜单 -->
    <div
      class="context-menu"
      v-if="contextMenu.visible"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div class="context-item" @click="onOpenBook">打开阅读</div>
      <div class="context-item danger" @click="onDeleteBook">删除书籍</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSortedBooks, deleteBook, formatTime, SORT_OPTIONS } from '../utils/bookStore.js'
import SvgIcon from './SvgIcon.vue'

const props = defineProps({
  nightMode: Boolean
})

const emit = defineEmits(['add-book', 'open-book', 'refresh'])

const sortBy = ref('lastRead')
const contextMenu = ref({ visible: false, x: 0, y: 0, book: null })
const refreshKey = ref(0)  // 用于手动触发 computed 刷新

const books = computed(() => {
  refreshKey.value  // 依赖追踪，refreshKey 变化时重新计算
  return getSortedBooks(sortBy.value)
})

// 封面颜色池
const COVER_COLORS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
]

function getCoverStyle(book) {
  const index = book.filePath.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const gradient = COVER_COLORS[index % COVER_COLORS.length]
  return { background: gradient }
}

function getDisplayName(fileName) {
  return fileName.replace(/\.txt$/i, '')
}

function onSortChange() {
  // computed 会自动重新计算
}

function showContextMenu(event, book) {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    book
  }
}

function onOpenBook() {
  if (contextMenu.value.book) {
    emit('open-book', contextMenu.value.book)
  }
  contextMenu.value.visible = false
}

function onDeleteBook() {
  if (contextMenu.value.book && confirm(`确定删除「${contextMenu.value.book.fileName}」？`)) {
    deleteBook(contextMenu.value.book.filePath)
    refreshKey.value++  // 触发 computed 重新计算，刷新书架
  }
  contextMenu.value.visible = false
}

function hideContextMenu() {
  contextMenu.value.visible = false
}

onMounted(() => {
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})
</script>

<style lang="scss" scoped>
.bookshelf {
  min-height: 100vh;
  background: $color-shelf-bg-day;
  padding-bottom: $spacing-lg;
  transition: background $duration-slow $easing-default;

  @include night-mode {
    background: $color-shelf-bg-night;
  }
}

/* 顶部栏 */
.shelf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-base $spacing-xl;
  background: $color-shelf-header-day;
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;

  @include night-mode {
    background: $color-shelf-header-night;
  }
}

.shelf-title {
  font-size: $font-size-2xl;
  font-weight: 700;
  color: #333;
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  @include night-mode {
    color: #ddd;
  }
}

.shelf-actions {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.sort-select select {
  padding: $spacing-xs $spacing-md;
  border: 1px solid #ddd;
  border-radius: $radius-md;
  background: $color-white;
  color: #333;
  font-size: $font-size-base;
  outline: none;
  cursor: pointer;

  @include night-mode {
    background: #333;
    border-color: #555;
    color: #ccc;
  }
}

.btn-add {
  background: $color-brand;
  color: $color-white;
  border: none;
  padding: $spacing-sm 18px;
  border-radius: $radius-md;
  font-size: $font-size-md;
  font-weight: 600;
  cursor: pointer;
  transition: background $duration-normal $easing-default;

  &:hover {
    background: $color-brand-hover;
  }
}

/* 书籍网格 */
.shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: $spacing-lg;
  padding: $spacing-xl;
}

.book-card {
  cursor: pointer;
  transition: transform $duration-normal $easing-default;
  border-radius: $radius-md;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
  }
}

.book-cover {
  width: 100%;
  height: 190px;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-base;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.book-cover-title {
  color: $color-white;
  font-size: $font-size-lg;
  font-weight: 700;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  word-break: break-all;
  line-height: 1.4;
  max-height: 100%;
  overflow: hidden;
  @include text-clamp(5);
}

.book-info {
  padding: $spacing-sm $spacing-xs;
}

.book-name {
  font-size: $font-size-base;
  font-weight: 600;
  color: #333;
  @include text-ellipsis;

  @include night-mode {
    color: #ccc;
  }
}

.book-meta {
  display: flex;
  justify-content: space-between;
  margin-top: $spacing-xs;
  font-size: $font-size-xs;
  color: $color-text-secondary-day;
}

.book-progress {
  color: $color-brand;
  font-weight: 600;
}

/* 空状态 */
.empty-shelf {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  color: $color-text-secondary-day;
}

.empty-icon {
  display: flex;
  justify-content: center;
  opacity: 0.5;
  margin-bottom: $spacing-base;
  color: $color-text-secondary-day;
}

.empty-text {
  font-size: $font-size-xl;
  color: #888;
  margin-bottom: $spacing-sm;
}

.empty-hint {
  font-size: $font-size-md;
  color: #aaa;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: $color-white;
  border-radius: $radius-md;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: $z-index-context-menu;
  min-width: 120px;
  overflow: hidden;

  @include night-mode {
    background: #333;
  }
}

.context-item {
  padding: 10px $spacing-base;
  font-size: $font-size-base;
  cursor: pointer;
  color: #333;
  transition: background $duration-fast $easing-default;

  @include night-mode {
    color: #ccc;
  }

  &:hover {
    background: #f0f0f0;

    @include night-mode {
      background: #444;
    }
  }

  &.danger {
    color: $color-danger;
  }
}
</style>
