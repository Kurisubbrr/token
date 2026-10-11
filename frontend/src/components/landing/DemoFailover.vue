<template>
  <!-- 请求经网关分发到上游线路。点任意一条线路可以让它“故障”，流量会自动切到下一条健康的线路 -->
  <div ref="rootRef" class="fo">
    <p class="fx-hint">{{ t('home.landing.features.routing.hint') }}</p>

    <div class="fo-diagram" :class="{ 'is-blocked': activeIndex === -1 }">
      <div class="fo-source fx-layer" style="--depth: 8">
        <Icon name="terminal" size="sm" :stroke-width="1.8" />
        <span>{{ t('home.landing.console.client') }}</span>
      </div>

      <span class="fo-wire" :class="{ 'is-flowing': activeIndex !== -1 }" aria-hidden="true" />

      <div class="fo-gateway fx-layer" style="--depth: 5">
        <span class="fo-gateway-pulse" aria-hidden="true" />
        <img :src="siteLogo || '/logo.svg'" alt="" />
      </div>

      <span class="fo-wire fo-wire-out" :class="{ 'is-flowing': activeIndex !== -1 }" aria-hidden="true" />

      <div class="fo-ups">
        <!-- 当前线路的高亮框：切换时滑到新的一行，而不是闪现 -->
        <span
          class="fo-ring"
          :class="{ 'is-hidden': activeIndex === -1 }"
          :style="{ transform: `translateY(${Math.max(0, activeIndex) * ROW_STEP}px)` }"
          aria-hidden="true"
        />
        <button
          v-for="(upstream, index) in upstreams"
          :key="upstream.id"
          type="button"
          class="fo-up"
          :class="{ 'is-active': index === activeIndex, 'is-down': upstream.down }"
          :aria-pressed="upstream.down"
          @click="toggle(index, true)"
        >
          <span class="fo-up-stub" aria-hidden="true" />
          <span class="fo-up-dot" />
          <span class="fo-up-name">{{ t('home.landing.features.routing.upstream') }} {{ upstream.id }}</span>
          <span class="fo-up-meta lp-mono">{{ upstream.down ? '429' : `${upstream.latency}ms` }}</span>
        </button>
      </div>
    </div>

    <div class="fo-log fx-panel fx-layer" style="--depth: 4">
      <header class="fo-log-head">
        <span class="lp-dot lp-dot-live" />
        {{ t('home.landing.features.routing.log') }}
        <span class="fx-tag">{{ t('home.landing.features.demo') }}</span>
      </header>
      <TransitionGroup tag="ul" name="fo-event" class="fo-events">
        <li v-for="event in events" :key="event.id" class="fo-event" :data-kind="event.kind">
          <span class="fo-event-time lp-mono">{{ event.time }}</span>
          <span class="fo-event-mark" />
          <span class="fo-event-text">{{ event.text }}</span>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { prefersReducedMotion, useInView } from './motion'

defineProps<{ siteLogo: string }>()

const { t } = useI18n()

interface Upstream {
  id: string
  latency: number
  down: boolean
  /** 故障发生的先后，恢复时先恢复最早坏的那条 */
  downAt: number
}

interface RouteEvent {
  id: number
  kind: 'down' | 'switch' | 'up' | 'blocked'
  time: string
  text: string
}

// 一行的高度加行距，高亮框据此滑动
const ROW_STEP = 62
const AUTOPLAY_MS = 4200
const USER_PAUSE_MS = 9000
const MAX_EVENTS = 4

const upstreams = ref<Upstream[]>([
  { id: 'A', latency: 312, down: false, downAt: 0 },
  { id: 'B', latency: 356, down: false, downAt: 0 },
  { id: 'C', latency: 298, down: false, downAt: 0 }
])

// 调度规则在演示里简化为“按顺位取第一条健康线路”
const activeIndex = computed(() => upstreams.value.findIndex((upstream) => !upstream.down))

const pad = (value: number) => String(value).padStart(2, '0')
const clock = () => {
  const now = new Date()
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

const upstreamName = (upstream: Upstream) => `${t('home.landing.features.routing.upstream')} ${upstream.id}`

let nextEventId = 0
let downCounter = 0
const events = ref<RouteEvent[]>([])

function log(kind: RouteEvent['kind'], text: string) {
  events.value = [{ id: nextEventId++, kind, time: clock(), text }, ...events.value].slice(0, MAX_EVENTS)
}

// 初始放一条“当前线路”的记录，日志区不至于空着
log('switch', t('home.landing.features.routing.evSwitch', { name: upstreamName(upstreams.value[0]) }))

let pausedUntil = 0

function toggle(index: number, fromUser: boolean) {
  const upstream = upstreams.value[index]
  const before = activeIndex.value
  upstream.down = !upstream.down

  if (upstream.down) {
    upstream.downAt = ++downCounter
    log('down', t('home.landing.features.routing.evDown', { name: upstreamName(upstream) }))
  } else {
    upstream.latency = Math.round(260 + Math.random() * 140)
    log('up', t('home.landing.features.routing.evUp', { name: upstreamName(upstream) }))
  }

  const after = activeIndex.value
  if (after === -1) {
    log('blocked', t('home.landing.features.routing.evBlocked'))
  } else if (after !== before) {
    log('switch', t('home.landing.features.routing.evSwitch', { name: upstreamName(upstreams.value[after]) }))
  }

  if (fromUser) pausedUntil = Date.now() + USER_PAUSE_MS
}

// 自动演示：没有故障就让当前线路坏一次；有故障就把最早坏的那条恢复
function autoStep() {
  if (Date.now() < pausedUntil) return
  const broken = upstreams.value
    .map((upstream, index) => ({ upstream, index }))
    .filter(({ upstream }) => upstream.down)
    .sort((a, b) => a.upstream.downAt - b.upstream.downAt)
  if (broken.length > 0) toggle(broken[0].index, false)
  else if (activeIndex.value !== -1) toggle(activeIndex.value, false)
}

const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef)
let autoplay: ReturnType<typeof setInterval> | undefined

watch(
  inView,
  (visible) => {
    clearInterval(autoplay)
    if (visible && !prefersReducedMotion()) autoplay = setInterval(autoStep, AUTOPLAY_MS)
  },
  { immediate: true }
)

onBeforeUnmount(() => clearInterval(autoplay))
</script>

<style scoped>
.fo {
  --row: 50px;
  --gap: 12px;
  --stub: 24px;

  display: flex;
  height: 100%;
  flex-direction: column;
}

/* ---- 拓扑：应用 → 网关 → 三条上游 ---- */

.fo-diagram {
  display: grid;
  grid-template-columns: auto minmax(14px, 1fr) auto minmax(14px, 0.7fr) minmax(0, 2.4fr);
  align-items: center;
  margin-top: 20px;
}

.fo-source {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding-inline: 12px;
  border: 1px solid var(--lp-line-strong);
  border-radius: 9999px;
  background-color: var(--lp-card-solid);
  box-shadow: var(--lp-shadow);
  font-size: 13px;
  white-space: nowrap;
  color: var(--lp-text);
}

/* 连线：平时是一条发丝线，有流量时一小段光沿线滑过 */
.fo-wire {
  position: relative;
  height: 1px;
  overflow: hidden;
  background-color: var(--lp-line-strong);
}

.fo-wire::after,
.fo-up-stub::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--lp-accent) 50%, transparent);
  transform: translateX(-100%);
}

.fo-wire.is-flowing::after {
  animation: fo-flow 1.3s linear infinite;
}

.fo-wire-out.is-flowing::after {
  animation-delay: 0.35s;
}

@keyframes fo-flow {
  to {
    transform: translateX(100%);
  }
}

.fo-gateway {
  position: relative;
  display: flex;
  width: 62px;
  height: 62px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--lp-accent) 45%, transparent);
  border-radius: 20px;
  background-color: var(--lp-card-solid);
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--lp-accent) 9%, transparent),
    var(--lp-shadow);
  transition:
    transform 0.7s var(--lp-ease-spring),
    border-color 0.4s ease,
    box-shadow 0.4s ease;
}

.fo-gateway img {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: contain;
}

.fo-gateway-pulse {
  position: absolute;
  inset: -1px;
  border: 1px solid var(--lp-accent);
  border-radius: inherit;
  animation: fo-pulse 2.6s var(--lp-ease-out) infinite;
}

@keyframes fo-pulse {
  from {
    opacity: 0.6;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* 全部线路不可用时，网关变成警示色 */
.fo-diagram.is-blocked .fo-gateway {
  border-color: var(--lp-warn);
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--lp-warn) 14%, transparent),
    var(--lp-shadow);
}

.fo-diagram.is-blocked .fo-gateway-pulse {
  border-color: var(--lp-warn);
}

/* ---- 上游线路 ---- */

.fo-ups {
  position: relative;
  display: grid;
  gap: var(--gap);
  padding-left: var(--stub);
}

/* 竖向的母线：从第一行中线到最后一行中线 */
.fo-ups::before {
  content: '';
  position: absolute;
  top: calc(var(--row) / 2);
  bottom: calc(var(--row) / 2);
  left: 0;
  width: 1px;
  background-color: var(--lp-line-strong);
}

.fo-ring {
  position: absolute;
  top: 0;
  right: 0;
  left: var(--stub);
  height: var(--row);
  border: 1px solid color-mix(in srgb, var(--lp-accent) 60%, transparent);
  border-radius: 14px;
  background-color: color-mix(in srgb, var(--lp-accent) 9%, transparent);
  box-shadow: 0 10px 26px -14px var(--lp-accent);
  transition:
    transform 0.65s var(--lp-ease-spring),
    opacity 0.3s ease;
  pointer-events: none;
}

.fo-ring.is-hidden {
  opacity: 0;
}

.fo-up {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  height: var(--row);
  padding-inline: 14px;
  border: 1px solid var(--lp-line);
  border-radius: 14px;
  background-color: var(--lp-inset);
  font-size: 13px;
  text-align: left;
  color: var(--lp-text-2);
  cursor: pointer;
  transition:
    transform 0.5s var(--lp-ease-spring),
    border-color 0.3s ease,
    background-color 0.3s ease,
    color 0.3s ease,
    opacity 0.3s ease;
}

.fo-up:hover {
  border-color: var(--lp-line-strong);
  transform: translateX(3px);
}

.fo-up:active {
  transform: scale(0.97);
  transition-duration: 0.1s;
}

.fo-up:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 2px;
}

/* 当前线路的描边与底色交给滑动的高亮框，自身保持透明 */
.fo-up.is-active {
  border-color: transparent;
  background-color: transparent;
  color: var(--lp-text);
}

.fo-up.is-down {
  border-style: dashed;
  opacity: 0.62;
}

/* 母线到每一行的短横线 */
.fo-up-stub {
  position: absolute;
  top: 50%;
  left: calc(var(--stub) * -1 - 1px);
  width: var(--stub);
  height: 1px;
  overflow: hidden;
  background-color: var(--lp-line-strong);
}

.fo-up.is-active .fo-up-stub::after {
  animation: fo-flow 1.3s linear 0.6s infinite;
}

.fo-up.is-down .fo-up-stub {
  background: repeating-linear-gradient(90deg, var(--lp-warn) 0 4px, transparent 4px 8px);
}

.fo-up-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background-color: var(--lp-good);
  transition: background-color 0.3s ease;
}

.fo-up.is-down .fo-up-dot {
  background-color: var(--lp-warn);
}

.fo-up-name {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fo-up-meta {
  font-size: 12px;
  color: var(--lp-text-3);
  font-variant-numeric: tabular-nums;
}

/* ---- 事件日志：贴着卡片底边 ---- */

.fo-log {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin-top: 24px;
  overflow: hidden;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
}

.fo-log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  flex-shrink: 0;
  padding-inline: 14px;
  border-bottom: 1px solid var(--lp-line);
  font-size: 12px;
  color: var(--lp-text-3);
}

.fo-log-head .fx-tag {
  margin-left: auto;
}

.fo-events {
  position: relative;
  min-height: 0;
  flex: 1;
  padding-block: 4px;
  -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent);
  mask-image: linear-gradient(to bottom, #000 55%, transparent);
}

.fo-event {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  height: 34px;
  padding-inline: 14px;
  font-size: 12.5px;
  color: var(--lp-text-2);
}

.fo-event-time {
  font-size: 11.5px;
  color: var(--lp-text-3);
  font-variant-numeric: tabular-nums;
}

.fo-event-mark {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--lp-accent);
}

.fo-event[data-kind='down'] .fo-event-mark,
.fo-event[data-kind='blocked'] .fo-event-mark {
  background-color: var(--lp-warn);
}

.fo-event[data-kind='up'] .fo-event-mark {
  background-color: var(--lp-good);
}

.fo-event-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fo-event-move {
  transition: transform 0.55s var(--lp-ease-spring);
}

.fo-event-enter-active {
  transition:
    opacity 0.35s ease,
    transform 0.55s var(--lp-ease-spring);
}

.fo-event-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.fo-event-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: opacity 0.2s ease;
}

.fo-event-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  .fo {
    --stub: 14px;
  }

  /* 窄屏上把宽度尽量让给右侧的线路列表，线路名才放得下 */
  .fo-diagram {
    grid-template-columns: auto 12px auto 12px minmax(0, 1fr);
  }

  .fo-gateway {
    width: 52px;
    height: 52px;
    border-radius: 17px;
  }

  .fo-gateway img {
    width: 30px;
    height: 30px;
  }

  .fo-up {
    gap: 8px;
    padding-inline: 10px;
  }

  .fo-source span {
    display: none;
  }

  .fo-source {
    padding-inline: 11px;
  }
}
</style>
