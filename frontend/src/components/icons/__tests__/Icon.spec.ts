import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Icon from '../Icon.vue'
import { icons, type IconName } from '../iconSet'

describe('icon set', () => {
  it('gives every icon a drawable stroke path', () => {
    for (const [name, shape] of Object.entries(icons)) {
      expect(shape.s, name).toMatch(/^M[\d.-]/)
      // 拼路径时混进 NaN / undefined 会让整枚图标画不出来
      expect(`${shape.s}${shape.f ?? ''}`, name).not.toMatch(/NaN|undefined|null/)
    }
  })
})

describe('Icon', () => {
  it('renders the tint layer under the stroke for icons that have one', () => {
    const wrapper = mount(Icon, { props: { name: 'key' } })
    const paths = wrapper.findAll('path')

    expect(paths).toHaveLength(2)
    expect(paths[0].classes()).toContain('icon-tint')
    expect(paths[0].attributes('d')).toBe(icons.key.f)
    expect(paths[1].attributes('d')).toBe(icons.key.s)
  })

  it('renders line-only icons as a single path', () => {
    const wrapper = mount(Icon, { props: { name: 'check' } })

    expect(wrapper.findAll('path')).toHaveLength(1)
    expect(wrapper.find('.icon-tint').exists()).toBe(false)
  })

  it('draws nothing instead of throwing when the name is not in the set', () => {
    const wrapper = mount(Icon, { props: { name: 'not-an-icon' as IconName } })

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('path').attributes('d')).toBe('')
  })
})
