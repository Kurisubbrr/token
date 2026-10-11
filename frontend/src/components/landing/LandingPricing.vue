<template>
  <section id="pricing" ref="rootRef" class="lp-section pricing">
    <div class="lp-container">
      <header class="pricing-head">
        <p v-reveal class="lp-eyebrow">{{ t('home.landing.pricing.eyebrow') }}</p>
        <h2 v-reveal="80" class="lp-h2">{{ t('home.landing.pricing.title') }}</h2>
        <p v-reveal="160" class="lp-lead">{{ t('home.landing.pricing.lead') }}</p>
      </header>

      <!-- 计费公式：价格怎么算，一行说清 -->
      <div v-reveal="120" class="pricing-formula" role="img" :aria-label="formulaLabel">
        <template v-for="(term, index) in formula" :key="term">
          <span v-if="index" class="pricing-op" aria-hidden="true">{{ index === formula.length - 1 ? '=' : '×' }}</span>
          <span class="pricing-term" :class="{ 'is-result': index === formula.length - 1 }" :style="{ '--i': index }">
            {{ t(`home.landing.pricing.formula.${term}`) }}
          </span>
        </template>
      </div>

      <!-- 实时价目：数据来自后台的模型广场配置，只有管理员公开了才会出现 -->
      <div v-if="tabs.length" v-reveal v-spotlight class="pricing-board">
        <div class="lp-card pricing-card">
          <div ref="tabsRef" class="pricing-tabs" role="tablist">
            <span class="pricing-tab-indicator" :style="indicatorStyle" aria-hidden="true"></span>
            <button
              v-for="(tab, index) in tabs"
              :key="tab.group.id"
              type="button"
              role="tab"
              class="pricing-tab"
              :class="{ 'is-active': index === active }"
              :aria-selected="index === active"
              @click="active = index"
            >
              {{ tab.group.name }}
              <span class="pricing-tab-rate lp-mono">×{{ tab.rateLabel }}</span>
            </button>
          </div>

          <div class="pricing-table" role="table">
            <div class="pricing-row pricing-row-head" role="row">
              <span role="columnheader">{{ t('home.landing.pricing.model') }}</span>
              <span role="columnheader">{{ t('home.landing.pricing.input') }}</span>
              <span role="columnheader">{{ t('home.landing.pricing.output') }}</span>
            </div>
            <!-- 切换分组时整组重新入场 -->
            <div :key="current.group.id" role="rowgroup">
              <div
                v-for="(row, index) in current.rows"
                :key="row.name"
                class="pricing-row pricing-row-item"
                role="row"
                :style="{ '--i': index }"
              >
                <span class="pricing-model" role="cell">
                  <span class="fx-icon"><ModelIcon :model="row.name" size="14px" /></span>
                  <span class="lp-mono">{{ row.name }}</span>
                </span>
                <span class="pricing-price lp-mono" role="cell">{{ row.input }}</span>
                <span class="pricing-price lp-mono" role="cell">{{ row.output }}</span>
              </div>
            </div>
          </div>

          <footer class="pricing-foot">
            <span>{{ t('home.landing.pricing.unit') }}</span>
            <router-link v-if="showModelPlaza" to="/model-plaza" class="pricing-more">
              {{ t('home.landing.pricing.viewAll', { count: current.total }) }}
              <Icon name="arrowRight" size="sm" :stroke-width="2" />
            </router-link>
          </footer>
        </div>
      </div>

      <!-- 计费方式的三点说明 -->
      <ul v-spotlight class="pricing-facts">
        <li v-for="(fact, index) in facts" :key="fact.key" v-reveal="index * 90" class="lp-card pricing-fact">
          <span class="pricing-fact-icon"><Icon :name="fact.icon" size="md" /></span>
          <h3>{{ t(`home.landing.pricing.facts.${fact.key}.title`) }}</h3>
          <p>{{ t(`home.landing.pricing.facts.${fact.key}.desc`) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { IconName } from '@/components/icons/iconSet'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { modelPlazaAPI, type ModelPlazaGroup } from '@/api/modelPlaza'
import { BILLING_MODE_TOKEN } from '@/constants/channel'
import { formatScaled } from '@/utils/pricing'
import { useInView, vReveal, vSpotlight } from './motion'

const props = defineProps<{
  /** 模型广场已开启且允许匿名访问：只有这时才去取价目 */
  publicPricing: boolean
  showModelPlaza: boolean
}>()

const { t } = useI18n()

const formula = ['price', 'rate', 'usage', 'cost'] as const
const formulaLabel = computed(() =>
  formula.map((term) => t(`home.landing.pricing.formula.${term}`)).join(' · ')
)

const facts: { key: string; icon: IconName }[] = [
  { key: 'token', icon: 'calculator' },
  { key: 'rate', icon: 'layers' },
  { key: 'records', icon: 'receipt' }
]

// ---- 实时价目 ----

const MAX_GROUPS = 6
const MAX_ROWS = 8
const PER_MILLION = 1_000_000

const groups = ref<ModelPlazaGroup[]>([])
const active = ref(0)

/** 与模型广场同一口径：实付价 = 渠道单价 × 生效倍率，按每百万 Token 展示 */
function paid(value: number | null | undefined, rate: number): string {
  return value == null ? '—' : formatScaled(value * rate, PER_MILLION, 2)
}

const tabs = computed(() =>
  groups.value
    .map((group) => {
      const rate = group.user_rate_multiplier ?? group.rate_multiplier
      // 首页只列按 Token 计费、且标了价的模型；按次、按张计费的在模型广场里看
      const priced = group.models.filter(
        (model) =>
          model.pricing &&
          (model.pricing.billing_mode || BILLING_MODE_TOKEN) === BILLING_MODE_TOKEN &&
          (model.pricing.input_price != null || model.pricing.output_price != null)
      )
      return {
        group,
        // 倍率去掉浮点尾巴（0.30000000000000004 → 0.3）
        rateLabel: String(Math.round(rate * 1000) / 1000),
        total: group.models.length,
        rows: priced.slice(0, MAX_ROWS).map((model) => ({
          name: model.name,
          input: paid(model.pricing?.input_price, rate),
          output: paid(model.pricing?.output_price, rate)
        }))
      }
    })
    .filter((tab) => tab.rows.length > 0)
    .slice(0, MAX_GROUPS)
)

const current = computed(() => tabs.value[Math.min(active.value, tabs.value.length - 1)])

// 当前分组下方的底块：点到哪一组就滑到哪一组
const tabsRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref<Record<string, string>>({ opacity: '0' })

function syncIndicator() {
  const el = tabsRef.value?.querySelector<HTMLElement>('.pricing-tab.is-active')
  if (!el) return
  indicatorStyle.value = {
    width: `${el.offsetWidth}px`,
    transform: `translate3d(${el.offsetLeft}px, 0, 0)`,
    opacity: '1'
  }
}

watch([active, tabs], () => void nextTick(syncIndicator), { flush: 'post' })

// 滚到这一区才去取数据；首页大部分访客不会滚到这里，也就不必多一次请求
const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef, '200px')
let requested = false

watch(
  [inView, () => props.publicPricing],
  async ([visible, enabled]) => {
    if (!visible || !enabled || requested) return
    requested = true
    try {
      groups.value = (await modelPlazaAPI.getModelPlaza()).groups ?? []
    } catch {
      // 取不到价目（开关关了、网络问题）就只展示计费说明，不打扰访客
      groups.value = []
    }
  },
  { immediate: true }
)

onMounted(() => window.addEventListener('resize', syncIndicator))
onBeforeUnmount(() => window.removeEventListener('resize', syncIndicator))
</script>

<style scoped>
.pricing-head {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
}

.pricing-head .lp-lead {
  margin-top: 16px;
}

/* ---- 计费公式 ---- */

.pricing-formula {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px 14px;
  margin-top: 40px;
}

.pricing-term {
  padding: 10px 18px;
  border: 1px solid var(--lp-line);
  border-radius: 9999px;
  background: var(--lp-card);
  font-size: 15px;
  font-weight: 500;
  box-shadow: var(--lp-shadow);
  transition:
    transform 0.5s var(--lp-ease-spring),
    border-color 0.3s ease;
}

.pricing-term:hover {
  border-color: var(--lp-line-strong);
  transform: translateY(-3px);
}

.pricing-term.is-result {
  border-color: transparent;
  background: var(--lp-cta-bg);
  color: var(--lp-cta-text);
}

.pricing-op {
  color: var(--lp-text-3);
  font-size: 18px;
}

/* ---- 价目表 ---- */

.pricing-board {
  max-width: 860px;
  margin: 48px auto 0;
}

.pricing-card {
  padding: 10px;
  border-radius: 22px;
}

.pricing-tabs {
  position: relative;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px;
  border-radius: 14px;
  background: var(--lp-inset);
  scrollbar-width: none;
}

.pricing-tabs::-webkit-scrollbar {
  display: none;
}

.pricing-tab-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  border-radius: 10px;
  background: var(--lp-card-solid);
  box-shadow: var(--lp-shadow);
  transition:
    transform 0.5s var(--lp-ease-spring),
    width 0.5s var(--lp-ease-spring),
    opacity 0.2s ease;
}

.pricing-tab {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  color: var(--lp-text-2);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.pricing-tab:hover,
.pricing-tab.is-active {
  color: var(--lp-text);
}

.pricing-tab-rate {
  color: var(--lp-text-3);
  font-size: 12px;
}

.pricing-table {
  padding: 6px 8px 0;
}

.pricing-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 96px;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  border-radius: 12px;
  font-size: 14px;
}

@media (min-width: 640px) {
  .pricing-row {
    grid-template-columns: minmax(0, 1fr) 140px 140px;
    padding-inline: 14px;
  }
}

.pricing-row-head {
  color: var(--lp-text-3);
  font-size: 12px;
}

.pricing-row > :not(:first-child) {
  text-align: right;
}

.pricing-row-item {
  transition: background-color 0.2s ease;
  animation: pricing-row-in 0.6s var(--lp-ease-out) backwards;
  animation-delay: calc(var(--i) * 45ms);
}

.pricing-row-item:hover {
  background: var(--lp-inset);
}

@keyframes pricing-row-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.pricing-model {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.pricing-model > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pricing-price {
  color: var(--lp-text);
  font-variant-numeric: tabular-nums;
}

.pricing-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 6px;
  padding: 14px 18px;
  border-top: 1px solid var(--lp-line);
  color: var(--lp-text-3);
  font-size: 13px;
}

.pricing-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--lp-text);
  font-weight: 500;
}

.pricing-more :deep(svg) {
  transition: transform 0.4s var(--lp-ease-spring);
}

.pricing-more:hover :deep(svg) {
  transform: translateX(4px);
}

/* ---- 三点说明 ---- */

.pricing-facts {
  display: grid;
  gap: 16px;
  margin-top: 48px;
}

@media (min-width: 768px) {
  .pricing-facts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.pricing-fact {
  padding: 26px 24px;
  border-radius: 20px;
}

.pricing-fact-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--lp-line);
  border-radius: 12px;
  background: var(--lp-inset);
  color: var(--lp-accent);
  transition: transform 0.5s var(--lp-ease-spring);
}

.pricing-fact:hover .pricing-fact-icon {
  transform: translateY(-3px) rotate(-6deg);
}

.pricing-fact h3 {
  margin-top: 18px;
  font-size: 17px;
  font-weight: 600;
}

.pricing-fact p {
  margin-top: 8px;
  color: var(--lp-text-2);
  font-size: 14px;
  line-height: 1.7;
}

@media (prefers-reduced-motion: reduce) {
  .pricing-row-item {
    animation: none;
  }

  .pricing-term,
  .pricing-tab-indicator {
    transition: none;
  }
}
</style>
