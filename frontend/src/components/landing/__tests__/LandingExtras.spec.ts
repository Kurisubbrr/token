import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const getModelPlaza = vi.fn()
vi.mock('@/api/modelPlaza', () => ({ modelPlazaAPI: { getModelPlaza: () => getModelPlaza() } }))

// 测试环境没有 IntersectionObserver：让“进入视口”直接成立，才能走到取数据那一步
vi.mock('../motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../motion')>()),
  useInView: () => ref(true)
}))

import LandingFaq from '../LandingFaq.vue'
import LandingPricing from '../LandingPricing.vue'

const stubs = { Icon: true, ModelIcon: true, RouterLink: { template: '<a><slot /></a>' } }

const tokenPricing = (input: number | null, output: number | null) => ({
  billing_mode: 'token',
  input_price: input,
  output_price: output,
  cache_write_price: null,
  cache_read_price: null,
  image_input_price: null,
  image_output_price: null,
  per_request_price: null,
  intervals: []
})

describe('LandingFaq', () => {
  it('opens the first question by default and toggles on click', async () => {
    const wrapper = mount(LandingFaq, { props: { siteName: 'Demo' }, global: { stubs } })
    const questions = wrapper.findAll('.faq-question')

    expect(questions).toHaveLength(6)
    expect(questions[0].attributes('aria-expanded')).toBe('true')
    expect(questions[1].attributes('aria-expanded')).toBe('false')

    await questions[1].trigger('click')
    expect(questions[0].attributes('aria-expanded')).toBe('false')
    expect(questions[1].attributes('aria-expanded')).toBe('true')

    await questions[1].trigger('click')
    expect(wrapper.findAll('.faq-item.is-open')).toHaveLength(0)
  })
})

describe('LandingPricing', () => {
  it('does not request prices when the model plaza is not public', async () => {
    getModelPlaza.mockReset()
    const wrapper = mount(LandingPricing, {
      props: { publicPricing: false, showModelPlaza: false },
      global: { stubs }
    })
    await flushPromises()

    expect(getModelPlaza).not.toHaveBeenCalled()
    expect(wrapper.find('.pricing-board').exists()).toBe(false)
    expect(wrapper.findAll('.pricing-fact')).toHaveLength(3)
  })

  it('shows paid prices per million tokens with the group rate applied', async () => {
    getModelPlaza.mockReset()
    getModelPlaza.mockResolvedValue({
      description: '',
      groups: [
        {
          id: 1,
          name: 'Standard',
          rate_multiplier: 0.8,
          models: [
            { name: 'model-a', platform: 'openai', pricing: tokenPricing(1.25e-6, 10e-6), official_pricing: null },
            // 按次计费的模型不在首页列出
            { name: 'model-image', platform: 'openai', pricing: { ...tokenPricing(null, null), billing_mode: 'image', per_request_price: 0.04 }, official_pricing: null },
            { name: 'model-unpriced', platform: 'openai', pricing: null, official_pricing: null }
          ]
        },
        // 登录用户有专属倍率时以专属倍率为准
        {
          id: 2,
          name: 'VIP',
          rate_multiplier: 1,
          user_rate_multiplier: 0.5,
          models: [{ name: 'model-b', platform: 'anthropic', pricing: tokenPricing(3e-6, null), official_pricing: null }]
        },
        // 没有可展示模型的分组不出现在标签里
        { id: 3, name: 'Empty', rate_multiplier: 1, models: [] }
      ]
    })

    const wrapper = mount(LandingPricing, {
      props: { publicPricing: true, showModelPlaza: true },
      global: { stubs }
    })
    await flushPromises()

    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.pricing-tab').map((tab) => tab.text())).toEqual(['Standard ×0.8', 'VIP ×0.5'])

    const firstRows = wrapper.findAll('.pricing-row-item')
    expect(firstRows).toHaveLength(1)
    expect(firstRows[0].findAll('.pricing-price').map((cell) => cell.text())).toEqual(['$1.00', '$8.00'])

    await wrapper.findAll('.pricing-tab')[1].trigger('click')
    expect(wrapper.find('.pricing-row-item').findAll('.pricing-price').map((cell) => cell.text())).toEqual(['$1.50', '—'])
  })

  it('falls back to the billing explainer when prices cannot be loaded', async () => {
    getModelPlaza.mockReset()
    getModelPlaza.mockRejectedValue(new Error('404'))

    const wrapper = mount(LandingPricing, {
      props: { publicPricing: true, showModelPlaza: true },
      global: { stubs }
    })
    await flushPromises()

    expect(wrapper.find('.pricing-board').exists()).toBe(false)
    expect(wrapper.findAll('.pricing-fact')).toHaveLength(3)
  })
})
