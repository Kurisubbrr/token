<template>
  <svg
    :class="sizeClass"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    :stroke-width="strokeWidth"
  >
    <!-- 淡色填充层：与线条同色，给图标一点体积感 -->
    <path v-if="icon.f" class="icon-tint" :d="icon.f" fill="currentColor" stroke="none" />
    <path stroke-linecap="round" stroke-linejoin="round" :d="icon.s" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { icons, type IconName, type IconShape } from './iconSet'

const props = withDefaults(defineProps<{
  name: IconName
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  strokeWidth?: number
}>(), {
  size: 'md',
  strokeWidth: 1.5
})

// 名称来自接口或配置时可能不在图标集里：画空，而不是让整个组件报错
const EMPTY: IconShape = { s: '' }

const icon = computed<IconShape>(() => icons[props.name] ?? EMPTY)

const sizeClass = computed(() => ({
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8'
}[props.size]))
</script>

<style scoped>
.icon-tint {
  opacity: 0.14;
}
</style>
