<template>
  <!-- 首屏两侧悬浮的模型图标：远近不同，跟着指针做幅度不同的位移，形成纵深 -->
  <div ref="rootRef" class="hero-floaters" aria-hidden="true">
    <span
      v-for="(chip, index) in chips"
      :key="chip.icon"
      class="hero-floater"
      :class="{ 'is-mono': chip.mono }"
      :style="{
        '--x': chip.x,
        '--y': chip.y,
        '--depth': chip.depth,
        '--size': `${chip.size}px`,
        '--i': index
      }"
    >
      <span class="hero-floater-chip">
        <ModelIcon :model="chip.icon" :size="`${Math.round(chip.size * 0.46)}px`" />
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { canHover, prefersReducedMotion } from './motion'

// x / y 是相对首屏的位置；depth 越大离观众越近：图标更大、位移幅度更大
const chips = [
  { icon: 'claude', mono: false, x: '9%', y: '24%', depth: 1, size: 64 },
  { icon: 'gemini', mono: false, x: '17%', y: '45%', depth: 0.55, size: 48 },
  { icon: 'deepseek', mono: false, x: '6%', y: '70%', depth: 0.8, size: 54 },
  { icon: 'gpt', mono: true, x: '91%', y: '22%', depth: 0.9, size: 60 },
  { icon: 'grok', mono: true, x: '83%', y: '43%', depth: 0.5, size: 46 },
  { icon: 'glm', mono: false, x: '94%', y: '68%', depth: 0.75, size: 52 }
]

const rootRef = ref<HTMLElement | null>(null)
let frame = 0
let bound = false

function onPointerMove(event: PointerEvent) {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    const el = rootRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--fx', (((event.clientX - rect.left) / rect.width - 0.5) * 2).toFixed(3))
    el.style.setProperty('--fy', (((event.clientY - rect.top) / rect.height - 0.5) * 2).toFixed(3))
  })
}

onMounted(() => {
  if (!canHover() || prefersReducedMotion()) return
  bound = true
  window.addEventListener('pointermove', onPointerMove, { passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  if (bound) window.removeEventListener('pointermove', onPointerMove)
})
</script>

<style scoped>
.hero-floaters {
  position: absolute;
  inset: 0;
  display: none;
  pointer-events: none;
}

/* 屏幕够宽、两侧留得出空白时才显示，不和标题抢位置 */
@media (min-width: 1180px) {
  .hero-floaters {
    display: block;
  }
}

.hero-floater {
  position: absolute;
  top: var(--y);
  left: var(--x);
  width: var(--size);
  height: var(--size);
  margin: calc(var(--size) / -2) 0 0 calc(var(--size) / -2);
  /* 指针视差：越近的图标位移越大，方向与指针相反 */
  transform: translate3d(
    calc(var(--fx, 0) * var(--depth) * -26px),
    calc(var(--fy, 0) * var(--depth) * -18px),
    0
  );
  transition: transform 0.9s var(--lp-ease-out);
}

.hero-floater-chip {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 1px solid var(--lp-line);
  border-radius: 30%;
  background: var(--lp-card-solid);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.5) inset,
    0 18px 40px -18px rgb(15 23 42 / 0.35);
  opacity: calc(0.55 + var(--depth) * 0.45);
  animation:
    hero-floater-in 1.1s var(--lp-ease-spring) backwards,
    hero-floater-bob 7s ease-in-out infinite;
  animation-delay:
    calc(var(--i) * 110ms + 700ms),
    calc(var(--i) * -1.3s);
}

.dark .hero-floater-chip {
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.06) inset,
    0 18px 40px -18px rgb(0 0 0 / 0.8);
}

/* 单色图标（OpenAI、Grok）跟随文字色，暗色下才看得见 */
.hero-floater.is-mono .hero-floater-chip {
  color: var(--lp-text);
}

.hero-floater.is-mono :deep(.model-icon path) {
  fill: currentColor;
}

@keyframes hero-floater-in {
  from {
    opacity: 0;
    transform: scale(0.4) translateY(24px);
    filter: blur(8px);
  }
}

@keyframes hero-floater-bob {
  0%,
  100% {
    translate: 0 0;
    rotate: -3deg;
  }
  50% {
    translate: 0 -10px;
    rotate: 3deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-floater {
    transition: none;
  }

  .hero-floater-chip {
    animation: none;
  }
}
</style>
