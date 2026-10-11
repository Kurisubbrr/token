<template>
  <!-- 外壳托管：侧栏和顶栏由 App.vue 常驻渲染，这里只负责内容区 -->
  <main v-if="hosted" ref="mainRef" v-card-spotlight class="app-main p-4 md:p-6 lg:p-8">
    <slot />
  </main>

  <!-- 独立使用（没有 App.vue 托管）：自己渲染整套布局。背景由 style.css 的 body::before 提供 -->
  <div v-else class="min-h-screen">
    <AppSidebar />

    <div
      class="relative min-h-screen transition-all duration-300"
      :class="[sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64']"
    >
      <AppHeader />

      <main ref="mainRef" v-card-spotlight class="app-main p-4 md:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@/styles/onboarding.css'
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { vCardSpotlight } from './cardSpotlight'
import { APP_SHELL_KEY, registerShellPage } from './appShell'

// 由 App.vue 托管外壳时，向它登记“这个页面需要侧栏和顶栏”
const hosted = inject(APP_SHELL_KEY, false)
if (hosted) {
  onUnmounted(registerShellPage({ sidebar: AppSidebar, header: AppHeader }))
}

const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isAdmin = computed(() => authStore.isAdmin)

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

const mainRef = ref<HTMLElement | null>(null)

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)

  // 入场：给页面挂载时已有的各个区块标上序号，让它们依次浮现（样式见 style.css 的 .app-section-enter）
  const root = mainRef.value?.firstElementChild
  const sections = root?.children.length ? Array.from(root.children) : root ? [root] : []
  sections.slice(0, 8).forEach((section, index) => {
    section.classList.add('app-section-enter')
    ;(section as HTMLElement).style.setProperty('--i', String(index))
  })
})

defineExpose({ replayTour })
</script>
