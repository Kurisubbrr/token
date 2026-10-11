<template>
  <section ref="rootRef" class="providers" :aria-label="t('home.landing.providers.title')">
    <div
      ref="viewportRef"
      v-reveal
      class="providers-viewport"
      @pointerenter="hovering = true"
      @pointerleave="hovering = false"
    >
      <!-- 同一组厂商首尾相接地排若干遍；整条带子匀速左移，移过一组的宽度就回到起点，
           画面与起点完全相同，所以看不出接缝。遍数按可视宽度算，保证右侧永远有内容。 -->
      <div ref="stripRef" class="providers-strip">
        <ul
          v-for="copy in copies"
          :key="copy"
          :ref="(el) => setTrackRef(el, copy)"
          class="providers-track"
          :aria-hidden="copy > 1 ? 'true' : undefined"
        >
          <li
            v-for="provider in providers"
            :key="provider.name"
            class="providers-item"
            :class="{ 'is-mono': provider.mono }"
          >
            <ModelIcon :model="provider.icon" size="30px" />
            <span class="providers-name">{{ provider.name }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { prefersReducedMotion, useInView, vReveal } from './motion'

const { t } = useI18n()

// 与后端平台清单一致的主流厂商。
// mono：品牌标是纯黑的几家，图标改为跟随文字颜色，深色主题下才看得见。
const providers = [
  { name: 'Claude', icon: 'claude', mono: false },
  { name: 'OpenAI', icon: 'gpt', mono: true },
  { name: 'Gemini', icon: 'gemini', mono: false },
  { name: 'DeepSeek', icon: 'deepseek', mono: false },
  { name: 'Grok', icon: 'grok', mono: true },
  { name: 'Kimi', icon: 'kimi', mono: true },
  { name: 'GLM', icon: 'glm', mono: false },
  { name: 'MiniMax', icon: 'minimax', mono: false }
]

const SPEED = 38 // 匀速滚动，像素/秒
const HOVER_SPEED = 6 // 指针停在上面时放慢，方便看清，但不完全停下

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const stripRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef, '80px')
const hovering = ref(false)

// 至少排 3 遍；挂载后按实际宽度重算
const copies = ref(3)

let firstTrack: HTMLElement | null = null
let trackWidth = 0
let offset = 0
let speed = SPEED
let lastTime = 0
let frame = 0

function setTrackRef(el: unknown, copy: number) {
  if (copy === 1) firstTrack = el instanceof HTMLElement ? el : null
}

function measure() {
  const viewport = viewportRef.value
  if (!viewport || !firstTrack) return
  const width = firstTrack.getBoundingClientRect().width
  if (width <= 0) return
  trackWidth = width
  // 带子最多左移一整组的宽度，所以“可视宽度 + 一组”都要铺满
  copies.value = Math.max(2, Math.ceil(viewport.clientWidth / width) + 1)
  offset %= trackWidth
}

function tick(now: number) {
  // 切到后台再回来时两帧间隔会很大，限制单帧步长，避免带子猛地跳一截
  const elapsed = Math.min(64, now - lastTime)
  lastTime = now
  // 速度向目标值缓缓靠拢：悬停时是平滑减速，移开后再慢慢提速
  speed += ((hovering.value ? HOVER_SPEED : SPEED) - speed) * 0.06
  if (trackWidth > 0 && stripRef.value) {
    offset = (offset + (speed * elapsed) / 1000) % trackWidth
    stripRef.value.style.transform = `translate3d(${(-offset).toFixed(2)}px, 0, 0)`
  }
  frame = requestAnimationFrame(tick)
}

function start() {
  if (frame || prefersReducedMotion()) return
  lastTime = performance.now()
  frame = requestAnimationFrame(tick)
}

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
}

watch(inView, (visible) => (visible ? start() : stop()))

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measure()
  // 字体加载完成、窗口尺寸变化都会改变一组的宽度，需要重新测量
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measure)
    if (viewportRef.value) resizeObserver.observe(viewportRef.value)
    if (firstTrack) resizeObserver.observe(firstTrack)
  } else {
    window.addEventListener('resize', measure)
  }
  if (inView.value) start()
})

onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
/* 一面不加任何边框和底色的 Logo 墙：只有图标和字标，靠留白和两端的淡出来收边 */
.providers {
  /* 下方紧接的功能区自带很大的上留白，这里底部只留一点，避免两段之间空得太开 */
  padding-block: clamp(40px, 6vw, 80px) clamp(8px, 2vw, 24px);
}

.providers-viewport {
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
}

.providers-strip {
  display: flex;
  width: max-content;
  /* 上下留一点余量，悬停放大的字标不会被裁掉 */
  padding-block: 12px;
  will-change: transform;
}

/* 组内间距与组间间距一致（靠 padding-right 补上最后一个间隔），接缝处才不会忽宽忽窄 */
.providers-track {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: clamp(48px, 6vw, 88px);
  padding-right: clamp(48px, 6vw, 88px);
}

.providers-item {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  font-size: clamp(20px, 2.1vw, 26px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--lp-text);
  opacity: 0.82;
  cursor: default;
  transition:
    opacity 0.4s ease,
    transform 0.6s var(--lp-ease-spring);
}

/* 指针移到其中一个上面时，它放大点亮，其余的一起退后 */
.providers-strip:hover .providers-item {
  opacity: 0.32;
}

.providers-strip:hover .providers-item:hover {
  opacity: 1;
  transform: scale(1.06);
}

/* 纯黑的品牌标改用文字色，深色主题下不会消失在背景里 */
.providers-item.is-mono :deep(.model-icon path) {
  fill: currentColor;
}

.providers-item :deep(.model-icon) {
  flex-shrink: 0;
}
</style>
