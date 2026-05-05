<template>
  <div class="reader-scroll" ref="scrollArea" @scroll="$emit('scroll')">
    <div class="reader-content" :style="contentStyle" ref="contentEl">
      <!-- 由 JS 动态管理章节 DOM -->
    </div>
  </div>
</template>

<script setup>
defineProps({
  contentStyle: { type: Object, required: true },
  nightMode: { type: Boolean, default: false },
  paragraphSpacing: { type: Number, default: 12 }
})

defineEmits(['scroll'])

defineExpose({
  scrollArea: () => null,
  contentEl: () => null,
})
</script>

<style lang="scss" scoped>
.reader-scroll {
  flex: 1; overflow-y: auto; scroll-behavior: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}

.reader-content {
  margin: 0 auto; word-wrap: break-word; text-align: justify; user-select: text;
}

/* 动态章节 DOM — 使用 :deep 穿透到 innerHTML 生成的内容 */
:deep(.chapter-block) { margin-bottom: 0; }

:deep(.chapter-header) {
  padding: $spacing-2xl 0 $spacing-base;
  border-bottom: 1px solid v-bind('nightMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"');
  margin-bottom: $spacing-base;
}

:deep(.chapter-title-inline) {
  font-size: 1.2em; font-weight: 700; text-align: center; color: inherit; opacity: 0.85;
}

:deep(.chapter-body p) {
  text-indent: 2em;
  margin-bottom: v-bind('paragraphSpacing + "px"');
  line-height: inherit;
}
</style>
