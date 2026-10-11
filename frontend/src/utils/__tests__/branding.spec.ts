import { beforeEach, describe, expect, it } from 'vitest'
import { customSiteSubtitle, updateFavicon } from '@/utils/branding'

describe('updateFavicon', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" href="/logo.svg">'
  })

  it('replaces the default favicon with the configured logo', () => {
    updateFavicon('https://example.com/custom-logo.png')

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    expect(link?.href).toBe('https://example.com/custom-logo.png')
  })

  it('ignores unsafe logo URLs', () => {
    updateFavicon('javascript:alert(1)')

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    expect(link?.getAttribute('href')).toBe('/logo.svg')
  })
})

describe('customSiteSubtitle', () => {
  it('treats the stock upstream subtitles as "not customized"', () => {
    expect(customSiteSubtitle('Subscription to API Conversion Platform')).toBe('')
    expect(customSiteSubtitle(' AI API Gateway Platform ')).toBe('')
  })

  it('treats a missing subtitle as "not customized"', () => {
    expect(customSiteSubtitle(undefined)).toBe('')
    expect(customSiteSubtitle(null)).toBe('')
    expect(customSiteSubtitle('   ')).toBe('')
  })

  it('returns the administrator-defined subtitle, trimmed', () => {
    expect(customSiteSubtitle('  我们自己的标语  ')).toBe('我们自己的标语')
  })
})
