/**
 * 常驻外壳：侧栏和顶栏由 App.vue 渲染一次，换页时不再跟着页面重新挂载。
 *
 * 各页面仍然用 <AppLayout> 包住内容，但在外壳托管下它只渲染内容区；
 * 页面挂载时到这里登记，App.vue 据此决定要不要显示外壳（首页、登录页等不登记，也就没有外壳）。
 * 侧栏和顶栏组件由 AppLayout 在登记时带过来，这样它们不会被打进首页的入口包。
 */
import { computed, markRaw, ref, shallowRef, type Component, type InjectionKey } from 'vue'

export interface AppShellParts {
  sidebar: Component
  header: Component
}

/** App.vue 提供这个标记，表示外壳由它托管；没有它（如单独挂载某个页面）时 AppLayout 自己渲染整套布局 */
export const APP_SHELL_KEY: InjectionKey<boolean> = Symbol('app-shell')

const pages = ref(0)
const parts = shallowRef<AppShellParts | null>(null)

/** 页面登记自己需要外壳，返回注销函数 */
export function registerShellPage(shellParts: AppShellParts): () => void {
  if (!parts.value) parts.value = markRaw(shellParts)
  pages.value += 1
  let released = false
  return () => {
    if (released) return
    released = true
    pages.value -= 1
  }
}

export function useAppShellHost() {
  return {
    /** 当前页面是否需要外壳。换页时旧页面注销、新页面登记发生在同一轮更新里，外壳不会闪断 */
    active: computed(() => pages.value > 0 && parts.value !== null),
    parts
  }
}
