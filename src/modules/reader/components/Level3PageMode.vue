<template>
  <div class="level3-overlay" @click="$emit('close-to-reading')">
    <div class="level3-panel" @click.stop>
      <div class="l3-header">
        <button class="l3-back" @click="$emit('close')">
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
          class="pm-card" :class="{ active: currentMode === mode.id }"
          @click="$emit('select', mode.id)">
          <div class="pm-card-icon" v-html="mode.icon"></div>
          <span class="pm-card-name">{{ mode.name }}</span>
          <svg v-if="currentMode === mode.id" class="pm-card-check" viewBox="0 0 24 24" width="16" height="16"
            fill="none" stroke="#e67e22" stroke-width="2.5">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  pageModes: { type: Array, required: true },
  currentMode: { type: String, default: 'scroll' }
})

defineEmits(['close', 'close-to-reading', 'select'])
</script>

<style lang="scss" scoped>
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
</style>
