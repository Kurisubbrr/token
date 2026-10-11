import { describe, expect, it } from 'vitest'
import { registerShellPage, useAppShellHost } from '../appShell'

const parts = { sidebar: { name: 'Sidebar' }, header: { name: 'Header' } }

describe('app shell host', () => {
  it('shows the shell while at least one page is registered', () => {
    const { active } = useAppShellHost()
    expect(active.value).toBe(false)

    const releaseFirst = registerShellPage(parts)
    expect(active.value).toBe(true)

    // 换页：新页面先登记、旧页面后注销（或反过来），外壳都不该中断
    const releaseSecond = registerShellPage(parts)
    releaseFirst()
    expect(active.value).toBe(true)

    releaseSecond()
    expect(active.value).toBe(false)
  })

  it('ignores a repeated release', () => {
    const { active } = useAppShellHost()
    const release = registerShellPage(parts)
    const other = registerShellPage(parts)

    release()
    release()
    expect(active.value).toBe(true)

    other()
    expect(active.value).toBe(false)
  })
})
