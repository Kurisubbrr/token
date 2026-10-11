/**
 * 侧栏当前项的底块：一枚会滑动的指示块（样式见 style.css 的 .sidebar-indicator）。
 * 换页时它从上一项滑到新的当前项，而不是旧的消失、新的出现。
 */
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

// 每个页面都会重新挂载侧栏，所以把指示块上一次的位置留在模块里：
// 新侧栏先原地出现在旧位置，再滑向新的当前项
let lastBox: Box | null = null

export function useSidebarIndicator(
  nav: Ref<HTMLElement | null>,
  indicator: Ref<HTMLElement | null>,
  /** 会改变当前项或其位置的响应式状态（路由、折叠、分组展开等） */
  deps: () => unknown
) {
  let mutationObserver: MutationObserver | null = null
  let resizeObserver: ResizeObserver | null = null
  let frame = 0

  /** 当前项在导航内容里的位置。用 offset* 而不是 getBoundingClientRect：不受滚动和按下时的缩放影响 */
  function measure(): Box | null {
    const navEl = nav.value
    const active = navEl?.querySelector<HTMLElement>('.sidebar-link-active')
    if (!navEl || !active || !active.offsetWidth || !active.offsetHeight) return null
    let x = 0
    let y = 0
    let node: HTMLElement | null = active
    while (node && node !== navEl) {
      x += node.offsetLeft
      y += node.offsetTop
      node = node.offsetParent as HTMLElement | null
    }
    if (node !== navEl) return null
    return { x, y, w: active.offsetWidth, h: active.offsetHeight }
  }

  function place(box: Box) {
    const el = indicator.value
    if (!el) return
    el.style.width = `${box.w}px`
    el.style.height = `${box.h}px`
    el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`
  }

  /** instant：直接就位，不做过渡（跟随侧栏折叠时的宽度变化用） */
  function sync(instant = false) {
    const navEl = nav.value
    const el = indicator.value
    if (!navEl || !el) return
    const box = measure()
    if (!box) {
      // 没有当前项（或量不到尺寸）：交还给链接自己的底色
      navEl.classList.remove('has-indicator')
      el.classList.remove('is-ready')
      lastBox = null
      return
    }

    const from = el.classList.contains('is-ready') ? null : lastBox
    if (instant || !el.classList.contains('is-ready')) {
      // 第一次出现：先无过渡地落在上一页的位置（没有就直接落在目标位置）
      el.classList.add('is-instant')
      place(instant ? box : (from ?? box))
      el.classList.add('is-ready')
      navEl.classList.add('has-indicator')
      void el.offsetWidth
      el.classList.remove('is-instant')
    }
    place(box)
    lastBox = box
  }

  function schedule(instant = false) {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => sync(instant))
  }

  onMounted(() => {
    sync()
    const navEl = nav.value
    if (!navEl) return
    // 菜单项是异步补齐的（功能开关、自定义菜单），增减之后当前项会移位
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => schedule())
      mutationObserver.observe(navEl, { childList: true, subtree: true })
    }
    // 侧栏折叠 / 展开是一段宽度过渡，过程中让指示块逐帧贴着当前项
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => schedule(true))
      resizeObserver.observe(navEl)
    }
  })

  watch(deps, () => void nextTick(() => sync()), { flush: 'post' })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    mutationObserver?.disconnect()
    resizeObserver?.disconnect()
  })
}
