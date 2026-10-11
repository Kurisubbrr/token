import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CommandPalette from '../CommandPalette.vue'
import { useCommandPalette, type CommandItem } from '../commandPalette'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function mountPalette(items: CommandItem[]) {
  return mount(CommandPalette, {
    props: { items },
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
        Transition: { inheritAttrs: false, template: '<slot />' },
        Icon: true
      }
    }
  })
}

const makeItems = (run = vi.fn()): CommandItem[] => [
  { id: 'page:/admin/users', label: '用户管理', group: 'pages', icon: 'span', keywords: '/admin/users', run },
  { id: 'page:/admin/channels/pricing', label: '渠道定价', hint: '渠道管理', group: 'pages', icon: 'span', run },
  { id: 'action:theme', label: '深色模式', group: 'actions', icon: 'span', keywords: 'theme dark', run }
]

describe('CommandPalette', () => {
  afterEach(() => {
    useCommandPalette().hide()
    document.body.innerHTML = ''
  })

  it('stays out of the DOM until opened, and toggles with the keyboard shortcut', async () => {
    const wrapper = mountPalette(makeItems())
    expect(wrapper.find('.cmdk-panel').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    await nextTick()
    expect(wrapper.find('.cmdk-panel').exists()).toBe(true)
    expect(wrapper.findAll('.cmdk-item')).toHaveLength(3)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await nextTick()
    expect(wrapper.find('.cmdk-panel').exists()).toBe(false)
    wrapper.unmount()
  })

  it('filters by label, hint and keywords, requiring every word to match', async () => {
    const wrapper = mountPalette(makeItems())
    useCommandPalette().show()
    await nextTick()

    const input = wrapper.find('.cmdk-input')
    await input.setValue('渠道')
    expect(wrapper.findAll('.cmdk-item').map((item) => item.text())).toEqual(['渠道定价渠道管理'])

    await input.setValue('admin users')
    expect(wrapper.findAll('.cmdk-item')).toHaveLength(1)

    await input.setValue('admin 不存在')
    expect(wrapper.findAll('.cmdk-item')).toHaveLength(0)
    expect(wrapper.find('.cmdk-empty').exists()).toBe(true)
    wrapper.unmount()
  })

  it('runs the highlighted item on Enter and closes', async () => {
    const run = vi.fn()
    const wrapper = mountPalette(makeItems(run))
    useCommandPalette().show()
    await nextTick()

    const input = wrapper.find('.cmdk-input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.findAll('.cmdk-item')[1].classes()).toContain('is-active')

    await input.trigger('keydown', { key: 'Enter' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.cmdk-panel').exists()).toBe(false)
    wrapper.unmount()
  })
})
