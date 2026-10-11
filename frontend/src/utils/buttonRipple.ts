/**
 * 按钮按下时，从指针落点荡开一圈涟漪。
 * 全站只在 document 上挂一个监听，之后才出现的按钮（弹窗、列表里的）自动生效。
 */
const SELECTOR = '.btn, .lp-btn'

export function installButtonRipple(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return () => {}

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    const button = event.target.closest<HTMLElement>(SELECTOR)
    if (!button || button.matches(':disabled, [aria-disabled="true"]')) return

    const rect = button.getBoundingClientRect()
    // 圆要大到从任意落点都能盖住整个按钮
    const size = Math.hypot(rect.width, rect.height) * 2

    // 外层负责按按钮的形状裁切，这样按钮自身不必 overflow: hidden（角标、焦点环不会被裁掉）
    const host = document.createElement('span')
    host.className = 'btn-ripple'
    host.setAttribute('aria-hidden', 'true')
    const wave = document.createElement('span')
    wave.style.width = wave.style.height = `${size}px`
    wave.style.left = `${event.clientX - rect.left - size / 2}px`
    wave.style.top = `${event.clientY - rect.top - size / 2}px`
    host.appendChild(wave)

    if (getComputedStyle(button).position === 'static') button.style.position = 'relative'
    button.appendChild(host)

    const remove = () => host.remove()
    wave.addEventListener('animationend', remove, { once: true })
    window.setTimeout(remove, 900)
  }

  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  return () => document.removeEventListener('pointerdown', onPointerDown)
}
