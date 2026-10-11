<template>
  <div class="card flex flex-col p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('admin.dashboard.tokenUsageTrend') }}
      </h3>
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="loading" class="flex items-center justify-center" :class="plotClass">
      <LoadingSpinner />
    </div>
    <div v-else-if="trendData.length > 0 && chartData" :class="plotClass">
      <Line :data="chartData" :options="lineOptions" />
    </div>
    <div
      v-else
      class="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"
      :class="plotClass"
    >
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>

    <!-- 区间合计：与图例同名同色，数值用正文色 -->
    <dl
      v-if="showSummary"
      class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-black/5 pt-4 dark:border-white/5 sm:grid-cols-4"
    >
      <div v-for="item in summaryItems" :key="item.label" class="min-w-0">
        <dt class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span class="h-2 w-2 flex-shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
          <span class="truncate">{{ item.label }}</span>
        </dt>
        <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
          {{ formatTokens(item.value) }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { TrendDataPoint } from '@/types'
import { categoryAxis, getChartTheme, legendLabels, lineSeriesStyle, useIsDark, valueAxisFrame } from './chartTheme'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const { t } = useI18n()

const props = defineProps<{
  trendData: TrendDataPoint[]
  loading?: boolean
  /** 加高绘图区，用于占据主栏的大图 */
  tall?: boolean
  /** 在图表下方显示所选区间内各类 Token 的合计 */
  showSummary?: boolean
}>()

const plotClass = computed(() => (props.tall ? 'h-72' : 'h-48'))

const isDarkMode = useIsDark()

const chartColors = computed(() => ({
  ...getChartTheme(isDarkMode.value),
  input: '#5a77fe',
  output: '#10b981',
  cacheCreation: '#f59e0b',
  cacheRead: '#06b6d4',
  cacheHitRate: '#8b5cf6'
}))

const chartData = computed(() => {
  if (!props.trendData?.length) return null

  return {
    labels: props.trendData.map((d) => d.date),
    datasets: [
      {
        label: 'Input',
        data: props.trendData.map((d) => d.input_tokens),
        borderColor: chartColors.value.input,
        backgroundColor: `${chartColors.value.input}1a`,
        fill: true,
        ...lineSeriesStyle
      },
      {
        label: 'Output',
        data: props.trendData.map((d) => d.output_tokens),
        borderColor: chartColors.value.output,
        backgroundColor: `${chartColors.value.output}1a`,
        fill: true,
        ...lineSeriesStyle
      },
      {
        label: 'Cache Creation',
        data: props.trendData.map((d) => d.cache_creation_tokens),
        borderColor: chartColors.value.cacheCreation,
        backgroundColor: `${chartColors.value.cacheCreation}1a`,
        fill: true,
        ...lineSeriesStyle
      },
      {
        label: 'Cache Read',
        data: props.trendData.map((d) => d.cache_read_tokens),
        borderColor: chartColors.value.cacheRead,
        backgroundColor: `${chartColors.value.cacheRead}1a`,
        fill: true,
        ...lineSeriesStyle
      },
      {
        label: 'Cache Hit Rate',
        data: props.trendData.map((d) => {
          const totalPromptTokens = d.input_tokens + d.cache_read_tokens + d.cache_creation_tokens
          return totalPromptTokens > 0 ? (d.cache_read_tokens / totalPromptTokens) * 100 : 0
        }),
        borderColor: chartColors.value.cacheHitRate,
        backgroundColor: `${chartColors.value.cacheHitRate}20`,
        borderDash: [5, 5],
        fill: false,
        ...lineSeriesStyle,
        yAxisID: 'yPercent'
      }
    ]
  }
})

const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: legendLabels(chartColors.value)
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          if (context.dataset.yAxisID === 'yPercent') {
            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`
          }
          return `${context.dataset.label}: ${formatTokens(context.raw)}`
        },
        footer: (tooltipItems: any) => {
          const dataIndex = tooltipItems[0]?.dataIndex
          if (dataIndex !== undefined && props.trendData[dataIndex]) {
            const data = props.trendData[dataIndex]
            return `Actual: $${formatCost(data.actual_cost)} | Standard: $${formatCost(data.cost)}`
          }
          return ''
        }
      }
    }
  },
  scales: {
    x: categoryAxis(chartColors.value),
    y: {
      ...valueAxisFrame(chartColors.value),
      ticks: {
        color: chartColors.value.muted,
        font: {
          size: 10
        },
        callback: (value: string | number) => formatTokens(Number(value))
      }
    },
    yPercent: {
      position: 'right' as const,
      min: 0,
      max: 100,
      grid: {
        drawOnChartArea: false
      },
      border: {
        display: false
      },
      ticks: {
        color: chartColors.value.cacheHitRate,
        font: {
          size: 10
        },
        callback: (value: string | number) => `${value}%`
      }
    }
  }
}))

const sumBy = (pick: (point: TrendDataPoint) => number): number =>
  (props.trendData ?? []).reduce((total, point) => total + (Number(pick(point)) || 0), 0)

const summaryItems = computed(() => [
  { label: 'Input', color: chartColors.value.input, value: sumBy((d) => d.input_tokens) },
  { label: 'Output', color: chartColors.value.output, value: sumBy((d) => d.output_tokens) },
  {
    label: 'Cache Creation',
    color: chartColors.value.cacheCreation,
    value: sumBy((d) => d.cache_creation_tokens)
  },
  { label: 'Cache Read', color: chartColors.value.cacheRead, value: sumBy((d) => d.cache_read_tokens) }
])

const formatTokens = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const formatCost = (value: number): string => {
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K'
  } else if (value >= 1) {
    return value.toFixed(2)
  } else if (value >= 0.01) {
    return value.toFixed(3)
  }
  return value.toFixed(4)
}
</script>
