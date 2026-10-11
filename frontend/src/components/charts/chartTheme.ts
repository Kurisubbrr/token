/**
 * Chart.js 图表的公共外观：坐标轴、网格与折线图元的统一规格。
 * 颜色随明暗主题取值；网格只留一步之差的细实线，让数据本身最醒目。
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 当前是否为暗色主题。主题切换是在 <html> 上增删 dark 类，
 * 这里监听该类的变化，图表配色才能在切换时跟着重算，而不必刷新页面。
 */
export function useIsDark() {
  const read = () => document.documentElement.classList.contains('dark')
  const isDark = ref(read())
  const observer = new MutationObserver(() => {
    isDark.value = read()
  })
  onMounted(() => {
    isDark.value = read()
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })
  onBeforeUnmount(() => observer.disconnect())
  return isDark
}

export interface ChartTheme {
  /** 图例等次要文字 */
  text: string
  /** 坐标轴刻度文字 */
  muted: string
  /** 网格细线 */
  grid: string
}

export function getChartTheme(isDark: boolean): ChartTheme {
  return isDark
    ? { text: '#d1d5db', muted: '#898781', grid: 'rgba(255, 255, 255, 0.08)' }
    : { text: '#4b5563', muted: '#898781', grid: 'rgba(11, 12, 14, 0.07)' }
}

/**
 * 分类色板：区分不同的模型、分组、端点、用户。第一位是品牌蓝，其余取自一套
 * 经过色觉缺陷校验的色相（相邻两色在红绿色弱视角下仍可分辨），明暗主题各一组。
 * 顺序就是校验通过的顺序，不要打乱；颜色跟着实体走，不跟着排名走。
 */
const SERIES_COLORS = {
  light: ['#3b5bfd', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#7088fc', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
} as const

/** “其他”一类用的中性灰，不占色板里的名额 */
export function otherSeriesColor(isDark: boolean): string {
  return isDark ? '#646a73' : '#9a9ea7'
}

/** 取 count 个系列色。色板只有 8 位，超出的部分循环取用（这时务必配合图例或标签区分） */
export function seriesColors(isDark: boolean, count: number = SERIES_COLORS.light.length): string[] {
  const palette = isDark ? SERIES_COLORS.dark : SERIES_COLORS.light
  return Array.from({ length: count }, (_, index) => palette[index % palette.length])
}

/** 环形图：扇区之间留 2px 间隙，端头略带圆角，悬停时向外浮出 */
export const doughnutSegmentStyle = {
  borderWidth: 0,
  spacing: 2,
  borderRadius: 4,
  hoverOffset: 6
} as const

/** 折线：2px 线宽，平时不画数据点，悬停时才出现，命中范围放大便于指向。 */
export const lineSeriesStyle = {
  borderWidth: 2,
  tension: 0.3,
  pointRadius: 0,
  pointHoverRadius: 4,
  pointHitRadius: 12
} as const

/** 图例：小圆点 + 次要文字色。 */
export function legendLabels(theme: ChartTheme) {
  return {
    color: theme.text,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 8,
    boxHeight: 8,
    padding: 15,
    font: { size: 11 }
  }
}

/** 类目轴：不画竖向网格和轴线，限制刻度数量避免标签挤在一起。 */
export function categoryAxis(theme: ChartTheme) {
  return {
    grid: { display: false },
    border: { display: false },
    ticks: {
      color: theme.muted,
      font: { size: 10 },
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: 8
    }
  }
}

/** 数值轴的网格与轴线；刻度由各图表自行补充格式化回调。 */
export function valueAxisFrame(theme: ChartTheme) {
  return {
    grid: { color: theme.grid },
    border: { display: false }
  }
}
