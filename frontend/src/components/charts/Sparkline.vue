<template>
  <div class="sparkline" role="img" :aria-label="ariaLabel">
    <div
      ref="plotRef"
      class="sparkline-plot"
      @pointermove="handlePointerMove"
      @pointerleave="hoverIndex = null"
    >
      <template v-if="hasData">
        <template v-if="variant === 'area'">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="sparkline-svg">
            <defs>
              <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" class="sparkline-wash-top" />
                <stop offset="100%" class="sparkline-wash-bottom" />
              </linearGradient>
            </defs>
            <path :d="areaPath" :fill="`url(#${gradientId})`" />
            <path :d="linePath" class="sparkline-line" vector-effect="non-scaling-stroke" />
          </svg>
          <!-- 圆点用 HTML 画：SVG 被非等比拉伸，里面的 circle 会变成椭圆 -->
          <span
            class="sparkline-dot"
            :style="{ left: `${markerPoint.x}%`, top: `${markerPoint.y}%` }"
          />
        </template>

        <div v-else class="sparkline-bars">
          <span
            v-for="(bar, index) in bars"
            :key="index"
            class="sparkline-bar"
            :class="{
              'sparkline-bar-current': index === activeIndex,
              'sparkline-bar-empty': bar.value <= 0
            }"
            :style="{ height: `${bar.height}%` }"
          />
        </div>

        <div v-if="hoverBucket" class="sparkline-tooltip" :style="tooltipStyle">
          <span v-if="hoverBucket.label" class="sparkline-tooltip-label">
            {{ hoverBucket.label }}
          </span>
          <span class="sparkline-tooltip-value">{{ formatValue(hoverBucket.value) }}</span>
        </div>
      </template>

      <div v-else class="sparkline-empty" />
    </div>

    <div v-if="axisLabels.length" class="sparkline-axis">
      <span v-for="(label, index) in axisLabels" :key="index">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'

interface Bucket {
  value: number
  label: string
  axisLabel: string
}

const props = withDefaults(
  defineProps<{
    values: number[]
    /** 与 values 一一对应的时间标签，如 "2026-10-11" 或 "2026-10-11 09:00" */
    labels?: string[]
    variant?: 'area' | 'bars'
    formatValue?: (value: number) => string
    ariaLabel?: string
  }>(),
  {
    labels: () => [],
    variant: 'area',
    formatValue: (value: number) => value.toLocaleString(),
    ariaLabel: undefined
  }
)

// 迷你图只需要走势；点数过多时按桶求和，柱子才不会细到看不见
const MAX_BUCKETS = { area: 48, bars: 24 } as const
// 折线的纵向活动范围（百分比），上下留白给线宽和圆点
const PLOT_TOP = 10
const PLOT_BOTTOM = 96

const gradientId = `sparkline-wash-${useId()}`
const plotRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)

const toFinite = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

// "2026-10-11 09:00" → "09:00"；"2026-10-11" → "10-11"
const shortLabel = (label: string): string => {
  const trimmed = label.trim()
  const timePart = trimmed.match(/\d{1,2}:\d{2}/)
  if (timePart) return timePart[0]
  const dayPart = trimmed.match(/\d{4}-(\d{2}-\d{2})/)
  return dayPart ? dayPart[1] : trimmed
}

const buckets = computed<Bucket[]>(() => {
  const values = props.values.map(toFinite)
  const size = Math.max(1, Math.ceil(values.length / MAX_BUCKETS[props.variant]))
  const result: Bucket[] = []
  for (let start = 0; start < values.length; start += size) {
    const end = Math.min(start + size, values.length) - 1
    let sum = 0
    for (let i = start; i <= end; i++) sum += values[i]
    const first = props.labels[start] ?? ''
    const last = props.labels[end] ?? ''
    result.push({
      value: sum,
      label: first && last && first !== last ? `${first} – ${last}` : first,
      axisLabel: first ? shortLabel(first) : ''
    })
  }
  return result
})

const maxValue = computed(() => Math.max(0, ...buckets.value.map((bucket) => bucket.value)))
const hasData = computed(() => buckets.value.length > 0 && maxValue.value > 0)

const points = computed(() => {
  const count = buckets.value.length
  return buckets.value.map((bucket, index) => ({
    x: count === 1 ? 50 : (index / (count - 1)) * 100,
    y: PLOT_BOTTOM - (bucket.value / maxValue.value) * (PLOT_BOTTOM - PLOT_TOP)
  }))
})

// 相邻两点之间用水平控制柄的三次贝塞尔：曲线平滑，且不会冲出两端点的取值范围
const linePath = computed(() => {
  const pts = points.value
  if (pts.length === 1) return `M0,${pts[0].y} L100,${pts[0].y}`
  return pts
    .map((point, index) => {
      if (index === 0) return `M${point.x},${point.y}`
      const prev = pts[index - 1]
      const midX = (prev.x + point.x) / 2
      return `C${midX},${prev.y} ${midX},${point.y} ${point.x},${point.y}`
    })
    .join(' ')
})

const areaPath = computed(() => {
  const pts = points.value
  const startX = pts.length === 1 ? 0 : pts[0].x
  const endX = pts.length === 1 ? 100 : pts[pts.length - 1].x
  return `${linePath.value} L${endX},100 L${startX},100 Z`
})

// 高亮项：悬停时跟随指针，否则停在最新一个数据点。数据刷新后点数可能变少，这里一并收敛
const activeIndex = computed(() =>
  Math.min(buckets.value.length - 1, hoverIndex.value ?? buckets.value.length - 1)
)
const markerPoint = computed(() => points.value[activeIndex.value])
const hoverBucket = computed(() =>
  hoverIndex.value === null ? null : (buckets.value[hoverIndex.value] ?? null)
)

const bars = computed(() =>
  buckets.value.map((bucket) => ({
    value: bucket.value,
    // 零值保留一小截，让时间轴的节奏仍然可见
    height: bucket.value > 0 ? Math.max(6, (bucket.value / maxValue.value) * 100) : 3
  }))
)

const axisLabels = computed(() => {
  const labels = buckets.value.map((bucket) => bucket.axisLabel)
  if (labels.length < 2 || !labels[0]) return []
  const picks = [labels[0]]
  if (labels.length >= 5) picks.push(labels[Math.floor((labels.length - 1) / 2)])
  picks.push(labels[labels.length - 1])
  return picks
})

const tooltipStyle = computed(() => {
  const count = buckets.value.length
  if (hoverIndex.value === null || !hoverBucket.value) return {}
  const ratio =
    props.variant === 'area'
      ? count === 1
        ? 0.5
        : hoverIndex.value / (count - 1)
      : (hoverIndex.value + 0.5) / count
  // 贴边时不让提示框伸出卡片
  return { left: `${Math.min(88, Math.max(12, ratio * 100))}%` }
})

const handlePointerMove = (event: PointerEvent) => {
  const plot = plotRef.value
  const count = buckets.value.length
  if (!plot || !hasData.value) return
  const rect = plot.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const index =
    props.variant === 'area' ? Math.round(ratio * (count - 1)) : Math.floor(ratio * count)
  hoverIndex.value = Math.min(count - 1, Math.max(0, index))
}
</script>

<style scoped>
.sparkline-plot {
  @apply relative h-14 w-full;
}

.sparkline-svg {
  @apply block h-full w-full overflow-visible;
  animation: sparkline-draw 1.1s var(--ease-out) 0.25s backwards;
}

/* 用裁剪区域从左向右展开，折线和面积一起“画”出来 */
@keyframes sparkline-draw {
  from {
    clip-path: inset(-10% 100% -10% 0);
  }
  to {
    clip-path: inset(-10% -2% -10% 0);
  }
}

.sparkline-line {
  fill: none;
  stroke: var(--viz-accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 面积只是一层淡淡的色晕，不做成饱和色块 */
.sparkline-wash-top {
  stop-color: var(--viz-accent);
  stop-opacity: 0.2;
}

.sparkline-wash-bottom {
  stop-color: var(--viz-accent);
  stop-opacity: 0;
}

.sparkline-dot {
  @apply pointer-events-none absolute h-2 w-2 rounded-full;
  background-color: var(--viz-accent);
  /* 2px 的底色描边，让圆点压在线上时仍然清晰 */
  box-shadow: 0 0 0 2px var(--glass-popover);
  transform: translate(-50%, -50%);
  /* 等折线画到终点再出现 */
  animation: sparkline-dot-in 0.5s var(--ease-spring) 1.15s backwards;
}

@keyframes sparkline-dot-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2);
  }
}

.sparkline-bars {
  animation: sparkline-rise 0.9s var(--ease-spring) 0.25s backwards;
  @apply grid h-full w-full items-end;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 2px;
}

/* 往期用弱化色，当前（或悬停）一根用强调色；数据端圆角，基线端保持方角 */
.sparkline-bar {
  @apply w-full justify-self-center;
  max-width: 24px;
  border-radius: 4px 4px 0 0;
  background-color: var(--viz-accent-soft);
  transition: background-color 0.15s ease;
}

.sparkline-bar-current {
  background-color: var(--viz-accent);
}

.sparkline-bar-empty {
  border-radius: 1px;
}

@keyframes sparkline-rise {
  from {
    clip-path: inset(100% 0 0 0);
  }
  to {
    clip-path: inset(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sparkline-svg,
  .sparkline-bars,
  .sparkline-dot {
    animation: none;
  }
}

.sparkline-empty {
  @apply absolute inset-x-0 bottom-0 h-px;
  background-color: var(--glass-field-border);
}

.sparkline-tooltip {
  @apply pointer-events-none absolute bottom-full z-10 mb-1 flex -translate-x-1/2 items-baseline gap-2 whitespace-nowrap rounded-lg px-2 py-1 text-xs shadow-glass-sm;
  @apply backdrop-blur-xl;
  background-color: var(--glass-popover);
}

.sparkline-tooltip-label {
  @apply text-gray-500 dark:text-gray-400;
}

.sparkline-tooltip-value {
  @apply font-semibold text-gray-900 dark:text-white;
}

.sparkline-axis {
  @apply mt-1.5 flex justify-between text-[11px] text-gray-400 dark:text-gray-500;
}
</style>
