<template>
  <div class="auto-read-panel" :class="{ 'panel-wide': isWideWindow }" @click.stop>
    <div class="arp-speed">
      <div class="arp-speed-header">
        <span>阅读速度</span>
        <span class="speed-value">{{ settings.autoReadSpeed }}</span>
      </div>
      <div class="arp-speed-track">
        <span class="speed-tip">慢</span>
        <input type="range" min="0" max="100" step="1"
          :value="settings.autoReadSpeed" @input="$emit('update:autoReadSpeed', +$event.target.value)" class="slider" />
        <span class="speed-tip">快</span>
      </div>
    </div>
    <div class="arp-mode">
      <div class="arp-mode-item" :class="{ active: settings.autoReadMode === 'scroll' }" @click="$emit('set-mode', 'scroll')">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M7 10l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>滚屏翻页</span>
      </div>
      <div class="arp-mode-item" :class="{ active: settings.autoReadMode === 'cover' }" @click="$emit('set-mode', 'cover')">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><path d="M10 12h4" stroke-linecap="round"/></svg>
        <span>覆盖翻页</span>
      </div>
    </div>
    <button class="arp-exit-btn" @click="$emit('exit')">退出自动阅读</button>
  </div>
</template>

<script setup>
defineProps({
  settings: { type: Object, required: true },
  isWideWindow: { type: Boolean, default: false }
})

defineEmits(['exit', 'set-mode', 'update:autoReadSpeed'])
</script>

<style lang="scss" scoped>
.auto-read-panel {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: $z-index-auto-read;
  background: $color-panel-bg; backdrop-filter: blur(16px);
  color: $color-panel-text; padding: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);

  &.panel-wide {
    max-width: 480px;
    margin: 0 auto;
    border-radius: $radius-2xl $radius-2xl 0 0;
  }
}

.arp-speed { padding: $spacing-base $spacing-lg $spacing-md; }

.arp-speed-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px; font-size: $font-size-base; color: #aaa;
}

.speed-value { color: $color-brand; font-weight: 600; font-size: $font-size-lg; }

.arp-speed-track { display: flex; align-items: center; gap: 10px; }

.arp-speed-track input[type="range"] {
  flex: 1; @include slider-track;
}

.arp-speed-track input[type="range"]::-webkit-slider-thumb {
  @include slider-thumb(18px);
}

.speed-tip { font-size: $font-size-xs; color: #666; }

.arp-mode {
  display: flex; gap: $spacing-sm; padding: 0 $spacing-lg $spacing-base;
}

.arp-mode-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: $spacing-sm;
  padding: 10px; border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: $radius-lg; cursor: pointer;
  font-size: $font-size-base; color: #999; transition: all $duration-normal $easing-default;

  &:hover { border-color: rgba(255, 255, 255, 0.25); color: #ddd; }
  &.active { border-color: $color-brand; background: $color-brand-medium; color: $color-brand; }
}

.arp-exit-btn {
  display: block; width: calc(100% - 40px); margin: 0 $spacing-lg $spacing-base;
  padding: $spacing-md; border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: $radius-lg; background: $color-panel-surface;
  color: #ccc; font-size: $font-size-md; cursor: pointer;
  text-align: center; transition: all $duration-normal $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.08); color: $color-white; }
}
</style>
