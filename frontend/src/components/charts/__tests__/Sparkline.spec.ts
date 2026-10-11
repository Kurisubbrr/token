import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import Sparkline from '../Sparkline.vue'

const hourlyLabels = (count: number) =>
  Array.from({ length: count }, (_, i) => `2026-10-11 ${String(i % 24).padStart(2, '0')}:00`)

describe('Sparkline', () => {
  it('renders one bar per point and highlights the latest one', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'bars', values: [4, 8, 2], labels: hourlyLabels(3) }
    })

    const bars = wrapper.findAll('.sparkline-bar')
    expect(bars).toHaveLength(3)
    expect(bars.map((bar) => bar.classes().includes('sparkline-bar-current'))).toEqual([
      false,
      false,
      true
    ])
    // 最大值撑满绘图区，其余按比例
    expect(bars[1].attributes('style')).toContain('height: 100%')
    expect(bars[0].attributes('style')).toContain('height: 50%')
  })

  it('sums points into buckets when there are too many bars to draw', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'bars', values: Array.from({ length: 48 }, () => 1), labels: hourlyLabels(48) }
    })

    // 48 个点合并成 24 根柱子，每根是相邻两个点之和，高度一致
    const bars = wrapper.findAll('.sparkline-bar')
    expect(bars).toHaveLength(24)
    expect(new Set(bars.map((bar) => bar.attributes('style'))).size).toBe(1)
  })

  it('shows a flat baseline instead of a plot when every value is zero', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'area', values: [0, 0, 0], labels: hourlyLabels(3) }
    })

    expect(wrapper.find('.sparkline-empty').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('treats missing or non-numeric values as zero', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'bars', values: [Number.NaN, 5, undefined as unknown as number] }
    })

    const bars = wrapper.findAll('.sparkline-bar')
    expect(bars.map((bar) => bar.classes().includes('sparkline-bar-empty'))).toEqual([
      true,
      false,
      true
    ])
  })

  it('labels the axis with the first, middle and last time of the range', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'area', values: [1, 2, 3, 4, 5], labels: hourlyLabels(5) }
    })

    expect(wrapper.findAll('.sparkline-axis span').map((span) => span.text())).toEqual([
      '00:00',
      '02:00',
      '04:00'
    ])
  })

  it('uses month-day axis labels for daily data', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'area', values: [1, 2], labels: ['2026-10-10', '2026-10-11'] }
    })

    expect(wrapper.findAll('.sparkline-axis span').map((span) => span.text())).toEqual([
      '10-10',
      '10-11'
    ])
  })

  it('draws a level line for a single data point', () => {
    const wrapper = mount(Sparkline, {
      props: { variant: 'area', values: [7], labels: ['2026-10-11'] }
    })

    expect(wrapper.find('.sparkline-line').attributes('d')).toBe('M0,10 L100,10')
  })
})
