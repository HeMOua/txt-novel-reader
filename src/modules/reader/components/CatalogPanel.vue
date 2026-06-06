<template>
  <div class="catalog-content">
    <div class="catalog-tabs">
      <button v-for="tab in catalogTabs" :key="tab.id"
        class="cat-tab" :class="{ active: activeCatalogTab === tab.id }"
        @click="$emit('update:activeCatalogTab', tab.id)">{{ tab.name }}</button>
    </div>
    <div class="catalog-info-bar">
      <span class="cat-book-name">{{ bookTitle }}</span>
      <span class="cat-chapter-count">共 {{ totalChapters }} 章</span>
      <button class="cat-sort-btn" @click="$emit('update:catalogReverse', !catalogReverse)" :title="catalogReverse ? '正序' : '倒序'">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
          :style="{ transform: catalogReverse ? 'rotate(180deg)' : '' }">
          <path d="M12 5v14M19 12l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="catalog-list" ref="catalogListEl">
      <div v-for="ch in displayChapters" :key="ch.originalIndex"
        class="catalog-item" :class="{ active: ch.originalIndex === currentChapterIndex }"
        @click="$emit('jump-from-catalog', ch.originalIndex)">
        <span class="chapter-index">{{ ch.originalIndex + 1 }}</span>
        <span class="chapter-title">{{ ch.title }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  bookTitle: { type: String, default: '' },
  totalChapters: { type: Number, required: true },
  currentChapterIndex: { type: Number, required: true },
  displayChapters: { type: Array, required: true },
  catalogTabs: { type: Array, required: true },
  activeCatalogTab: { type: String, default: 'catalog' },
  catalogReverse: { type: Boolean, default: false }
})

defineEmits(['jump-from-catalog', 'update:activeCatalogTab', 'update:catalogReverse'])

const catalogListEl = ref(null)

defineExpose({ catalogListEl })

// 滚动目录列表，使当前章节项居中
function scrollToActive() {
  nextTick(() => {
    if (!catalogListEl.value) return
    const activeEl = catalogListEl.value.querySelector('.catalog-item.active')
    if (activeEl) {
      const listRect = catalogListEl.value.getBoundingClientRect()
      const itemRect = activeEl.getBoundingClientRect()
      const offset = itemRect.top - listRect.top - (listRect.height / 2) + (itemRect.height / 2)
      catalogListEl.value.scrollTop += offset
    }
  })
}

// 打开目录（组件挂载）即定位到当前章；当前章变化时也跟随
onMounted(scrollToActive)
watch(() => props.currentChapterIndex, scrollToActive)
</script>

<style lang="scss" scoped>
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
</style>
