<template>
  <!-- 使用记录：每次调用落一行，点开任意一行能看到这笔费用是怎么由各类 Token 算出来的 -->
  <div
    ref="rootRef"
    class="usage"
    @pointerenter="hovering = true"
    @pointerleave="hovering = false"
  >
    <div class="usage-summary fx-layer" style="--depth: 8">
      <div>
        <p class="usage-label">
          {{ t('home.landing.features.billing.today') }}
          <span class="fx-tag">{{ t('home.landing.features.billing.sample') }}</span>
        </p>
        <p class="usage-total">
          <span class="usage-currency">$</span>
          <RollingNumber :value="total.toFixed(4)" />
        </p>
      </div>
      <!-- 最近几次调用的费用，最新一根用强调色 -->
      <TransitionGroup tag="div" name="usage-bar" class="usage-bars" aria-hidden="true">
        <span
          v-for="(bar, index) in bars"
          :key="bar.id"
          class="usage-bar"
          :class="{ 'is-latest': index === bars.length - 1 }"
          :style="{ height: `${bar.height}%` }"
        />
      </TransitionGroup>
    </div>

    <p class="fx-hint usage-hint">{{ t('home.landing.features.billing.hint') }}</p>

    <div class="usage-table fx-panel fx-layer" style="--depth: 4">
      <TransitionGroup tag="ul" name="usage-row" class="usage-rows">
        <li
          v-for="row in rows"
          :key="row.id"
          class="usage-row"
          :class="{ 'is-open': openId === row.id }"
        >
          <button
            type="button"
            class="usage-row-main"
            :aria-expanded="openId === row.id"
            @click="openId = openId === row.id ? null : row.id"
          >
            <span class="fx-icon"><ModelIcon :model="row.icon" size="14px" /></span>
            <span class="usage-row-model lp-mono">{{ row.model }}</span>
            <span class="usage-row-tokens lp-mono">{{ formatTokens(row.input + row.output + row.cache) }}</span>
            <span class="usage-row-cost lp-mono">${{ row.cost.toFixed(4) }}</span>
            <Icon name="chevronDown" size="xs" :stroke-width="2" class="usage-row-caret" />
          </button>
          <!-- 用 grid 的 0fr → 1fr 做高度过渡，展开收起都顺滑 -->
          <div class="usage-row-detail">
            <dl>
              <div v-for="part in breakdown(row)" :key="part.key">
                <dt>{{ t(`home.landing.features.billing.${part.key}`) }}</dt>
                <dd class="lp-mono">
                  <span>{{ formatTokens(part.tokens) }} tokens</span>
                  <span class="usage-row-sub">${{ part.cost.toFixed(4) }}</span>
                </dd>
              </div>
            </dl>
          </div>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import RollingNumber from '@/components/common/RollingNumber.vue'
import { prefersReducedMotion, useInView } from './motion'

const { t } = useI18n()

interface UsageRow {
  id: number
  model: string
  icon: string
  input: number
  output: number
  cache: number
  cost: number
}

const catalog = [
  { model: 'claude-sonnet-4-6', icon: 'claude' },
  { model: 'gpt-5.5', icon: 'gpt' },
  { model: 'gemini-2.5-pro', icon: 'gemini' },
  { model: 'deepseek-v4-pro', icon: 'deepseek' },
  { model: 'grok-4.6', icon: 'grok' },
  { model: 'glm-5.3', icon: 'glm' }
]

// 示意用的折算比例（每百万 Token 的美元数），只为让三类 Token 和总价能对得上，
// 不代表本站任何模型的实际价格
const RATE = { input: 3, output: 15, cache: 0.3 } as const
const MAX_ROWS = 6
const MAX_BARS = 12
const AUTOPLAY_MS = 2800

const partCost = (tokens: number, rate: number) => (tokens * rate) / 1_000_000

let nextId = 0
function makeRow(index: number, input: number, output: number, cache: number): UsageRow {
  const entry = catalog[index % catalog.length]
  return {
    id: nextId++,
    ...entry,
    input,
    output,
    cache,
    cost: partCost(input, RATE.input) + partCost(output, RATE.output) + partCost(cache, RATE.cache)
  }
}

const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

const rows = ref<UsageRow[]>([
  makeRow(1, 1840, 412, 2048),
  makeRow(0, 1284, 356, 4096),
  makeRow(2, 960, 688, 0),
  makeRow(3, 2210, 240, 5120)
])

// 今日合计从一个示例底数起步，之后每来一行就累加
const total = ref(0.3962 + rows.value.reduce((sum, row) => sum + row.cost, 0))

const toBar = (row: UsageRow) => ({ id: row.id, height: Math.min(100, Math.max(14, (row.cost / 0.026) * 100)) })
const bars = ref([0.008, 0.013, 0.006, 0.017, 0.011, 0.009, 0.015, 0.012].map((cost, index) => ({
  id: -index - 1,
  height: Math.min(100, Math.max(14, (cost / 0.026) * 100))
})).concat([...rows.value].reverse().map(toBar)))

const openId = ref<number | null>(null)
const hovering = ref(false)

const formatTokens = (value: number) => value.toLocaleString('en-US')

function breakdown(row: UsageRow) {
  return [
    { key: 'input', tokens: row.input, cost: partCost(row.input, RATE.input) },
    { key: 'output', tokens: row.output, cost: partCost(row.output, RATE.output) },
    { key: 'cache', tokens: row.cache, cost: partCost(row.cache, RATE.cache) }
  ]
}

let cursor = 4
function addRow() {
  const row = makeRow(cursor++, between(380, 2400), between(120, 980), between(0, 6200))
  rows.value = [row, ...rows.value].slice(0, MAX_ROWS)
  bars.value = [...bars.value, toBar(row)].slice(-MAX_BARS)
  total.value += row.cost
}

const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef)
// 正在看明细或指针停在上面时不再往里加行，免得内容自己跑掉
const idle = computed(() => !hovering.value && openId.value === null)
let autoplay: ReturnType<typeof setInterval> | undefined

watch(
  inView,
  (visible) => {
    clearInterval(autoplay)
    if (!visible || prefersReducedMotion()) return
    autoplay = setInterval(() => {
      if (idle.value) addRow()
    }, AUTOPLAY_MS)
  },
  { immediate: true }
)

onBeforeUnmount(() => clearInterval(autoplay))
</script>

<style scoped>
.usage {
  display: flex;
  height: 100%;
  flex-direction: column;
}

/* ---- 今日合计 ---- */

.usage-summary {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.usage-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--lp-text-3);
}

.usage-total {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-top: 8px;
  font-size: 38px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--lp-text);
}

.usage-currency {
  font-size: 0.55em;
  color: var(--lp-text-3);
}

.usage-bars {
  position: relative;
  display: flex;
  width: 46%;
  max-width: 190px;
  height: 52px;
  align-items: flex-end;
  gap: 2px;
}

/* 数据端圆角、基线端方角；往期用弱化色，最新一根用强调色 */
.usage-bar {
  flex: 1;
  max-width: 16px;
  border-radius: 3px 3px 0 0;
  background-color: color-mix(in srgb, var(--lp-accent) 28%, transparent);
  transform-origin: bottom;
  transition: background-color 0.5s ease;
}

.usage-bar.is-latest {
  background-color: var(--lp-accent);
}

.usage-bar-move {
  transition: transform 0.7s var(--lp-ease-spring);
}

.usage-bar-enter-active {
  transition:
    transform 0.7s var(--lp-ease-spring),
    opacity 0.4s ease;
}

.usage-bar-enter-from {
  opacity: 0;
  transform: scaleY(0);
}

.usage-bar-leave-active {
  position: absolute;
  transition: opacity 0.25s ease;
}

.usage-bar-leave-to {
  opacity: 0;
}

.usage-hint {
  margin-top: 18px;
}

/* ---- 记录表：贴着卡片底边 ---- */

.usage-table {
  min-height: 0;
  flex: 1;
  margin-top: 10px;
  overflow: hidden;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
}

.usage-rows {
  position: relative;
  height: 100%;
  -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent);
  mask-image: linear-gradient(to bottom, #000 70%, transparent);
}

.usage-row {
  border-bottom: 1px solid var(--lp-line);
  transition: background-color 0.3s ease;
}

.usage-row.is-open {
  background-color: color-mix(in srgb, var(--lp-accent) 6%, transparent);
}

.usage-row-main {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding-inline: 14px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.usage-row-main:hover {
  background-color: var(--lp-inset);
}

.usage-row-main:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: -2px;
}

.usage-row-model {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lp-text);
}

.usage-row-tokens {
  color: var(--lp-text-3);
  font-variant-numeric: tabular-nums;
}

.usage-row-cost {
  min-width: 62px;
  text-align: right;
  color: var(--lp-text);
  font-variant-numeric: tabular-nums;
}

.usage-row-caret {
  color: var(--lp-text-3);
  transition: transform 0.45s var(--lp-ease-spring);
}

.usage-row.is-open .usage-row-caret {
  transform: rotate(180deg);
}

.usage-row-detail {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.5s var(--lp-ease-spring);
}

.usage-row.is-open .usage-row-detail {
  grid-template-rows: 1fr;
}

.usage-row-detail > dl {
  min-height: 0;
  overflow: hidden;
  padding-inline: 46px 14px;
}

.usage-row-detail dl > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 28px;
  font-size: 12px;
  color: var(--lp-text-2);
}

.usage-row-detail dl > div:last-child {
  margin-bottom: 8px;
}

.usage-row-detail dd {
  display: inline-flex;
  gap: 14px;
  color: var(--lp-text-3);
  font-variant-numeric: tabular-nums;
}

.usage-row-sub {
  min-width: 62px;
  text-align: right;
  color: var(--lp-text);
}

.usage-row-move {
  transition: transform 0.6s var(--lp-ease-spring);
}

.usage-row-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.6s var(--lp-ease-spring);
}

.usage-row-enter-from {
  opacity: 0;
  transform: translateY(-14px);
}

.usage-row-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: opacity 0.25s ease;
}

.usage-row-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  .usage-row-tokens {
    display: none;
  }

  .usage-row-main {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }

  .usage-row-detail > dl {
    padding-left: 14px;
  }
}
</style>
