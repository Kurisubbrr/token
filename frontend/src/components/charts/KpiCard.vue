<template>
  <div v-parallax class="card kpi-card">
    <div class="flex items-start justify-between gap-3">
      <p class="kpi-title">{{ title }}</p>
      <span v-if="$slots.icon" class="icon-tile" aria-hidden="true">
        <slot name="icon" />
      </span>
    </div>

    <div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <p class="kpi-value" :title="String(value)"><RollingNumber :value="shown" /></p>
      <span v-if="unit" class="kpi-unit">{{ unit }}</span>
    </div>

    <div v-if="$slots.caption" class="kpi-caption">
      <slot name="caption" />
    </div>

    <!-- 迷你图 / 占比条等，贴在卡片底部 -->
    <div v-if="$slots.default" class="kpi-viz">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import RollingNumber from '@/components/common/RollingNumber.vue'
import { vParallax } from '@/components/landing/motion'

const props = defineProps<{
  title: string
  value: string | number
  unit?: string
}>()

// 首次出现时先显示全 0，下一帧再换成真实数值，各位数字就会像里程表一样滚到位；
// 之后数据刷新，数字从旧值滚到新值
const shown = ref(String(props.value).replace(/\d/g, '0'))

onMounted(() => {
  requestAnimationFrame(() => {
    shown.value = String(props.value)
  })
})

watch(
  () => props.value,
  (value) => {
    shown.value = String(value)
  }
)
</script>

<style scoped>
.kpi-card {
  @apply flex min-w-0 flex-col p-5;
  animation: kpi-rise 0.7s var(--ease-spring) backwards;
  /* 跟着指针轻微倾斜（--px / --py 由 v-parallax 写入，范围 -1..1）。
     指标卡里没有下拉层，所以可以放心用 transform */
  transform: perspective(900px) rotateX(calc(var(--py, 0) * -3deg)) rotateY(calc(var(--px, 0) * 3deg));
}

/* 同一排的卡片依次浮现 */
.kpi-card:nth-child(2) {
  animation-delay: 60ms;
}

.kpi-card:nth-child(3) {
  animation-delay: 120ms;
}

.kpi-card:nth-child(4) {
  animation-delay: 180ms;
}

@keyframes kpi-rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }
}

@media (prefers-reduced-motion: reduce) {
  .kpi-card {
    animation: none;
  }
}

.kpi-title {
  @apply pt-1.5 text-sm font-medium text-gray-600 dark:text-gray-300;
}

/* 大数字用比例数字，不加 tabular-nums：等宽数字在大字号下会显得松散 */
.kpi-value {
  @apply truncate text-3xl font-semibold tracking-tight text-gray-900 dark:text-white;
  line-height: 1.15;
}

.kpi-unit {
  @apply text-sm font-medium text-gray-500 dark:text-gray-400;
}

.kpi-caption {
  @apply mt-1.5 text-xs text-gray-500 dark:text-gray-400;
}

.kpi-viz {
  @apply mt-auto pt-4;
}
</style>
