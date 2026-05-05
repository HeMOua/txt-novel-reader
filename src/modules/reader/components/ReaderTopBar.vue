<template>
  <header class="panel-top-bar" @click.stop>
    <button class="back-btn" @click="$emit('back')">← 返回</button>
    <span class="top-bar-title">{{ chapterLabel }}</span>
    <span class="top-spacer"></span>
  </header>
</template>

<script setup>
defineProps({
  chapterLabel: { type: String, default: '' }
})

defineEmits(['back'])
</script>

<style lang="scss" scoped>
.panel-top-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: $z-index-top-bar;
  display: flex; align-items: center; padding: 10px $spacing-base;
  background: $color-panel-bg-light; backdrop-filter: blur(10px); color: $color-panel-text;
}

.back-btn {
  background: none; border: none; color: $color-panel-text;
  font-size: $font-size-md; cursor: pointer;
  padding: $spacing-xs 10px; border-radius: $radius-sm; white-space: nowrap;

  &:hover { background: rgba(255, 255, 255, 0.1); }
}

.top-bar-title {
  flex: 1; text-align: center; font-size: $font-size-md;
  @include text-ellipsis; color: #ccc;
}

.top-spacer { width: 60px; }
</style>
