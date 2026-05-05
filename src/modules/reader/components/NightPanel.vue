<template>
  <div class="l2-night">
    <div class="night-toggle-row">
      <span class="night-label">夜间模式</span>
      <div class="toggle-switch" :class="{ on: nightMode }" @click="$emit('toggle-night')">
        <div class="toggle-thumb"></div>
      </div>
    </div>
    <div class="night-colors">
      <div v-for="theme in themes" :key="theme.id"
        class="color-card" :class="{ active: currentTheme === theme.id }"
        @click="$emit('set-theme', theme)">
        <div class="color-swatch" :style="{ background: theme.bgColor }">
          <svg v-if="currentTheme === theme.id" viewBox="0 0 24 24" width="14" height="14"
            fill="none" stroke="#e67e22" stroke-width="3">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="color-name">{{ theme.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  nightMode: { type: Boolean, default: false },
  currentTheme: { type: String, default: 'default' },
  themes: { type: Array, required: true }
})

defineEmits(['toggle-night', 'set-theme'])
</script>

<style lang="scss" scoped>
.night-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: $spacing-sm 0 $spacing-base;
}

.night-label { font-size: 15px; color: #ddd; }

.toggle-switch {
  position: relative; width: 44px; height: 24px;
  background: #444; border-radius: 12px;
  cursor: pointer; transition: background $duration-slow $easing-default;
  flex-shrink: 0;

  &.on { background: $color-brand; }
}

.toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px; background: $color-white;
  border-radius: $radius-full; transition: transform $duration-slow $easing-default;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-switch.on .toggle-thumb { transform: translateX(20px); }

.night-colors {
  display: flex; gap: $spacing-base; flex-wrap: wrap; justify-content: center;
  padding: $spacing-sm 0;
}

.color-card {
  display: flex; flex-direction: column; align-items: center; gap: $spacing-xs;
  cursor: pointer; transition: transform $duration-fast $easing-default;

  &:hover { transform: scale(1.05); }
}

.color-swatch {
  width: 44px; height: 44px; border-radius: $radius-lg;
  border: 2px solid rgba(255, 255, 255, 0.1);
  display: flex; align-items: center; justify-content: center;
  transition: border-color $duration-normal $easing-default;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.color-card.active .color-swatch { border-color: $color-brand; }
.color-name { font-size: $font-size-xs; color: #888; }
.color-card.active .color-name { color: $color-brand; }
</style>
