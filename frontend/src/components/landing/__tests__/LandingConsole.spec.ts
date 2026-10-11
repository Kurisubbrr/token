import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import LandingConsole from '../LandingConsole.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

function mountConsole() {
  return mount(LandingConsole, {
    props: { siteName: 'Test site' },
    // 把过渡组件换成直通的桩：切换后立即渲染新内容，不必等离场动画结束
    global: { stubs: { ModelIcon: true, Transition: { inheritAttrs: false, template: '<slot />' } } }
  })
}

describe('LandingConsole', () => {
  it('starts on the Anthropic Messages endpoint with a matching request body', () => {
    const wrapper = mountConsole()

    expect(wrapper.find('.lp-console-path').text()).toBe('/v1/messages')
    expect(wrapper.find('.lp-console-code').text()).toContain('"model": "claude-sonnet-4-6"')
    expect(wrapper.find('.lp-console-code').text()).toContain('"max_tokens": 1024')
  })

  it('switches endpoint and body shape with the selected model', async () => {
    const wrapper = mountConsole()
    const tabs = wrapper.findAll('.lp-console-model')

    await tabs[1].trigger('click')
    expect(wrapper.find('.lp-console-path').text()).toBe('/v1/chat/completions')
    expect(wrapper.find('.lp-console-code').text()).toContain('"model": "gpt-5.5"')

    // Gemini 的原生协议把模型写在路径里，请求体是 contents/parts
    await tabs[2].trigger('click')
    expect(wrapper.find('.lp-console-path').text()).toBe(
      '/v1beta/models/gemini-2.5-pro:streamGenerateContent'
    )
    expect(wrapper.find('.lp-console-code').text()).toContain('"contents"')
    expect(wrapper.find('.lp-console-code').text()).not.toContain('"messages"')
  })

  it('marks only the selected model tab as active', async () => {
    const wrapper = mountConsole()
    const tabs = wrapper.findAll('.lp-console-model')

    await tabs[3].trigger('click')

    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual([
      'false',
      'false',
      'false',
      'true'
    ])
  })

  it('never leaks the caret marker into the rendered request', async () => {
    const wrapper = mountConsole()

    for (const tab of wrapper.findAll('.lp-console-model')) {
      await tab.trigger('click')
      expect(wrapper.find('.lp-console-code').text()).not.toContain('\u0001')
    }
  })
})
