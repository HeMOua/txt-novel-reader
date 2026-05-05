<template>
  <div class="l2-default">
    <div class="nav-row">
      <button class="nav-btn" @click="$emit('prev')" :disabled="currentChapterIndex <= 0">上一章</button>
      <div class="progress-slider">
        <input type="range" min="0" :max="Math.max(totalChapters - 1, 0)"
          :value="sliderChapter" @input="$emit('slider-change', $event.target.value)" class="slider" />
      </div>
      <button class="nav-btn" @click="$emit('next')" :disabled="currentChapterIndex >= totalChapters - 1">下一章</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  currentChapterIndex: { type: Number, required: true },
  totalChapters: { type: Number, required: true },
  sliderChapter: { type: Number, required: true }
})

defineEmits(['prev', 'next', 'slider-change'])
</script>

<style lang="scss" scoped>
.nav-row { display: flex; align-items: center; gap: 10px; }

.nav-btn {
  background: none; border: none; color: #ccc; font-size: $font-size-base;
  cursor: pointer; padding: $spacing-sm $spacing-md; border-radius: $radius-sm; white-space: nowrap;
  transition: all $duration-fast $easing-default;

  &:hover { background: rgba(255, 255, 255, 0.08); color: $color-white; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
}

.progress-slider { flex: 1; padding: 0 $spacing-xs; }

.slider {
  @include slider-track;

  &::-webkit-slider-thumb {
    @include slider-thumb;
  }
}
</style>
