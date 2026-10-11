/** 命令面板（⌘K）的开关状态：顶栏的搜索按钮、面板本身和全局快捷键共用 */
import { ref } from 'vue'

export interface CommandItem {
  id: string
  label: string
  /** 右侧的补充说明，例如所属的菜单分组 */
  hint?: string
  group: string
  icon: unknown
  /** 额外参与匹配的文字（路径等） */
  keywords?: string
  run: () => void
}

const open = ref(false)

export function useCommandPalette() {
  return {
    open,
    show: () => {
      open.value = true
    },
    hide: () => {
      open.value = false
    },
    toggle: () => {
      open.value = !open.value
    }
  }
}

/** 快捷键提示：苹果设备显示 ⌘K，其余显示 Ctrl K */
export function commandPaletteShortcut(): string {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K'
}
