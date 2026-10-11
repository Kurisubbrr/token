import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import RollingNumber from '../RollingNumber.vue'

const stripOffsets = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.rolling-strip').map((strip) => strip.attributes('style'))

describe('RollingNumber', () => {
  it('rolls each digit strip to its value and leaves separators static', () => {
    const wrapper = mount(RollingNumber, { props: { value: '1,284' } })

    // 每一位平移 digit × 10%，露出对应的数字
    expect(stripOffsets(wrapper)).toEqual([
      'transform: translateY(-10%);',
      'transform: translateY(-20%);',
      'transform: translateY(-80%);',
      'transform: translateY(-40%);'
    ])
    expect(wrapper.findAll('.rolling-static').map((cell) => cell.text())).toEqual([','])
  })

  it('exposes the plain value to assistive technology', () => {
    const wrapper = mount(RollingNumber, { props: { value: '0.0104' } })

    expect(wrapper.find('.rolling').attributes('aria-label')).toBe('0.0104')
  })

  it('keeps the ones digit in place when the number gains a digit', async () => {
    const wrapper = mount(RollingNumber, { props: { value: '98' } })
    const onesBefore = wrapper.findAll('.rolling-digit').at(-1)!.element

    await wrapper.setProps({ value: '105' })

    // 个位的 DOM 节点被复用，只是滚到新数字；新增的是最高位
    expect(wrapper.findAll('.rolling-digit')).toHaveLength(3)
    expect(wrapper.findAll('.rolling-digit').at(-1)!.element).toBe(onesBefore)
    expect(stripOffsets(wrapper).at(-1)).toBe('transform: translateY(-50%);')
  })
})
