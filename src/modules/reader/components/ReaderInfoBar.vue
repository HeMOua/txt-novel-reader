<template>
  <footer class="reader-info-bar">
    <span class="info-left">{{ Math.round(progress) }}%</span>
    <span class="info-right">{{ currentTime }}</span>
  </footer>
</template>

<script setup>
defineProps({
  progress: { type: Number, required: true },
  currentTime: { type: String, required: true },
  nightMode: { type: Boolean, default: false }
})
</script>

<style lang="scss" scoped>
.reader-info-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between;
  padding: $spacing-xs $spacing-lg;
  font-size: $font-size-xs;
  color: v-bind('nightMode ? "#555" : "#bbb"');
  pointer-events: none; z-index: $z-index-info;
}
</style>
