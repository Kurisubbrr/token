import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import LandingMarquee from '../LandingMarquee.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

function mountMarquee() {
  return mount(LandingMarquee, { global: { stubs: { ModelIcon: true } } })
}

describe('LandingMarquee', () => {
  it('repeats the provider list so the strip can loop without a gap', () => {
    const wrapper = mountMarquee()
    const tracks = wrapper.findAll('.providers-track')

    // 至少三遍：带子左移一整组之后，可视区右侧仍然有内容
    expect(tracks.length).toBeGreaterThanOrEqual(3)
    const names = tracks.map((track) => track.findAll('.providers-name').map((name) => name.text()))
    expect(names[0]).toEqual(['Claude', 'OpenAI', 'Gemini', 'DeepSeek', 'Grok', 'Kimi', 'GLM', 'MiniMax'])
    expect(names.every((list) => list.join() === names[0].join())).toBe(true)
  })

  it('exposes only the first copy to assistive technology', () => {
    const tracks = mountMarquee().findAll('.providers-track')

    expect(tracks[0].attributes('aria-hidden')).toBeUndefined()
    expect(tracks.slice(1).every((track) => track.attributes('aria-hidden') === 'true')).toBe(true)
  })
})
