<template>
  <div class="level1-panel" @click.stop>
    <button class="l1-btn" :class="{ active: activeLevel2 === 'catalog' }" @click="$emit('set-level2', 'catalog')">
      <span class="l1-icon"><SvgIcon name="catalog" :size="22" /></span>
      <span>目录</span>
    </button>
    <button class="l1-btn" :class="{ active: activeLevel2 === 'night' }" @click="$emit('set-level2', 'night')">
      <span class="l1-icon"><SvgIcon :name="nightMode ? 'sun' : 'moon'" :size="22" /></span>
      <span>{{ nightMode ? '日间' : '夜间' }}</span>
    </button>
    <button class="l1-btn" :class="{ active: activeLevel2 === 'settings' }" @click="$emit('set-level2', 'settings')">
      <span class="l1-icon"><SvgIcon name="settings" :size="22" /></span>
      <span>设置</span>
    </button>
  </div>
</template>

<script setup>
import SvgIcon from '@/components/SvgIcon.vue'

defineProps({
  activeLevel2: { type: String, default: null },
  nightMode: { type: Boolean, default: false }
})

defineEmits(['set-level2'])
</script>

<style lang="scss" scoped>
.level1-panel {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: $z-index-panel-1;
  height: 56px;
  background: $color-panel-bg-light; backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: space-around;
  color: #ccc;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.l1-btn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  @include panel-btn;
  padding: $spacing-sm $spacing-lg; border-radius: $radius-md;

  &:hover { color: #ddd; background: rgba(255, 255, 255, 0.05); }
  &.active { color: $color-brand; }
}

.l1-icon { display: flex; align-items: center; justify-content: center; }
</style>
