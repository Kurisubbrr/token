<template>
  <!-- 一把密钥调用所有模型：点任意模型，就用同一把密钥发起一次调用，记录落进下方列表 -->
  <div ref="rootRef" class="keys">
    <div class="keys-key fx-layer" :class="{ 'is-firing': firing }" style="--depth: 9">
      <span class="keys-key-icon"><Icon name="key" size="sm" :stroke-width="1.9" /></span>
      <code class="lp-mono">sk-<span class="keys-key-mask">••••••••••••</span>3f9a</code>
      <span class="fx-tag">{{ t('home.landing.features.oneKey.yourKey') }}</span>
    </div>

    <p class="fx-hint keys-hint">{{ t('home.landing.features.oneKey.hint') }}</p>

    <div class="keys-models" role="group" :aria-label="t('home.landing.features.oneKey.hint')">
      <button
        v-for="model in models"
        :key="model.id"
        type="button"
        class="keys-model"
        :class="{ 'is-active': model.id === lastModelId }"
        @click="fire(model, true)"
      >
        <span class="fx-icon"><ModelIcon :model="model.icon" size="14px" /></span>
        {{ model.label }}
      </button>
    </div>

    <div class="keys-log fx-panel fx-layer" style="--depth: 4">
      <header class="keys-log-head">
        <span class="lp-dot lp-dot-live" />
        {{ t('home.landing.features.oneKey.log') }}
        <span class="fx-tag">{{ t('home.landing.features.demo') }}</span>
      </header>
      <TransitionGroup tag="ul" name="keys-row" class="keys-rows">
        <li v-for="call in calls" :key="call.id" class="keys-row" :data-state="call.state">
          <span class="fx-icon"><ModelIcon :model="call.icon" size="14px" /></span>
          <span class="keys-row-model lp-mono">{{ call.model }}</span>
          <span class="keys-row-endpoint lp-mono">{{ call.endpoint }}</span>
          <span class="keys-row-status lp-mono">
            <span v-if="call.state === 'pending'" class="fx-dots"><i /><i /><i /></span>
            <template v-else>
              <span class="keys-row-ok" />200
              <span class="keys-row-ms">{{ call.seconds }}s</span>
            </template>
          </span>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { prefersReducedMotion, useInView } from './motion'

const { t } = useI18n()

interface DemoModel {
  id: string
  label: string
  icon: string
  /** 该模型所属协议的入口路径 */
  endpoint: string
}

// 模型名取自后端支持的清单，路径对应各自的原生协议
const models: DemoModel[] = [
  { id: 'claude-sonnet-4-6', label: 'Claude', icon: 'claude', endpoint: '/v1/messages' },
  { id: 'gpt-5.5', label: 'GPT', icon: 'gpt', endpoint: '/v1/chat/completions' },
  { id: 'gemini-2.5-pro', label: 'Gemini', icon: 'gemini', endpoint: '/v1beta/models' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek', icon: 'deepseek', endpoint: '/v1/chat/completions' },
  { id: 'grok-4.6', label: 'Grok', icon: 'grok', endpoint: '/v1/responses' },
  { id: 'kimi-k3', label: 'Kimi', icon: 'kimi', endpoint: '/v1/chat/completions' },
  { id: 'glm-5.3', label: 'GLM', icon: 'glm', endpoint: '/v1/chat/completions' },
  { id: 'MiniMax-M3', label: 'MiniMax', icon: 'minimax', endpoint: '/v1/chat/completions' }
]

interface Call {
  id: number
  model: string
  icon: string
  endpoint: string
  state: 'pending' | 'done'
  seconds: string
}

const MAX_ROWS = 6
const AUTOPLAY_MS = 2400
const USER_PAUSE_MS = 7000

let nextId = 0
const seed = (model: DemoModel, seconds: string): Call => ({
  id: nextId++,
  model: model.id,
  icon: model.icon,
  endpoint: model.endpoint,
  state: 'done',
  seconds
})

const calls = ref<Call[]>([seed(models[1], '0.61'), seed(models[0], '0.48')])
const lastModelId = ref(models[1].id)
const firing = ref(false)

const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef)

const pending = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, delay: number) {
  const handle = setTimeout(() => {
    pending.delete(handle)
    fn()
  }, delay)
  pending.add(handle)
}

let autoplayCursor = 2
let pausedUntil = 0
let autoplay: ReturnType<typeof setInterval> | undefined

function fire(model: DemoModel, fromUser: boolean) {
  const id = nextId++
  const call: Call = {
    id,
    model: model.id,
    icon: model.icon,
    endpoint: model.endpoint,
    state: 'pending',
    seconds: ''
  }
  calls.value = [call, ...calls.value].slice(0, MAX_ROWS)
  lastModelId.value = model.id

  // 密钥“亮”一下，表示这次调用用的还是它
  firing.value = true
  later(() => {
    firing.value = false
  }, 520)

  // 演示用的随机耗时，仅为了让列表有先后完成的节奏
  const elapsed = 320 + Math.random() * 620
  later(() => {
    const settled = calls.value.find((item) => item.id === id)
    if (!settled) return
    settled.state = 'done'
    settled.seconds = (elapsed / 1000).toFixed(2)
  }, elapsed)

  if (fromUser) pausedUntil = Date.now() + USER_PAUSE_MS
}

watch(
  inView,
  (visible) => {
    clearInterval(autoplay)
    if (!visible || prefersReducedMotion()) return
    autoplay = setInterval(() => {
      // 用户刚点过就先让一让，别抢着往列表里塞
      if (Date.now() < pausedUntil) return
      fire(models[autoplayCursor % models.length], false)
      autoplayCursor += 1
    }, AUTOPLAY_MS)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearInterval(autoplay)
  pending.forEach(clearTimeout)
})
</script>

<style scoped>
.keys {
  display: flex;
  height: 100%;
  flex-direction: column;
}

/* ---- 密钥 ---- */

.keys-key {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 10px;
  height: 44px;
  padding: 0 12px 0 6px;
  border: 1px solid var(--lp-line-strong);
  border-radius: 14px;
  background-color: var(--lp-card-solid);
  box-shadow: var(--lp-shadow);
  font-size: 13.5px;
  color: var(--lp-text);
  transition:
    transform 0.7s var(--lp-ease-spring),
    border-color 0.3s ease,
    box-shadow 0.5s ease;
}

.keys-key.is-firing {
  border-color: var(--lp-accent);
  box-shadow:
    0 0 0 5px color-mix(in srgb, var(--lp-accent) 16%, transparent),
    var(--lp-shadow);
}

.keys-key-icon {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(145deg, var(--lp-accent), var(--lp-accent-2));
  color: #fff;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.35);
  transition: transform 0.5s var(--lp-ease-spring);
}

.keys-key.is-firing .keys-key-icon {
  transform: rotate(-18deg) scale(1.08);
}

.keys-key code,
.keys-key .fx-tag {
  white-space: nowrap;
}

.keys-key-mask {
  letter-spacing: 0.06em;
  color: var(--lp-text-3);
}

/* ---- 模型 ---- */

.keys-hint {
  margin-top: 16px;
}

.keys-models {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.keys-model {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 7px;
  border: 1px solid var(--lp-line);
  border-radius: 9999px;
  background-color: var(--lp-inset);
  font-size: 13px;
  font-weight: 500;
  color: var(--lp-text-2);
  transition:
    transform 0.5s var(--lp-ease-spring),
    border-color 0.25s ease,
    background-color 0.25s ease,
    color 0.25s ease,
    box-shadow 0.3s ease;
}

.keys-model:hover {
  border-color: var(--lp-line-strong);
  color: var(--lp-text);
  transform: translateY(-2px);
}

.keys-model:active {
  transform: scale(0.94);
  transition-duration: 0.1s;
}

.keys-model:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 2px;
}

.keys-model.is-active {
  border-color: color-mix(in srgb, var(--lp-accent) 55%, transparent);
  background-color: color-mix(in srgb, var(--lp-accent) 10%, transparent);
  color: var(--lp-text);
}

/* ---- 调用记录：贴着卡片底边，像一扇露出上半截的窗口 ---- */

.keys-log {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin-top: 20px;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
}

.keys-log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding-inline: 14px;
  border-bottom: 1px solid var(--lp-line);
  font-size: 12px;
  color: var(--lp-text-3);
}

.keys-log-head .fx-tag {
  margin-left: auto;
}

.keys-rows {
  position: relative;
  flex: 1;
  overflow: hidden;
  /* 最旧的记录在底部渐隐 */
  -webkit-mask-image: linear-gradient(to bottom, #000 62%, transparent);
  mask-image: linear-gradient(to bottom, #000 62%, transparent);
}

.keys-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1.1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding-inline: 14px;
  border-bottom: 1px solid var(--lp-line);
  font-size: 12px;
}

.keys-row-model {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lp-text);
}

.keys-row-endpoint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lp-text-3);
}

.keys-row-status {
  display: inline-flex;
  min-width: 82px;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: var(--lp-text-2);
  font-variant-numeric: tabular-nums;
}

.keys-row[data-state='pending'] .keys-row-status {
  color: var(--lp-accent);
}

.keys-row-ok {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--lp-good);
  animation: keys-ok 0.5s var(--lp-ease-spring) backwards;
}

@keyframes keys-ok {
  from {
    transform: scale(0);
  }
}

.keys-row-ms {
  color: var(--lp-text-3);
}

/* 新记录从顶部滑入，其余整体下移 */
.keys-row-move {
  transition: transform 0.6s var(--lp-ease-spring);
}

.keys-row-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.6s var(--lp-ease-spring),
    background-color 1.2s ease;
}

.keys-row-enter-from {
  opacity: 0;
  transform: translateY(-14px);
  background-color: color-mix(in srgb, var(--lp-accent) 14%, transparent);
}

.keys-row-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: opacity 0.25s ease;
}

.keys-row-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  /* 窄屏上模型排成可横向滑动的一行，把高度留给下面的调用记录 */
  .keys-models {
    flex-wrap: nowrap;
    margin-inline: -22px;
    padding-inline: 22px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .keys-models::-webkit-scrollbar {
    display: none;
  }

  .keys-model {
    flex-shrink: 0;
  }

  .keys-key {
    max-width: 100%;
  }

  .keys-key-mask {
    letter-spacing: 0;
  }

  .keys-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .keys-row-endpoint {
    display: none;
  }
}
</style>
