/**
 * v-card-spotlight：挂在内容区上，指针经过哪张 .card，就把指针位置写进那张卡片的
 * --mx / --my，并把 --card-spot 置 1（样式见 style.css 的 .card）。
 * 用事件委托而不是给每张卡片挂监听：卡片随数据增减，页面里也到处都是。
 */
import type { Directive } from 'vue'
import { canHover, prefersReducedMotion } from '@/components/landing/motion'

interface SpotlightState {
  move: (event: PointerEvent) => void
  leave: () => void
  card: HTMLElement | null
  frame: number
}

const states = new WeakMap<HTMLElement, SpotlightState>()

export const vCardSpotlight: Directive<HTMLElement> = {
  mounted(el) {
    if (!canHover() || prefersReducedMotion()) return
    const state: SpotlightState = {
      card: null,
      frame: 0,
      move(event) {
        if (state.frame) return
        // 合并到下一帧再写样式，指针移动事件远比刷新率密
        state.frame = requestAnimationFrame(() => {
          state.frame = 0
          const target = event.target instanceof Element ? event.target : null
          const card = target?.closest<HTMLElement>('.card') ?? null
          if (card !== state.card) {
            state.card?.style.setProperty('--card-spot', '0')
            state.card = card
          }
          if (!card) return
          const rect = card.getBoundingClientRect()
          card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
          card.style.setProperty('--my', `${event.clientY - rect.top}px`)
          card.style.setProperty('--card-spot', '1')
        })
      },
      leave() {
        state.card?.style.setProperty('--card-spot', '0')
        state.card = null
      }
    }
    states.set(el, state)
    el.addEventListener('pointermove', state.move, { passive: true })
    el.addEventListener('pointerleave', state.leave)
  },
  unmounted(el) {
    const state = states.get(el)
    if (!state) return
    cancelAnimationFrame(state.frame)
    el.removeEventListener('pointermove', state.move)
    el.removeEventListener('pointerleave', state.leave)
    states.delete(el)
  }
}
