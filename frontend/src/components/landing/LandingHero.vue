<template>
  <section id="top" ref="heroRef" class="lp-hero">
    <!-- 页面滚动进度：顶端一条随滚动变长的细线 -->
    <div class="lp-hero-progress" aria-hidden="true"><span ref="progressRef" /></div>

    <div class="lp-hero-bg" aria-hidden="true">
      <div class="lp-hero-glow lp-hero-glow-a" />
      <div class="lp-hero-glow lp-hero-glow-b" />
      <div class="lp-hero-grid" />
      <!-- 指针附近的网格被点亮 -->
      <div class="lp-hero-grid lp-hero-grid-lit" />
      <!-- 沿网格线流过的几道光 -->
      <span class="lp-hero-beam lp-hero-beam-v" style="--at: -6; --delay: 0s; --dur: 7s" />
      <span class="lp-hero-beam lp-hero-beam-v" style="--at: 5; --delay: 2.6s; --dur: 9s" />
      <span class="lp-hero-beam lp-hero-beam-v" style="--at: 9; --delay: 5s; --dur: 8s" />
      <span class="lp-hero-beam lp-hero-beam-h" style="--at: 3; --delay: 1.2s; --dur: 10s" />
      <span class="lp-hero-beam lp-hero-beam-h" style="--at: 7; --delay: 6s; --dur: 12s" />
    </div>

    <HeroFloaters />

    <div class="lp-container lp-hero-inner">
      <p class="lp-hero-badge lp-hero-enter" style="--i: 0">
        <span class="lp-hero-badge-spark" aria-hidden="true">✦</span>
        {{ badgeText }}
      </p>

      <!-- 标题逐字浮现；读屏器读 aria-label 里的完整句子 -->
      <h1 class="lp-hero-title" :aria-label="`${siteName} — ${tagline}`">
        <span class="lp-hero-line" aria-hidden="true">
          <span
            v-for="(unit, index) in nameUnits"
            :key="`n-${index}`"
            class="lp-hero-unit"
            :style="{ '--i': index }"
            >{{ unit }}</span
          >
        </span>
        <span class="lp-hero-line lp-hero-line-sub" aria-hidden="true">
          <span
            v-for="(unit, index) in taglineUnits"
            :key="`t-${index}`"
            class="lp-hero-unit"
            :style="{ '--i': nameUnits.length + 2 + index }"
            >{{ unit }}</span
          >
        </span>
      </h1>

      <p class="lp-lead lp-hero-desc lp-hero-enter" style="--i: 5">
        {{ t('home.landing.hero.description') }}
      </p>

      <div class="lp-hero-actions lp-hero-enter" style="--i: 6">
        <span v-magnetic class="lp-magnet">
          <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="lp-btn lp-btn-primary">
            {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
            <Icon name="arrowRight" size="sm" :stroke-width="2" class="lp-btn-arrow" />
          </router-link>
        </span>
        <router-link v-if="showModelPlaza" to="/model-plaza" class="lp-btn lp-btn-ghost">
          {{ t('home.landing.hero.browseModels') }}
        </router-link>
        <a v-else href="#quickstart" class="lp-btn lp-btn-ghost" @click.prevent="scrollToQuickstart">
          {{ t('home.landing.hero.howToConnect') }}
        </a>
      </div>

      <ul class="lp-hero-protocols lp-hero-enter" style="--i: 7">
        <li v-for="protocol in protocols" :key="protocol">{{ protocol }}</li>
      </ul>
    </div>

    <!-- 演示窗口：随滚动由后仰逐渐放平，并跟着指针轻微倾斜 -->
    <div class="lp-container">
      <div ref="stageRef" class="lp-hero-stage lp-hero-enter" style="--i: 9">
        <div class="lp-hero-stage-glow" aria-hidden="true" />
        <div ref="tiltRef" class="lp-hero-tilt">
          <LandingConsole :site-name="siteName" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingConsole from './LandingConsole.vue'
import HeroFloaters from './HeroFloaters.vue'
import { canHover, prefersReducedMotion, vMagnetic } from './motion'

const props = defineProps<{
  siteName: string
  /** 管理员在系统设置里自定义的副标题；为空时用默认文案 */
  customSubtitle: string
  showModelPlaza: boolean
  isAuthenticated: boolean
  dashboardPath: string
}>()

const { t } = useI18n()

const protocols = ['Anthropic Messages', 'OpenAI Chat Completions', 'OpenAI Responses', 'Gemini']

const badgeText = computed(() => props.customSubtitle || t('home.landing.hero.badge'))
const tagline = computed(() => t('home.landing.hero.tagline'))

// 中日韩文字逐字拆开，拉丁文字按单词拆开（保留词间空格），这样换行位置仍然自然
function splitUnits(text: string): string[] {
  const units: string[] = []
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue
    if (/^\s+$/.test(part)) {
      if (units.length) units[units.length - 1] += ' '
    } else if (/[\u3000-\u9fff\uff00-\uffef]/.test(part)) {
      units.push(...Array.from(part))
    } else {
      units.push(part)
    }
  }
  return units
}

const nameUnits = computed(() => splitUnits(props.siteName))
const taglineUnits = computed(() => splitUnits(tagline.value))

function scrollToQuickstart() {
  document
    .getElementById('quickstart')
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

// ---- 演示窗口的倾斜：滚动决定后仰角度，指针决定左右/上下的细微偏转 ----

const stageRef = ref<HTMLElement | null>(null)
const tiltRef = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const progressRef = ref<HTMLElement | null>(null)

const MAX_LEAN = 14 // 进入视口前的后仰角度
const MAX_POINTER_TILT = 3.5

let frame = 0
let lean = 0
let scale = 1
const pointer = { x: 0, y: 0 }
const current = { x: 0, y: 0 }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

function apply() {
  const el = tiltRef.value
  if (!el) return
  el.style.transform = `perspective(1800px) rotateX(${(lean + current.x).toFixed(3)}deg) rotateY(${current.y.toFixed(3)}deg) scale(${scale.toFixed(4)})`
}

function tick() {
  frame = 0
  // 每帧向目标靠近一小步，形成有惯性的跟随
  current.x += (pointer.x - current.x) * 0.08
  current.y += (pointer.y - current.y) * 0.08
  apply()
  if (Math.abs(pointer.x - current.x) > 0.01 || Math.abs(pointer.y - current.y) > 0.01) {
    frame = requestAnimationFrame(tick)
  }
}

function requestTick() {
  if (!frame) frame = requestAnimationFrame(tick)
}

function handleScroll() {
  const stage = stageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  const viewport = window.innerHeight || 1
  // 窗口顶边从视口底部走到视口上方 1/4 处，完成“放平”
  const progress = easeOutCubic(clamp01((viewport - rect.top) / (viewport * 0.75)))
  lean = (1 - progress) * MAX_LEAN
  scale = 0.93 + 0.07 * progress
  requestTick()

  // 顶端进度条：整页滚动了多少
  const scrollable = document.documentElement.scrollHeight - viewport
  if (progressRef.value) {
    progressRef.value.style.transform = `scaleX(${scrollable > 0 ? clamp01(window.scrollY / scrollable).toFixed(4) : 0})`
  }
}

// 指针在首屏里的位置，用来点亮附近的网格
let spotFrame = 0

function handleHeroPointer(event: PointerEvent) {
  if (spotFrame) return
  spotFrame = requestAnimationFrame(() => {
    spotFrame = 0
    const hero = heroRef.value
    if (!hero) return
    const rect = hero.getBoundingClientRect()
    hero.style.setProperty('--hx', `${event.clientX - rect.left}px`)
    hero.style.setProperty('--hy', `${event.clientY - rect.top}px`)
    hero.style.setProperty('--hlit', '1')
  })
}

function handleHeroLeave() {
  heroRef.value?.style.setProperty('--hlit', '0')
}

function handlePointerMove(event: PointerEvent) {
  const stage = stageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  pointer.y = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * MAX_POINTER_TILT
  pointer.x = -((event.clientY - rect.top) / rect.height - 0.5) * 2 * MAX_POINTER_TILT
  requestTick()
}

function handlePointerLeave() {
  pointer.x = 0
  pointer.y = 0
  requestTick()
}

let pointerBound = false

onMounted(() => {
  if (prefersReducedMotion()) return
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll)
  if (canHover() && stageRef.value) {
    pointerBound = true
    stageRef.value.addEventListener('pointermove', handlePointerMove)
    stageRef.value.addEventListener('pointerleave', handlePointerLeave)
    heroRef.value?.addEventListener('pointermove', handleHeroPointer)
    heroRef.value?.addEventListener('pointerleave', handleHeroLeave)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  cancelAnimationFrame(spotFrame)
  heroRef.value?.removeEventListener('pointermove', handleHeroPointer)
  heroRef.value?.removeEventListener('pointerleave', handleHeroLeave)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
  if (pointerBound && stageRef.value) {
    stageRef.value.removeEventListener('pointermove', handlePointerMove)
    stageRef.value.removeEventListener('pointerleave', handlePointerLeave)
  }
})
</script>

<style scoped>
.lp-hero {
  position: relative;
  padding-top: clamp(132px, 17vh, 196px);
  padding-bottom: clamp(48px, 8vw, 96px);
  text-align: center;
}

/* ---- 背景：两团缓慢游移的光 + 向下淡出的细网格 ---- */

.lp-hero-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.lp-hero-glow {
  position: absolute;
  top: -18%;
  left: 50%;
  width: min(1100px, 150vw);
  aspect-ratio: 1.7;
  border-radius: 50%;
  filter: blur(60px);
  will-change: transform;
}

.lp-hero-glow-a {
  background: radial-gradient(closest-side, var(--lp-glow-a), transparent 72%);
  transform: translateX(-62%);
  animation: lp-hero-drift-a 18s ease-in-out infinite alternate;
}

.lp-hero-glow-b {
  top: -8%;
  width: min(820px, 120vw);
  background: radial-gradient(closest-side, var(--lp-glow-b), transparent 72%);
  transform: translateX(-24%);
  animation: lp-hero-drift-b 22s ease-in-out infinite alternate;
}

@keyframes lp-hero-drift-a {
  to {
    transform: translateX(-48%) translateY(6%) scale(1.08);
  }
}

@keyframes lp-hero-drift-b {
  to {
    transform: translateX(-44%) translateY(-4%) scale(0.94);
  }
}

.lp-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--lp-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--lp-grid) 1px, transparent 1px);
  background-size: 56px 56px;
  background-position: center top;
  -webkit-mask-image: radial-gradient(ellipse 75% 62% at 50% 0%, #000 18%, transparent 76%);
  mask-image: radial-gradient(ellipse 75% 62% at 50% 0%, #000 18%, transparent 76%);
}

/* 第二层网格：线更亮、带强调色，只在指针周围露出来 */
.lp-hero-grid-lit {
  background-image:
    linear-gradient(var(--lp-spot-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--lp-spot-border) 1px, transparent 1px);
  opacity: calc(var(--hlit, 0) * 0.55);
  -webkit-mask-image: radial-gradient(240px circle at var(--hx, 50%) var(--hy, 0%), #000, transparent 72%);
  mask-image: radial-gradient(240px circle at var(--hx, 50%) var(--hy, 0%), #000, transparent 72%);
  transition: opacity 0.5s ease;
}

/* 流光：贴着网格线的一小段亮线，--at 是它所在的第几条线（以中线为 0，每格 56px） */
.lp-hero-beam {
  position: absolute;
  opacity: 0;
  animation: var(--dur, 8s) linear var(--delay, 0s) infinite;
}

.lp-hero-beam-v {
  top: 0;
  left: calc(50% + var(--at) * 56px);
  width: 1px;
  height: 180px;
  background: linear-gradient(to bottom, transparent, var(--lp-accent) 70%, transparent);
  animation-name: lp-hero-beam-v;
}

.lp-hero-beam-h {
  top: calc(var(--at) * 56px);
  left: 0;
  width: 220px;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--lp-accent) 70%, transparent);
  animation-name: lp-hero-beam-h;
}

@keyframes lp-hero-beam-v {
  0% {
    opacity: 0;
    transform: translateY(-180px);
  }
  12% {
    opacity: 0.7;
  }
  45% {
    opacity: 0;
    transform: translateY(620px);
  }
  100% {
    opacity: 0;
    transform: translateY(620px);
  }
}

@keyframes lp-hero-beam-h {
  0% {
    opacity: 0;
    transform: translateX(-220px);
  }
  10% {
    opacity: 0.55;
  }
  55% {
    opacity: 0;
    transform: translateX(100vw);
  }
  100% {
    opacity: 0;
    transform: translateX(100vw);
  }
}

/* 顶端的滚动进度线 */
.lp-hero-progress {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 60;
  height: 2px;
  pointer-events: none;
}

.lp-hero-progress span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--lp-accent), var(--lp-accent-2));
  transform: scaleX(0);
  transform-origin: left center;
}

@media (prefers-reduced-motion: reduce) {
  .lp-hero-beam,
  .lp-hero-progress {
    display: none;
  }
}

.lp-hero-inner {
  position: relative;
}

/* ---- 入场：各元素按 --i 依次淡入上浮 ---- */

.lp-hero-enter {
  animation: lp-hero-rise 1s var(--lp-ease-out) both;
  animation-delay: calc(var(--i, 0) * 80ms + 80ms);
}

@keyframes lp-hero-rise {
  from {
    opacity: 0;
    filter: blur(10px);
    transform: translate3d(0, 18px, 0);
  }
}

.lp-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding-inline: 12px 14px;
  border: 1px solid var(--lp-line);
  border-radius: 9999px;
  background-color: var(--lp-inset);
  font-size: 13px;
  color: var(--lp-text-2);
}

.lp-hero-badge-spark {
  background: linear-gradient(135deg, var(--lp-accent), var(--lp-accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: lp-hero-spark 3.6s ease-in-out infinite;
}

@keyframes lp-hero-spark {
  50% {
    opacity: 0.45;
    transform: scale(0.82) rotate(45deg);
  }
}

.lp-hero-title {
  margin-top: 28px;
  font-size: clamp(2.6rem, 7.2vw, 5.25rem);
  font-weight: 500;
  line-height: 1.06;
  letter-spacing: -0.04em;
}

.lp-hero-line {
  display: block;
}

.lp-hero-line-sub {
  margin-top: 0.12em;
  font-size: 0.62em;
  letter-spacing: -0.03em;
  color: var(--lp-text-2);
}

.lp-hero-unit {
  display: inline-block;
  white-space: pre;
  animation: lp-hero-unit 1.1s var(--lp-ease-out) both;
  animation-delay: calc(var(--i, 0) * 42ms + 160ms);
}

@keyframes lp-hero-unit {
  from {
    opacity: 0;
    filter: blur(14px);
    transform: translate3d(0, 0.35em, 0);
  }
}

.lp-hero-desc {
  max-width: 620px;
  margin: 26px auto 0;
}

.lp-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 36px;
}

.lp-hero-protocols {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 18px;
  margin-top: 28px;
  font-size: 12.5px;
  color: var(--lp-text-3);
}

.lp-hero-protocols li {
  display: inline-flex;
  align-items: center;
  gap: 18px;
}

.lp-hero-protocols li + li::before {
  content: '';
  width: 3px;
  height: 3px;
  border-radius: 9999px;
  background-color: currentColor;
  opacity: 0.6;
}

/* ---- 演示窗口 ---- */

.lp-hero-stage {
  position: relative;
  max-width: 980px;
  margin: clamp(56px, 8vw, 88px) auto 0;
}

.lp-hero-stage-glow {
  position: absolute;
  inset: 12% 6% -6%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--lp-glow-a), transparent 75%);
  filter: blur(70px);
  opacity: 0.9;
}

.lp-hero-tilt {
  position: relative;
  transform-origin: 50% 0%;
  will-change: transform;
}
</style>
