<template>
  <div class="paged-viewport" ref="viewport" :style="viewportStyle">
    <!-- 底层：当前页 -->
    <div class="paged-layer base" ref="baseLayer">
      <div class="paged-flow" ref="baseFlow"></div>
    </div>
    <!-- 上层：下一页，被遮罩自上而下露出 -->
    <div class="cover-mask" ref="coverMask">
      <div class="paged-layer incoming" ref="incomingLayer">
        <div class="paged-flow" ref="incomingFlow"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  viewportStyle: { type: Object, required: true },
  nightMode: { type: Boolean, default: false },
  paragraphSpacing: { type: Number, default: 12 },
  pageBackground: { type: String, default: '#f5f0e8' },
})

const viewport = ref(null)
const baseLayer = ref(null)
const baseFlow = ref(null)
const coverMask = ref(null)
const incomingLayer = ref(null)
const incomingFlow = ref(null)

defineExpose({ viewport, baseLayer, baseFlow, coverMask, incomingLayer, incomingFlow })
</script>

<style lang="scss" scoped>
.paged-viewport {
  flex: 1; position: relative; overflow: hidden;
  padding: 24px v-bind('($props.viewportStyle.paddingLeft) || "0"') 48px;
  user-select: none; -webkit-user-select: none;
}

.paged-layer {
  position: absolute; top: 24px; bottom: 48px; left: 0; right: 0;
  will-change: transform;
}

.paged-flow {
  width: 100%;
  text-align: justify; word-wrap: break-word;
  /* column-* / height 由 JS 引擎按视口注入 */
}

.cover-mask {
  position: absolute; top: 0; left: 0; right: 0; height: 0;
  overflow: hidden; will-change: height, box-shadow; z-index: 2;
  /* 不透明=页面底色，覆盖时真正盖住底层；下边缘阴影由引擎在动画期间注入 */
  background: v-bind('pageBackground');
}

/* incoming 层在遮罩内，仍需与 base 同样的内边距定位 */
.cover-mask .paged-layer.incoming { top: 24px; }

:deep(.paged-chapter-title) {
  font-size: 1.2em; font-weight: 700; text-align: center;
  opacity: 0.85; margin-bottom: 1em;
  break-inside: avoid;
}

:deep(.paged-flow p) {
  text-indent: 2em;
  margin: 0 0 v-bind('paragraphSpacing + "px"');
  line-height: inherit;
}
</style>
