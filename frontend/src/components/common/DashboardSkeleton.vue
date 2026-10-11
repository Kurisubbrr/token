<template>
  <!-- 仪表盘加载占位：形状与真实内容一致（指标卡 + 图表），数据到了原地换成内容，不会整页跳动 -->
  <div class="space-y-5" role="status" :aria-label="t('common.loading')">
    <span class="sr-only">{{ t('common.loading') }}</span>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="i in cards" :key="i" class="card p-5">
        <div class="flex items-start justify-between">
          <div class="skeleton h-4 w-20"></div>
          <div class="skeleton h-9 w-9 rounded-xl"></div>
        </div>
        <div class="skeleton mt-4 h-8 w-28"></div>
        <div class="skeleton mt-3 h-3 w-36"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div class="card p-5 lg:col-span-2">
        <div class="skeleton h-5 w-32"></div>
        <div class="skeleton mt-5 h-64 w-full rounded-xl"></div>
      </div>
      <div class="card p-5">
        <div class="skeleton h-5 w-24"></div>
        <div class="skeleton mx-auto mt-6 h-40 w-40 rounded-full"></div>
        <div class="skeleton mt-6 h-3 w-full"></div>
        <div class="skeleton mt-3 h-3 w-2/3"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{ cards?: number }>(), { cards: 4 })

const { t } = useI18n()
</script>
