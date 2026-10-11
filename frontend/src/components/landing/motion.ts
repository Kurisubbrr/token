/**
 * 首页动效的公共部件：滚动显现、指针光晕、磁吸按钮，以及“是否在视口内”的状态。
 * 全部在不支持 IntersectionObserver 或用户开启“减少动态效果”时退化为静态呈现。
 */
import { onBeforeUnmount, onMounted, ref, type Directive, type Ref } from 'vue'

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)')?.matches === true
  )
}

/** 指针是否支持悬停（排除触屏），用于决定要不要挂跟随指针的效果 */
export function canHover(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)')?.matches === true
  )
}

const hasObserver = () => typeof IntersectionObserver !== 'undefined'

// ---------------------------------------------------------------------------
// v-reveal：元素滚入视口时淡入上浮一次。绑定值是延迟毫秒数，用来做错峰。
// ---------------------------------------------------------------------------

let revealObserver: IntersectionObserver | null = null

function getRevealObserver(): IntersectionObserver {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          revealObserver?.unobserve(entry.target)
        }
      },
      // 元素露出一小截、且离开视口底边一点距离后再触发，避免贴着底边闪现
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    )
  }
  return revealObserver
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    el.classList.add('lp-reveal')
    if (binding.value) el.style.setProperty('--lp-delay', `${binding.value}ms`)
    if (!hasObserver() || prefersReducedMotion()) {
      el.classList.add('is-in')
      return
    }
    getRevealObserver().observe(el)
  },
  unmounted(el) {
    revealObserver?.unobserve(el)
  }
}

// ---------------------------------------------------------------------------
// v-spotlight：挂在卡片网格的容器上，把指针位置写进每张 .lp-card 的 --mx/--my，
// 卡片的描边和底色据此画出跟随指针的光晕（样式见 landing.css）。
// ---------------------------------------------------------------------------

interface SpotlightState {
  move: (event: PointerEvent) => void
  enter: () => void
  leave: () => void
  frame: number
}

const spotlightStates = new WeakMap<HTMLElement, SpotlightState>()

export const vSpotlight: Directive<HTMLElement> = {
  mounted(el) {
    if (!canHover()) return
    const state: SpotlightState = {
      frame: 0,
      move(event) {
        if (state.frame) return
        // 合并到下一帧再写样式，指针移动事件远比刷新率密
        state.frame = requestAnimationFrame(() => {
          state.frame = 0
          el.querySelectorAll<HTMLElement>('.lp-card').forEach((card) => {
            const rect = card.getBoundingClientRect()
            card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
            card.style.setProperty('--my', `${event.clientY - rect.top}px`)
          })
        })
      },
      enter() {
        el.style.setProperty('--spot', '1')
      },
      leave() {
        el.style.setProperty('--spot', '0')
      }
    }
    spotlightStates.set(el, state)
    el.addEventListener('pointermove', state.move)
    el.addEventListener('pointerenter', state.enter)
    el.addEventListener('pointerleave', state.leave)
  },
  unmounted(el) {
    const state = spotlightStates.get(el)
    if (!state) return
    cancelAnimationFrame(state.frame)
    el.removeEventListener('pointermove', state.move)
    el.removeEventListener('pointerenter', state.enter)
    el.removeEventListener('pointerleave', state.leave)
    spotlightStates.delete(el)
  }
}

// ---------------------------------------------------------------------------
// v-magnetic：按钮被指针轻轻“吸”过去，移开后弹回。绑定值是吸附强度（0–1）。
// ---------------------------------------------------------------------------

interface MagneticState {
  move: (event: PointerEvent) => void
  leave: () => void
}

const magneticStates = new WeakMap<HTMLElement, MagneticState>()

export const vMagnetic: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (!canHover() || prefersReducedMotion()) return
    const strength = binding.value ?? 0.28
    const state: MagneticState = {
      move(event) {
        const rect = el.getBoundingClientRect()
        const dx = event.clientX - (rect.left + rect.width / 2)
        const dy = event.clientY - (rect.top + rect.height / 2)
        el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`
      },
      leave() {
        el.style.transform = ''
      }
    }
    magneticStates.set(el, state)
    el.addEventListener('pointermove', state.move)
    el.addEventListener('pointerleave', state.leave)
  },
  unmounted(el) {
    const state = magneticStates.get(el)
    if (!state) return
    el.removeEventListener('pointermove', state.move)
    el.removeEventListener('pointerleave', state.leave)
    magneticStates.delete(el)
  }
}

// ---------------------------------------------------------------------------
// v-parallax：把指针在元素内的相对位置写成 --px / --py（范围 -1..1）。
// 卡片里带 .fx-layer 的图层据此做不同幅度的位移，形成前后景的纵深。
// ---------------------------------------------------------------------------

interface ParallaxState {
  move: (event: PointerEvent) => void
  leave: () => void
  frame: number
}

const parallaxStates = new WeakMap<HTMLElement, ParallaxState>()

export const vParallax: Directive<HTMLElement> = {
  mounted(el) {
    if (!canHover() || prefersReducedMotion()) return
    const state: ParallaxState = {
      frame: 0,
      move(event) {
        if (state.frame) return
        state.frame = requestAnimationFrame(() => {
          state.frame = 0
          const rect = el.getBoundingClientRect()
          const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2
          const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2
          el.style.setProperty('--px', px.toFixed(3))
          el.style.setProperty('--py', py.toFixed(3))
        })
      },
      leave() {
        el.style.setProperty('--px', '0')
        el.style.setProperty('--py', '0')
      }
    }
    parallaxStates.set(el, state)
    el.addEventListener('pointermove', state.move)
    el.addEventListener('pointerleave', state.leave)
  },
  unmounted(el) {
    const state = parallaxStates.get(el)
    if (!state) return
    cancelAnimationFrame(state.frame)
    el.removeEventListener('pointermove', state.move)
    el.removeEventListener('pointerleave', state.leave)
    parallaxStates.delete(el)
  }
}

// ---------------------------------------------------------------------------
// useInView：元素是否在视口内。循环播放的演示据此暂停，离屏时不空转。
// ---------------------------------------------------------------------------

export function useInView(target: Ref<HTMLElement | null>, rootMargin = '0px'): Ref<boolean> {
  // 没有 IntersectionObserver 的环境里保持 false：演示停在初始画面，而不是在后台空转计时器
  const inView = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!hasObserver() || !target.value) return
    observer = new IntersectionObserver(
      ([entry]) => {
        inView.value = entry.isIntersecting
      },
      { rootMargin, threshold: 0.15 }
    )
    observer.observe(target.value)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return inView
}
