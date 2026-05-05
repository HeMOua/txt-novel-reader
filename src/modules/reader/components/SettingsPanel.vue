<template>
  <div class="l2-settings">
    <div class="setting-section">
      <div class="setting-row">
        <button class="font-ctrl-btn" @click="$emit('change-font-size', -1)">A-</button>
        <span class="font-size-val">{{ settings.fontSize }}</span>
        <button class="font-ctrl-btn" @click="$emit('change-font-size', 1)">A+</button>
        <div class="font-family-wrap">
          <select :value="settings.fontFamily" @change="$emit('settings-change')">
            <option v-for="f in fontFamilies" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </div>
      </div>
    </div>
    <div class="setting-section">
      <span class="section-label">行间距</span>
      <div class="preset-group">
        <button v-for="preset in lineHeightPresets" :key="preset.id"
          class="preset-btn" :class="{ active: Math.abs(settings.lineHeight - preset.value) < 0.01 }"
          @click="$emit('set-line-height', preset.value)">{{ preset.name }}</button>
      </div>
    </div>
    <div class="setting-section">
      <span class="section-label">背景色</span>
      <div class="color-row">
        <div v-for="theme in themes" :key="theme.id"
          class="color-card-sm" :class="{ active: settings.theme === theme.id }"
          :style="{ background: theme.bgColor }"
          @click="$emit('set-theme', theme)">
          <svg v-if="settings.theme === theme.id" viewBox="0 0 24 24" width="12" height="12"
            fill="none" stroke="#e67e22" stroke-width="3">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
    <div class="setting-section setting-controls">
      <div class="control-row">
        <span>自动阅读</span>
        <div class="toggle-switch" :class="{ on: autoReading }" @click="$emit('start-auto-read')">
          <div class="toggle-thumb"></div>
        </div>
      </div>
      <div class="control-row page-mode-trigger" @click="$emit('open-level3')">
        <span>翻页类型</span>
        <div class="pm-trigger-right">
          <span class="pm-current">{{ currentPageModeName }}</span>
          <svg class="pm-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  settings: { type: Object, required: true },
  themes: { type: Array, required: true },
  fontFamilies: { type: Array, required: true },
  lineHeightPresets: { type: Array, required: true },
  autoReading: { type: Boolean, default: false },
  currentPageModeName: { type: String, default: '上下滑动' }
})

defineEmits(['change-font-size', 'set-line-height', 'set-theme', 'settings-change', 'start-auto-read', 'open-level3'])
</script>

<style lang="scss" scoped>
.setting-section {
  padding: 10px 0;
  border-bottom: 1px solid $color-panel-border;

  &:last-child { border-bottom: none; }
}

.section-label { display: block; font-size: $font-size-sm; color: #888; margin-bottom: $spacing-sm; }
.setting-row { display: flex; align-items: center; gap: 10px; justify-content: space-around; }

.font-ctrl-btn {
  width: 38px; height: 38px; border: 1px solid #555; border-radius: $radius-md;
  background: transparent; color: $color-panel-text; font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all $duration-fast $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.08); }
  &:active { background: rgba(255, 255, 255, 0.15); }
}

.font-size-val {
  min-width: 28px; text-align: center; font-size: $font-size-lg; font-weight: 600; color: $color-panel-text;
}

.font-family-wrap select {
  padding: 7px 10px; border: 1px solid #555; border-radius: $radius-md;
  background: $color-panel-surface; color: #ddd; font-size: $font-size-base;
  outline: none; cursor: pointer;
}

.preset-group { display: flex; gap: $spacing-xs; flex-wrap: wrap; justify-content: space-around; }

.preset-btn {
  padding: $spacing-sm $spacing-md; border: 1px solid #555; border-radius: $radius-md;
  background: transparent; color: #bbb; font-size: $font-size-sm;
  cursor: pointer; transition: all $duration-normal $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.06); color: #ddd; }
  &.active { background: $color-brand; border-color: $color-brand; color: $color-white; }
}

.color-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: space-around; }

.color-card-sm {
  width: 36px; height: 36px; border-radius: $radius-md;
  border: 2px solid rgba(255, 255, 255, 0.1);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all $duration-normal $easing-default;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);

  &:hover { transform: scale(1.08); }
  &.active { border-color: $color-brand; }
}

.setting-controls {
  display: flex; flex-direction: row; gap: $spacing-md;
  border-bottom: none !important;
}

.control-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: $font-size-md; color: #ccc;
}

.page-mode-trigger {
  cursor: pointer; padding: $spacing-sm 0;
  transition: color $duration-fast $easing-default;

  &:hover { color: $color-white; }
}

.pm-trigger-right { display: flex; align-items: center; gap: $spacing-xs; color: #888; }
.pm-current { font-size: $font-size-base; }
.pm-arrow { color: #666; }

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
</style>
