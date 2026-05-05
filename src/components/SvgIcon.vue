<template>
  <span class="svg-icon" :style="iconStyle" v-html="svgContent"></span>
</template>

<script setup>
import { computed } from 'vue'

// 自动导入 icons/ 目录下所有 SVG 文件（构建时解析，零运行时开销）
const svgModules = import.meta.glob('@/assets/icons/svg/*.svg', { query: '?raw', import: 'default', eager: true })

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
  color: { type: String, default: 'currentColor' }
})

// 根据文件名匹配 SVG 内容
const svgContent = computed(() => {
  const key = Object.keys(svgModules).find(k => k.endsWith(`/${props.name}.svg`))
  return key ? svgModules[key] : ''
})

const iconStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  color: props.color,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0'
}))
</script>

<style scoped>
.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
}

/* 对于使用 fill 而非 stroke 的图标（如 pause、play），覆盖 fill */
.svg-icon :deep(svg path[fill="currentColor"]),
.svg-icon :deep(svg rect[fill="currentColor"]) {
  fill: currentColor;
  stroke: none;
}
</style>
