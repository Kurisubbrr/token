import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import DemoClients from '../DemoClients.vue'
import DemoFailover from '../DemoFailover.vue'
import DemoKeys from '../DemoKeys.vue'
import DemoUsage from '../DemoUsage.vue'

// t() 回显 key；带参数时把参数接在后面，便于断言是哪条线路
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${Object.values(params).join(',')}` : key
    })
  }
})

// 列表过渡换成直通的桩：被挤出去的行立即从 DOM 里移除，不必等离场动画结束
const TransitionGroupStub = {
  inheritAttrs: false,
  props: ['tag'],
  template: '<component :is="tag || \'div\'" v-bind="$attrs"><slot /></component>'
}

const stubs = { ModelIcon: true, Icon: true, TransitionGroup: TransitionGroupStub }

describe('DemoKeys', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sends a call through the endpoint of the clicked model and settles it', async () => {
    const wrapper = mount(DemoKeys, { global: { stubs } })
    const before = wrapper.findAll('.keys-row').length
    const grok = wrapper.findAll('.keys-model').find((button) => button.text() === 'Grok')!

    await grok.trigger('click')

    const newest = wrapper.find('.keys-row')
    expect(wrapper.findAll('.keys-row')).toHaveLength(before + 1)
    expect(newest.find('.keys-row-model').text()).toBe('grok-4.6')
    // Grok 走 Responses 接口，而不是 Chat Completions
    expect(newest.find('.keys-row-endpoint').text()).toBe('/v1/responses')
    expect(newest.attributes('data-state')).toBe('pending')
    expect(grok.classes()).toContain('is-active')

    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('.keys-row').attributes('data-state')).toBe('done')
    expect(wrapper.find('.keys-row .keys-row-status').text()).toContain('200')
  })

  it('keeps only the most recent calls in the log', async () => {
    const wrapper = mount(DemoKeys, { global: { stubs } })
    const buttons = wrapper.findAll('.keys-model')

    for (const button of buttons) await button.trigger('click')

    // 上限 6 行，最新的在最上面
    expect(wrapper.findAll('.keys-row')).toHaveLength(6)
    expect(wrapper.find('.keys-row .keys-row-model').text()).toBe('MiniMax-M3')
  })
})

describe('DemoFailover', () => {
  const mountFailover = () =>
    mount(DemoFailover, { props: { siteLogo: '' }, global: { stubs } })

  const activeIndex = (wrapper: ReturnType<typeof mountFailover>) =>
    wrapper.findAll('.fo-up').findIndex((row) => row.classes().includes('is-active'))

  it('moves traffic to the next healthy route when the active one fails', async () => {
    const wrapper = mountFailover()
    expect(activeIndex(wrapper)).toBe(0)

    await wrapper.findAll('.fo-up')[0].trigger('click')

    expect(activeIndex(wrapper)).toBe(1)
    expect(wrapper.findAll('.fo-up')[0].classes()).toContain('is-down')
    expect(wrapper.findAll('.fo-up')[0].find('.fo-up-meta').text()).toBe('429')
    // 最新的两条日志：先记故障，再记切换
    const events = wrapper.findAll('.fo-event-text').map((event) => event.text())
    expect(events[0]).toContain('evSwitch')
    expect(events[0]).toContain('B')
    expect(events[1]).toContain('evDown')
    expect(events[1]).toContain('A')
  })

  it('does not reroute when a standby route fails', async () => {
    const wrapper = mountFailover()

    await wrapper.findAll('.fo-up')[2].trigger('click')

    expect(activeIndex(wrapper)).toBe(0)
    expect(wrapper.find('.fo-event-text').text()).toContain('evDown')
  })

  it('returns to the preferred route once it recovers', async () => {
    const wrapper = mountFailover()
    const first = wrapper.findAll('.fo-up')[0]

    await first.trigger('click')
    await first.trigger('click')

    expect(activeIndex(wrapper)).toBe(0)
    expect(first.classes()).not.toContain('is-down')
    expect(wrapper.find('.fo-event-text').text()).toContain('evSwitch')
  })

  it('reports a blocked state when every route is down', async () => {
    const wrapper = mountFailover()

    for (const row of wrapper.findAll('.fo-up')) await row.trigger('click')

    expect(activeIndex(wrapper)).toBe(-1)
    expect(wrapper.find('.fo-diagram').classes()).toContain('is-blocked')
    expect(wrapper.find('.fo-ring').classes()).toContain('is-hidden')
    expect(wrapper.find('.fo-event-text').text()).toContain('evBlocked')
  })
})

describe('DemoUsage', () => {
  const toNumber = (text: string) => Number(text.replace(/[^0-9.]/g, ''))

  it('expands one row at a time and its parts add up to the row cost', async () => {
    const wrapper = mount(DemoUsage, { global: { stubs } })
    const rows = wrapper.findAll('.usage-row')

    await rows[0].find('.usage-row-main').trigger('click')
    expect(rows[0].classes()).toContain('is-open')

    const parts = rows[0].findAll('.usage-row-sub').map((part) => toNumber(part.text()))
    const cost = toNumber(rows[0].find('.usage-row-cost').text())
    expect(parts).toHaveLength(3)
    // 三项各自四舍五入到 4 位，合计与行内金额最多差一个末位
    expect(Math.abs(parts.reduce((sum, part) => sum + part, 0) - cost)).toBeLessThan(0.0002)

    await rows[1].find('.usage-row-main').trigger('click')
    expect(rows[0].classes()).not.toContain('is-open')
    expect(rows[1].classes()).toContain('is-open')

    await rows[1].find('.usage-row-main').trigger('click')
    expect(wrapper.findAll('.usage-row.is-open')).toHaveLength(0)
  })
})

describe('DemoClients', () => {
  const mountClients = () =>
    mount(DemoClients, {
      props: { baseUrl: 'https://api.example.test', siteName: 'Test site' },
      global: { stubs }
    })

  const keyLine = (wrapper: ReturnType<typeof mountClients>) =>
    wrapper.find('.clients-line.is-key').text().replace(/^\d+/, '')

  it('shows the Anthropic base URL without /v1 for Claude Code', () => {
    // Anthropic 客户端会自己拼 /v1/messages，地址里不能再带 /v1
    expect(keyLine(mountClients())).toBe('export ANTHROPIC_BASE_URL="https://api.example.test"')
  })

  it('appends /v1 for OpenAI-style clients', async () => {
    const wrapper = mountClients()
    const tabs = wrapper.findAll('.clients-tab')

    await tabs[1].trigger('click')
    expect(wrapper.find('.clients-file').text()).toBe('~/.codex/config.toml')
    expect(wrapper.find('.clients-code').text()).toContain('wire_api = "responses"')

    await tabs[3].trigger('click')
    expect(wrapper.find('.clients-file').text()).toBe('app.py')
    expect(wrapper.findAll('.clients-tab.is-active')).toHaveLength(1)
    expect(tabs[3].attributes('aria-selected')).toBe('true')
  })

  it('highlights exactly one line per client: the one that changes', async () => {
    const wrapper = mountClients()

    for (const tab of wrapper.findAll('.clients-tab')) {
      await tab.trigger('click')
      expect(wrapper.findAll('.clients-line.is-key')).toHaveLength(1)
    }
  })
})
