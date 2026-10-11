<template>
  <section ref="rootRef" class="lp-cta">
    <!-- 节点网络：缓慢漂移的点在彼此靠近时连成线，指针经过时附近的点会被牵引过来 -->
    <canvas ref="canvasRef" class="lp-cta-canvas" aria-hidden="true" />
    <div class="lp-cta-fade" aria-hidden="true" />

    <div class="lp-container lp-cta-inner">
      <h2 v-reveal class="lp-h2 lp-cta-title">{{ t('home.landing.cta.title') }}</h2>
      <p v-reveal="100" class="lp-lead lp-cta-desc">{{ t('home.landing.cta.description') }}</p>
      <div v-reveal="200" class="lp-cta-actions">
        <span v-magnetic class="lp-magnet">
          <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="lp-btn lp-btn-primary">
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
            <Icon name="arrowRight" size="sm" :stroke-width="2" class="lp-btn-arrow" />
          </router-link>
        </span>
        <router-link to="/key-usage" class="lp-btn lp-btn-ghost">
          {{ t('home.landing.nav.usage') }}
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { canHover, prefersReducedMotion, useInView, vMagnetic, vReveal } from './motion'

defineProps<{
  isAuthenticated: boolean
  dashboardPath: string
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const inView = useInView(rootRef, '120px')

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

const LINK_DISTANCE = 128
const POINTER_DISTANCE = 190

let context: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let width = 0
let height = 0
let frame = 0
let ink = '255 255 255'
let accent = '124 147 255'
const pointer = { x: -9999, y: -9999 }

// 把 "#rrggbb" 转成 "r g b"，方便拼出带透明度的颜色
function toRgbTriplet(value: string, fallback: string): string {
  const hex = value.trim().match(/^#([0-9a-f]{6})$/i)?.[1]
  if (!hex) return fallback
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(' ')
}

function readColors() {
  const root = rootRef.value
  if (!root) return
  const styles = getComputedStyle(root)
  ink = toRgbTriplet(styles.getPropertyValue('--lp-text'), ink)
  accent = toRgbTriplet(styles.getPropertyValue('--lp-accent'), accent)
}

function resize() {
  const canvas = canvasRef.value
  const root = rootRef.value
  if (!canvas || !root || !context) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  width = root.clientWidth
  height = root.clientHeight
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  // 粒子数量跟着面积走，手机上自然变少
  const count = Math.round(Math.min(110, Math.max(36, (width * height) / 11000)))
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28,
    radius: 0.8 + Math.random() * 1.4
  }))
  draw()
}

function draw() {
  if (!context) return
  context.clearRect(0, 0, width, height)

  for (let i = 0; i < particles.length; i++) {
    const a = particles[i]

    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (distance > LINK_DISTANCE) continue
      context.strokeStyle = `rgb(${ink} / ${(1 - distance / LINK_DISTANCE) * 0.16})`
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
      context.stroke()
    }

    const toPointer = Math.hypot(a.x - pointer.x, a.y - pointer.y)
    if (toPointer < POINTER_DISTANCE) {
      context.strokeStyle = `rgb(${accent} / ${(1 - toPointer / POINTER_DISTANCE) * 0.55})`
      context.beginPath()
      context.moveTo(a.x, a.y)
      context.lineTo(pointer.x, pointer.y)
      context.stroke()
    }

    context.fillStyle = `rgb(${ink} / 0.5)`
    context.beginPath()
    context.arc(a.x, a.y, a.radius, 0, Math.PI * 2)
    context.fill()
  }
}

function tick() {
  for (const particle of particles) {
    // 指针附近的点被轻轻吸过去
    const dx = pointer.x - particle.x
    const dy = pointer.y - particle.y
    const distance = Math.hypot(dx, dy)
    if (distance < POINTER_DISTANCE && distance > 1) {
      particle.x += (dx / distance) * 0.35
      particle.y += (dy / distance) * 0.35
    }

    particle.x += particle.vx
    particle.y += particle.vy
    // 出界后从对侧回来，保持密度恒定
    if (particle.x < -10) particle.x = width + 10
    else if (particle.x > width + 10) particle.x = -10
    if (particle.y < -10) particle.y = height + 10
    else if (particle.y > height + 10) particle.y = -10
  }
  draw()
  frame = requestAnimationFrame(tick)
}

function start() {
  if (!frame && context && !prefersReducedMotion()) frame = requestAnimationFrame(tick)
}

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
}

function handlePointerMove(event: PointerEvent) {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return
  pointer.x = event.clientX - rect.left
  pointer.y = event.clientY - rect.top
}

function handlePointerLeave() {
  pointer.x = -9999
  pointer.y = -9999
}

let themeObserver: MutationObserver | null = null
let pointerBound = false

watch(inView, (visible) => (visible ? start() : stop()))

onMounted(() => {
  // jsdom 等环境没有 2D 画布：直接跳过，页面其余部分照常
  try {
    context = canvasRef.value?.getContext('2d') ?? null
  } catch {
    context = null
  }
  if (!context) return

  readColors()
  resize()
  window.addEventListener('resize', resize)

  // 明暗主题切换时重新取色
  themeObserver = new MutationObserver(() => {
    readColors()
    draw()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  if (canHover() && rootRef.value) {
    pointerBound = true
    rootRef.value.addEventListener('pointermove', handlePointerMove)
    rootRef.value.addEventListener('pointerleave', handlePointerLeave)
  }
  if (inView.value) start()
})

onBeforeUnmount(() => {
  stop()
  themeObserver?.disconnect()
  window.removeEventListener('resize', resize)
  if (pointerBound && rootRef.value) {
    rootRef.value.removeEventListener('pointermove', handlePointerMove)
    rootRef.value.removeEventListener('pointerleave', handlePointerLeave)
  }
})
</script>

<style scoped>
.lp-cta {
  position: relative;
  overflow: hidden;
  padding-block: clamp(96px, 14vw, 176px);
  text-align: center;
}

.lp-cta-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 四周淡出到页面底色，中间留给文字 */
.lp-cta-fade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 46% 52% at 50% 50%, var(--lp-bg) 20%, transparent 78%),
    linear-gradient(to bottom, var(--lp-bg), transparent 22%, transparent 78%, var(--lp-bg));
  pointer-events: none;
}

.lp-cta-inner {
  position: relative;
}

.lp-cta-title {
  max-width: 720px;
  margin-inline: auto;
}

.lp-cta-desc {
  max-width: 520px;
  margin: 20px auto 0;
}

.lp-cta-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 36px;
}
</style>
