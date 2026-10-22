<template>
  <div class="subscription-catalog" data-testid="subscription-catalog">
    <header class="catalog-header">
      <div>
        <div class="catalog-eyebrow">
          <span class="status-dot" aria-hidden="true"></span>
          {{ copy.eyebrow }}
        </div>
        <h1>{{ copy.title }}</h1>
        <p class="catalog-intro">{{ copy.intro }}</p>
      </div>
      <div class="catalog-header-actions"><slot name="actions" /></div>
    </header>

    <div class="catalog-navigation">
      <div ref="tabList" class="catalog-tabs" role="tablist" :aria-label="copy.tabsLabel">
        <button
          v-for="(tab, index) in tabs"
          :id="'catalog-tab-' + tab"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab"
          :aria-controls="'catalog-panel-' + tab"
          :tabindex="activeTab === tab ? 0 : -1"
          :class="{ 'is-active': activeTab === tab }"
          :data-testid="'catalog-tab-' + tab"
          @click="activeTab = tab"
          @keydown="handleTabKey($event, index)"
        >{{ tab === 'plans' ? copy.plansTab : copy.balanceTab }}</button>
      </div>
      <span class="catalog-availability">{{ copy.comingSoon }}</span>
    </div>

    <section
      v-if="activeTab === 'plans'"
      id="catalog-panel-plans"
      role="tabpanel"
      aria-labelledby="catalog-tab-plans"
    >
      <div class="plan-grid" role="radiogroup" :aria-label="copy.planSelection">
        <article
          v-for="(plan, index) in plans"
          :key="plan.id"
          class="plan-card card"
          :class="['plan-' + plan.id, { 'is-selected': selectedPlan === plan.id }]"
          :aria-labelledby="'catalog-plan-name-' + plan.id"
          :data-testid="'catalog-plan-' + plan.id"
        >
          <div class="plan-topline">
            <span class="plan-index" aria-hidden="true">PLAN 0{{ index + 1 }}</span>
            <svg class="plan-symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="38" height="38" rx="12" />
              <path class="symbol-line first" d="M12 26V18" />
              <path class="symbol-line second" d="M20 26V14" />
              <path class="symbol-line third" d="M28 26V10" />
            </svg>
          </div>
          <h2>
            <label class="plan-picker">
              <input
                v-model="selectedPlan"
                class="sr-only"
                type="radio"
                name="catalog-plan"
                :value="plan.id"
                :aria-label="copy.viewPlan + ' ' + plan.name"
                :data-testid="'catalog-select-' + plan.id"
              >
              <span :id="'catalog-plan-name-' + plan.id" class="plan-name">{{ plan.name }}</span>
              <span class="plan-selection" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none"><path d="m4 8 2.5 2.5L12 5" /></svg>
              </span>
            </label>
          </h2>
          <p class="plan-positioning">{{ copy.positions[plan.id] }}</p>
          <div class="plan-price">
            <span>{{ copy.priceComingSoon }}</span>
            <p>{{ copy.priceNote }}</p>
          </div>
          <dl class="plan-facts">
            <div><dt>{{ copy.quota }}</dt><dd>{{ copy.toBeAnnounced }}</dd></div>
            <div><dt>{{ copy.models }}</dt><dd>{{ copy.toBeAnnounced }}</dd></div>
            <div><dt>{{ copy.validity }}</dt><dd>{{ copy.toBeAnnounced }}</dd></div>
          </dl>
          <button type="button" class="catalog-purchase" disabled data-testid="catalog-purchase">
            {{ copy.comingSoon }}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></svg>
          </button>
          <p class="plan-disclaimer">{{ copy.benefitsDisclaimer }}</p>
        </article>
      </div>

      <div class="catalog-plan-tools">
        <p class="catalog-current-plan" role="status" aria-live="polite">
          <span class="selection-dot" aria-hidden="true"></span>
          {{ copy.viewing }} <strong>{{ selectedPlanName }}</strong>
          <span class="catalog-view-only">{{ copy.viewOnly }}</span>
        </p>
        <button
          type="button"
          class="catalog-compare-toggle"
          :aria-expanded="comparisonOpen"
          aria-controls="catalog-comparison"
          data-testid="catalog-compare-toggle"
          @click="comparisonOpen = !comparisonOpen"
        >
          {{ comparisonOpen ? copy.hideComparison : copy.comparePlans }}
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" :class="{ 'is-open': comparisonOpen }"><path d="m4 6 4 4 4-4" /></svg>
        </button>
      </div>

      <section v-if="comparisonOpen" id="catalog-comparison" class="catalog-comparison card" :aria-label="copy.comparePlans">
        <div class="comparison-scroll">
          <table>
            <caption class="sr-only">{{ copy.comparisonCaption }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ copy.planDetails }}</th>
                <th v-for="plan in plans" :key="plan.id" scope="col" :class="{ 'is-selected': selectedPlan === plan.id }">{{ plan.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisonRows" :key="row">
                <th scope="row">{{ copy[row] }}</th>
                <td v-for="plan in plans" :key="plan.id" :class="{ 'is-selected': selectedPlan === plan.id }">
                  {{ row === 'price' ? copy.toBeAnnounced : copy.benefitsPending }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="comparison-note">{{ copy.benefitsDisclaimer }}</p>
      </section>

      <div class="catalog-bottom-grid">
        <aside class="catalog-balance-note card">
          <span class="section-eyebrow">{{ copy.anotherWay }}</span>
          <h2>{{ copy.balanceTitle }}</h2>
          <p>{{ copy.balanceHint }}</p>
          <button type="button" class="catalog-text-link" @click="openBalance">
            {{ copy.viewBalance }}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></svg>
          </button>
        </aside>
        <section class="catalog-faq" :aria-label="copy.faqTitle">
          <h2>{{ copy.faqTitle }}</h2>
          <details v-for="faq in copy.faqs" :key="faq.question">
            <summary>
              {{ faq.question }}
              <span class="faq-plus" aria-hidden="true">+</span>
            </summary>
            <p>{{ faq.answer }}</p>
          </details>
        </section>
      </div>
    </section>

    <section
      v-else
      id="catalog-panel-balance"
      class="catalog-balance-panel card"
      role="tabpanel"
      aria-labelledby="catalog-tab-balance"
      data-testid="catalog-balance-panel"
    >
      <div class="balance-symbol" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none"><path d="M29 14V10H12a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h20V16H12a2 2 0 0 1 0-4" /><path d="M32 21h-8v6h8M26 24h1" /></svg>
      </div>
      <span class="section-eyebrow">{{ copy.balanceTab }}</span>
      <h2>{{ copy.balanceTitle }}</h2>
      <p>{{ copy.balanceDescription }}</p>
      <button type="button" class="catalog-purchase balance-purchase" disabled data-testid="catalog-recharge">
        {{ copy.balanceComingSoon }}
      </button>
      <button type="button" class="catalog-text-link" @click="openPlans">{{ copy.backToPlans }}</button>
    </section>

    <p class="catalog-footer">{{ copy.footer }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type PlanId = 'plus' | 'pro' | 'max'
type CatalogTab = 'plans' | 'balance'

const plans: ReadonlyArray<{ id: PlanId; name: string }> = [
  { id: 'plus', name: 'Plus' },
  { id: 'pro', name: 'Pro' },
  { id: 'max', name: 'Max' },
]
const tabs: CatalogTab[] = ['plans', 'balance']
const comparisonRows = ['price', 'quota', 'models', 'validity'] as const
const activeTab = ref<CatalogTab>('plans')
const selectedPlan = ref<PlanId>('plus')
const comparisonOpen = ref(false)
const tabList = ref<HTMLDivElement | null>(null)
const { locale } = useI18n()

// Read the existing global locale; copy stays local and works with the site's
// runtime-only vue-i18n build without introducing uncompiled message strings.
const messages = {
  zh: {
    eyebrow: '订阅计划 · 即将开放',
    title: '找到适合你的订阅。',
    intro: 'Plus、Pro、Max，三种选择。先了解方案，等正式开放后再决定。',
    tabsLabel: '选择订阅或余额充值',
    plansTab: '订阅计划',
    balanceTab: '余额充值',
    comingSoon: '即将开放',
    planSelection: '浏览订阅方案',
    viewPlan: '查看方案',
    positions: {
      plus: '适合日常体验与轻量使用。',
      pro: '适合持续创作与专业工作。',
      max: '适合高强度使用与进阶需求。',
    },
    priceComingSoon: '价格即将公布',
    priceNote: '定价与购买规则将在开放时说明',
    price: '订阅价格',
    quota: '使用额度',
    models: '支持模型',
    validity: '有效期',
    toBeAnnounced: '待公布',
    benefitsPending: '以正式发布为准',
    benefitsDisclaimer: '权益以正式发布为准',
    viewing: '正在查看',
    viewOnly: '仅浏览，不会开通订阅',
    comparePlans: '对比三档计划',
    hideComparison: '收起对比',
    comparisonCaption: 'Plus、Pro、Max 订阅方案信息，尚未公布的权益以正式发布为准',
    planDetails: '方案信息',
    anotherWay: '另一种选择',
    balanceTitle: '按需充值，灵活使用。',
    balanceHint: '更习惯按需使用？你仍可在这里了解余额充值。服务尚未开放。',
    viewBalance: '查看余额充值',
    balanceDescription: '充值服务尚未开放。具体充值规则与支付方式将在开放时说明。',
    balanceComingSoon: '充值即将开放',
    backToPlans: '返回订阅计划',
    faqTitle: '你可能想了解',
    faqs: [
      { question: '现在可以购买这些计划吗？', answer: '暂时还不能。Plus、Pro、Max 和余额充值均未开放购买，具体开放安排请留意站内公告。' },
      { question: '三档计划的价格和权益有什么区别？', answer: '价格、使用额度、支持模型与有效期尚未公布。完整方案以正式发布的信息为准。' },
      { question: '选择计划会立即开通或扣费吗？', answer: '选中方案仅便于浏览和比较，正式开放后才能购买。' },
      { question: '已有订阅和余额会受影响吗？', answer: '浏览此页不会修改已有订阅、账户余额或使用记录。你可以继续在原有页面查询。' },
    ],
    footer: '所有计划均待正式开放，当前页面仅供了解方案。',
  },
  en: {
    eyebrow: 'SUBSCRIPTIONS · COMING SOON',
    title: 'Find your next plan.',
    intro: 'Plus, Pro, or Max. Explore the options, then decide when subscriptions open.',
    tabsLabel: 'Choose subscriptions or balance top-up',
    plansTab: 'Subscriptions',
    balanceTab: 'Balance top-up',
    comingSoon: 'Coming soon',
    planSelection: 'Explore subscription plans',
    viewPlan: 'View plan',
    positions: {
      plus: 'For everyday exploration and lighter use.',
      pro: 'For ongoing creation and professional work.',
      max: 'For intensive use and advanced needs.',
    },
    priceComingSoon: 'Pricing coming soon',
    priceNote: 'Pricing and purchase terms will be shared at launch',
    price: 'Price',
    quota: 'Usage allowance',
    models: 'Supported models',
    validity: 'Validity',
    toBeAnnounced: 'To be announced',
    benefitsPending: 'To be confirmed at launch',
    benefitsDisclaimer: 'Benefits are subject to the official release',
    viewing: 'Viewing',
    viewOnly: 'Browsing only; no subscription is activated',
    comparePlans: 'Compare all plans',
    hideComparison: 'Hide comparison',
    comparisonCaption: 'Plus, Pro, and Max plan details. Unannounced benefits will be confirmed at launch.',
    planDetails: 'Plan details',
    anotherWay: 'ANOTHER OPTION',
    balanceTitle: 'Top up as needed. Use it your way.',
    balanceHint: 'Prefer topping up as needed? You can explore that option here. The service is not open yet.',
    viewBalance: 'Explore balance top-up',
    balanceDescription: 'Balance top-ups are not open yet. Top-up terms and payment methods will be shared when available.',
    balanceComingSoon: 'Top-ups coming soon',
    backToPlans: 'Back to subscriptions',
    faqTitle: 'A few useful answers',
    faqs: [
      { question: 'Can I purchase these plans now?', answer: 'Not yet. Plus, Pro, Max, and balance top-ups are not open for purchase. Watch for announcements on this site.' },
      { question: 'How do prices and benefits differ?', answer: 'Pricing, allowances, supported models, and validity have not been announced. The official release will confirm the full details.' },
      { question: 'Does selecting a plan activate it or charge me?', answer: 'Selecting a plan helps you browse and compare. Purchases will be available after launch.' },
      { question: 'Will this affect my existing subscriptions or balance?', answer: 'Browsing this page does not change subscriptions, account balances, or usage records. You can still check them on their existing pages.' },
    ],
    footer: 'Plans are not open for purchase. This page is for exploring the options.',
  },
} as const

const copy = computed(() => messages[locale.value.startsWith('zh') ? 'zh' : 'en'])
const selectedPlanName = computed(() => plans.find(plan => plan.id === selectedPlan.value)?.name ?? 'Plus')

function handleTabKey(event: KeyboardEvent, index: number) {
  let nextIndex: number
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
  else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = tabs.length - 1
  else return
  event.preventDefault()
  activeTab.value = tabs[nextIndex]
  tabList.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
}

function openBalance() {
  activeTab.value = 'balance'
  tabList.value?.querySelector<HTMLButtonElement>('#catalog-tab-balance')?.focus()
}

function openPlans() {
  activeTab.value = 'plans'
  tabList.value?.querySelector<HTMLButtonElement>('#catalog-tab-plans')?.focus()
}
</script>

<style scoped>
.subscription-catalog {
  --catalog-text: #111318;
  --catalog-muted: #687181;
  --catalog-soft: #9098a6;
  --catalog-accent-soft: rgb(59 91 253 / 0.065);
  max-width: 1160px;
  margin: 0 auto;
  color: var(--catalog-text);
}
:global(.dark) .subscription-catalog {
  --catalog-text: #f3f4f6;
  --catalog-muted: #9da5b4;
  --catalog-soft: #7c8595;
  --catalog-accent-soft: rgb(124 147 255 / 0.085);
}
.catalog-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding: 12px 0 30px; }
.catalog-eyebrow, .section-eyebrow { display: flex; align-items: center; gap: 8px; color: var(--app-accent); font-size: 11px; font-weight: 650; letter-spacing: .09em; }
.status-dot, .selection-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--app-accent); flex-shrink: 0; }
.status-dot { box-shadow: 0 0 0 4px var(--catalog-accent-soft); }
.catalog-header h1 { margin: 18px 0 12px; font-size: clamp(28px, 3.8vw, 42px); line-height: 1.22; font-weight: 700; letter-spacing: -.045em; }
.catalog-intro { max-width: 650px; color: var(--catalog-muted); font-size: 14px; line-height: 1.85; }
.catalog-header-actions { flex-shrink: 0; padding-top: 3px; }
.catalog-navigation { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--glass-divider); }
.catalog-tabs { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--glass-stroke); border-radius: 12px; background: var(--glass-field); }
.catalog-tabs button { padding: 9px 21px; border-radius: 8px; color: var(--catalog-muted); font-size: 13px; font-weight: 550; transition: color .18s, background .18s, box-shadow .18s; }
.catalog-tabs button.is-active { color: var(--catalog-text); background: var(--glass-surface-strong); box-shadow: var(--glass-shadow-sm); }
.catalog-tabs button:focus-visible, .catalog-text-link:focus-visible, .catalog-compare-toggle:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 4px; }
.catalog-availability { color: var(--catalog-soft); font-size: 12px; white-space: nowrap; }
.plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.plan-card { position: relative; display: flex; flex-direction: column; min-width: 0; padding: 25px 24px 20px; border-radius: 20px; border: 1px solid var(--glass-stroke); transition: border-color .2s, box-shadow .2s; }
.plan-card::before { content: ''; position: absolute; inset: 0 26px auto; height: 2px; border-radius: 0 0 3px 3px; background: var(--glass-stroke); }
.plan-pro::before { background: var(--app-accent); }
.plan-max::before { background: #98a1b3; }
.plan-card.is-selected { border-color: var(--app-accent); box-shadow: 0 0 0 1px var(--app-accent), var(--glass-shadow); }
.plan-pro { background-image: linear-gradient(155deg, var(--catalog-accent-soft), transparent 58%); }
.plan-topline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px; }
.plan-index { color: var(--catalog-soft); font-size: 9px; font-weight: 600; letter-spacing: .12em; }
.plan-symbol { width: 38px; height: 38px; color: var(--catalog-muted); }
.plan-symbol rect { fill: var(--glass-field); stroke: var(--glass-stroke); }
.symbol-line { stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.plan-plus .second, .plan-plus .third { opacity: .22; }
.plan-pro .plan-symbol { color: var(--app-accent); }
.plan-pro .third { opacity: .22; }
.plan-card h2 { margin: 0; }
.plan-picker { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; border-radius: 5px; }
.plan-picker:focus-within { outline: 2px solid var(--app-accent); outline-offset: 6px; }
.plan-name { font-size: 29px; font-weight: 650; letter-spacing: -.045em; line-height: 1.25; }
.plan-selection { display: flex; align-items: center; justify-content: center; width: 19px; height: 19px; border-radius: 50%; border: 1px solid var(--glass-field-border); color: transparent; flex-shrink: 0; }
.plan-selection svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.plan-card.is-selected .plan-selection { border-color: var(--app-accent); background: var(--app-accent); color: white; }
.plan-positioning { min-height: 42px; margin-top: 10px; color: var(--catalog-muted); font-size: 12px; line-height: 1.75; }
.plan-price { margin: 25px 0 22px; }
.plan-price > span { font-size: 20px; font-weight: 600; letter-spacing: -.025em; }
.plan-price p { margin-top: 7px; color: var(--catalog-soft); font-size: 10px; line-height: 1.7; }
.plan-facts { display: grid; gap: 12px; padding: 20px 0 23px; border-top: 1px solid var(--glass-divider); }
.plan-facts > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 12px; line-height: 1.5; }
.plan-facts dt { color: var(--catalog-muted); }
.plan-facts dd { color: var(--catalog-soft); }
.catalog-purchase { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 43px; margin-top: auto; padding: 11px 14px; border: 1px solid var(--glass-stroke); border-radius: 10px; color: var(--catalog-muted); background: var(--glass-field); font-size: 12px; font-weight: 550; cursor: not-allowed; }
.catalog-purchase svg, .catalog-text-link svg, .catalog-compare-toggle svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.plan-disclaimer { margin-top: 12px; color: var(--catalog-soft); text-align: center; font-size: 10px; line-height: 1.7; }
.catalog-plan-tools { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; padding: 20px 2px 27px; }
.catalog-current-plan { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; color: var(--catalog-muted); font-size: 11px; line-height: 1.8; }
.catalog-current-plan strong { color: var(--catalog-text); font-weight: 550; }
.catalog-view-only { margin-left: 5px; color: var(--catalog-soft); }
.selection-dot { width: 4px; height: 4px; margin-right: 2px; }
.catalog-compare-toggle { display: inline-flex; align-items: center; gap: 8px; color: var(--catalog-text); font-size: 12px; font-weight: 550; }
.catalog-compare-toggle svg { transition: transform .18s; }
.catalog-compare-toggle svg.is-open { transform: rotate(180deg); }
.catalog-comparison { margin-bottom: 28px; overflow: hidden; border-radius: 16px; }
.comparison-scroll { overflow-x: auto; }
.catalog-comparison table { width: 100%; border-collapse: collapse; font-size: 12px; }
.catalog-comparison th, .catalog-comparison td { padding: 15px 18px; border-bottom: 1px solid var(--glass-divider); text-align: center; }
.catalog-comparison th:first-child { text-align: left; }
.catalog-comparison thead th { font-weight: 600; color: var(--catalog-text); }
.catalog-comparison tbody th { color: var(--catalog-muted); font-weight: 450; white-space: nowrap; }
.catalog-comparison td { color: var(--catalog-muted); }
.catalog-comparison .is-selected { background: var(--catalog-accent-soft); }
.comparison-note { padding: 13px 18px; color: var(--catalog-soft); font-size: 10px; }
.catalog-bottom-grid { display: grid; grid-template-columns: .85fr 1.15fr; gap: 34px; padding-top: 5px; }
.catalog-balance-note { align-self: start; padding: 25px 26px; border-radius: 18px; background-image: radial-gradient(ellipse at 100% 0%, var(--catalog-accent-soft), transparent 70%); }
.catalog-balance-note h2 { margin: 16px 0 12px; font-size: 18px; font-weight: 600; line-height: 1.6; letter-spacing: -.025em; }
.catalog-balance-note p { max-width: 320px; color: var(--catalog-muted); font-size: 12px; line-height: 1.85; }
.catalog-text-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 20px; color: var(--app-accent); font-size: 12px; font-weight: 550; }
.catalog-faq > h2 { margin: 0 0 12px; color: var(--catalog-text); font-size: 14px; font-weight: 600; }
.catalog-faq details { border-bottom: 1px solid var(--glass-divider); }
.catalog-faq summary { display: flex; justify-content: space-between; gap: 15px; align-items: baseline; padding: 15px 0; color: var(--catalog-text); font-size: 12px; font-weight: 500; cursor: pointer; list-style: none; line-height: 1.7; }
.catalog-faq summary::-webkit-details-marker { display: none; }
.catalog-faq summary:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 4px; }
.faq-plus { color: var(--catalog-soft); font-size: 17px; font-weight: 400; transition: transform .18s; }
.catalog-faq details[open] .faq-plus { transform: rotate(45deg); }
.catalog-faq details p { padding: 0 20px 16px 0; color: var(--catalog-muted); font-size: 12px; line-height: 1.9; }
.catalog-balance-panel { display: flex; flex-direction: column; align-items: center; padding: 48px 28px; text-align: center; border-radius: 20px; min-height: 380px; background-image: radial-gradient(ellipse at 50% 0%, var(--catalog-accent-soft), transparent 70%); }
.balance-symbol { display: flex; align-items: center; justify-content: center; width: 70px; height: 70px; border: 1px solid var(--glass-stroke); border-radius: 22px; background: var(--glass-surface); margin-bottom: 25px; }
.balance-symbol svg { width: 36px; height: 36px; stroke: var(--app-accent); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.catalog-balance-panel h2 { margin: 16px 0 14px; font-size: clamp(21px, 3vw, 28px); font-weight: 600; letter-spacing: -.035em; }
.catalog-balance-panel > p { max-width: 480px; color: var(--catalog-muted); font-size: 13px; line-height: 1.85; }
.balance-purchase { width: auto; min-width: 210px; margin-top: 28px; }
.catalog-balance-panel .catalog-text-link { margin-top: 18px; }
.catalog-footer { margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--glass-divider); color: var(--catalog-soft); text-align: center; font-size: 10px; line-height: 1.8; }
@media (max-width: 1100px) {
  .plan-grid { gap: 13px; }
  .plan-card { padding: 22px 18px 18px; }
  .plan-price > span { font-size: 18px; }
  .catalog-bottom-grid { gap: 25px; }
}
@media (max-width: 760px) {
  .catalog-header { flex-direction: column; gap: 16px; padding-top: 4px; padding-bottom: 25px; }
  .catalog-header-actions:empty { display: none; }
  .catalog-intro { font-size: 13px; }
  .catalog-navigation { margin-bottom: 20px; gap: 8px; }
  .catalog-tabs button { padding: 8px 15px; font-size: 12px; }
  .catalog-availability { font-size: 10px; }
  .plan-grid { grid-template-columns: 1fr; gap: 16px; }
  .plan-card { padding: 22px 24px 20px; }
  .plan-topline { margin-bottom: 17px; }
  .plan-positioning { min-height: 0; }
  .plan-price { margin: 22px 0 18px; }
  .plan-facts { padding: 17px 0 20px; }
  .catalog-plan-tools { align-items: flex-start; padding-bottom: 24px; }
  .catalog-current-plan { flex-basis: 100%; }
  .catalog-view-only { margin-left: 2px; }
  .catalog-bottom-grid { grid-template-columns: 1fr; gap: 28px; }
  .catalog-comparison th, .catalog-comparison td { padding: 13px 10px; min-width: 104px; font-size: 11px; }
  .catalog-balance-panel { padding: 36px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .plan-card, .catalog-tabs button, .catalog-compare-toggle svg, .faq-plus { transition: none; }
}
</style>
