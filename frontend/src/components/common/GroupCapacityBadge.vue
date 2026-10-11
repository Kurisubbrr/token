<template>
  <div class="flex flex-col gap-1">
    <!-- 并发槽位 -->
    <div class="flex items-center gap-1">
      <span
        :class="[
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
          capacityClass(concurrencyUsed, concurrencyMax)
        ]"
      >
        <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2zM15 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2zM6 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2zM15 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2z" />
        </svg>
        <span class="font-mono">{{ concurrencyUsed }}</span>
        <span class="text-gray-400 dark:text-gray-500">/</span>
        <span class="font-mono">{{ concurrencyMax }}</span>
      </span>
    </div>

    <!-- 会话数 -->
    <div v-if="sessionsMax > 0" class="flex items-center gap-1">
      <span
        :class="[
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
          capacityClass(sessionsUsed, sessionsMax)
        ]"
      >
        <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.8 8.5a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0zM3 19.5a6 6 0 0 1 12 0M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2a6 6 0 0 1 3.5 5.3" />
        </svg>
        <span class="font-mono">{{ sessionsUsed }}</span>
        <span class="text-gray-400 dark:text-gray-500">/</span>
        <span class="font-mono">{{ sessionsMax }}</span>
      </span>
    </div>

    <!-- RPM -->
    <div v-if="rpmMax > 0" class="flex items-center gap-1">
      <span
        :class="[
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
          capacityClass(rpmUsed, rpmMax)
        ]"
      >
        <svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0zM12 7.5V12l3 2" />
        </svg>
        <span class="font-mono">{{ rpmUsed }}</span>
        <span class="text-gray-400 dark:text-gray-500">/</span>
        <span class="font-mono">{{ rpmMax }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  concurrencyUsed: number
  concurrencyMax: number
  sessionsUsed: number
  sessionsMax: number
  rpmUsed: number
  rpmMax: number
}

withDefaults(defineProps<Props>(), {
  concurrencyUsed: 0,
  concurrencyMax: 0,
  sessionsUsed: 0,
  sessionsMax: 0,
  rpmUsed: 0,
  rpmMax: 0
})

function capacityClass(used: number, max: number): string {
  if (max > 0 && used >= max) {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (used > 0) {
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}
</script>
