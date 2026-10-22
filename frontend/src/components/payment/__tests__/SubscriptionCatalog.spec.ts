import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SubscriptionCatalog from '../SubscriptionCatalog.vue'

function renderCatalog(locale: 'zh' | 'en' = 'zh') {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { zh: {}, en: {} } })
  const wrapper = mount(SubscriptionCatalog, { global: { plugins: [i18n] }, attachTo: document.body })
  return { wrapper, i18n }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('subscription catalog before purchases open', () => {
  it.each([
    ['zh', '价格即将公布', '权益以正式发布为准', '即将开放'],
    ['en', 'Pricing coming soon', 'Benefits are subject to the official release', 'Coming soon'],
  ] as const)('shows truthful %s details and disabled purchases', (locale, pricing, disclaimer, cta) => {
    const { wrapper } = renderCatalog(locale)
    expect(wrapper.findAll('input[name="catalog-plan"]')).toHaveLength(3)
    for (const name of ['Plus', 'Pro', 'Max']) expect(wrapper.text()).toContain(name)
    expect(wrapper.text()).toContain(pricing)
    expect(wrapper.text()).toContain(disclaimer)
    const purchases = wrapper.findAll('[data-testid="catalog-purchase"]')
    expect(purchases).toHaveLength(3)
    for (const button of purchases) {
      expect(button.text()).toBe(cta)
      expect(button.attributes('disabled')).toBeDefined()
    }
    expect(wrapper.text()).not.toMatch(/[¥$€]\s*\d|\d+\s*%|unlimited|自动续费|更高并发|优先客服/i)
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('browses a plan and its comparison without payment requests or purchase events', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { wrapper } = renderCatalog()
    await wrapper.get('[data-testid="catalog-select-max"]').setValue()
    expect(wrapper.get('[role="status"]').text()).toContain('Max')
    expect(wrapper.get('[data-testid="catalog-plan-max"]').classes()).toContain('is-selected')
    await wrapper.get('[data-testid="catalog-compare-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="catalog-compare-toggle"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('#catalog-comparison tbody tr')).toHaveLength(4)
    await wrapper.get('[data-testid="catalog-purchase"]').trigger('click')
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.emitted('purchase')).toBeUndefined()
    expect(wrapper.emitted('recharge')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps balance top-up accessible but disabled without accepting amounts', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { wrapper } = renderCatalog()
    await wrapper.get('[data-testid="catalog-tab-balance"]').trigger('click')
    expect(wrapper.get('[data-testid="catalog-balance-panel"]').text()).toContain('充值服务尚未开放')
    expect(wrapper.get('[data-testid="catalog-recharge"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.get('[data-testid="catalog-recharge"]').trigger('click')
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.emitted('recharge')).toBeUndefined()
    wrapper.unmount()
  })

  it('supports keyboard tab navigation and identifies the selected tab', async () => {
    const { wrapper } = renderCatalog()
    await wrapper.get('[data-testid="catalog-tab-plans"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('[data-testid="catalog-tab-balance"]').attributes('aria-selected')).toBe('true')
    expect(document.activeElement?.id).toBe('catalog-tab-balance')
    await wrapper.get('[data-testid="catalog-tab-balance"]').trigger('keydown', { key: 'Home' })
    expect(wrapper.get('[data-testid="catalog-tab-plans"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('[data-testid="catalog-plan-plus"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('reacts to the existing locale and uses native FAQ disclosures', async () => {
    const { wrapper, i18n } = renderCatalog()
    expect(wrapper.text()).toContain('找到适合你的订阅')
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(wrapper.text()).toContain('Find your next plan')
    expect(wrapper.text()).toContain('Pricing coming soon')
    expect(wrapper.text()).not.toContain('价格即将公布')
    expect(wrapper.findAll('details summary')).toHaveLength(4)
    wrapper.unmount()
  })
})
